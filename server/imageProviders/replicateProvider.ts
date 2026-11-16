import {
  IImageGenerationProvider,
  ImageGenerationOptions,
  ImageGenerationResult,
  ImageProviderHealth,
  ImageProviderType,
} from './types';

export class ReplicateImageProvider implements IImageGenerationProvider {
  readonly providerType: ImageProviderType = 'replicate';
  private apiKey: string | null = null;
  private modelName: string;

  constructor() {
    this.apiKey = process.env.AI_IMAGE_API_KEY || null;
    this.modelName =
      process.env.AI_IMAGE_MODEL || 'black-forest-labs/flux-schnell';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async getHealth(): Promise<ImageProviderHealth> {
    const isEnabled = (process.env.AI_IMAGE_ENABLED || 'false').toLowerCase() === 'true';

    if (!isEnabled) {
      return {
        enabled: false,
        provider: 'replicate',
        configured: this.isConfigured(),
        model: this.modelName,
        status: 'disabled',
        message: 'Image generation feature flag (AI_IMAGE_ENABLED) is currently set to false.',
      };
    }

    if (!this.isConfigured()) {
      return {
        enabled: true,
        provider: 'replicate',
        configured: false,
        model: this.modelName,
        status: 'not_configured',
        message: 'Replicate API token is not configured (set AI_IMAGE_API_KEY).',
      };
    }

    return {
      enabled: true,
      provider: 'replicate',
      configured: true,
      model: this.modelName,
      status: 'ready',
      message: `Replicate provider ready with model ${this.modelName}.`,
    };
  }

  async generateImage(
    prompt: string,
    options?: ImageGenerationOptions
  ): Promise<ImageGenerationResult> {
    if (!this.isConfigured() || !this.apiKey) {
      throw new Error(
        'Replicate image generation is not configured. Set AI_IMAGE_API_KEY in server environment variables.'
      );
    }

    const startTime = Date.now();
    // Use official Replicate prediction endpoint
    const response = await fetch(`https://api.replicate.com/v1/models/${this.modelName}/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: options?.aspectRatio || '1:1',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `Replicate API HTTP ${response.status}`;
      try {
        const json = JSON.parse(errorText);
        if (json.detail) errorMsg = json.detail;
      } catch {
        if (errorText) errorMsg += `: ${errorText.slice(0, 200)}`;
      }
      throw new Error(`Replicate Error: ${errorMsg}`);
    }

    const prediction = (await response.json()) as any;
    let outputUrl: string | null = null;

    if (Array.isArray(prediction.output) && prediction.output.length > 0) {
      outputUrl = prediction.output[0];
    } else if (typeof prediction.output === 'string') {
      outputUrl = prediction.output;
    }

    if (!outputUrl) {
      throw new Error('Replicate did not return an image URL in prediction output.');
    }

    // Fetch generated image data and encode to base64
    const imgRes = await fetch(outputUrl);
    if (!imgRes.ok) {
      throw new Error(`Failed to fetch generated image from Replicate: HTTP ${imgRes.status}`);
    }

    const arrayBuffer = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    const mimeType = imgRes.headers.get('content-type') || 'image/webp';

    return {
      data: base64Data,
      mimeType,
      durationMs: Date.now() - startTime,
      model: this.modelName,
      provider: 'replicate',
    };
  }
}
