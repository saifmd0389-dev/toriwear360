import {
  AIDesignConcept,
  AIDepartment,
  OriginalityStatus,
  PrintReadiness,
} from '../types/ai';
import { AdminProduct } from '../types';

export interface GenerateDesignParams {
  prompt: string;
  department: AIDepartment;
  world: string;
  collection?: string;
  character?: string;
  designType: string;
  placement: string;
  mood: string;
  colorDirection: string;
  generationMode: string;
  targetAge?: string;
  numConcepts?: number;
  aspectRatio?: string;
  imageSize?: string;
  characterDetails?: {
    hair?: string;
    eyes?: string;
    outfit?: string;
    silhouette?: string;
    weaponTool?: string;
    symbol?: string;
  };
}

export interface GeminiHealthResponse {
  success?: boolean;
  enabled?: boolean;
  provider: string;
  configured?: boolean;
  status: string;
  textAI?: {
    provider: string;
    model: string;
    configured: boolean;
    status: string;
  };
  imageAI?: {
    enabled: boolean;
    provider: string;
    configured: boolean;
    model: string;
    status: string;
    message?: string;
  };
  connected: boolean;
  apiKeyConfigured: boolean;
  imageModel?: string;
  textModel?: string;
  error?: string;
}

export interface GeminiImageTestResponse {
  success: boolean;
  status?: 'SUCCESS' | 'FAILED';
  image?: {
    data: string;
    mimeType: string;
    url?: string;
  };
  imageUrl?: string;
  model?: string;
  durationMs?: number;
  prompt?: string;
  error?: {
    code?: string;
    message?: string;
  } | string;
}

export interface AIUsageStats {
  totalGenerations: number;
  successfulGenerations: number;
  failedGenerations: number;
  todayGenerations: number;
  averageDurationSeconds: number;
  logs: Array<{
    id: string;
    timestamp: string;
    operation: string;
    modelUsed: string;
    durationMs: number;
    status: 'SUCCESS' | 'FAILED';
    error?: string;
    promptSnippet: string;
  }>;
}

// Known third-party anime/franchise keywords for client-side live preview feedback
const THIRD_PARTY_KEYWORDS = [
  'naruto', 'sasuke', 'goku', 'dragon ball', 'dbz', 'luffy', 'one piece',
  'zoro', 'gojo', 'sukuna', 'jujutsu kaisen', 'jjk', 'tanjiro', 'nezuko',
  'demon slayer', 'kimetsu', 'deku', 'bakugo', 'my hero academia', 'mha',
  'eren', 'levi', 'attack on titan', 'aot', 'bleach', 'ichigo', 'hunter x hunter',
  'killua', 'gon', 'death note', 'light yagami', 'sailor moon', 'pokemon',
  'pikachu', 'charizard', 'evangelion', 'shinji', 'asuka', 'marvel', 'dc',
  'batman', 'superman', 'spiderman', 'avengers', 'disney', 'mickey',
];

/**
 * Checks a creative prompt for third-party IP references and provides a Creative Transformation suggestion
 */
export function checkOriginalityGuard(prompt: string): {
  status: OriginalityStatus;
  notes: string;
  detectedFranchises: string[];
  transformationSuggestion?: string;
} {
  const lower = prompt.toLowerCase();
  const detected = THIRD_PARTY_KEYWORDS.filter((kw) => lower.includes(kw));

  if (detected.length > 0) {
    return {
      status: 'REQUIRES CREATIVE TRANSFORMATION',
      detectedFranchises: detected,
      notes: `Third-party reference detected (${detected.join(', ')}). The TORIWEAR AI Creative Director will extract the underlying mood and archetype, transforming it into a 100% original TORIWEAR character, world, and streetwear composition.`,
      transformationSuggestion: `Transformed into an original TORIWEAR protagonist with unique silhouette, proprietary costume, and distinct universe lore.`,
    };
  }

  return {
    status: 'SAFE FOR ORIGINAL CONCEPT',
    detectedFranchises: [],
    notes: 'Prompt is clear of third-party IP references. Safe for original concept development within the TORIWEAR universe.',
  };
}

/**
 * Evaluates print readiness for apparel graphics
 */
