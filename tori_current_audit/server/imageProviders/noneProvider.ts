import {
  IImageGenerationProvider,
  ImageGenerationOptions,
  ImageGenerationResult,
  ImageProviderHealth,
  ImageProviderType,
} from './types';

export class NoneImageProvider implements IImageGenerationProvider {
  readonly providerType: ImageProviderType = 'none';

  isConfigured(): boolean {
    return false;
  }

  async getHealth(): Promise<ImageProviderHealth> {
    return {
      enabled: false,
      provider: 'none',
      configured: false,
      model: 'none',
      status: 'disabled',
      message:
        'Image generation is currently unavailable. Your concepts, stories and designs can still be created and saved. Connect an image AI provider when you are ready to generate artwork.',
    };
  }

  async generateImage(
    _prompt: string,
    _options?: ImageGenerationOptions
  ): Promise<ImageGenerationResult> {
    throw new Error(
      'Image generation is currently disabled. Enable AI_IMAGE_ENABLED=true and configure an image provider in server environment variables to generate artwork.'
    );
  }
}
