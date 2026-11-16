import {
  IImageGenerationProvider,
  ImageGenerationOptions,
  ImageGenerationResult,
  ImageProviderHealth,
  ImageProviderType,
} from './types';

export class FutureImageProvider implements IImageGenerationProvider {
  readonly providerType: ImageProviderType = 'future_provider';
  private apiKey: string | null = null;
  private endpointUrl: string | null = null;
  private modelName: string;

  constructor() {
    this.apiKey = process.env.AI_IMAGE_API_KEY || null;
    this.endpointUrl = process.env.AI_IMAGE_ENDPOINT || null;
    this.modelName = process.env.AI_IMAGE_MODEL || 'custom-model';
  }

  isConfigured(): boolean {
    return Boolean(this.endpointUrl || (this.apiKey && this.apiKey.trim().length > 0));
  }

  async getHealth(): Promise<ImageProviderHealth> {
    const isEnabled = (process.env.AI_IMAGE_ENABLED || 'false').toLowerCase() === 'true';

    if (!isEnabled) {
      return {
        enabled: false,
        provider: 'future_provider',
        configured: this.isConfigured(),
        model: this.modelName,
        status: 'disabled',
        message: 'Image generation feature flag (AI_IMAGE_ENABLED) is currently set to false.',
      };
    }

    if (!this.isConfigured()) {
      return {
        enabled: true,
        provider: 'future_provider',
        configured: false,
        model: this.modelName,
        status: 'not_configured',
        message: 'Custom/Future provider endpoint or key is not configured.',
      };
    }

    return {
      enabled: true,
      provider: 'future_provider',
      configured: true,
      model: this.modelName,
      status: 'ready',
      message: `Future provider ready with model ${this.modelName}.`,
    };
  }

  async generateImage(
    prompt: string,
    options?: ImageGenerationOptions
  ): Promise<ImageGenerationResult> {
    if (!this.isConfigured() || !this.endpointUrl) {
      throw new Error(
        'Future provider is not configured. Set AI_IMAGE_ENDPOINT and AI_IMAGE_API_KEY in server environment.'
      );
    }

    const startTime = Date.now();
    const response = await fetch(this.endpointUrl, {
      method: 'POST',
      headers: {
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, ...options }),
    });

    if (!response.ok) {
      throw new Error(`Custom image provider HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = (await response.json()) as any;
      if (json.image_base64) {
        return {
          data: json.image_base64,
          mimeType: json.mime_type || 'image/png',
          durationMs: Date.now() - startTime,
          model: this.modelName,
          provider: 'future_provider',
        };
      }
      throw new Error('Custom image provider did not return image_base64 field.');
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return {
      data: base64,
      mimeType: contentType || 'image/png',
      durationMs: Date.now() - startTime,
      model: this.modelName,
      provider: 'future_provider',
    };
  }
}
