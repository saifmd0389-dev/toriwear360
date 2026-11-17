import { GoogleGenAI } from '@google/genai';
import { getProviderCredentials } from './services/integrationVault';

export const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';
export const GEMINI_TEXT_MODEL = 'gemini-3.8-flash';

export interface GeminiImageResult {
  data: string;
  mimeType: string;
  durationMs: number;
  model: string;
}

/**
 * Initializes Google GenAI client securely on the server
 */
export async function getGeminiClient(): Promise<GoogleGenAI | null> {
  const vault = await getProviderCredentials('google_ai');
  const envKey = String(process.env.GEMINI_API_KEY || '').trim();
  const apiKey = envKey && envKey !== 'MY_GEMINI_API_KEY' ? envKey : vault.apiKey;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Normalizes raw Gemini API errors into clean, descriptive messages
 */
export function formatGeminiError(err: any): string {
  if (!err) return 'Unknown error occurred while contacting Google Gemini.';
  const message = err.message || String(err);

  try {
    const parsed = typeof err === 'object' && err !== null && err.error ? err : JSON.parse(message);
    if (parsed.error && parsed.error.message) {
      if (parsed.error.code === 429 || parsed.error.status === 'RESOURCE_EXHAUSTED') {
        return 'Gemini Quota Exceeded (429): Quota limit reached or paid tier project required for image generation (gemini-3.1-flash-image). Ensure billing is active on your Google Cloud / AI Studio project.';
      }
      return `Gemini API (${parsed.error.code || 'Error'}): ${parsed.error.message}`;
    }
  } catch {
    // String message
  }

  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('Quota exceeded')) {
    return 'Gemini Quota Exceeded (429): Quota limit reached or paid tier project required for image generation (gemini-3.1-flash-image). Ensure billing is active on your Google Cloud / AI Studio project.';
  }
  if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
    return 'Invalid Gemini API Key: Please verify GEMINI_API_KEY in your AI Studio Secrets or server environment.';
  }
  if (message.includes('not found') || message.includes('unsupported model')) {
    return 'Gemini image model (gemini-3.1-flash-image) is unavailable for this API configuration.';
  }

  return message;
}

/**
 * Server-side Gemini image generation service using official @google/genai SDK
 * Uses model: gemini-3.1-flash-image
 */
export async function generateGeminiImage(
  prompt: string,
  options?: {
    aspectRatio?: string;
    imageSize?: string;
  }
): Promise<GeminiImageResult> {
  const ai = await getGeminiClient();
  if (!ai) {
    throw new Error(
      'Gemini image generation is not configured. Add GEMINI_API_KEY to the server environment (AI Studio Secrets) and test the connection.'
    );
  }

  const startTime = Date.now();
  const model = GEMINI_IMAGE_MODEL;

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
    response = await ai.models.generateContent({
      model,
      contents: prompt,
      config,
    });
  } catch (err: any) {
    throw new Error(formatGeminiError(err));
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

  const durationMs = Date.now() - startTime;

  return {
    data: base64Data,
    mimeType,
    durationMs,
    model,
  };
}
