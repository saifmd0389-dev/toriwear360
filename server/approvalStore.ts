import fs from 'fs';
import path from 'path';
import { ApprovalRequest, PlatformUser } from './rbacTypes';
import { auditStore } from './auditStore';
import { resolveSecureStorePath } from './utils/storageHelper';

const APPROVALS_PERSIST_FILE = resolveSecureStorePath('approvals-store.json', 'public/generated-assets/approvals-store.json');

class ApprovalStore {
  private requests: ApprovalRequest[] = [];

  constructor() {
    this.loadOrSeedRequests();
  }

  private loadOrSeedRequests() {
    try {
      if (fs.existsSync(APPROVALS_PERSIST_FILE)) {
        const raw = fs.readFileSync(APPROVALS_PERSIST_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.requests = parsed;
          return;
        }
      }
    } catch (err) {
      console.warn('[APPROVALS] Failed to load approvals store from disk:', err);
    }
    this.seedInitialRequests();
    this.persistToDisk();
  }

  private persistToDisk() {
    try {
      const dir = path.dirname(APPROVALS_PERSIST_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmp = `${APPROVALS_PERSIST_FILE}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.requests, null, 2), 'utf-8');
      fs.renameSync(tmp, APPROVALS_PERSIST_FILE);
    } catch (err) {
      console.warn('[APPROVALS] Failed to persist approvals store to disk:', err);
    }
  }

  private seedInitialRequests() {
    const now = new Date();
    const isoHoursAgo = (hours: number) => new Date(now.getTime() - hours * 3600000).toISOString();

    this.requests = [
      {
        id: 'appr-001',
        type: 'PRICE_CHANGE',
        title: 'Price Adjustment: Neo-Tokyo Streetwear Oversized Hoodie',
        description: 'Proposed retail price reduction from ₹2,499 to ₹2,199 to increase velocity ahead of summer campaign.',
        amount: 2199,
        dataPayload: {
          productId: 'prod-hoodie-01',
          productName: 'Neo-Tokyo Streetwear Oversized Hoodie',
          oldPrice: 2499,
          newPrice: 2199,
        },
        status: 'SUBMITTED',
        submittedBy: {
          userId: 'usr-priya',
          name: 'Priya Patel',
          role: 'STAFF',
        },
        submittedAt: isoHoursAgo(4),
      },
      {
        id: 'appr-002',
        type: 'EXPENSE',
        title: 'Screen Printing High-Density Inks Bulk Restock',
        description: 'Order of 40kg Japanese plastisol inks (Matte Black, Crimson Red, Cyber White) for Tirupur facility.',
        amount: 34500,
        dataPayload: {
          vendor: 'Apex Inks & Textiles Ltd.',
          facility: 'Tirupur Hub',
          category: 'Manufacturing Supplies',
        },
        status: 'APPROVED',
        submittedBy: {
          userId: 'usr-simranjeet',
          name: 'Simranjeet Singh',
          role: 'PARTNER',
        },
        submittedAt: isoHoursAgo(24),
        reviewedBy: {
          userId: 'usr-saif',
          name: 'Mohammed Saif',
          role: 'SUPER_ADMIN',
        },
        reviewedAt: isoHoursAgo(20),
        reviewComment: 'Approved. Essential manufacturing supplies for upcoming drop.',
      },
      {
        id: 'appr-003',
        type: 'REFUND',
        title: 'Customer Refund: Order #TORI-10291 (Fabric Defect Claim)',
        description: 'Customer requested 100% refund due to reported print misregistration on Shadow Monarch Tee.',
        amount: 1499,
        dataPayload: {
          orderId: 'TORI-10291',
          customerName: 'Aditya Sharma',
          method: 'Razorpay UPI Return',
        },
        status: 'APPROVED',
        submittedBy: {
          userId: 'usr-ananya',
          name: 'Ananya Sharma',
          role: 'STAFF',
        },
        submittedAt: isoHoursAgo(16),
        reviewedBy: {
          userId: 'usr-saif',
          name: 'Mohammed Saif',
          role: 'SUPER_ADMIN',
        },
        reviewedAt: isoHoursAgo(12),
        reviewComment: 'QC confirmed fabric defect. Process full refund immediately.',
      },
      {
        id: 'appr-004',
        type: 'INVENTORY_ADJUSTMENT',
        title: 'Inventory Shrinkage Write-off: Tirupur Wash Testing',
        description: 'Write-off 12 units of Graphic Tee blank prototypes damaged during high-temperature shrinkage stress tests.',
        amount: 4200,
        dataPayload: {
          sku: 'TORI-BLK-TEE-RAW',
          quantity: 12,
          unitCost: 350,
          reason: 'QC Wash Stress Failure',
        },
        status: 'SUBMITTED',
        submittedBy: {
          userId: 'usr-rahul',
          name: 'Rahul Varma',
          role: 'STAFF',
        },
        submittedAt: isoHoursAgo(2),
      },
      {
        id: 'appr-005',
        type: 'MARKETING_EXPENDITURE',
        title: 'Instagram & Meta Reels Ad Spend (Batch 1)',
        description: 'Targeted campaign budget for Cyber Ronin collection launch video across Mumbai & Bengaluru metro circles.',
        amount: 15000,
        dataPayload: {
          platform: 'Meta Ads Manager',
          campaign: 'Cyber Ronin V1 Drop',
          durationDays: 7,
        },
        status: 'APPROVED',
        submittedBy: {
          userId: 'usr-priya',
          name: 'Priya Patel',
          role: 'STAFF',
        },
        submittedAt: isoHoursAgo(36),
        reviewedBy: {
          userId: 'usr-nagesh',
          name: 'Nagesh M',
          role: 'PARTNER',
        },
        reviewedAt: isoHoursAgo(30),
        reviewComment: 'Approved. Growth metrics look sound.',
      },
    ];
  }

  public getAll(): ApprovalRequest[] {
    return [...this.requests];
  }

  public getById(id: string): ApprovalRequest | undefined {
    return this.requests.find(r => r.id === id);
  }

  public findPendingByProductId(productId: string): ApprovalRequest | undefined {
    return this.requests.find(
      (r) =>
        r.type === 'PRODUCT_CREATION' &&
        r.status === 'SUBMITTED' &&
        r.dataPayload?.productId === productId
    );
  }

  public syncProductReviewRequest(params: {
    product: {
      id: string;
      catalogNumber: string;
      name: string;
      price: number;
      sku?: string;
      department?: string;
      world?: string;
      status: string;
    };
    actor: Pick<PlatformUser, 'id' | 'name' | 'role'>;
  }): ApprovalRequest | null {
    const existingPending = this.findPendingByProductId(params.product.id);

    if (params.product.status === 'REVIEW') {
      const title = `Product Review: ${params.product.name} (#${params.product.catalogNumber})`;
      const description = `Catalog item "${params.product.name}" (SKU: ${params.product.sku || params.product.catalogNumber}, Dept: ${params.product.department || 'MEN'}, World: ${params.product.world || 'STREET ANIME'}) was submitted with REVIEW status and requires executive approval.`;
      const dataPayload = {
        productId: params.product.id,
        catalogNumber: params.product.catalogNumber,
        productName: params.product.name,
        sku: params.product.sku || params.product.catalogNumber,
        department: params.product.department || 'MEN',
        world: params.product.world || 'STREET ANIME',
      };

      if (existingPending) {
        existingPending.title = title;
        existingPending.description = description;
        existingPending.amount = Number(params.product.price) || 0;
        existingPending.dataPayload = dataPayload;
        this.persistToDisk();
        return existingPending;
      }

      return this.createRequest({
        type: 'PRODUCT_CREATION',
        title,
        description,
        amount: Number(params.product.price) || 0,
        dataPayload,
        status: 'SUBMITTED',
        actor: {
          ...params.actor,
          email: '',
          accountStatus: 'ACTIVE',
          twoFactorEnabled: false,
          createdBy: 'SYSTEM',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          permissions: {
            dashboard: [],
            products: [],
            inventory: [],
            orders: [],
            customers: [],
            customerSupport: [],
            marketing: [],
            catalog: [],
            shipping: [],
            finance: [],
            reports: [],
            communication: [],
            meetings: [],
            aiDesignLab: [],
            superAdmin: [],
          },
          activeSessions: [],
        },
      });
    }

    if ((params.product.status === 'APPROVED' || params.product.status === 'PUBLISHED') && existingPending) {
      existingPending.status = 'APPROVED';
      existingPending.reviewedBy = {
        userId: params.actor.id,
        name: params.actor.name,
        role: params.actor.role,
      };
      existingPending.reviewedAt = new Date().toISOString();
      existingPending.reviewComment = `Auto-approved when product status changed to ${params.product.status}.`;
      this.persistToDisk();
      return existingPending;
    }

    return null;
  }

  public createRequest(params: {
    type: ApprovalRequest['type'];
    title: string;
    description: string;
    amount?: number;
    dataPayload?: any;
    status?: 'DRAFT' | 'SUBMITTED';
    actor: PlatformUser;
  }): ApprovalRequest {
    const newRequest: ApprovalRequest = {
      id: `appr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: params.type,
      title: params.title,
      description: params.description,
      amount: params.amount,
      dataPayload: params.dataPayload,
      status: params.status || 'SUBMITTED',
      submittedBy: {
        userId: params.actor.id,
        name: params.actor.name,
        role: params.actor.role,
      },
      submittedAt: new Date().toISOString(),
    };

    this.requests.unshift(newRequest);
    this.persistToDisk();

    auditStore.record({
      userId: params.actor.id,
      userName: params.actor.name,
      userRole: params.actor.role,
      module: 'approvals',
      action: 'APPROVAL_REQUEST_SUBMITTED',
      recordAffected: `${newRequest.type}: ${newRequest.title}`,
      newValue: `Status: ${newRequest.status}, Amount: ₹${newRequest.amount || 0}`,
      ipAddress: '103.21.144.12',
      severity: 'INFO',
    });

    return newRequest;
  }

  public reviewRequest(
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    comment: string,
    actor: PlatformUser
  ): { success: boolean; request?: ApprovalRequest; error?: string } {
    // Only Super Admin or Partners can approve sensitive staff actions
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'PARTNER') {
      return { success: false, error: 'Authorization error: Only Super Admin or Partners can approve or reject workflow requests.' };
    }

    const target = this.getById(id);
    if (!target) return { success: false, error: 'Approval request not found.' };

    if (target.status === 'VOIDED') {
      return { success: false, error: 'Cannot review a voided record.' };
    }

    const prevStatus = target.status;
    target.status = decision;
    target.reviewedBy = {
      userId: actor.id,
      name: actor.name,
      role: actor.role,
    };
    target.reviewedAt = new Date().toISOString();
    target.reviewComment = comment;
    this.persistToDisk();

    auditStore.record({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      module: 'approvals',
      action: decision === 'APPROVED' ? 'APPROVAL_REQUEST_APPROVED' : 'APPROVAL_REQUEST_REJECTED',
      recordAffected: `${target.type}: ${target.title} (ID: ${target.id})`,
      previousValue: `Status: ${prevStatus}`,
      newValue: `Status: ${decision}, Comment: "${comment}"`,
      ipAddress: '103.21.144.12',
      severity: decision === 'APPROVED' ? 'INFO' : 'WARNING',
    });

    return { success: true, request: target };
  }

  // Strict Compliance: Financial records are NEVER deleted; they are Voided / Reversed
  public voidRecord(
    id: string,
    voidReason: string,
    actor: PlatformUser
  ): { success: boolean; request?: ApprovalRequest; error?: string } {
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'PARTNER') {
      return { success: false, error: 'Authorization error: Only Super Admin or Partners can void records.' };
    }

    const target = this.getById(id);
    if (!target) return { success: false, error: 'Record not found.' };

    if (target.status === 'VOIDED') {
      return { success: false, error: 'Record is already voided.' };
    }

    const prevStatus = target.status;
    target.status = 'VOIDED';
    target.voidedBy = {
      userId: actor.id,
      name: actor.name,
    };
    target.voidedAt = new Date().toISOString();
    target.voidReason = voidReason;
    this.persistToDisk();

    auditStore.record({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      module: 'approvals',
      action: 'APPROVAL_RECORD_VOIDED',
      recordAffected: `${target.type}: ${target.title} (ID: ${target.id})`,
      previousValue: `Status: ${prevStatus}`,
      newValue: `Status: VOIDED, Reason: "${voidReason}", VoidedBy: ${actor.name}`,
      ipAddress: '103.21.144.12',
      severity: 'CRITICAL',
    });

    return { success: true, request: target };
  }
}

export const approvalStore = new ApprovalStore();
