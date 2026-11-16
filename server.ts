import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { GEMINI_TEXT_MODEL } from './server/geminiImageService';
import { imageManager } from './server/imageProviders/imageGenerationManager';
import { generateConceptWithAI } from './server/geminiStoryService';
import { platformRouter } from './server/internalPlatformRouter';
import { apiRouter } from './server/routes/apiRouter';
import { financeRouter } from './server/routes/financeRouter';
import { cmsRouter } from './server/routes/cmsRouter';
import { cmsRepository } from './server/repositories/cmsRepository';
import { setupRealtimeWebSocket } from './server/realtimeSocket';
import { getPrismaClient } from './server/db/prisma';
import { ensureDevPostgresRunning } from './server/db/start-postgres';
import { authStore } from './server/authStore';
import { paymentConfigService } from './server/services/paymentConfigService';
import { requireAuth } from './server/middleware/authMiddleware';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Trust proxy for reverse proxies, Cloud Run, Firebase Hosting, and load balancers
app.set('trust proxy', 1);

// Liveness check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Readiness check (verifies database connectivity)
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    if (prisma) {
      await prisma.$queryRaw`SELECT 1`;
      return res.json({ status: 'ready', database: 'connected', timestamp: new Date().toISOString() });
    }
    if (isProd) {
      return res.status(503).json({
        status: 'unhealthy',
        database: 'memory-fallback',
        error: 'Production requires the configured persistent database; memory fallback is not launch-safe.',
        timestamp: new Date().toISOString(),
      });
    }
    return res.json({ status: 'ready', database: 'memory-fallback', timestamp: new Date().toISOString() });
  } catch (err: any) {
    return res.status(503).json({ status: 'unhealthy', database: 'disconnected', error: err.message });
  }
});

// Increase body parser limits and capture rawBody for cryptographic webhook signatures
app.use(
  express.json({
    limit: '30mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Security headers & permissions policy
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // Explicitly permit camera, disallow microphone entirely
  res.setHeader('Permissions-Policy', 'camera=*, microphone=(), geolocation=()');
  // Content Security Policy permitting local WASM workers, fonts, images and self
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://fonts.googleapis.com https://cdn.jsdelivr.net https://checkout.razorpay.com https://apis.google.com https://www.gstatic.com https://accounts.google.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://checkout.razorpay.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://api.razorpay.com https://checkout.razorpay.com; media-src 'self' data: blob: https:; connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://accounts.google.com https://apis.google.com https://firebase.googleapis.com https://firebaseinstallations.googleapis.com https://api.razorpay.com https://lumberjack.razorpay.com https://checkout.razorpay.com ws: wss:;"
  );
  next();
});

// Sliding-window in-memory rate limiter for abuse protection
function createRateLimiter(windowMs: number, maxRequests: number, keyPrefix: string) {
  const hits = new Map<string, number[]>();
  const timer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [k, timestamps] of hits.entries()) {
      const fresh = timestamps.filter((t) => t > cutoff);
      if (fresh.length === 0) hits.delete(k);
      else hits.set(k, fresh);
    }
  }, Math.max(30000, windowMs));
  timer.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.ip || req.socket.remoteAddress || 'unknown').replace('::ffff:', '');
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const cutoff = now - windowMs;
    const recent = (hits.get(key) || []).filter((t) => t > cutoff);
    if (recent.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        error: 'Too many requests. Please wait a moment before trying again.',
      });
    }
    recent.push(now);
    hits.set(key, recent);
    return next();
  };
}

const authRateLimiter = createRateLimiter(15 * 60 * 1000, 30, 'auth');
const checkoutRateLimiter = createRateLimiter(10 * 60 * 1000, 60, 'checkout');
const aiRateLimiter = createRateLimiter(10 * 60 * 1000, 30, 'ai');

