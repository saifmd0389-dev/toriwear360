import express, { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { cmsRepository } from '../repositories/cmsRepository';
import { extractSessionToken } from '../middleware/authMiddleware';
import { userService } from '../services/userService';
import { authStore } from '../authStore';
import { userStore } from '../userStore';
import {
  DEFAULT_REGULAR_MAX_UPLOAD_BYTES,
  ImageValidationError,
  getConfiguredMaxUploadBytes,
  optimizeImageForStorage,
} from '../services/storage/imageOptimizer';
import {
  IMMUTABLE_IMAGE_CACHE_CONTROL,
  getStorageAdapter,
} from '../services/storage/storageAdapter';
import {
  ChunkUploadError,
  chunkUploadSessionManager,
} from '../services/storage/chunkUploadSessionManager';
import {
  extractAllMediaUrlsFromValue,
  mediaCleanupService,
} from '../services/storage/mediaCleanupService';

export const cmsRouter = Router();

// Middleware to enforce admin/staff authentication & CMS write permissions
function requireAdminAuth(requiredAction: 'view' | 'edit' = 'edit') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = extractSessionToken(req);

    if (token) {
      let resolvedUser: any = null;
      const session = await userService.validateSession(token);
      if (session) {
        const storeUser = userStore.getUserById(session.user.id);
        resolvedUser = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: session.user.role,
          permissions: storeUser?.permissions,
          department: session.user.department,
        };
      } else {
        const legacyUser = await authStore.getUserByTokenAsync(token);
        if (legacyUser) {
          resolvedUser = {
            id: legacyUser.id,
            email: legacyUser.email,
            name: legacyUser.name,
            role: legacyUser.role,
            permissions: legacyUser.permissions,
            department: legacyUser.department,
          };
        }
      }

      if (resolvedUser) {
        const role = String(resolvedUser.role || '').toUpperCase();
        if (role === 'CUSTOMER') {
          res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            error: 'Customers are not permitted to perform admin CMS operations.',
          });
          return;
        }

        const isPrivileged = role === 'SUPER_ADMIN' || role === 'PARTNER' || role === 'STORE_MANAGER';
        const perms = resolvedUser.permissions;
        const hasPerm = isPrivileged || (
          perms && (
            perms.website?.includes(requiredAction) ||
            perms.superAdmin?.includes(requiredAction) ||
            perms.catalog?.includes(requiredAction) ||
            perms.marketing?.includes(requiredAction) ||
            perms.aiDesignLab?.includes(requiredAction)
          )
        );

        if (!hasPerm) {
          res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            error: 'Insufficient permissions for CMS modification.',
          });
          return;
        }

        req.user = resolvedUser;
        req.sessionToken = token;
        return next();
      }
    }

    res.status(401).json({
      success: false,
      code: 'UNAUTHENTICATED',
      error: 'Admin authentication required to perform this CMS operation.',
    });
  };
}

// ============================================================================
// 1. PUBLIC STOREFRONT CMS APIS
// ============================================================================

/**
 * Public Frontpage CMS Data (Hero, Ordered Sections, Realms, Announcements, Lore)
 */
