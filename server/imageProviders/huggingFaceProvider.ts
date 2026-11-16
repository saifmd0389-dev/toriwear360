import {
  IImageGenerationProvider,
  ImageGenerationOptions,
  ImageGenerationResult,
  ImageProviderHealth,
  ImageProviderType,
} from './types';

export class HuggingFaceImageProvider implements IImageGenerationProvider {
  readonly providerType: ImageProviderType = 'huggingface';
  private apiKey: string | null = null;
  private modelName: string;

  constructor() {
    this.apiKey = process.env.AI_IMAGE_API_KEY || null;
    this.modelName =
      process.env.AI_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async getHealth(): Promise<ImageProviderHealth> {
    const isEnabled = (process.env.AI_IMAGE_ENABLED || 'false').toLowerCase() === 'true';

    if (!isEnabled) {
      return {
        enabled: false,
        provider: 'huggingface',
        configured: this.isConfigured(),
        model: this.modelName,
        status: 'disabled',
        message: 'Image generation feature flag (AI_IMAGE_ENABLED) is currently set to false.',
      };
    }

    if (!this.isConfigured()) {
      return {
        enabled: true,
        provider: 'huggingface',
        configured: false,
        model: this.modelName,
        status: 'not_configured',
        message: 'Hugging Face API token is not configured (set AI_IMAGE_API_KEY).',
      };
    }

    return {
      enabled: true,
      provider: 'huggingface',
      configured: true,
      model: this.modelName,
      status: 'ready',
      message: `Hugging Face provider ready with model ${this.modelName}.`,
    };
  }

  async generateImage(
    prompt: string,
    _options?: ImageGenerationOptions
  ): Promise<ImageGenerationResult> {
    if (!this.isConfigured() || !this.apiKey) {
      throw new Error(
        'Hugging Face image generation is not configured. Set AI_IMAGE_API_KEY in server environment variables.'
      );
    }

    const startTime = Date.now();
    // Try router first, fallback to standard api-inference endpoint
    const url = `https://router.huggingface.co/hf-inference/models/${this.modelName}`;

    let response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          guidance_scale: 7.5,
          num_inference_steps: 25,
        },
      }),
    });

    // Fallback if router fails or returns 404
    if (!response.ok && response.status === 404) {
      const fallbackUrl = `https://api-inference.huggingface.co/models/${this.modelName}`;
      response = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: prompt }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `Hugging Face API returned HTTP ${response.status}`;
      try {
        const json = JSON.parse(errorText);
        if (json.error) errorMsg = json.error;
      } catch {
        if (errorText) errorMsg += `: ${errorText.slice(0, 200)}`;
      }
      throw new Error(`Hugging Face Error: ${errorMsg}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';

    return {
      data: base64Data,
      mimeType,
      durationMs: Date.now() - startTime,
      model: this.modelName,
      provider: 'huggingface',
    };
  }
}