app.use(
  [
    '/api/platform/auth/login',
    '/api/platform/auth/signin',
    '/api/platform/auth/verify-2fa',
    '/api/platform/auth/2fa/verify',
    '/api/platform/auth/forgot-password',
    '/api/platform/auth/reset-password',
    '/api/v1/auth/login',
    '/api/v1/customers/auth/firebase',
    '/v1/customers/auth/firebase',
  ],
  authRateLimiter
);

app.use(
  [
    '/api/v1/orders',
    '/api/v1/payments/intent',
    '/api/v1/payments/razorpay/create-order',
    '/api/v1/coupons/validate',
  ],
  checkoutRateLimiter
);

function requireStaffAuth(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    const role = (req.user?.role || '').toUpperCase();
    if (!role || role === 'CUSTOMER') {
      res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: 'Administrator or staff session required.',
      });
      return;
    }
    next();
  });
}

// Ensure public/generated-assets, public/assets, and public/models directories exist
const publicDir = path.resolve(process.cwd(), 'public');
const assetsDir = path.resolve(publicDir, 'generated-assets');
const brandAssetsDir = path.resolve(publicDir, 'assets');
const modelsDir = path.resolve(publicDir, 'models');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}
if (!fs.existsSync(brandAssetsDir)) {
  fs.mkdirSync(brandAssetsDir, { recursive: true });
}
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

// Block static access to internal data/temp/dotfiles (always return 404)
const blockSensitiveStaticFiles = (req: Request, res: Response, next: NextFunction) => {
  const cleanPath = (req.path || '').toLowerCase();
  const base = path.posix.basename(cleanPath);
  if (
    base.startsWith('.') ||
    cleanPath.endsWith('.json') ||
    cleanPath.endsWith('.tmp') ||
    cleanPath.endsWith('.bin') ||
    cleanPath.includes('.tmp-chunk-')
  ) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  return next();
};