cmsRouter.get(['/frontpage', '/cms/frontpage', '/admin/frontpage', '/admin/cms/frontpage', '/cms/admin/frontpage'], async (_req: Request, res: Response) => {
  try {
    const data = await cmsRepository.getFrontPageData();
    res.json({
      success: true,
      data,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to retrieve frontpage CMS data' });
  }
});

/**
 * Public Hero Configuration
 */
cmsRouter.get(['/hero', '/cms/hero', '/admin/hero', '/admin/cms/hero', '/cms/admin/hero'], async (_req: Request, res: Response) => {
  try {
    const data = await cmsRepository.getFrontPageData();
    res.json({
      success: true,
      data: data.hero,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to retrieve hero settings' });
  }
});

const resolveExistingBrandAssetUrl = (preferred: string | undefined, candidates: string[]): string => {
  const publicDir = path.resolve(process.cwd(), 'public');
  const toCheck = [preferred, ...candidates].filter((v): v is string => Boolean(v && v.trim()));
  for (const url of toCheck) {
    if (!url.startsWith('/')) {
      return url;
    }
    const cleanRel = (url.split('?')[0] ?? url).replace(/^\/+/, '');
    const fullPath = path.resolve(publicDir, cleanRel);
    if (fs.existsSync(fullPath)) {
      return url;
    }
  }
  return candidates[candidates.length - 1] || '/assets/toriwear-official-logo.png';
};

/**
 * Public Store Settings (Shipping thresholds, Maintenance mode, Currency, Fees, Logo)
 */
cmsRouter.get(['/settings', '/cms/settings', '/admin/settings', '/admin/cms/settings', '/cms/admin/settings'], async (_req: Request, res: Response) => {
  try {
    const full = await cmsRepository.getStoreSettings();
    const resolvedLogoUrl = resolveExistingBrandAssetUrl(full.logoUrl, [
      '/assets/branding/toriwear-official-logo.svg',
      '/assets/toriwear-official-logo.svg',
      '/assets/branding/toriwear-official-logo.png',
      '/assets/toriwear-official-logo.png',
    ]);
    const resolvedSecondaryLogoUrl = resolveExistingBrandAssetUrl(full.secondaryLogoUrl, [
      '/assets/branding/second-brand-logo.svg',
      '/assets/second-brand-logo.svg',
      '/assets/branding/second-brand-logo.png',
      '/assets/second-brand-logo.png',
    ]);
    res.json({
      success: true,
      data: {
        storeName: full.storeName,
        tagline: full.tagline,
        freeShippingThreshold: full.freeShippingThreshold,
        standardShippingFee: full.standardShippingFee,
        codFee: full.codFee,
        currency: full.currency,
        maintenanceMode: full.maintenanceMode,
        supportEmail: full.supportEmail,
        supportPhone: full.supportPhone,
        gstNumber: full.gstNumber,
        panNumber: full.panNumber,
        registeredAddress: full.registeredAddress,
        operatingHours: full.operatingHours,
        logoUrl: resolvedLogoUrl,
        secondaryLogoUrl: resolvedSecondaryLogoUrl,
        logoUpdatedAt: full.logoUpdatedAt || null,
        whatsappNumber: full.whatsappNumber,
        whatsappDefaultMessage: full.whatsappDefaultMessage,
        contactChannels: full.contactChannels,
        returnWindowDays: full.returnWindowDays || 7,
        exchangeEnabled: full.exchangeEnabled !== false,
        metaBusiness: full.metaBusiness || { domainVerificationCode: '', pixelId: '', capiEnabled: false },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to retrieve store settings' });
  }
});

/**
 * Public Store Contact & Social Channels Endpoint (/api/v1/store/contact)
 */
cmsRouter.get(['/v1/store/contact', '/store/contact'], async (_req: Request, res: Response) => {
  try {
    const contact = await cmsRepository.getPublicContactConfig();
    res.json({ success: true, data: contact });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to retrieve store contact configuration' });
  }
});

/**
 * Admin Read Store Contact, Social & Support Policy Settings (/api/v1/admin/store/contact)
 */
cmsRouter.get(['/v1/admin/store/contact', '/admin/store/contact'], requireAdminAuth('view'), async (_req: Request, res: Response) => {
  try {
    const contact = await cmsRepository.getPublicContactConfig(true);
    return res.json({ success: true, data: contact });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to load admin contact settings' });
  }
});

/**
 * Admin Update Store Contact, Social & Support Policy Settings (/api/v1/admin/store/contact)
 */
cmsRouter.put(['/v1/admin/store/contact', '/admin/store/contact'], requireAdminAuth('edit'), async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const updates: Record<string, any> = {};
    if (typeof body.storeName === 'string' && body.storeName.trim()) updates.storeName = body.storeName.trim();
    if (typeof body.supportEmail === 'string') updates.supportEmail = body.supportEmail.trim();
    const incomingPhone = typeof body.supportPhone === 'string' ? body.supportPhone : typeof body.phone === 'string' ? body.phone : undefined;
    if (incomingPhone !== undefined) updates.supportPhone = incomingPhone.trim();
    if (typeof body.whatsappNumber === 'string') updates.whatsappNumber = body.whatsappNumber.trim();
    const incomingWaMsg = typeof body.whatsappDefaultMessage === 'string'
      ? body.whatsappDefaultMessage
      : typeof body.whatsappMessage === 'string'
        ? body.whatsappMessage
        : undefined;
    if (incomingWaMsg !== undefined) updates.whatsappDefaultMessage = incomingWaMsg.trim();
    if (typeof body.operatingHours === 'string') updates.operatingHours = body.operatingHours.trim();
    const incomingAddress = typeof body.registeredAddress === 'string'
      ? body.registeredAddress
      : typeof body.businessAddress === 'string'
        ? body.businessAddress
        : undefined;
    if (incomingAddress !== undefined) updates.registeredAddress = incomingAddress.trim();
    if (body.returnWindowDays !== undefined) updates.returnWindowDays = Math.max(1, Math.min(60, Number(body.returnWindowDays) || 7));
    if (typeof body.exchangeEnabled === 'boolean') updates.exchangeEnabled = body.exchangeEnabled;
    const rawChannels = Array.isArray(body.contactChannels)
      ? body.contactChannels
      : Array.isArray(body.channels)
        ? body.channels
        : undefined;
    if (rawChannels) updates.contactChannels = rawChannels;

    const saved = await cmsRepository.updateStoreSettings(updates, req.user?.id || req.user?.name || 'ADMIN');
    const adminContact = await cmsRepository.getPublicContactConfig(true);
    const publicContact = await cmsRepository.getPublicContactConfig(false);
    return res.json({ success: true, message: 'Contact & social settings saved.', data: adminContact, rawSettings: saved, publicContact });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to update contact settings' });
  }
});

/**
 * Admin Meta Business Integration Settings (/api/v1/admin/store/meta)
 * Server-side token is read strictly from process.env.META_CONVERSIONS_API_TOKEN and NEVER returned to client.
 */
cmsRouter.get(['/v1/admin/store/meta', '/admin/store/meta'], requireAdminAuth('view'), async (_req: Request, res: Response) => {
  try {
    const settings = await cmsRepository.getStoreSettings();
    return res.json({
      success: true,
      data: {
        domainVerificationCode: settings.metaBusiness?.domainVerificationCode || '',
        pixelId: settings.metaBusiness?.pixelId || '',
        capiEnabled: Boolean(settings.metaBusiness?.capiEnabled),
        capiTokenConfigured: Boolean(process.env.META_CONVERSIONS_API_TOKEN && process.env.META_CONVERSIONS_API_TOKEN.trim()),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to read Meta Business configuration' });
  }
});

cmsRouter.put(['/v1/admin/store/meta', '/admin/store/meta'], requireAdminAuth('edit'), async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const current = await cmsRepository.getStoreSettings();
    const nextMeta = {
      domainVerificationCode: typeof body.domainVerificationCode === 'string'
        ? body.domainVerificationCode.trim()
        : (current.metaBusiness?.domainVerificationCode || ''),
      pixelId: typeof body.pixelId === 'string'
        ? body.pixelId.replace(/[^0-9a-zA-Z_-]/g, '').trim()
        : (current.metaBusiness?.pixelId || ''),
      capiEnabled: typeof body.capiEnabled === 'boolean'
        ? body.capiEnabled
        : Boolean(current.metaBusiness?.capiEnabled),
    };

    await cmsRepository.updateStoreSettings({ metaBusiness: nextMeta }, req.user?.id || req.user?.name || 'ADMIN');
    return res.json({
      success: true,
      message: 'Meta Business settings updated.',
      data: {
        ...nextMeta,
        capiTokenConfigured: Boolean(process.env.META_CONVERSIONS_API_TOKEN && process.env.META_CONVERSIONS_API_TOKEN.trim()),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to update Meta Business settings' });
  }
});

/**
 * Storefront Meta Conversions API Deduplication Relay (/api/v1/store/meta/event)
 */
cmsRouter.post(['/v1/store/meta/event', '/store/meta/event'], async (req: Request, res: Response) => {
  try {
    const { dispatchMetaCapiEvent } = await import('../services/metaCapiService');
    const body = req.body || {};
    const validEvents = new Set(['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase']);
    const eventName = String(body.eventName || '');
    if (!validEvents.has(eventName)) {
      return res.status(400).json({ success: false, error: 'Unsupported Meta event name.' });
    }
    const eventId = String(body.eventId || crypto.randomUUID());
    const ip = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '');
    const result = await dispatchMetaCapiEvent({
      eventName: eventName as any,
      eventId,
      eventSourceUrl: typeof body.eventSourceUrl === 'string' ? body.eventSourceUrl : undefined,
      clientIpAddress: ip || undefined,
      clientUserAgent: String(req.headers['user-agent'] || '').slice(0, 255) || undefined,
      email: typeof body.email === 'string' ? body.email : undefined,
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      customData: body.customData && typeof body.customData === 'object' ? body.customData : undefined,
    });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Meta event relay failed' });
  }
});

// ============================================================================
// 2. PROTECTED ADMIN CMS APIS (Session & Role Enforced)
// ============================================================================

cmsRouter.post(['/admin/frontpage', '/frontpage', '/cms/frontpage', '/admin/cms/frontpage', '/cms/admin/frontpage'], requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const actorId = req.user?.id || req.user?.name || 'ADMIN';
    const saved = await mediaCleanupService.withMediaReferenceWrite(() =>
      cmsRepository.saveFrontPageData(req.body, actorId)
    );
    const savedUrls = new Set<string>();
    extractAllMediaUrlsFromValue(saved, savedUrls);
    if (savedUrls.size > 0) {
      mediaCleanupService.markUrlsCommitted(Array.from(savedUrls)).catch(() => {});
    }
    res.json({
      success: true,
      message: 'Frontpage CMS successfully published and persisted to backend.',
      data: saved,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to save frontpage CMS data' });
  }
});

cmsRouter.put(['/admin/sections', '/sections', '/cms/sections', '/admin/cms/sections', '/cms/admin/sections'], requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    if (!Array.isArray(req.body.sections)) {
      return res.status(400).json({ success: false, error: 'Expected "sections" array in request body.' });
    }
    const actorId = req.user?.id || req.user?.name || 'ADMIN';
    const updated = await mediaCleanupService.withMediaReferenceWrite(() =>
      cmsRepository.updateSections(req.body.sections, actorId)
    );
    const savedUrls = new Set<string>();
    extractAllMediaUrlsFromValue(updated, savedUrls);
    if (savedUrls.size > 0) {
      mediaCleanupService.markUrlsCommitted(Array.from(savedUrls)).catch(() => {});
    }
    return res.json({
      success: true,
      message: 'Homepage sections order and visibility updated.',
      data: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to update sections' });
  }
});

cmsRouter.put(['/admin/hero', '/hero', '/cms/hero', '/admin/cms/hero', '/cms/admin/hero'], requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const actorId = req.user?.id || req.user?.name || 'ADMIN';
    const updated = await mediaCleanupService.withMediaReferenceWrite(() =>
      cmsRepository.updateHero(req.body, actorId)
    );
    const savedUrls = new Set<string>();
    extractAllMediaUrlsFromValue(updated, savedUrls);
    if (savedUrls.size > 0) {
      mediaCleanupService.markUrlsCommitted(Array.from(savedUrls)).catch(() => {});
    }
    res.json({
      success: true,
      message: 'Hero billboard configuration updated.',
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to update hero settings' });
  }
});

cmsRouter.post(['/admin/reset', '/reset', '/cms/reset', '/admin/cms/reset', '/cms/admin/reset'], requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const actorId = req.user?.id || req.user?.name || 'ADMIN';
    const reset = await mediaCleanupService.withMediaReferenceWrite(() =>
      cmsRepository.resetToDefaults(actorId)
    );
    res.json({
      success: true,
      message: 'CMS configurations reset to baseline factory defaults.',
      data: reset,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to reset CMS defaults' });
  }
});

cmsRouter.put(['/admin/settings', '/settings', '/cms/settings', '/admin/cms/settings', '/cms/admin/settings'], requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const actorId = req.user?.id || req.user?.name || 'ADMIN';
    const updated = await mediaCleanupService.withMediaReferenceWrite(() =>
      cmsRepository.updateStoreSettings(req.body, actorId)
    );
    const savedUrls = new Set<string>();
    extractAllMediaUrlsFromValue(updated, savedUrls);
    if (savedUrls.size > 0) {
      mediaCleanupService.markUrlsCommitted(Array.from(savedUrls)).catch(() => {});
    }
    res.json({
      success: true,
      message: 'Store settings successfully updated.',
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to update store settings' });
  }
});

function buildUniqueAssetFilename(rawFilename: string | undefined, extension: string): string {
  const baseName = rawFilename ? path.basename(rawFilename, path.extname(rawFilename)) : 'cms';
  const safePrefix = baseName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'cms';
  return `cms-${safePrefix}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${extension}`;
}

cmsRouter.post(['/upload-asset', '/cms/upload-asset', '/admin/upload-asset', '/admin/cms/upload-asset'], requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const { dataUrl, filename } = req.body || {};
    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing image dataUrl payload.' });
    }

    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml|avif);base64,(.+)$/i);
    if (!match || !match[1] || !match[2]) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported image format. Allowed types: PNG, JPEG, WEBP, AVIF, GIF, SVG.',
      });
    }

    const declaredMimeType = `image/${match[1].toLowerCase()}`;
    const rawBuffer = Buffer.from(match[2], 'base64');

    const optimized = await optimizeImageForStorage(rawBuffer, {
      filename: typeof filename === 'string' ? filename : undefined,
      mimeType: declaredMimeType,
      maxBytes: DEFAULT_REGULAR_MAX_UPLOAD_BYTES,
    });

    const storage = getStorageAdapter();
    const outName = buildUniqueAssetFilename(typeof filename === 'string' ? filename : undefined, optimized.extension);
    const uploadRes = await storage.uploadFile(optimized.buffer, outName, optimized.contentType, {
      cacheControl: IMMUTABLE_IMAGE_CACHE_CONTROL,
    });

    if (!uploadRes.success || !uploadRes.url) {
      return res.status(uploadRes.statusCode || 502).json({
        success: false,
        error: uploadRes.error || 'Failed to persist uploaded image asset.',
      });
    }

    const ownerId = String(req.user?.id || req.user?.email || 'ADMIN').trim();
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : undefined;
    await mediaCleanupService
      .registerPendingUpload({
        url: uploadRes.url,
        ownerId,
        sessionId: sessionId || undefined,
        storageKey: uploadRes.destinationPath,
        provider: storage.providerName,
      })
      .catch(() => {});

    return res.json({
      success: true,
      url: uploadRes.url,
      contentType: uploadRes.contentType || optimized.contentType,
      sizeBytes: uploadRes.sizeBytes ?? optimized.optimizedSizeBytes,
      originalSizeBytes: optimized.originalSizeBytes,
      width: optimized.width,
      height: optimized.height,
      optimized: optimized.optimized,
      storageProvider: storage.providerName,
    });
  } catch (err: any) {
    if (err instanceof ImageValidationError) {
      return res.status(err.statusCode).json({
        success: false,
        code: err.code,
        error: err.message,
      });
    }
    console.error('[CMS] Asset upload error:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Failed to upload CMS image asset.' });
  }
});