export function evaluatePrintReadiness(
  designType: string,
  placement: string,
  colorCount: number
): { printReadiness: PrintReadiness; notes: string } {
  if (colorCount > 6) {
    return {
      printReadiness: 'NEEDS SIMPLIFICATION',
      notes: 'Color palette exceeds 6 spot colors. Recommend limiting to 4-5 high-contrast colors for optimal DTF or screen-print fidelity.',
    };
  }
  if (placement === 'Small Chest' && (designType === 'Full Streetwear Composition' || designType === 'Manga Panel')) {
    return {
      printReadiness: 'REVIEW',
      notes: 'High micro-detail in a small chest placement risks ink fill-in. Consider simplifying linework or moving to Large Back placement.',
    };
  }
  return {
    printReadiness: 'GOOD',
    notes: 'High contrast, clean silhouette separation, and optimal print-friendly color count suitable for screen printing and premium DTF.',
  };
}

/**
 * Safe fetch utility that inspects Content-Type, prevents HTML parse errors,
 * and extracts normalized JSON responses from the server.
 */
async function safeFetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let token: string | null = null;
  try {
    token = localStorage.getItem('tori_admin_session_token') || sessionStorage.getItem('tori_admin_session_token');
  } catch {}

  const mergedHeaders: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token && !mergedHeaders['Authorization']) {
    mergedHeaders['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: mergedHeaders,
    });
  } catch (networkErr: any) {
    throw new Error(
      `Network error contacting AI server: ${networkErr?.message || 'Connection refused or backend unreachable.'}`
    );
  }

  const contentType = response.headers.get('content-type') || '';
  const status = response.status;

  // Verify response is JSON, NOT HTML
  if (contentType.includes('text/html')) {
    throw new Error('Server returned HTML (temporary warmup or gateway unavailable). Please retry in a few seconds.');
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch (jsonErr: any) {
    throw new Error(`Failed to parse AI server response as JSON: ${jsonErr?.message || 'Invalid JSON format'}`);
  }

  // Handle explicitly failed payloads (success: false)
  if (data && data.success === false) {
    let errorMsg = 'AI service request failed.';
    if (typeof data.error === 'string') {
      errorMsg = data.error;
    } else if (data.error?.message) {
      errorMsg = data.error.message;
    } else if (data.message) {
      errorMsg = data.message;
    }
    throw new Error(errorMsg);
  }

  // Handle non-OK status codes with clear normalized error messages
  if (!response.ok) {
    let errorMsg = 'AI service request failed.';
    if (typeof data?.error === 'string') {
      errorMsg = data.error;
    } else if (data?.error?.message) {
      errorMsg = data.error.message;
    } else if (data?.message) {
      errorMsg = data.message;
    } else {
      errorMsg = `Server returned HTTP ${status}`;
    }
    throw new Error(errorMsg);
  }

  return data as T;
}

/**
 * Tests connection to Google Gemini through the secure server backend
 */
export async function testGeminiConnection(): Promise<GeminiHealthResponse> {
  return safeFetchJson<GeminiHealthResponse>('/api/ai/health', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Tests real Google Gemini image generation through the secure server backend
 * Endpoint: POST /api/ai/image/test
 */
export async function testImageGeneration(): Promise<GeminiImageTestResponse> {
  const data = await safeFetchJson<GeminiImageTestResponse>('/api/ai/image/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!data.success && data.status === 'FAILED') {
    const errorMsg =
      typeof data.error === 'string'
        ? data.error
        : data.error?.message || 'Gemini image generation test failed.';
    throw new Error(errorMsg);
  }

  return data;
}

/**
 * Fetches AI usage telemetry from server
 */
export async function fetchAIUsageStats(): Promise<AIUsageStats> {
  return safeFetchJson<AIUsageStats>('/api/ai/usage', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Main real design concept generation via server-side Google Gemini Image API
 * NEVER uses fake or placeholder artwork
 */
export async function generateAIDesignConcept(
  params: GenerateDesignParams,
  existingConceptsCount: number
): Promise<AIDesignConcept> {
  const data = await safeFetchJson<{
    success: boolean;
    image?: { data: string; mimeType: string; url?: string };
    concept?: AIDesignConcept;
    error?: { code: string; message: string } | string;
  }>('/api/ai/design/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...params,
      existingConceptsCount,
    }),
  });

  if (!data.success || !data.concept) {
    const errorMsg =
      typeof data.error === 'string'
        ? data.error
        : data.error?.message || 'Failed to generate design concept.';
    throw new Error(errorMsg);
  }

  return data.concept;
}

/**
 * On-demand artwork generation for a saved concept using the active image provider
 */
export async function generateArtworkForConcept(
  prompt: string,
  aspectRatio = '1:1',
  imageSize = '1K'
): Promise<{ imageUrl: string; provider?: string; model?: string }> {
  const data = await safeFetchJson<{
    success: boolean;
    imageUrl?: string;
    provider?: string;
    model?: string;
    error?: { code: string; message: string } | string;
  }>('/api/ai/design/generate-artwork', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, aspectRatio, imageSize }),
  });

  if (!data.success || !data.imageUrl) {
    const errorMsg =
      typeof data.error === 'string'
        ? data.error
        : data.error?.message ||
          'Artwork generation is temporarily unavailable. Your design concept has been saved and can be generated again later.';
    throw new Error(errorMsg);
  }

  return {
    imageUrl: data.imageUrl,
    provider: data.provider,
    model: data.model,
  };
}

