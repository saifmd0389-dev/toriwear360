import { GoogleGenAI } from '@google/genai';
import {
  IImageGenerationProvider,
  ImageGenerationOptions,
  ImageGenerationResult,
  ImageProviderHealth,
  ImageProviderType,
} from './types';

export class GeminiImageProvider implements IImageGenerationProvider {
  readonly providerType: ImageProviderType = 'gemini';
  private client: GoogleGenAI | null = null;
  private apiKey: string | null = null;
  private modelName: string;

  constructor() {
    this.apiKey = process.env.AI_IMAGE_API_KEY || process.env.GEMINI_API_KEY || null;
    this.modelName = process.env.AI_IMAGE_MODEL || 'gemini-3.1-flash-image';

    if (this.apiKey && this.apiKey.trim() !== '' && this.apiKey !== 'MY_GEMINI_API_KEY') {
      this.client = new GoogleGenAI({
        apiKey: this.apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }

  isConfigured(): boolean {
    return Boolean(this.client && this.apiKey && this.apiKey.trim().length > 0);
  }

  async getHealth(): Promise<ImageProviderHealth> {
    const isEnabled = (process.env.AI_IMAGE_ENABLED || 'false').toLowerCase() === 'true';

    if (!isEnabled) {
      return {
        enabled: false,
        provider: 'gemini',
        configured: this.isConfigured(),
        model: this.modelName,
        status: 'disabled',
        message: 'Image generation feature flag (AI_IMAGE_ENABLED) is currently set to false.',
      };
    }

    if (!this.isConfigured()) {
      return {
        enabled: true,
        provider: 'gemini',
        configured: false,
        model: this.modelName,
        status: 'not_configured',
        message: 'Google Gemini API key is not configured for image generation.',
      };
    }

    return {
      enabled: true,
      provider: 'gemini',
      configured: true,
      model: this.modelName,
      status: 'ready',
      message: 'Gemini image provider is configured and ready.',
    };
  }

  async generateImage(
    prompt: string,
    options?: ImageGenerationOptions
  ): Promise<ImageGenerationResult> {
    if (!this.client || !this.isConfigured()) {
      throw new Error(
        'Gemini image generation is not configured. Set AI_IMAGE_API_KEY or GEMINI_API_KEY in the server environment.'
      );
    }

    const startTime = Date.now();
    const config: any = {
      responseModalities: ['IMAGE'],
    };

    if (options?.aspectRatio || options?.imageSize) {
      config.imageConfig = {};
      if (options.aspectRatio) config.imageConfig.aspectRatio = options.aspectRatio;
      if (options.imageSize) config.imageConfig.imageSize = options.imageSize;
    }

    let response: any;
    try {
      response = await this.client.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config,
      });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota exceeded') || errMsg.includes('429')) {
        throw new Error(
          'Gemini Quota Exceeded (429): Quota limit reached or paid tier project required for gemini-3.1-flash-image.'
        );
      }
      throw new Error(`Gemini Image Generation Error: ${errMsg}`);
    }

    let base64Data: string | null = null;
    let mimeType = 'image/png';

    if (response?.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          base64Data = part.inlineData.data;
          if (part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          break;
        }
      }
    }

    if (!base64Data) {
      throw new Error('Gemini image generation model did not return image data.');
    }

    return {
      data: base64Data,
      mimeType,
      durationMs: Date.now() - startTime,
      model: this.modelName,
      provider: 'gemini',
    };
  }
}
