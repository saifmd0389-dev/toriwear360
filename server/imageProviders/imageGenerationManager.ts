import {
  IImageGenerationProvider,
  ImageGenerationOptions,
  ImageGenerationResult,
  ImageProviderHealth,
  ImageProviderType,
} from './types';
import { NoneImageProvider } from './noneProvider';
import { GeminiImageProvider } from './geminiProvider';
import { HuggingFaceImageProvider } from './huggingFaceProvider';
import { ReplicateImageProvider } from './replicateProvider';
import { FutureImageProvider } from './futureProvider';

export class ImageGenerationManager {
  private static instance: ImageGenerationManager | null = null;

  public static getInstance(): ImageGenerationManager {
    if (!ImageGenerationManager.instance) {
      ImageGenerationManager.instance = new ImageGenerationManager();
    }
    return ImageGenerationManager.instance;
  }

  /**
   * Resets the singleton instance (used when environment variables change or for testing)
   */
  public static resetInstance(): void {
    ImageGenerationManager.instance = null;
  }

  public isImageEnabled(): boolean {
    const raw = (process.env.AI_IMAGE_ENABLED || 'false').trim().toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes';
  }

  public getProviderType(): ImageProviderType {
    const raw = (process.env.AI_IMAGE_PROVIDER || 'none').trim().toLowerCase();
    switch (raw) {
      case 'gemini':
        return 'gemini';
      case 'huggingface':
      case 'hf':
        return 'huggingface';
      case 'replicate':
        return 'replicate';
      case 'future_provider':
      case 'future':
      case 'custom':
        return 'future_provider';
      case 'none':
      default:
        return 'none';
    }
  }

  public getProvider(): IImageGenerationProvider {
    // If image generation is disabled via feature flag, always return NoneImageProvider
    if (!this.isImageEnabled()) {
      return new NoneImageProvider();
    }

    const type = this.getProviderType();
    switch (type) {
      case 'gemini':
        return new GeminiImageProvider();
      case 'huggingface':
        return new HuggingFaceImageProvider();
      case 'replicate':
        return new ReplicateImageProvider();
      case 'future_provider':
        return new FutureImageProvider();
      case 'none':
      default:
        return new NoneImageProvider();
    }
  }

  public async getHealth(): Promise<ImageProviderHealth> {
    const isEnabled = this.isImageEnabled();
    const configuredType = this.getProviderType();

    if (!isEnabled || configuredType === 'none') {
      return {
        enabled: false,
        provider: configuredType,
        configured: false,
        model: process.env.AI_IMAGE_MODEL || 'none',
        status: 'disabled',
        message:
          'Image generation is currently unavailable. Your concepts, stories and designs can still be created and saved. Connect an image AI provider when you are ready to generate artwork.',
      };
    }

    const provider = this.getProvider();
    return provider.getHealth();
  }

  public async generateImage(
    prompt: string,
    options?: ImageGenerationOptions
  ): Promise<ImageGenerationResult> {
    if (!this.isImageEnabled()) {
      throw new Error(
        'Image generation is currently disabled. Enable AI_IMAGE_ENABLED=true in server environment to generate artwork.'
      );
    }

    const provider = this.getProvider();
    return provider.generateImage(prompt, options);
  }
}

export const imageManager = ImageGenerationManager.getInstance();