// Raw binary chunked upload endpoint — binds sessions to the authenticated admin identity,
// enforces sequential chunks and consistent metadata, isolates per-session staging files,
// optimizes with Sharp, and uploads to the configured StorageAdapter (local or GCS).
cmsRouter.post(
  ['/upload-asset-chunk', '/cms/upload-asset-chunk', '/admin/upload-asset-chunk', '/admin/cms/upload-asset-chunk'],
  requireAdminAuth(),
  express.raw({ type: 'application/octet-stream', limit: '8mb' }),
  async (req: Request, res: Response) => {
    try {
      const ownerId = String(req.user?.id || req.user?.email || '').trim();
      if (!ownerId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHENTICATED',
          error: 'Authenticated admin identity is required for chunked uploads.',
        });
      }

      const uploadId = String(req.query.uploadId || '').trim();
      const chunkIndex = Number(req.query.chunkIndex);
      const totalChunks = Number(req.query.totalChunks);
      const rawFilename = String(req.query.filename || 'image.png').trim();
      const mimeType = String(req.query.mimeType || '').trim().toLowerCase();
      const maxUploadBytes = getConfiguredMaxUploadBytes();

      const chunkBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');

      if (chunkIndex === 0) {
        const extFromName = path.extname(rawFilename).toLowerCase().replace('.', '');
        const allowedExts = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif']);
        let ext = allowedExts.has(extFromName) ? (extFromName === 'jpeg' ? 'jpg' : extFromName) : '';
        if (!ext) {
          if (mimeType.includes('png')) ext = 'png';
          else if (mimeType.includes('webp')) ext = 'webp';
          else if (mimeType.includes('gif')) ext = 'gif';
          else if (mimeType.includes('svg')) ext = 'svg';
          else if (mimeType.includes('avif')) ext = 'avif';
          else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
        }
        if (!ext) {
          return res.status(400).json({
            success: false,
            error: 'Unsupported image format. Allowed types: PNG, JPEG, WEBP, GIF, SVG, AVIF.',
          });
        }
      }

      // Fail fast if cloud storage is explicitly enabled but misconfigured
      const storage = getStorageAdapter();
      const storageStatus = storage.getConfigStatus();
      if (!storageStatus.configured) {
        return res.status(503).json({
          success: false,
          error: storageStatus.error || 'Configured storage provider is unavailable.',
        });
      }

      const outcome = chunkUploadSessionManager.appendChunk({
        ownerId,
        uploadId,
        chunkIndex,
        totalChunks,
        filename: rawFilename,
        mimeType,
        chunkBuffer,
        maxUploadBytes,
      });

      if (!outcome.completed || !outcome.assembledBuffer) {
        return res.json({
          success: true,
          completed: false,
          chunkIndex: outcome.chunkIndex,
          totalChunks: outcome.totalChunks,
        });
      }

      // Note: chunkUploadSessionManager has already cleaned up the temporary staging file on finalization.
      const optimized = await optimizeImageForStorage(outcome.assembledBuffer, {
        filename: rawFilename,
        mimeType,
        maxBytes: maxUploadBytes,
      });

      const outName = buildUniqueAssetFilename(rawFilename, optimized.extension);
      const uploadRes = await storage.uploadFile(optimized.buffer, outName, optimized.contentType, {
        cacheControl: IMMUTABLE_IMAGE_CACHE_CONTROL,
      });

      if (!uploadRes.success || !uploadRes.url) {
        return res.status(uploadRes.statusCode || 502).json({
          success: false,
          error: uploadRes.error || 'Failed to persist uploaded image asset.',
        });
      }

      const editorSessionId = String(req.query.sessionId || '').trim() || undefined;
      await mediaCleanupService
        .registerPendingUpload({
          url: uploadRes.url,
          ownerId,
          sessionId: editorSessionId,
          storageKey: uploadRes.destinationPath,
          provider: storage.providerName,
        })
        .catch(() => {});

      return res.json({
        success: true,
        completed: true,
        url: uploadRes.url,
        contentType: uploadRes.contentType || optimized.contentType,
        sizeBytes: uploadRes.sizeBytes ?? optimized.optimizedSizeBytes,
        originalSizeBytes: optimized.originalSizeBytes,
        width: optimized.width,
        height: optimized.height,
        optimized: optimized.optimized,
        storageProvider: storage.providerName,
      });
    } catch (err: any) {
      if (err instanceof ChunkUploadError) {
        return res.status(err.statusCode).json({
          success: false,
          code: err.code,
          error: err.message,
        });
      }
      if (err instanceof ImageValidationError) {
        return res.status(err.statusCode).json({
          success: false,
          code: err.code,
          error: err.message,
        });
      }
      console.error('[CMS] Chunked asset upload error:', err?.message || err);
      return res.status(500).json({ success: false, error: 'Failed to process uploaded image chunk.' });
    }
  }
);

