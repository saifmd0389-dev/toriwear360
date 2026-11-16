export type ImageProviderType =
  | 'none'
  | 'huggingface'
  | 'replicate'
  | 'gemini'
  | 'future_provider';

export interface ImageGenerationOptions {
  aspectRatio?: string;
  imageSize?: string;
  width?: number;
  height?: number;
}

export interface ImageGenerationResult {
  data: string; // base64 encoded image string
  mimeType: string;
  durationMs: number;
  model: string;
  provider: ImageProviderType;
}

export interface ImageProviderConfig {
  enabled: boolean;
  provider: ImageProviderType;
  apiKey?: string;
  model: string;
}

export interface ImageProviderHealth {
  enabled: boolean;
  provider: ImageProviderType;
  configured: boolean;
  model: string;
  status: 'ready' | 'disabled' | 'not_configured' | 'quota_limit' | 'error';
  message?: string;
}

export interface IImageGenerationProvider {
  readonly providerType: ImageProviderType;
  isConfigured(): boolean;
  getHealth(): Promise<ImageProviderHealth>;
  generateImage(prompt: string, options?: ImageGenerationOptions): Promise<ImageGenerationResult>;
}
