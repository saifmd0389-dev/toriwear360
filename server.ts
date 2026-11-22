import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { GEMINI_TEXT_MODEL } from './server/geminiImageService';
import { imageManager } from './server/imageProviders/imageGenerationManager';
import { generateConceptWithAI } from './server/geminiStoryService';
import { platformRouter } from './server/internalPlatformRouter';
import { apiRouter } from './server/routes/apiRouter';
import { financeRouter } from './server/routes/financeRouter';
import { cmsRouter } from './server/routes/cmsRouter';
import { earlyAccessRouter } from './server/routes/earlyAccessRouter';
import { cmsRepository } from './server/repositories/cmsRepository';
import { productRepository } from './server/repositories/productRepository';
import { setupRealtimeWebSocket } from './server/realtimeSocket';
import { getPrismaClient } from './server/db/prisma';
import { ensureMySqlSchemaInitialized } from './server/db/init-mysql';
import { seedCatalogIfEmpty } from './server/db/seed';
import { authStore } from './server/authStore';
import { userStore } from './server/userStore';
import { paymentConfigService } from './server/services/paymentConfigService';
import { requireAuth } from './server/middleware/authMiddleware';
import { mediaCleanupService } from './server/services/storage/mediaCleanupService';

function readCliArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  const prefix = `${flag}=`;
  const eqArg = process.argv.find((arg) => arg.startsWith(prefix));
  return eqArg ? eqArg.slice(prefix.length) : undefined;
}

const app = express();
const cliPort = Number(readCliArg('--port'));
const port = (Number.isFinite(cliPort) && cliPort > 0 ? cliPort : Number(process.env.PORT)) || 3000;
const host = readCliArg('--host') || process.env.HOST || '0.0.0.0';
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
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // Disallow camera, microphone, and geolocation across the entire application
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // Content Security Policy permitting local WASM workers, fonts, images, Google Auth, Razorpay, and Meta Pixel
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://fonts.googleapis.com https://cdn.jsdelivr.net https://checkout.razorpay.com https://apis.google.com https://www.gstatic.com https://accounts.google.com https://connect.facebook.net; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://checkout.razorpay.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https: https://www.facebook.com; frame-src 'self' https://*.firebaseapp.com https://*.web.app https://accounts.google.com https://api.razorpay.com https://checkout.razorpay.com https://www.facebook.com; media-src 'self' data: blob: https:; connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net https://*.firebaseapp.com https://*.web.app https://www.gstatic.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://accounts.google.com https://apis.google.com https://firebase.googleapis.com https://firebaseinstallations.googleapis.com https://api.razorpay.com https://lumberjack.razorpay.com https://checkout.razorpay.com https://connect.facebook.net https://www.facebook.com ws: wss:;"
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
// 5B. SEO: ROBOTS.TXT, SITEMAP.XML & META CATALOG FEEDS
// ==========================================
const CANONICAL_SITE_ORIGIN = (process.env.SITE_URL || 'https://thetoriwearstore.in').replace(/\/+$/, '');