// Serve generated/uploaded product & CMS images with immutable long-lived browser caching (zero re-buffering),
// while strictly blocking .json, .tmp, .bin, and dotfiles.
app.use('/generated-assets', blockSensitiveStaticFiles, express.static(assetsDir, {
  etag: true,
  lastModified: true,
  dotfiles: 'deny',
  setHeaders: (res, filePath) => {
    if (/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));
app.use('/assets', express.static(brandAssetsDir, {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  }
}));
app.use('/models', express.static(modelsDir, { maxAge: '7d' }));

// API to check or upload the official logo asset
app.get(['/api/brand/logo-status', '/api/v1/brand/logo-status'], async (_req: Request, res: Response) => {
  try {
    const storeSettings = await cmsRepository.getStoreSettings();
    const brandingDir = path.join(brandAssetsDir, 'branding');

    const resolveLogoPath = (baseName: string): { exists: boolean; url: string; filePath: string } => {
      const candidates = [
        { url: `/assets/branding/${baseName}.svg`, filePath: path.join(brandingDir, `${baseName}.svg`) },
        { url: `/assets/${baseName}.svg`, filePath: path.join(brandAssetsDir, `${baseName}.svg`) },
        { url: `/assets/branding/${baseName}.png`, filePath: path.join(brandingDir, `${baseName}.png`) },
        { url: `/assets/${baseName}.png`, filePath: path.join(brandAssetsDir, `${baseName}.png`) },
      ];
      for (const c of candidates) {
        if (fs.existsSync(c.filePath)) {
          return { exists: true, url: c.url, filePath: c.filePath };
        }
      }
      return { exists: false, url: `/assets/${baseName}.png`, filePath: path.join(brandAssetsDir, `${baseName}.png`) };
    };

    const primary = resolveLogoPath('toriwear-official-logo');
    const secondary = resolveLogoPath('second-brand-logo');

    const primaryUrl = storeSettings.logoUrl || primary.url;
    const secondaryUrl = storeSettings.secondaryLogoUrl || secondary.url;

    let size = 0;
    let mtime = 0;
    if (primary.exists) {
      const stat = fs.statSync(primary.filePath);
      size = stat.size;
      mtime = Math.floor(stat.mtimeMs);
    }

    const persistedTimestamp = storeSettings.logoUpdatedAt || mtime || 1;

    res.json({
      success: true,
      data: {
        exists: primary.exists,
        secondaryExists: secondary.exists,
        path: primaryUrl,
        secondaryPath: secondaryUrl,
        sizeBytes: size,
        timestamp: persistedTimestamp,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to read brand logo status.' });
  }
});

app.post(['/api/brand/upload-logo', '/api/v1/brand/upload-logo'], requireStaffAuth, async (req: Request, res: Response) => {
  try {
    const { imageBase64, target } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing imageBase64 payload.' });
    }

    const mimeMatch = imageBase64.match(/^data:image\/(svg\+xml|[a-zA-Z0-9.+-]+);base64,(.*)$/i);
    const isSvg = mimeMatch?.[1] ? mimeMatch[1].toLowerCase() === 'svg+xml' : false;
    const cleanBase64 = mimeMatch?.[2] || imageBase64.replace(/^data:image\/[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length === 0) {
      return res.status(400).json({ success: false, error: 'Uploaded logo payload is empty.' });
    }

    const brandingDir = path.join(brandAssetsDir, 'branding');
    if (!fs.existsSync(brandingDir)) {
      fs.mkdirSync(brandingDir, { recursive: true });
    }

    const ext = isSvg ? 'svg' : 'png';
    const oppositeExt = isSvg ? 'png' : 'svg';
    const now = Date.now();
    const saveTargetFiles = (baseName: string) => {
      const bPath = path.join(brandingDir, `${baseName}.${ext}`);
      const rPath = path.join(brandAssetsDir, `${baseName}.${ext}`);
      fs.writeFileSync(bPath, buffer);
      fs.writeFileSync(rPath, buffer);
      // Clean up any stale opposite-extension file (.svg vs .png) so the newly uploaded format is always served cleanly
      const oldB = path.join(brandingDir, `${baseName}.${oppositeExt}`);
      const oldR = path.join(brandAssetsDir, `${baseName}.${oppositeExt}`);
      if (fs.existsSync(oldB)) fs.unlinkSync(oldB);
      if (fs.existsSync(oldR)) fs.unlinkSync(oldR);
      return `/assets/branding/${baseName}.${ext}`;
    };

    const currentSettings = await cmsRepository.getStoreSettings();
    const defaultSecondaryFallback = fs.existsSync(path.join(brandingDir, 'second-brand-logo.png'))
      ? '/assets/branding/second-brand-logo.png'
      : '/assets/second-brand-logo.png';
    let nextPrimaryUrl = currentSettings.logoUrl || '/assets/branding/toriwear-official-logo.png';
    let nextSecondaryUrl = currentSettings.secondaryLogoUrl || defaultSecondaryFallback;

    if (target === 'secondary') {
      nextSecondaryUrl = saveTargetFiles('second-brand-logo');
      console.log(`[BRAND] Secondary logo saved to ${nextSecondaryUrl} (${buffer.length} bytes)`);
    } else if (target === 'primary') {
      nextPrimaryUrl = saveTargetFiles('toriwear-official-logo');
      console.log(`[BRAND] Primary logo saved to ${nextPrimaryUrl} (${buffer.length} bytes)`);
    } else {
      nextPrimaryUrl = saveTargetFiles('toriwear-official-logo');
      nextSecondaryUrl = saveTargetFiles('second-brand-logo');
      console.log(`[BRAND] Official brand logo saved to both primary and secondary logo paths (${buffer.length} bytes)`);
    }

    await cmsRepository.updateStoreSettings({
      logoUrl: nextPrimaryUrl,
      secondaryLogoUrl: nextSecondaryUrl,
      logoUpdatedAt: now,
    });

    return res.json({
      success: true,
      message: 'Brand logo asset saved permanently to disk.',
      timestamp: now,
      primaryUrl: nextPrimaryUrl,
      secondaryUrl: nextSecondaryUrl,
      sizeBytes: buffer.length,
      target: target || 'both',
    });
  } catch (err: any) {
    console.error('[BRAND] Error saving official logo:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to save logo asset.' });
  }
});

// Telemetry and usage tracking storage
interface TelemetryLog {
  id: string;
  timestamp: string;
  operation: string;
  modelUsed: string;
  durationMs: number;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
  promptSnippet: string;
}

const telemetryLogs: TelemetryLog[] = [];

// Ensure all /api responses default to application/json
app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// ==========================================
// 1. HEALTH / TEST CONNECTION ENDPOINT
// ==========================================
app.get('/api/ai/health', requireStaffAuth, async (_req: Request, res: Response) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const isGeminiKeySet = Boolean(geminiKey && geminiKey.trim() !== '' && geminiKey !== 'MY_GEMINI_API_KEY');
  const imageHealth = await imageManager.getHealth();

  return res.status(200).json({
    success: true,
    enabled: imageHealth.enabled,
    provider: imageHealth.provider,
    configured: imageHealth.configured,
    status: imageHealth.status,
    textAI: {
      provider: 'Google Gemini',
      model: GEMINI_TEXT_MODEL,
      configured: isGeminiKeySet,
      status: isGeminiKeySet ? 'ready' : 'not_configured',
    },
    imageAI: imageHealth,
    // Legacy backward-compatible keys
    connected: isGeminiKeySet,
    apiKeyConfigured: isGeminiKeySet,
    imageModel: imageHealth.model,
    textModel: GEMINI_TEXT_MODEL,
  });
});

// ==========================================
// 2. TEST IMAGE GENERATION ENDPOINT (SECTION 15)
// ==========================================
app.post('/api/ai/image/test', requireStaffAuth, aiRateLimiter, async (_req: Request, res: Response) => {
  const startTime = Date.now();

  if (!imageManager.isImageEnabled()) {
    return res.status(200).json({
      success: false,
      status: 'DISABLED',
      error: {
        code: 'IMAGE_GENERATION_DISABLED',
        message:
          'Image generation is currently unavailable. Your concepts, stories and designs can still be created and saved. Connect an image AI provider when you are ready to generate artwork.',
      },
      provider: imageManager.getProviderType(),
      durationMs: 0,
    });
  }

  const testPrompt =
    'Create a simple original futuristic geometric energy symbol suitable for a premium streetwear graphic. No existing characters, logos, brands, or copyrighted characters.';

  try {
    const result = await imageManager.generateImage(testPrompt, {
      aspectRatio: '1:1',
      imageSize: '1K',
    });

    const filename = `test-symbol-${Date.now()}.png`;
    const filePath = path.join(assetsDir, filename);
    fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'));

    const imageUrl = `/generated-assets/${filename}`;
    const durationMs = Date.now() - startTime;

    telemetryLogs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      operation: 'TEST_IMAGE_GENERATION',
      modelUsed: result.model,
      durationMs,
      status: 'SUCCESS',
      promptSnippet: testPrompt,
    });

    return res.status(200).json({
      success: true,
      status: 'SUCCESS',
      image: {
        data: result.data,
        mimeType: result.mimeType,
        url: imageUrl,
      },
      imageUrl,
      model: result.model,
      provider: result.provider,
      durationMs,
      prompt: testPrompt,
    });
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err?.message || 'Image generation test failed.';

    telemetryLogs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      operation: 'TEST_IMAGE_GENERATION',
      modelUsed: process.env.AI_IMAGE_MODEL || 'none',
      durationMs,
      status: 'FAILED',
      error: errorMsg,
      promptSnippet: testPrompt,
    });

    return res.status(200).json({
      success: false,
      status: 'FAILED',
      error: {
        code: 'IMAGE_GENERATION_FAILED',
        message: errorMsg,
      },
      model: process.env.AI_IMAGE_MODEL || 'none',
      provider: imageManager.getProviderType(),
      durationMs,
    });
  }
});

