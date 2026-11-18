import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getPrismaClient } from '../db/prisma';
import { resolveSecureStorePath } from '../utils/storageHelper';
import { productRepository } from './productRepository';

const STORE_PATH = resolveSecureStorePath('reviews-store.json', 'public/generated-assets/reviews-store.json');

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type FitFeedback = 'TRUE_TO_SIZE' | 'RUNS_SMALL' | 'RUNS_LARGE';

export interface ReviewRecord {
  id: string;
  productId: string;
  productName?: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  rating: number;
  title?: string;
  comment: string;
  verifiedPurchase: boolean;
  sizePurchased?: string;
  fitFeedback?: FitFeedback;
  status: ReviewStatus;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductReviewSummary {
  averageRating: number;
  totalCount: number;
  verifiedCount: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  fitBreakdown: {
    TRUE_TO_SIZE: number;
    RUNS_SMALL: number;
    RUNS_LARGE: number;
  };
}

function normalizeFitFeedback(raw?: string): FitFeedback | undefined {
  if (!raw) return undefined;
  const upper = raw.trim().toUpperCase().replace(/\s+/g, '_');
  if (upper === 'TRUE_TO_SIZE' || upper === 'RUNS_SMALL' || upper === 'RUNS_LARGE') {
    return upper;
  }
  return undefined;
}

export class ReviewRepository {
  private fallbackReviews: Map<string, ReviewRecord> = new Map();
  private initialized = false;

