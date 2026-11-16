export type AIDepartment = 'MEN' | 'KIDS';

export type AIDesignType =
  | 'Character Portrait'
  | 'Action Scene'
  | 'Back Print'
  | 'Front Graphic'
  | 'Front + Back'
  | 'Minimal Chest Graphic'
  | 'Manga Panel'
  | 'Typography Graphic'
  | 'Symbol / Emblem'
  | 'Creature'
  | 'Full Streetwear Composition';

export type AIPlacement =
  | 'Large Back'
  | 'Small Chest'
  | 'Front'
  | 'Front + Back'
  | 'Sleeve'
  | 'Oversized Center'
  | 'Full Garment Artwork';

export type AIMood =
  | 'Dark'
  | 'Mysterious'
  | 'Energetic'
  | 'Emotional'
  | 'Nostalgic'
  | 'Futuristic'
  | 'Cute'
  | 'Playful'
  | 'Aggressive'
  | 'Calm'
  | 'Epic'
  | 'Street'
  | 'Dreamlike';

export type AIColorDirection =
  | 'Black / White'
  | 'Monochrome'
  | 'Neon'
  | 'Pastel'
  | 'Earth Tone'
  | 'Red / Black'
  | 'Blue / Black'
  | 'Purple / Black'
  | 'Custom';

export type AIGenerationMode =
  | 'STORY + DESIGN'
  | 'DESIGN ONLY'
  | 'CHARACTER + STORY'
  | 'FULL PRODUCT';

export type OriginalityStatus =
  | 'SAFE FOR ORIGINAL CONCEPT'
  | 'REQUIRES CREATIVE TRANSFORMATION'
  | 'THIRD-PARTY REFERENCE DETECTED';

export type PrintReadiness = 'GOOD' | 'REVIEW' | 'NEEDS SIMPLIFICATION';

export interface AIVersionEntry {
  versionNumber: number;
  prompt: string;
  designName: string;
  story: string;
  imageUrl: string;
  character?: string;
  world?: string;
  changesSummary: string;
  createdBy: string;
  createdAt: string;
}

export interface AIQualityReview {
  originalityScore: number; // 0 - 100
  characterDistinctiveness: number;
  streetwearAppeal: number;
  printReadability: number;
  brandFit: number;
  feedback: string[];
}

export interface AIDesignConcept {
  id: string;
  prompt: string;
  department: AIDepartment;
  world: string;
  collection: string;
  character: string;
  characterRole?: string;
  characterAbility?: string;
  designType: AIDepartment extends 'KIDS' ? string : AIDesignType | string;
  placement: AIPlacement | string;
  mood: AIMood | string;
  colorDirection: AIColorDirection | string;
  generationMode: AIGenerationMode | string;
  designName: string;
  designNumber: string;
  story: string;
  oneLineStory?: string;
  designLore?: string;
  whyWearing?: string;
  visualConcept: string;
  palette: string[];
  typography: string;
  graphicElements?: string[];
  printStyle: string;
  printPlacement: string;
  targetAudience?: string;
  marketingHook?: string;
  productDescription: string;
  marketingDescription?: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  imagePrompt: string;
  imageUrl: string;
  thumbnailUrl?: string;
  artworkStatus?: 'READY' | 'PENDING' | 'DISABLED' | 'FAILED';
  artworkNotice?: string;
  imageProviderUsed?: string;
  characterPersonality?: string[];
  ability?: string;
  visualIdentity?: string;
  designStory?: string;
  garmentType?: string;
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'ARCHIVED';
  originalityStatus: OriginalityStatus;
  originalityNotes?: string;
  printReadiness: PrintReadiness;
  printNotes?: string;
  qualityReview: AIQualityReview;
  adminNotes?: {
    internal?: string;
    revision?: string;
    approval?: string;
    production?: string;
  };
  version: number;
  versionHistory: AIVersionEntry[];
  convertedToProductId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AICharacter {
  id: string;
  name: string;
  alias: string;
  ageRange: string;
  genderPresentation: string;
  role: string;
  world: string;
  personality: string[];
  strength: string;
  weakness: string;
  ability: string;
  weaponTool: string;
  symbol: string;
  colorPalette: string[];
  outfit: string;
  accessories?: string;
  hair: string;
  eyes: string;
  bodyType: string;
  silhouette: string;
  backstory: string;
  quote: string;
  firstAppearance?: string;
  collection?: string;
  avatarUrl?: string;
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface AIWorld {
  id: string;
  department: AIDepartment;
  name: string;
  subtitle: string;
  description: string;
  visualStyle: string;
  environment: string;
  technologyLevel: string;
  culture: string;
  colorPalette: string[];
  architecture: string;
  characterTypes: string[];
  storyThemes: string[];
  rules: string;
  symbols: string[];
  accentColor: string;
  badge: string;
  heroImage?: string;
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface AICollection {
  id: string;
  name: string;
  number?: string;
  chapterNumber?: string;
  department?: 'MEN' | 'KIDS';
  description?: string;
  theme: string;
  world?: string;
  worlds?: string[];
  characters?: string[];
  launchDate?: string;
  targetLaunch?: string;
  season?: string;
  heroCharacter?: string;
  bannerImage?: string;
  designCount?: number;
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED' | 'PLANNING' | 'IN DESIGN' | 'READY' | 'LIVE';
  createdAt: string;
  updatedAt: string;
}

export interface AISettings {
  provider?: string;
  textProvider?: string;
  model?: string;
  textModel?: string;
  imageProvider?: string;
  imageModel?: string;
  imageQuality?: 'Standard' | 'HD' | 'Ultra' | 'Print 300DPI';
  defaultImageSize?: string;
  defaultVariationsCount?: number;
  creativityTemperature?: number;
  temperature?: number;
  maxDailyGenerations?: number;
  dailyGenerationLimit?: number;
  rateLimitPerMinute?: number;
  defaultDesignInstructions?: string;
  brandInstructions?: string;
  defaultBrandPrompt?: string;
  enforceStrictOriginality?: boolean;
  hasServerApiKey?: boolean;
  kidsCreativeMode?: boolean;
}

export interface AIUsageLog {
  id: string;
  timestamp: string;
  type?: 'TEXT_GENERATION' | 'IMAGE_GENERATION' | 'VARIATION' | 'REMIX';
  operation?: string;
  modelUsed?: string;
  tokensUsed?: number;
  tokensOrUnits?: number;
  durationSeconds?: number;
  estimatedCostUsd?: number;
  promptPreview?: string;
  status?: 'SUCCESS' | 'FAILED';
  userEmail?: string;
  notes?: string;
}

export interface AIProviderHealthInfo {
  enabled: boolean;
  provider: string;
  configured: boolean;
  model?: string;
  status: string;
  message?: string;
}

export interface AIHealthStatusResponse {
  success: boolean;
  enabled: boolean;
  provider: string;
  configured: boolean;
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
  connected?: boolean;
  apiKeyConfigured?: boolean;
  error?: string;
}