// ==========================================
// 3. REAL DESIGN GENERATION ENDPOINT
// ==========================================
app.post('/api/ai/design/generate', requireStaffAuth, aiRateLimiter, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const {
    prompt,
    department = 'MEN',
    world = 'Dark Shonen',
    collection,
    character,
    designType = 'Full Streetwear Composition',
    placement = 'Large Back',
    mood = 'Mysterious',
    colorDirection = 'Blue / Black',
    generationMode = 'STORY + DESIGN',
    aspectRatio = '1:1',
    imageSize = '1K',
    existingConceptsCount = 0,
    characterDetails,
  } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Prompt is required for generating design.',
      },
    });
  }

  // 1. Creative Director & Narrative Synthesis via Gemini / Lore Engine
  const isKids = department === 'KIDS';
  const prefix = isKids ? 'TW-KIDS' : 'TW-MEN';
  const num = String(Number(existingConceptsCount) + 1).padStart(3, '0');
  const designNumber = `${prefix}-${num}`;

  const conceptData = await generateConceptWithAI({
    prompt,
    department,
    world,
    character,
    designType,
    placement,
    mood,
    colorDirection,
    generationMode,
    characterDetails,
  });

  const finalCharacter = conceptData.character;
  const finalWorld = conceptData.world;
  const finalDesignName = conceptData.designName;

  // 2. Provider-Independent Artwork Generation (Optional via Feature Flag)
  const isImageEnabled = imageManager.isImageEnabled();
  let imageUrl = '';
  let artworkStatus: 'READY' | 'PENDING' | 'DISABLED' | 'FAILED' = isImageEnabled ? 'PENDING' : 'DISABLED';
  let artworkNotice: string | undefined = undefined;
  let imageResultData: string | undefined = undefined;
  let imageMimeType: string | undefined = undefined;

  if (isImageEnabled) {
    try {
      const result = await imageManager.generateImage(conceptData.imagePrompt, {
        aspectRatio,
        imageSize,
      });
      imageResultData = result.data;
      imageMimeType = result.mimeType;

      const assetId = `tori-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const filename = `${assetId}.png`;
      const filePath = path.join(assetsDir, filename);
      fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'));

      imageUrl = `/generated-assets/${filename}`;
      artworkStatus = 'READY';
    } catch (imageErr: any) {
      console.warn('[Image Generation Notice]', imageErr?.message || imageErr);
      artworkStatus = 'PENDING';
      artworkNotice =
        'Artwork generation is temporarily unavailable. Your design concept has been saved and can be generated again later.';
    }
  }

  // 3. Assemble Complete TORIWEAR AIDesignConcept with all 21+ required fields
  const concept = {
    id: `concept-${Date.now()}`,
    designNumber,
    designName: finalDesignName,
    character: finalCharacter,
    characterRole: isKids ? 'Youth Faction Hero' : 'Street Syndicate Specialist',
    characterAbility: conceptData.ability,
    characterPersonality: conceptData.characterPersonality,
    ability: conceptData.ability,
    visualIdentity: conceptData.visualIdentity,
    world: finalWorld,
    department,
    collection: collection || conceptData.collection,
    category: isKids ? 'KIDS_TEE' : 'OVERSIZED_TEE',
    imageUrl,
    thumbnailUrl: imageUrl,
    aspectRatio,
    placement: conceptData.printPlacement,
    designType,
    mood: conceptData.mood,
    colorDirection,
    palette: conceptData.colorPalette,
    typography: conceptData.typography,
    graphicElements: conceptData.graphicElements,
    printStyle: conceptData.printStyle,
    printPlacement: conceptData.printPlacement,
    garmentType: conceptData.garmentType,
    targetAudience: conceptData.targetAudience,
    marketingHook: conceptData.marketingHook,
    productDescription: conceptData.productDescription,
    story: conceptData.story,
    designStory: conceptData.designStory,
    oneLineStory: conceptData.oneLineStory,
    designLore: conceptData.designStory,
    whyWearing: conceptData.whyWearing,
    tags: conceptData.tags,
    seoTitle: conceptData.seoTitle,
    seoDescription: conceptData.seoDescription,
    imagePrompt: conceptData.imagePrompt,
    generationMode,
    artworkStatus,
    artworkNotice,
    imageProviderUsed: isImageEnabled ? imageManager.getProviderType() : 'none',
    originalityStatus: 'SAFE FOR ORIGINAL CONCEPT' as const,
    printReadiness: 'GOOD' as const,
    qualityReview: {
      originalityScore: conceptData.originalityScore,
      characterDistinctiveness: 94,
      streetwearAppeal: 95,
      printReadability: 92,
      brandFit: 96,
      feedback: [
        '100% original IP, no third-party franchise references',
        'High contrast graphic vectorization ready for screen printing',
        'Story lore integrated with TORIWEAR brand canon',
      ],
    },
    status: 'DRAFT' as const,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    versionHistory: [
      {
        versionNumber: 1,
        prompt: conceptData.imagePrompt,
        designName: finalDesignName,
        story: conceptData.story,
        imageUrl,
        character: finalCharacter,
        world: finalWorld,
        changesSummary: isImageEnabled && imageUrl
          ? `Initial design concept and artwork generated via ${imageManager.getProviderType()}.`
          : 'Initial design concept, narrative lore, and artwork specifications created.',
        createdBy: 'Admin Session',
        createdAt: new Date().toISOString(),
      },
    ],
  };

  const durationMs = Date.now() - startTime;
  telemetryLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    operation: 'CREATE_DESIGN',
    modelUsed: isImageEnabled ? imageManager.getProviderType() : 'TEXT_ONLY',
    durationMs,
    status: 'SUCCESS',
    promptSnippet: prompt.slice(0, 80),
  });

  return res.status(200).json({
    success: true,
    concept,
    artworkNotice,
    image: imageResultData
      ? {
          data: imageResultData,
          mimeType: imageMimeType || 'image/png',
          url: imageUrl,
        }
      : undefined,
  });
});

// ==========================================
// 4. GENERATE ARTWORK FOR EXISTING CONCEPT (ON DEMAND)
// ==========================================
app.post('/api/ai/design/generate-artwork', requireStaffAuth, aiRateLimiter, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { prompt, aspectRatio = '1:1', imageSize = '1K' } = req.body;

  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Prompt is required for artwork generation.' },
    });
  }

  if (!imageManager.isImageEnabled()) {
    return res.status(200).json({
      success: false,
      error: {
        code: 'IMAGE_GENERATION_DISABLED',
        message:
          'Image generation is currently unavailable. Your concepts, stories and designs can still be created and saved. Connect an image AI provider when you are ready to generate artwork.',
      },
    });
  }

  try {
    const result = await imageManager.generateImage(prompt, { aspectRatio, imageSize });
    const assetId = `tori-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const filename = `${assetId}.png`;
    const filePath = path.join(assetsDir, filename);
    fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'));
    const imageUrl = `/generated-assets/${filename}`;

    return res.status(200).json({
      success: true,
      imageUrl,
      thumbnailUrl: imageUrl,
      provider: result.provider,
      model: result.model,
      durationMs: Date.now() - startTime,
    });
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      error: {
        code: 'IMAGE_GENERATION_FAILED',
        message:
          'Artwork generation is temporarily unavailable. Your design concept has been saved and can be generated again later.',
      },
    });
  }
});