/**
 * Generates variations of an existing design via server-side Google Gemini Image API
 */
export async function generateVariations(
  concept: AIDesignConcept,
  variationType: string
): Promise<AIDesignConcept> {
  const data = await safeFetchJson<{
    success: boolean;
    image?: { data: string; mimeType: string; url?: string };
    concept?: AIDesignConcept;
    error?: { code: string; message: string } | string;
  }>('/api/ai/design/variation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      concept,
      variationType,
    }),
  });

  if (!data.success || !data.concept) {
    const errorMsg =
      typeof data.error === 'string'
        ? data.error
        : data.error?.message || 'Failed to generate variation with Gemini.';
    throw new Error(errorMsg);
  }

  return data.concept;
}

/**
 * Transforms an AIDesignConcept into a pre-filled AdminProduct draft
 * for the existing TORIWEAR product CMS without duplicating systems.
 * Note: AI does NOT invent unverified GSM, fabric, or safety claims (Section 22).
 */
export function conceptToProductDraft(
  concept: AIDesignConcept,
  currentProductsCount: number
): Partial<AdminProduct> {
  const newCatalogNum = String(currentProductsCount + 1).padStart(2, '0');
  const isKids = concept.department === 'KIDS';

  return {
    name: concept.designName,
    sku: isKids ? `TORI-KIDS-${newCatalogNum}` : `TORI-OVR-${newCatalogNum}`,
    franchise: 'Toriwear Originals',
    universe: isKids ? 'KIDS' : 'ORIGINALS',
    category: isKids ? 'T-Shirts' : 'Oversized Tees',
    fit: isKids ? 'Regular Fit' : 'Oversized',
    price: isKids ? 799 : 1199,
    mrp: isKids ? 1099 : 1599,
    costPrice: isKids ? 320 : 450,
    discountPercent: 25,
    gstRate: 5,
    images: concept.imageUrl ? [concept.imageUrl] : [],
    description: concept.productDescription,
    shortDescription: concept.oneLineStory || `${concept.department} collection design.`,
    storyQuote: concept.oneLineStory || concept.story.slice(0, 100),
    drop: concept.collection || (isKids ? 'KIDS CHAPTER 01' : 'CHAPTER 01 — GENESIS'),
    // Leave GSM and fabric specifications to be set by the CMS production team
    gsm: undefined,
    fabric: undefined,
    neck: isKids ? 'Ribbed Crewneck' : 'High-Ribbed Crewneck',
    sleeves: isKids ? 'Regular Half Sleeves' : 'Drop Shoulder Half Sleeves',
    print: concept.printStyle || 'High-Density Screen Print',
    tags: concept.tags,
    seoTitle: concept.seoTitle,
    seoDescription: concept.seoDescription,
    slug: concept.designName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    publishingStatus: 'DRAFT', // Mandatory: Always starts in DRAFT!
    licenseRightsStatus: 'Owned IP',
    variants: [
      {
        id: `var-${concept.id}-M`,
        sku: `TORI-${newCatalogNum}-M`,
        size: 'M',
        colorName: 'Obsidian Black',
        colorHex: '#111115',
        price: isKids ? 799 : 1199,
        stock: 25,
        reserved: 0,
        barcode: `8900${newCatalogNum}1`,
        weightGrams: isKids ? 180 : 340,
      },
      {
        id: `var-${concept.id}-L`,
        sku: `TORI-${newCatalogNum}-L`,
        size: 'L',
        colorName: 'Obsidian Black',
        colorHex: '#111115',
        price: isKids ? 799 : 1199,
        stock: 35,
        reserved: 0,
        barcode: `8900${newCatalogNum}2`,
        weightGrams: isKids ? 180 : 340,
      },
    ],
  };
}