// Protected admin endpoint to safely discard unsaved images uploaded during a cancelled editor session.
// Verifies ownership against the durable pending-upload registry and enforces full cross-entity reference checks.
cmsRouter.post(
  ['/discard-uploads', '/cms/discard-uploads', '/admin/discard-uploads', '/admin/cms/discard-uploads'],
  requireAdminAuth(),
  async (req: Request, res: Response) => {
    try {
      const ownerId = String(req.user?.id || req.user?.email || '').trim();
      if (!ownerId) {
        return res.status(401).json({ success: false, error: 'Authenticated admin identity required.' });
      }
      const rawUrls = Array.isArray(req.body?.urls) ? req.body.urls : [];
      const urls = rawUrls
        .filter((u: unknown): u is string => typeof u === 'string' && u.trim().length > 0)
        .slice(0, 100);
      const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : undefined;
      const role = String(req.user?.role || '').toUpperCase();
      const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'FOUNDER';

      const result = await mediaCleanupService.discardPendingUploads({
        urls,
        ownerId,
        sessionId: sessionId || undefined,
        isSuperAdmin,
      });

      return res.json({
        success: true,
        acceptedCount: result.acceptedUrls.length,
        rejectedCount: result.rejectedUrls.length,
        deletedCount: result.report.deletedKeys.length,
        preservedCount: result.report.preservedReferencedKeys.length,
      });
    } catch (err: any) {
      console.warn('[CMS] Discard uploads error (non-fatal):', err?.message || err);
      return res.json({ success: true, acceptedCount: 0, deletedCount: 0 });
    }
  }
);

