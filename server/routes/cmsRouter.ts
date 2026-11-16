import express, { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { cmsRepository } from '../repositories/cmsRepository';
import { extractSessionToken } from '../middleware/authMiddleware';
import { userService } from '../services/userService';
import { authStore } from '../authStore';

export const cmsRouter = Router();

// Middleware to enforce admin/staff authentication & CMS write permissions
function requireAdminAuth(requiredAction: 'view' | 'edit' = 'edit') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = extractSessionToken(req);

    if (token) {
      let resolvedUser: any = null;
      const session = await userService.validateSession(token);
      if (session) {
        resolvedUser = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: session.user.role,
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
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to retrieve store settings' });
  }
});

// ============================================================================
// 2. PROTECTED ADMIN CMS APIS (Session & Role Enforced)
// ============================================================================

cmsRouter.post(['/admin/frontpage', '/frontpage', '/cms/frontpage', '/admin/cms/frontpage', '/cms/admin/frontpage'], requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const actorId = req.user?.id || req.user?.name || 'ADMIN';
    const saved = await cmsRepository.saveFrontPageData(req.body, actorId);
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
    const updated = await cmsRepository.updateSections(req.body.sections, actorId);
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
    const updated = await cmsRepository.updateHero(req.body, actorId);
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
    const reset = await cmsRepository.resetToDefaults(actorId);
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
    const updated = await cmsRepository.updateStoreSettings(req.body, actorId);
    res.json({
      success: true,
      message: 'Store settings successfully updated.',
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to update store settings' });
  }
});

cmsRouter.post(['/upload-asset', '/cms/upload-asset', '/admin/upload-asset', '/admin/cms/upload-asset'], requireAdminAuth(), async (req: Request, res: Response) => {
  try {
    const { dataUrl, filename } = req.body || {};
    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing image dataUrl payload.' });
    }

    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,(.+)$/i);
    if (!match || !match[1] || !match[2]) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported image format. Allowed types: PNG, JPEG, WEBP, GIF, SVG.',
      });
    }

    const rawMimeSub = match[1].toLowerCase();
    const ext = rawMimeSub === 'jpeg' ? 'jpg' : rawMimeSub === 'svg+xml' ? 'svg' : rawMimeSub;
    const buffer = Buffer.from(match[2], 'base64');

    if (buffer.length === 0) {
      return res.status(400).json({ success: false, error: 'Uploaded image file is empty.' });
    }
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(413).json({ success: false, error: 'Image size exceeds 10 MB limit.' });
    }

    const assetsDir = path.resolve(process.cwd(), 'public/generated-assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    const safePrefix = typeof filename === 'string'
      ? filename.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'cms'
      : 'cms';
    const outName = `cms-${safePrefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
    const outPath = path.join(assetsDir, outName);
    const tmpPath = `${outPath}.tmp`;

    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, outPath);

    return res.json({
      success: true,
      url: `/generated-assets/${outName}`,
      sizeBytes: buffer.length,
    });
  } catch (err: any) {
    console.error('[CMS] Asset upload error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to upload CMS image asset.' });
  }
});

// Raw binary chunked upload endpoint — bypasses JSON Base64 inflation and 32MB request body limits,
// allowing unlimited image file sizes to stream cleanly to disk in small binary chunks.
cmsRouter.post(
  ['/upload-asset-chunk', '/cms/upload-asset-chunk', '/admin/upload-asset-chunk', '/admin/cms/upload-asset-chunk'],
  requireAdminAuth(),
  express.raw({ type: 'application/octet-stream', limit: '8mb' }),
  async (req: Request, res: Response) => {
    try {
      const uploadId = String(req.query.uploadId || '').trim();
      const chunkIndex = Number(req.query.chunkIndex);
      const totalChunks = Number(req.query.totalChunks);
      const rawFilename = String(req.query.filename || 'image.png');
      const mimeType = String(req.query.mimeType || '').toLowerCase();

      if (!/^[a-zA-Z0-9_-]{8,64}$/.test(uploadId)) {
        return res.status(400).json({ success: false, error: 'Invalid upload session ID.' });
      }
      if (!Number.isInteger(chunkIndex) || !Number.isInteger(totalChunks) || chunkIndex < 0 || totalChunks < 1 || chunkIndex >= totalChunks) {
        return res.status(400).json({ success: false, error: 'Invalid chunk index parameters.' });
      }

      const chunkBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      if (chunkBuffer.length === 0) {
        return res.status(400).json({ success: false, error: 'Received empty upload chunk.' });
      }

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

      const assetsDir = path.resolve(process.cwd(), 'public/generated-assets');
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      const tmpChunkPath = path.join(assetsDir, `.tmp-chunk-${uploadId}.bin`);
      if (chunkIndex === 0) {
        fs.writeFileSync(tmpChunkPath, chunkBuffer);
      } else {
        if (!fs.existsSync(tmpChunkPath)) {
          return res.status(400).json({ success: false, error: 'Upload session expired or missing initial chunk.' });
        }
        fs.appendFileSync(tmpChunkPath, chunkBuffer);
      }

      if (chunkIndex < totalChunks - 1) {
        return res.json({
          success: true,
          completed: false,
          chunkIndex,
          totalChunks,
        });
      }

      const stats = fs.statSync(tmpChunkPath);
      const baseName = path.basename(rawFilename, path.extname(rawFilename));
      const safePrefix = baseName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'cms';
      const outName = `cms-${safePrefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
      const outPath = path.join(assetsDir, outName);

      fs.renameSync(tmpChunkPath, outPath);

      return res.json({
        success: true,
        completed: true,
        url: `/generated-assets/${outName}`,
        sizeBytes: stats.size,
      });
    } catch (err: any) {
      console.error('[CMS] Chunked asset upload error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Failed to stream image chunk.' });
    }
  }
);