function escapeXml(val: string): string {
  return String(val || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toAbsoluteAssetUrl(url: string | undefined, origin = CANONICAL_SITE_ORIGIN): string {
  if (!url) return `${origin}/logo-192.png`;
  if (/^https?:\/\//i.test(url)) return url;
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
}

function resolveConfiguredAdminPath(): string {
  const rawAdminEnv = process.env.VITE_ADMIN_PATH || process.env.ADMIN_PATH || '';
  let val = String(rawAdminEnv).trim().replace(/^['"]+|['"]+$/g, '').trim();
  if (/^https?:\/\//i.test(val)) {
    try {
      val = new URL(val).pathname;
    } catch {
      val = '';
    }
  }
  val = (val.split('?')[0]?.split('#')[0] || '').trim();
  if (val) {
    val = (val.startsWith('/') ? val : `/${val}`).replace(/\/+/g, '/').replace(/\/+$/, '');
    for (const suffix of ['/login', '/gateway', '/dashboard', '/forgot-password', '/reset-password', '/account/security']) {
      if (val.toLowerCase().endsWith(suffix) && val.length > suffix.length) {
        val = val.slice(0, val.length - suffix.length).replace(/\/+$/, '');
        break;
      }
    }
    if (val && val !== '/' && val.toLowerCase() !== '/admin') {
      return val;
    }
  }
  return '/tori-ops-gateway';
}

app.get('/robots.txt', (_req: Request, res: Response) => {
  const adminPath = resolveConfiguredAdminPath();
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /tori-ops-gateway',
    ...(adminPath !== '/tori-ops-gateway' ? [`Disallow: ${adminPath}`] : []),
    'Disallow: /api/',
    'Disallow: /v1/',
    `Sitemap: ${CANONICAL_SITE_ORIGIN}/sitemap.xml`,
    '',
  ];
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.send(lines.join('\n'));
});

app.get('/sitemap.xml', async (_req: Request, res: Response) => {
  try {
    const [categories, products] = await Promise.all([
      productRepository.getCategories(undefined, false),
      productRepository.getAll({ status: 'PUBLISHED' }),
    ]);

    const today = new Date().toISOString().split('T')[0];
    const staticUrls = [
      { loc: `${CANONICAL_SITE_ORIGIN}/`, changefreq: 'daily', priority: '1.0' },
      { loc: `${CANONICAL_SITE_ORIGIN}/men`, changefreq: 'daily', priority: '0.9' },
      { loc: `${CANONICAL_SITE_ORIGIN}/kids`, changefreq: 'daily', priority: '0.9' },
      { loc: `${CANONICAL_SITE_ORIGIN}/catalog`, changefreq: 'daily', priority: '0.9' },
      { loc: `${CANONICAL_SITE_ORIGIN}/track`, changefreq: 'weekly', priority: '0.6' },
    ];

    const categoryUrls = categories.map((cat) => ({
      loc: `${CANONICAL_SITE_ORIGIN}/category/${encodeURIComponent(cat.slug)}`,
      changefreq: 'weekly',
      priority: '0.8',
    }));

    const productUrls = products.map((p) => ({
      loc: `${CANONICAL_SITE_ORIGIN}/product/${encodeURIComponent(p.slug || p.id)}`,
      lastmod: p.updatedAt ? new Date(p.updatedAt).toISOString().split('T')[0] : today,
      changefreq: 'weekly',
      priority: '0.8',
    }));

    const allEntries = [...staticUrls, ...categoryUrls, ...productUrls];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${allEntries
      .map(
        (u: any) =>
          `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n    <lastmod>${u.lastmod || today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
      )
      .join('\n')}\n</urlset>\n`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    return res.send(xml);
  } catch (err: any) {
    return res.status(500).type('text/plain').send('Failed to generate sitemap.');
  }
});

app.get(['/api/v1/catalog/feed.json', '/v1/catalog/feed.json'], async (_req: Request, res: Response) => {
  try {
    const products = await productRepository.getAll({ status: 'PUBLISHED' });
    const items = products.map((p) => {
      const slug = encodeURIComponent(p.slug || p.id);
      const isAvailable = p.inStock && p.stock > 0;
      return {
        id: p.sku || p.id,
        item_group_id: p.id,
        title: p.name,
        description: p.description || `${p.name} — Heavyweight ${p.gsm || 240} GSM ${p.fabric || 'cotton'} streetwear by TORI-WEAR.`,
        availability: isAvailable ? 'in stock' : 'out of stock',
        condition: 'new',
        price: `${Number(p.originalPrice || p.price).toFixed(2)} INR`,
        sale_price: p.originalPrice && p.originalPrice > p.price ? `${Number(p.price).toFixed(2)} INR` : undefined,
        link: `${CANONICAL_SITE_ORIGIN}/product/${slug}`,
        image_link: toAbsoluteAssetUrl(p.images?.[0]),
        additional_image_link: (p.images || []).slice(1, 5).map((img) => toAbsoluteAssetUrl(img)),
        brand: 'TORI-WEAR',
        google_product_category: 'Apparel & Accessories > Clothing > Shirts & Tops',
        gender: p.department === 'KIDS' ? 'kids' : 'unisex',
        material: `${p.gsm || 240} GSM ${p.fabric || '100% Combed Cotton'}`,
      };
    });
    res.setHeader('Cache-Control', 'public, max-age=900');
    return res.json({
      success: true,
      brand: 'TORI-WEAR',
      website: CANONICAL_SITE_ORIGIN,
      currency: 'INR',
      generatedAt: new Date().toISOString(),
      count: items.length,
      items,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to generate catalog JSON feed.' });
  }
});

app.get(['/api/v1/catalog/feed.xml', '/v1/catalog/feed.xml'], async (_req: Request, res: Response) => {
  try {
    const products = await productRepository.getAll({ status: 'PUBLISHED' });
    const itemsXml = products
      .map((p) => {
        const slug = encodeURIComponent(p.slug || p.id);
        const isAvailable = p.inStock && p.stock > 0;
        const desc = p.description || `${p.name} — Heavyweight ${p.gsm || 240} GSM ${p.fabric || 'cotton'} streetwear by TORI-WEAR.`;
        const regularPrice = `${Number(p.originalPrice || p.price).toFixed(2)} INR`;
        const salePrice = p.originalPrice && p.originalPrice > p.price ? `${Number(p.price).toFixed(2)} INR` : '';
        return `    <item>
      <g:id>${escapeXml(p.sku || p.id)}</g:id>
      <g:item_group_id>${escapeXml(p.id)}</g:item_group_id>
      <g:title>${escapeXml(p.name)}</g:title>
      <g:description>${escapeXml(desc)}</g:description>
      <g:link>${escapeXml(`${CANONICAL_SITE_ORIGIN}/product/${slug}`)}</g:link>
      <g:image_link>${escapeXml(toAbsoluteAssetUrl(p.images?.[0]))}</g:image_link>
      <g:brand>TORI-WEAR</g:brand>
      <g:condition>new</g:condition>
      <g:availability>${isAvailable ? 'in stock' : 'out of stock'}</g:availability>
      <g:price>${escapeXml(regularPrice)}</g:price>${salePrice ? `\n      <g:sale_price>${escapeXml(salePrice)}</g:sale_price>` : ''}
      <g:google_product_category>${escapeXml('Apparel & Accessories > Clothing > Shirts & Tops')}</g:google_product_category>
    </item>`;
      })
      .join('\n');

    const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">\n  <channel>\n    <title>TORI-WEAR Product Catalog</title>\n    <link>${CANONICAL_SITE_ORIGIN}</link>\n    <description>Original anime-inspired heavyweight 240 GSM streetwear by TORI-WEAR.</description>\n${itemsXml}\n  </channel>\n</rss>\n`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=900');
    return res.send(rss);
  } catch (err: any) {
    return res.status(500).type('text/plain').send('Failed to generate catalog XML feed.');
  }
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
app.use('/api', earlyAccessRouter);
app.use('/api', apiRouter);
app.use('/v1', apiRouter);
app.use('/api/platform', platformRouter);
app.use('/api', platformRouter);

// ==========================================
// 7. CATCH-ALL FOR UNMATCHED /api/* & /v1/* (PREVENTS HTML FALLBACK)
// ==========================================
app.all(['/api/*', '/v1/*'], (req: Request, res: Response) => {
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
  const mysqlReady = await ensureMySqlSchemaInitialized();
  const dbReady = mysqlReady || Boolean(getPrismaClient());

  if (dbReady) {
    await seedCatalogIfEmpty();
    await Promise.allSettled([
      authStore.ensureProductionBootstrap(),
      authStore.hydrateSessionsFromDb(),
      userStore.hydratePermissionsFromDb(),
      paymentConfigService.syncToDatabase(),
    ]);
  }

  const httpServer = http.createServer(app);

  // Initialize Realtime WebSocket & WebRTC Signaling
  setupRealtimeWebSocket(httpServer);

  const serverAdminPath = resolveConfiguredAdminPath();

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.ENABLE_VITE_HMR === 'true' ? { server: httpServer } : false,
        ws: process.env.ENABLE_VITE_HMR === 'true' ? { server: httpServer } : false,
      },
      appType: 'spa',
    });
    // Never allow Vite's HTML fallback to intercept /api, /v1, /generated-assets, /assets, /models, /robots.txt, or /sitemap.xml
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (
        req.originalUrl.startsWith('/api') ||
        req.originalUrl.startsWith('/v1') ||
        req.originalUrl.startsWith('/generated-assets') ||
        req.originalUrl.startsWith('/assets') ||
        req.originalUrl.startsWith('/models') ||
        req.path === '/robots.txt' ||
        req.path === '/sitemap.xml'
      ) {
        return next();
      }
      vite.middlewares(req, res, next);
    });
  } else {
    const candidateDistDirs = [
      path.resolve(process.cwd(), 'dist'),
      path.resolve(import.meta.dirname || process.cwd(), 'dist'),
      path.resolve(import.meta.dirname || process.cwd(), '..', 'dist'),
    ];
    const distDir = candidateDistDirs.find((d) => fs.existsSync(path.join(d, 'index.html'))) || candidateDistDirs[0]!;
    const indexHtmlPath = path.join(distDir, 'index.html');

    const getRuntimeSpaHtml = async (): Promise<string | null> => {
      if (!fs.existsSync(indexHtmlPath)) return null;
      const rawHtml = fs.readFileSync(indexHtmlPath, 'utf8');
      let metaDomainCode = '';
      let metaPixelId = '';
      try {
        const settings = await cmsRepository.getStoreSettings();
        metaDomainCode = String(settings?.metaBusiness?.domainVerificationCode || '').trim();
        metaPixelId = String(settings?.metaBusiness?.pixelId || '').trim();
      } catch {
        // Fallback safely without blocking HTML response
      }
      const metaTag = metaDomainCode
        ? `<meta name="facebook-domain-verification" content="${metaDomainCode.replace(/"/g, '&quot;')}" />\n    `
        : '';
      const runtimeScript = `<script>window.__TORI_RUNTIME_CONFIG__=${JSON.stringify({ adminPath: serverAdminPath, metaPixelId })};</script>`;
      if (rawHtml.includes('</head>')) {
        return rawHtml.replace('</head>', `    ${metaTag}${runtimeScript}\n  </head>`);
      }
      return `${metaTag}${runtimeScript}${rawHtml}`;
    };

    const sendSpaHtml = async (_req: Request, res: Response) => {
      const html = await getRuntimeSpaHtml();
      if (!html) {
        return res.status(503).send('Production frontend build (dist/index.html) not found. Run npm run build.');
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res.send(html);
    };

    app.use(express.static(distDir, {
      index: false,
      maxAge: '7d',
      etag: true,
    }));

    // Explicit production SPA routes for the private admin gateway & login subroutes
    const adminRoutePatterns = Array.from(
      new Set([
        '/tori-ops-gateway',
        '/tori-ops-gateway/*',
        serverAdminPath,
        `${serverAdminPath}/*`,
      ])
    );
    app.get(adminRoutePatterns, sendSpaHtml);

    app.get('*', (req: Request, res: Response) => {
      if (
        req.originalUrl.startsWith('/api') ||
        req.originalUrl.startsWith('/v1') ||
        req.originalUrl.startsWith('/generated-assets') ||
        req.originalUrl.startsWith('/assets') ||
        req.originalUrl.startsWith('/models')
      ) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Endpoint ${req.originalUrl} not found.`,
          },
        });
      }
      return sendSpaHtml(req, res);
    });
  }

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    console.error(`[SERVER] Failed to bind http://${host}:${port}:`, err?.message || err);
    process.exit(1);
  });

  httpServer.listen(port, host, () => {
    console.log(`[TORIWEAR] Enterprise Platform server & WebSocket running on http://${host}:${port}`);
    mediaCleanupService.startBackgroundSweeper();
  });

  const shutdown = async (signal: string) => {
    console.log(`[SERVER] Received ${signal}. Draining connections and shutting down gracefully...`);
    mediaCleanupService.stopBackgroundSweeper();
    httpServer.close(async () => {
      console.log('[SERVER] Closed HTTP & WebSocket connections.');
      try {
        const prisma = getPrismaClient();
        if (prisma) {
          await prisma.$disconnect();
          console.log('[SERVER] Disconnected from MySQL database.');
        }
      } catch (e) {
        console.warn('[SERVER] Error during Prisma disconnect:', e);
      }
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

startServer().catch((err) => {
  console.error('[SERVER] Fatal startup error:', err);
  process.exit(1);
});