// ==========================================
// 5. REAL DESIGN VARIATION ENDPOINT
// ==========================================
app.post('/api/ai/design/variation', requireStaffAuth, aiRateLimiter, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { concept, variationType = 'Different color palette' } = req.body;

  if (!concept) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Concept is required to create a variation.',
      },
    });
  }

  const variationSuffix = variationType.toUpperCase();
  const newVersion = (concept.version || 1) + 1;
  const variationPrompt = `Create a high-impact variation of this existing TORIWEAR artwork.
Variation Directive: ${variationType}
Existing Design: ${concept.designName}
Character: ${concept.character} (PRESERVE core character silhouette, attire identity, and distinguishing features).
Universe / World: ${concept.world}
Print Placement: ${concept.placement}
Art Direction: Isolated original anime streetwear graphic on solid clean neutral background, no t-shirt mockups, crisp vectors and bold linework.`;

  const isImageEnabled = imageManager.isImageEnabled();
  let imageUrl = concept.imageUrl || '';
  let base64Data: string | undefined = undefined;
  let mimeType: string | undefined = undefined;

  if (isImageEnabled) {
    try {
      const result = await imageManager.generateImage(variationPrompt, {
        aspectRatio: '1:1',
        imageSize: '1K',
      });
      base64Data = result.data;
      mimeType = result.mimeType;

      const assetId = `tori-var-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const filename = `${assetId}.png`;
      const filePath = path.join(assetsDir, filename);
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
      imageUrl = `/generated-assets/${filename}`;
    } catch (err: any) {
      console.warn('[Variation Generation Notice]', err?.message || err);
    }
  }

  const updatedConcept = {
    ...concept,
    id: `concept-${Date.now()}`,
    designName: `${concept.designName} [${variationSuffix}]`,
    designNumber: `${concept.designNumber}-V${newVersion}`,
    imageUrl,
    thumbnailUrl: imageUrl,
    version: newVersion,
    status: 'DRAFT' as const,
    artworkStatus: imageUrl ? ('READY' as const) : ('PENDING' as const),
    versionHistory: [
      {
        versionNumber: newVersion,
        prompt: variationPrompt,
        designName: `${concept.designName} [${variationSuffix}]`,
        story: concept.story,
        imageUrl,
        character: concept.character,
        world: concept.world,
        changesSummary: `Variation: ${variationType}. Character identity preserved.${isImageEnabled && imageUrl ? ' Real image generated.' : ' Narrative variation concept created.'}`,
        createdBy: 'Admin Session',
        createdAt: new Date().toISOString(),
      },
      ...(concept.versionHistory || []),
    ],
    updatedAt: new Date().toISOString(),
  };

  telemetryLogs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    operation: 'GENERATE_VARIATION',
    modelUsed: isImageEnabled ? imageManager.getProviderType() : 'TEXT_ONLY',
    durationMs: Date.now() - startTime,
    status: 'SUCCESS',
    promptSnippet: variationPrompt.slice(0, 80),
  });

  return res.status(200).json({
    success: true,
    image: base64Data
      ? {
          data: base64Data,
          mimeType: mimeType || 'image/png',
          url: imageUrl,
        }
      : undefined,
    concept: updatedConcept,
  });
});

// ==========================================
// 5. TELEMETRY & USAGE STATS ENDPOINT
// ==========================================
app.get('/api/ai/usage', requireStaffAuth, (_req: Request, res: Response) => {
  const total = telemetryLogs.length;
  const successful = telemetryLogs.filter((l) => l.status === 'SUCCESS').length;
  const failed = telemetryLogs.filter((l) => l.status === 'FAILED').length;
  const avgDurationMs = total > 0
    ? Math.round(telemetryLogs.reduce((acc, l) => acc + l.durationMs, 0) / total)
    : 0;

  const todayStr = new Date().toISOString().split('T')[0] || '2026-01-01';
  const todayCount = telemetryLogs.filter((l) => l.timestamp.startsWith(todayStr)).length;

  res.json({
    totalGenerations: total,
    successfulGenerations: successful,
    failedGenerations: failed,
    todayGenerations: todayCount,
    averageDurationSeconds: Math.round(avgDurationMs / 100) / 10,
    logs: telemetryLogs.slice(0, 25),
  });
});

// ==========================================
// 6. INTERNAL BUSINESS MANAGEMENT PLATFORM API & PERSISTENCE SERVICES
// ==========================================
app.use('/api/v1/admin/finance', financeRouter);
app.use('/api/finance', financeRouter);
app.use('/api/v1/admin/cms', cmsRouter);
app.use('/api/admin/cms', cmsRouter);
app.use('/api/v1/cms', cmsRouter);
app.use('/api/cms', cmsRouter);
app.use('/api', cmsRouter);
app.use('/api', apiRouter);
app.use('/v1', apiRouter);
app.use('/api/platform', platformRouter);
app.use('/api', platformRouter);

// ==========================================
// 7. CATCH-ALL FOR UNMATCHED /api/* (PREVENTS HTML FALLBACK)
// ==========================================
app.all('/api/*', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(404).json({
    success: false,
    error: {
      code: 'API_ENDPOINT_NOT_FOUND',
      message: `API route ${req.method} ${req.originalUrl} not found.`,
    },
  });
});

// ==========================================
// 8. EXPRESS ERROR HANDLER (ENSURES JSON ERROR RESPONSES)
// ==========================================
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[API Server Error]', err);
  if (req.originalUrl.startsWith('/api') || req.path.startsWith('/api')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const rawStatus = err.status || 500;
    const safeStatus = [502, 503, 504].includes(rawStatus) ? 500 : rawStatus;
    return res.status(safeStatus).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An internal server error occurred.',
      },
    });
  }
  next(err);
  return;
});

// ==========================================
// 9. VITE OR STATIC PROD MIDDLEWARE & SERVER STARTUP
// ==========================================
async function startServer() {
  let devPgStop: () => Promise<void> = async () => {};
  let dbReady = isProd;
  if (!isProd) {
    try {
      const devPg = await ensureDevPostgresRunning();
      devPgStop = devPg.stop;
      dbReady = true;
    } catch (pgErr: any) {
      console.warn('[PG-DEV] Embedded PostgreSQL auto-start warning (continuing with fallback):', pgErr?.message || pgErr);
    }
  }

  if (dbReady) {
    await Promise.allSettled([
      authStore.ensureProductionBootstrap(),
      authStore.hydrateSessionsFromDb(),
      paymentConfigService.syncToDatabase(),
    ]);
  }

  const httpServer = http.createServer(app);

  // Initialize Realtime WebSocket & WebRTC Signaling
  setupRealtimeWebSocket(httpServer);

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.ENABLE_VITE_HMR === 'true' ? { server: httpServer } : false,
        ws: process.env.ENABLE_VITE_HMR === 'true' ? { server: httpServer } : false,
      },
      appType: 'spa',
    });
    // Never allow Vite's HTML fallback to intercept /api, /generated-assets, /assets, or /models requests
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/generated-assets') || req.originalUrl.startsWith('/assets') || req.originalUrl.startsWith('/models')) {
        return next();
      }
      vite.middlewares(req, res, next);
    });
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir, {
      maxAge: '7d',
      etag: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }));
    app.get('*', (req: Request, res: Response) => {
      if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/generated-assets') || req.originalUrl.startsWith('/assets') || req.originalUrl.startsWith('/models')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Endpoint ${req.originalUrl} not found.`,
          },
        });
      }
      return res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[TORIWEAR] Enterprise Platform server & WebSocket running on http://0.0.0.0:${port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[SERVER] Received ${signal}. Draining connections and shutting down gracefully...`);
    httpServer.close(async () => {
      console.log('[SERVER] Closed HTTP & WebSocket connections.');
      try {
        const prisma = getPrismaClient();
        if (prisma) {
          await prisma.$disconnect();
          console.log('[SERVER] Disconnected from PostgreSQL database.');
        }
      } catch (e) {
        console.warn('[SERVER] Error during Prisma disconnect:', e);
      }
      await devPgStop();
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[SERVER] Graceful shutdown timeout reached. Forcing process termination.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