  private ensureLoaded() {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const dir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        const list = JSON.parse(raw) as ReviewRecord[];
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item && item.id) {
              this.fallbackReviews.set(item.id, item);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[REVIEW_REPO] Failed to load reviews disk store:', err);
    }
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const list = Array.from(this.fallbackReviews.values());
      const tmpPath = `${STORE_PATH}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(list, null, 2), 'utf-8');
      fs.renameSync(tmpPath, STORE_PATH);
    } catch (err) {
      console.warn('[REVIEW_REPO] Failed to save reviews disk store:', err);
    }
  }

  private mapPrismaToRecord(r: any): ReviewRecord {
    return {
      id: r.id,
      productId: r.productId,
      productName: r.product?.name || undefined,
      customerId: r.customerId || undefined,
      customerName: r.customerName,
      rating: Number(r.rating || 5),
      title: r.title || undefined,
      comment: r.comment,
      verifiedPurchase: Boolean(r.verifiedPurchase),
      sizePurchased: r.sizePurchased || undefined,
      fitFeedback: normalizeFitFeedback(r.fitFeedback),
      status: (r.status || 'APPROVED') as ReviewStatus,
      isFeatured: Boolean(r.isFeatured),
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  async getById(id: string): Promise<ReviewRecord | null> {
    this.ensureLoaded();
    const prisma = getPrismaClient();
    if (prisma?.review) {
      try {
        const row = await prisma.review.findUnique({
          where: { id },
          include: { product: { select: { name: true } } },
        });
        if (row) return this.mapPrismaToRecord(row);
      } catch (err) {
        console.warn('[REVIEW_REPO] Prisma getById fallback:', err);
      }
    }
    return this.fallbackReviews.get(id) || null;
  }

  async listByProduct(
    productId: string,
    options?: {
      includeAllStatuses?: boolean;
      rating?: number;
      fitFeedback?: string;
      verifiedOnly?: boolean;
      sort?: 'recent' | 'highest' | 'lowest';
    }
  ): Promise<{ reviews: ReviewRecord[]; summary: ProductReviewSummary }> {
    this.ensureLoaded();
    let allForProduct: ReviewRecord[] = [];

    const prisma = getPrismaClient();
    if (prisma?.review) {
      try {
        const rows = await prisma.review.findMany({
          where: { productId },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
        allForProduct = rows.map((r: any) => this.mapPrismaToRecord(r));
      } catch (err) {
        console.warn('[REVIEW_REPO] Prisma listByProduct fallback:', err);
      }
    }

    if (allForProduct.length === 0) {
      allForProduct = Array.from(this.fallbackReviews.values()).filter(
        (r) => r.productId === productId
      );
    }

    const approvedReviews = allForProduct.filter((r) => r.status === 'APPROVED');
    const summary = this.computeSummary(approvedReviews);

    let filtered = options?.includeAllStatuses ? [...allForProduct] : [...approvedReviews];

    if (options?.rating && options.rating >= 1 && options.rating <= 5) {
      filtered = filtered.filter((r) => Math.round(r.rating) === options.rating);
    }

    const fitFilter = normalizeFitFeedback(options?.fitFeedback);
    if (fitFilter) {
      filtered = filtered.filter((r) => r.fitFeedback === fitFilter);
    }

    if (options?.verifiedOnly) {
      filtered = filtered.filter((r) => r.verifiedPurchase);
    }

    const sortMode = options?.sort || 'recent';
    filtered.sort((a, b) => {
      if (sortMode === 'highest') {
        if (b.rating !== a.rating) return b.rating - a.rating;
      } else if (sortMode === 'lowest') {
        if (a.rating !== b.rating) return a.rating - b.rating;
      } else {
        if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return { reviews: filtered, summary };
  }

  computeSummary(approvedReviews: ReviewRecord[]): ProductReviewSummary {
    const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const fitBreakdown = { TRUE_TO_SIZE: 0, RUNS_SMALL: 0, RUNS_LARGE: 0 };
    let sum = 0;
    let verifiedCount = 0;

    for (const r of approvedReviews) {
      const clamped = Math.max(1, Math.min(5, Math.round(Number(r.rating || 5)))) as 1 | 2 | 3 | 4 | 5;
      breakdown[clamped] += 1;
      sum += clamped;
      if (r.verifiedPurchase) verifiedCount += 1;
      if (r.fitFeedback && r.fitFeedback in fitBreakdown) {
        fitBreakdown[r.fitFeedback] += 1;
      }
    }

    const totalCount = approvedReviews.length;
    const averageRating = totalCount > 0 ? Math.round((sum / totalCount) * 10) / 10 : 0;

    return {
      averageRating,
      totalCount,
      verifiedCount,
      breakdown,
      fitBreakdown,
    };
  }

  async recalculateProductRatingStats(productId: string): Promise<ProductReviewSummary> {
    const { summary } = await this.listByProduct(productId);
    await productRepository.updateRatingStats(productId, summary.averageRating, summary.totalCount);
    return summary;
  }

  async listAllAdmin(filter?: {
    status?: string;
    productId?: string;
    search?: string;
  }): Promise<ReviewRecord[]> {
    this.ensureLoaded();
    let list: ReviewRecord[] = [];

    const prisma = getPrismaClient();
    if (prisma?.review) {
      try {
        const rows = await prisma.review.findMany({
          include: { product: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
        list = rows.map((r: any) => this.mapPrismaToRecord(r));
      } catch (err) {
        console.warn('[REVIEW_REPO] Prisma listAllAdmin fallback:', err);
      }
    }

    if (list.length === 0) {
      list = Array.from(this.fallbackReviews.values());
    }

    // Enrich product names cleanly
    const products = await productRepository.getAll();
    const productNameMap = new Map(products.map((p) => [p.id, p.name]));
    list = list.map((r) => ({
      ...r,
      productName: r.productName || productNameMap.get(r.productId) || r.productId,
    }));

    if (filter?.status && filter.status !== 'ALL') {
      const st = filter.status.toUpperCase();
      list = list.filter((r) => r.status === st);
    }

    if (filter?.productId) {
      list = list.filter((r) => r.productId === filter.productId);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.customerName.toLowerCase().includes(q) ||
          (r.productName || '').toLowerCase().includes(q) ||
          (r.title || '').toLowerCase().includes(q) ||
          r.comment.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }

  async create(input: {
    productId: string;
    productName?: string;
    customerId?: string;
    customerName: string;
    customerEmail?: string;
    rating: number;
    title?: string;
    comment: string;
    verifiedPurchase: boolean;
    sizePurchased?: string;
    fitFeedback?: string;
    status?: ReviewStatus;
  }): Promise<ReviewRecord> {
    this.ensureLoaded();
    const now = new Date().toISOString();
    const id = `rev-${crypto.randomBytes(6).toString('hex')}`;
    const clampedRating = Math.max(1, Math.min(5, Math.round(Number(input.rating || 5))));
    const fitFeedback = normalizeFitFeedback(input.fitFeedback);

    const record: ReviewRecord = {
      id,
      productId: input.productId,
      productName: input.productName,
      customerId: input.customerId,
      customerName: input.customerName.trim(),
      customerEmail: input.customerEmail?.trim().toLowerCase() || undefined,
      rating: clampedRating,
      title: input.title?.trim() || undefined,
      comment: input.comment.trim(),
      verifiedPurchase: Boolean(input.verifiedPurchase),
      sizePurchased: input.sizePurchased?.trim() || undefined,
      fitFeedback,
      status: input.status || 'APPROVED',
      isFeatured: false,
      createdAt: now,
      updatedAt: now,
    };

    this.fallbackReviews.set(record.id, record);
    this.saveToDisk();

    const prisma = getPrismaClient();
    if (prisma?.review) {
      try {
        // Verify referenced product/customer exist in Prisma before linking foreign keys
        const productExists = await prisma.product.findUnique({ where: { id: record.productId } });
        if (productExists) {
          let linkedCustomerId: string | null = null;
          if (record.customerId) {
            const custExists = await prisma.customer.findUnique({ where: { id: record.customerId } });
            if (custExists) linkedCustomerId = custExists.id;
          }
          await prisma.review.create({
            data: {
              id: record.id,
              productId: record.productId,
              customerId: linkedCustomerId,
              customerName: record.customerName,
              rating: record.rating,
              title: record.title || null,
              comment: record.comment,
              verifiedPurchase: record.verifiedPurchase,
              sizePurchased: record.sizePurchased || null,
              fitFeedback: record.fitFeedback || null,
              status: record.status as any,
              isFeatured: record.isFeatured,
              createdAt: new Date(record.createdAt),
              updatedAt: new Date(record.updatedAt),
            },
          });
        }
      } catch (err) {
        console.warn('[REVIEW_REPO] Prisma create failed, stored on disk:', err);
      }
    }

    await this.recalculateProductRatingStats(record.productId);
    return record;
  }

  async moderate(
    id: string,
    updates: { status?: ReviewStatus; isFeatured?: boolean }
  ): Promise<ReviewRecord | null> {
    this.ensureLoaded();
    const existing = (await this.getById(id)) || this.fallbackReviews.get(id);
    if (!existing) return null;

    const merged: ReviewRecord = {
      ...existing,
      status: updates.status || existing.status,
      isFeatured: updates.isFeatured !== undefined ? updates.isFeatured : existing.isFeatured,
      updatedAt: new Date().toISOString(),
    };

    this.fallbackReviews.set(id, merged);
    this.saveToDisk();

    const prisma = getPrismaClient();
    if (prisma?.review) {
      try {
        await prisma.review.update({
          where: { id },
          data: {
            status: merged.status as any,
            isFeatured: merged.isFeatured,
            updatedAt: new Date(merged.updatedAt),
          },
        });
      } catch (err) {
        console.warn('[REVIEW_REPO] Prisma moderate fallback:', err);
      }
    }

    await this.recalculateProductRatingStats(merged.productId);
    return merged;
  }

  async delete(id: string): Promise<boolean> {
    this.ensureLoaded();
    const existing = (await this.getById(id)) || this.fallbackReviews.get(id);
    if (!existing) return false;

    this.fallbackReviews.delete(id);
    this.saveToDisk();

    const prisma = getPrismaClient();
    if (prisma?.review) {
      try {
        await prisma.review.deleteMany({ where: { id } });
      } catch (err) {
        console.warn('[REVIEW_REPO] Prisma delete fallback:', err);
      }
    }

    await this.recalculateProductRatingStats(existing.productId);
    return true;
  }
}

export const reviewRepository = new ReviewRepository();