// Protected admin endpoint for active Product Editor media leases (heartbeat & release).
// Prevents another admin's deletion/cleanup from removing images currently open in an active editor.
cmsRouter.post(
  ['/media-lease', '/cms/media-lease', '/admin/media-lease', '/admin/cms/media-lease'],
  requireAdminAuth(),
  async (req: Request, res: Response) => {
    try {
      const ownerId = String(req.user?.id || req.user?.email || '').trim();
      if (!ownerId) {
        return res.status(401).json({ success: false, error: 'Authenticated admin identity required.' });
      }
      const action = String(req.body?.action || 'heartbeat').trim().toLowerCase();
      const sessionId = String(req.body?.sessionId || '').trim();
      if (!sessionId || sessionId.length > 128) {
        return res.status(400).json({ success: false, error: 'Valid editor sessionId is required.' });
      }

      if (action === 'release') {
        const released = await mediaCleanupService.releaseEditorMediaLease({ sessionId, ownerId });
        return res.json({ success: true, released });
      }

      const rawUrls = Array.isArray(req.body?.urls) ? req.body.urls : [];
      const urls = rawUrls
        .filter((u: unknown): u is string => typeof u === 'string' && u.trim().length > 0)
        .slice(0, 200);
      const entityId = typeof req.body?.entityId === 'string' ? req.body.entityId.trim().slice(0, 128) : undefined;

      const lease = await mediaCleanupService.upsertEditorMediaLease({
        sessionId,
        ownerId,
        entityId,
        urls,
      });

      return res.json({
        success: true,
        leasedKeysCount: lease?.storageKeys.length ?? 0,
        expiresAt: lease?.expiresAt ?? null,
      });
    } catch (err: any) {
      console.warn('[CMS] Media lease error (non-fatal):', err?.message || err);
      return res.json({ success: true, leasedKeysCount: 0 });
    }
  }
);
