import fs from 'fs';
import path from 'path';
import { getPrismaClient, getRawPrismaClient } from '../db/prisma';
import { auditStore } from '../auditStore';
import { resolveSecureStorePath } from '../utils/storageHelper';
import {
  FinancialAccount,
  Partner,
  FinancialTransaction,
  FinancialAuditLog,
} from '../../src/admin/types/finance';
import { 
  INITIAL_PARTNERS, 
  INITIAL_FINANCIAL_ACCOUNTS, 
  INITIAL_TRANSACTIONS, 
  INITIAL_FINANCIAL_AUDIT_LOGS 
} from '../../src/admin/data/financeMockData';
import {
  calculateAccountBalances,
  calculateProfitAndLoss,
  calculatePartnerSummaries,
  calculateExecutiveKPIs,
} from '../../src/admin/services/financeService';

const PERSIST_FILE = resolveSecureStorePath('finance-store.json', 'public/generated-assets/finance-store.json');

export interface FinanceStoreData {
  accounts: FinancialAccount[];
  partners: Partner[];
  transactions: FinancialTransaction[];
  auditLogs: FinancialAuditLog[];
  lastUpdated: string;
}

export class FinanceRepository {
  private accounts = new Map<string, FinancialAccount>();
  private partners = new Map<string, Partner>();
  private transactions = new Map<string, FinancialTransaction>();
  private auditLogs: FinancialAuditLog[] = [];
  private isLoaded = false;
  private lastMtime = 0;

  constructor() {
    this.ensureLoaded(true);
  }

  public reloadFromDisk() {
    this.ensureLoaded(true);
  }

  // --- Persistence Engine (File-system + Prisma Sync) ---
  private ensureLoaded(force = false) {
    try {
      if (fs.existsSync(PERSIST_FILE)) {
        const stat = fs.statSync(PERSIST_FILE);
        if (!force && this.isLoaded && stat.mtimeMs <= this.lastMtime) {
          return;
        }
        const raw = fs.readFileSync(PERSIST_FILE, 'utf-8');
        const data: FinanceStoreData = JSON.parse(raw);
        if (data && Array.isArray(data.accounts) && Array.isArray(data.partners)) {
          this.accounts.clear();
          this.partners.clear();
          this.transactions.clear();
          this.auditLogs = Array.isArray(data.auditLogs) ? data.auditLogs : [];

          data.accounts.forEach(a => this.accounts.set(a.id, a));
          data.partners.forEach(p => this.partners.set(p.id, p));
          if (Array.isArray(data.transactions)) {
            data.transactions.forEach(t => this.transactions.set(t.id, t));
          }

          this.lastMtime = stat.mtimeMs;
          this.isLoaded = true;
          console.log(`[FINANCE-REPO] Authoritative finance data loaded: ${this.accounts.size} accounts, ${this.partners.size} partners, ${this.transactions.size} transactions.`);
          return;
        }
      }
    } catch (err) {
      console.warn('[FINANCE-REPO] Error loading finance-store.json, initializing baseline:', err);
    }

    if (!this.isLoaded) {
      // Seed clean baseline
      this.initializeBaseline();
    }
  }

  private initializeBaseline() {
    this.accounts.clear();
    this.partners.clear();
    this.transactions.clear();
    this.auditLogs = [...INITIAL_FINANCIAL_AUDIT_LOGS];

    INITIAL_FINANCIAL_ACCOUNTS.forEach(a => this.accounts.set(a.id, { ...a }));
    INITIAL_PARTNERS.forEach(p => this.partners.set(p.id, { ...p }));
    INITIAL_TRANSACTIONS.forEach(t => this.transactions.set(t.id, { ...t }));

    this.isLoaded = true;
    this.saveToDisk();
    console.log('[FINANCE-REPO] Initialized fresh baseline finance records and saved to disk.');
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(PERSIST_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const payload: FinanceStoreData = {
        accounts: Array.from(this.accounts.values()),
        partners: Array.from(this.partners.values()),
        transactions: Array.from(this.transactions.values()).sort(
          (a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
        ),
        auditLogs: this.auditLogs.slice(0, 1000), // Keep recent 1,000 logs
        lastUpdated: new Date().toISOString(),
      };

      fs.writeFileSync(PERSIST_FILE, JSON.stringify(payload, null, 2), 'utf-8');
      if (fs.existsSync(PERSIST_FILE)) {
        this.lastMtime = fs.statSync(PERSIST_FILE).mtimeMs;
      }
    } catch (err) {
      console.error('[FINANCE-REPO] Failed to persist finance data to disk:', err);
    }
  }

  // --- Audit Logger ---
  public recordAudit(
    action: FinancialAuditLog['action'],
    details: string,
    performedBy: string,
    transactionId?: string,
    oldValue?: string,
    newValue?: string
  ) {
    const entry: FinancialAuditLog = {
      id: `faudit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      transactionId,
      action,
      performedBy,
      timestamp: new Date().toISOString(),
      details,
      oldValue,
      newValue,
    };

    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > 2000) {
      this.auditLogs.pop();
    }

    // Also bridge to centralized audit store
    try {
      auditStore.record({
        userId: performedBy,
        userName: performedBy,
        userRole: 'PARTNER',
        module: 'finance',
        action: `FINANCE_${action}`,
        recordAffected: transactionId || 'GENERAL_FINANCE',
        previousValue: oldValue ? String(oldValue) : undefined,
        newValue: details,
        ipAddress: '127.0.0.1',
        severity: action === 'VOID' || action === 'REJECT' ? 'WARNING' : 'INFO',
      });
    } catch {}

    this.saveToDisk();
    return entry;
  }

  // --- Summary & Intelligence ---
  public getFinancialSummary(startDate?: string, endDate?: string) {
    this.ensureLoaded();
    const allAccounts = Array.from(this.accounts.values());
    const allPartners = Array.from(this.partners.values());
    const allTransactions = Array.from(this.transactions.values());

    const accountsWithBalances = calculateAccountBalances(allAccounts, allTransactions);
    const executiveKPIs = calculateExecutiveKPIs(allTransactions, allAccounts, allPartners, startDate, endDate);
    const currentPnL = calculateProfitAndLoss(allTransactions, allPartners, 'FY 2025-26', startDate, endDate);
    const partnerSummaries = calculatePartnerSummaries(allPartners, allTransactions, currentPnL.netProfit);
    const pendingApprovalsCount = allTransactions.filter(t => t.status === 'PENDING_APPROVAL').length;

    return {
      accounts: accountsWithBalances,
      partners: allPartners,
      transactions: allTransactions.sort(
        (a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
      ),
      auditLogs: this.auditLogs,
      executiveKPIs,
      currentPnL,
      partnerSummaries,
      pendingApprovalsCount,
      lastUpdated: new Date().toISOString(),
    };
  }

  // --- Accounts ---
  public getAccounts(): FinancialAccount[] {
    const allAccounts = Array.from(this.accounts.values());
    const allTransactions = Array.from(this.transactions.values());
    return calculateAccountBalances(allAccounts, allTransactions);
  }

  public getAccountById(id: string): FinancialAccount | undefined {
    const acc = this.accounts.get(id);
    if (!acc) return undefined;
    const allTransactions = Array.from(this.transactions.values());
    const balances = calculateAccountBalances([acc], allTransactions);
    return balances[0];
  }

  public createAccount(data: Partial<FinancialAccount>, performedBy: string): FinancialAccount {
    const newAcc: FinancialAccount = {
      id: data.id || `acc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: data.name || 'New Financial Account',
      type: data.type || 'BANK',
      accountNumber: data.accountNumber,
      bankName: data.bankName,
      ifscCode: data.ifscCode,
      upiId: data.upiId,
      initialBalance: Number(data.initialBalance) || 0,
      currentBalance: Number(data.initialBalance) || 0,
      currency: data.currency || 'INR',
      isActive: data.isActive !== undefined ? data.isActive : true,
      notes: data.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.accounts.set(newAcc.id, newAcc);
    this.recordAudit('CREATE', `Created financial account "${newAcc.name}" (${newAcc.type})`, performedBy);
    this.saveToDisk();

    // Async Prisma mirror if connected
    this.syncPrismaAccount(newAcc);
    return newAcc;
  }

  public updateAccount(id: string, updates: Partial<FinancialAccount>, performedBy: string): FinancialAccount | null {
    const existing = this.accounts.get(id);
    if (!existing) return null;

    const updated: FinancialAccount = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.accounts.set(id, updated);
    this.recordAudit('EDIT', `Updated financial account settings for "${updated.name}"`, performedBy);
    this.saveToDisk();

    this.syncPrismaAccount(updated);
    return updated;
  }

  // --- Transactions ---
  public getTransactions(filters?: {
    startDate?: string;
    endDate?: string;
    type?: string;
    category?: string;
    accountId?: string;
    partnerId?: string;
    status?: string;
    search?: string;
  }): FinancialTransaction[] {
    this.ensureLoaded();
    let list = Array.from(this.transactions.values());

    if (filters) {
      if (filters.startDate) {
        list = list.filter(t => t.date >= filters.startDate!);
      }
      if (filters.endDate) {
        list = list.filter(t => t.date <= filters.endDate!);
      }
      if (filters.type && filters.type !== 'ALL') {
        list = list.filter(t => t.type === filters.type);
      }
      if (filters.category && filters.category !== 'ALL') {
        list = list.filter(t => t.category === filters.category);
      }
      if (filters.accountId && filters.accountId !== 'ALL') {
        list = list.filter(t => t.paymentAccountId === filters.accountId || t.toPaymentAccountId === filters.accountId);
      }
      if (filters.partnerId && filters.partnerId !== 'ALL') {
        list = list.filter(t => t.partnerId === filters.partnerId);
      }
      if (filters.status && filters.status !== 'ALL') {
        list = list.filter(t => t.status === filters.status);
      }
      if (filters.search) {
        const query = filters.search.toLowerCase().trim();
        list = list.filter(t =>
          t.transactionNumber.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          (t.referenceId && t.referenceId.toLowerCase().includes(query)) ||
          t.category.toLowerCase().includes(query)
        );
      }
    }

    return list.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  }

  public getTransactionById(id: string): FinancialTransaction | undefined {
    return this.transactions.get(id);
  }

  public createTransaction(data: Partial<FinancialTransaction>, performedBy: string): FinancialTransaction {
    // 1. Idempotency Check: if referenceId matches an existing transaction, prevent duplicate ledger entry
    if (data.referenceId && data.referenceId.trim().length > 0) {
      const cleanRef = data.referenceId.trim();
      const existing = Array.from(this.transactions.values()).find(
        t => t.referenceId === cleanRef && t.type === data.type && t.amount === data.amount
      );
      if (existing) {
        console.log(`[FINANCE-REPO] Idempotent hit: Transaction ${existing.transactionNumber} already exists for reference ${cleanRef}`);
        return existing;
      }
    }

    const now = new Date();
    const count = this.transactions.size + 1;
    const defaultTxNumber = `TXN-${now.getFullYear()}-${String(count).padStart(5, '0')}`;

    const newTx: FinancialTransaction = {
      id: data.id || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      transactionNumber: data.transactionNumber || defaultTxNumber,
      date: data.date || now.toISOString().slice(0, 10),
      type: data.type || 'EXPENSE',
      category: data.category || 'Miscellaneous',
      amount: Math.abs(Number(data.amount)) || 0,
      paymentAccountId: data.paymentAccountId || 'acc-hdfc-current',
      toPaymentAccountId: data.toPaymentAccountId,
      referenceId: data.referenceId,
      orderId: data.orderId,
      partnerId: data.partnerId,
      isPersonalExpenseByPartner: Boolean(data.isPersonalExpenseByPartner),
      description: data.description || 'General Transaction',
      notes: data.notes,
      attachmentName: data.attachmentName,
      attachmentUrl: data.attachmentUrl,
      attachmentSize: data.attachmentSize,
      createdBy: data.createdBy || performedBy,
      createdAt: data.createdAt || now.toISOString(),
      status: data.status || 'APPROVED',
      approvedBy: data.status === 'APPROVED' ? (data.approvedBy || performedBy) : undefined,
      approvedAt: data.status === 'APPROVED' ? (data.approvedAt || now.toISOString()) : undefined,
      approvalNotes: data.approvalNotes,
      isCogs: data.isCogs,
    };

    this.transactions.set(newTx.id, newTx);
    this.recordAudit(
      'CREATE',
      `Created ${newTx.type} transaction ${newTx.transactionNumber} for ₹${newTx.amount.toLocaleString('en-IN')}: ${newTx.description}`,
      performedBy,
      newTx.id,
      undefined,
      JSON.stringify({ type: newTx.type, amount: newTx.amount, status: newTx.status })
    );

    this.saveToDisk();
    this.syncPrismaTransaction(newTx);
    return newTx;
  }

  public updateTransaction(id: string, updates: Partial<FinancialTransaction>, performedBy: string): FinancialTransaction | null {
    const existing = this.transactions.get(id);
    if (!existing) return null;

    const oldStr = JSON.stringify(existing);
    const updated: FinancialTransaction = {
      ...existing,
      ...updates,
    };

    this.transactions.set(id, updated);
    this.recordAudit(
      'EDIT',
      `Updated transaction ${updated.transactionNumber}`,
      performedBy,
      id,
      oldStr,
      JSON.stringify(updated)
    );

    this.saveToDisk();
    this.syncPrismaTransaction(updated);
    return updated;
  }

  public approveTransaction(id: string, notes: string | undefined, performedBy: string): FinancialTransaction | null {
    const existing = this.transactions.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    existing.status = 'APPROVED';
    existing.approvedBy = performedBy;
    existing.approvedAt = now;
    existing.approvalNotes = notes;

    this.transactions.set(id, existing);
    this.recordAudit(
      'APPROVE',
      `Approved transaction ${existing.transactionNumber} (₹${existing.amount.toLocaleString('en-IN')}). Notes: ${notes || 'None'}`,
      performedBy,
      id
    );

    this.saveToDisk();
    this.syncPrismaTransaction(existing);
    return existing;
  }

  public rejectTransaction(id: string, reason: string, performedBy: string): FinancialTransaction | null {
    const existing = this.transactions.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    existing.status = 'REJECTED';
    existing.rejectedBy = performedBy;
    existing.rejectedAt = now;
    existing.rejectionReason = reason;

    this.transactions.set(id, existing);
    this.recordAudit(
      'REJECT',
      `Rejected transaction ${existing.transactionNumber}. Reason: ${reason}`,
      performedBy,
      id
    );

    this.saveToDisk();
    this.syncPrismaTransaction(existing);
    return existing;
  }

  public voidTransaction(id: string, reason: string, performedBy: string): FinancialTransaction | null {
    const existing = this.transactions.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    existing.status = 'VOIDED';
    existing.voidedBy = performedBy;
    existing.voidedAt = now;
    existing.voidReason = reason;

    this.transactions.set(id, existing);
    this.recordAudit(
      'VOID',
      `Voided/reversed transaction ${existing.transactionNumber} (₹${existing.amount.toLocaleString('en-IN')}). Reason: ${reason}`,
      performedBy,
      id
    );

    this.saveToDisk();
    this.syncPrismaTransaction(existing);
    return existing;
  }

  public deleteTransaction(id: string, performedBy: string): boolean {
    const existing = this.transactions.get(id);
    if (!existing) return false;

    this.transactions.delete(id);
    this.recordAudit(
      'DELETE',
      `Deleted transaction ${existing.transactionNumber} (${existing.type} of ₹${existing.amount.toLocaleString('en-IN')})`,
      performedBy,
      id
    );

    this.saveToDisk();
    return true;
  }

  public batchApprove(ids: string[], performedBy: string): number {
    let count = 0;
    const now = new Date().toISOString();
    ids.forEach(id => {
      const tx = this.transactions.get(id);
      if (tx && tx.status !== 'APPROVED') {
        tx.status = 'APPROVED';
        tx.approvedBy = performedBy;
        tx.approvedAt = now;
        tx.approvalNotes = 'Batch approved';
        this.transactions.set(id, tx);
        this.syncPrismaTransaction(tx);
        count++;
      }
    });

    if (count > 0) {
      this.recordAudit('APPROVE', `Batch approved ${count} transactions`, performedBy);
      this.saveToDisk();
    }
    return count;
  }

  // --- Partners ---
  public getPartners(): Partner[] {
    return Array.from(this.partners.values());
  }

  public getPartnerById(id: string): Partner | undefined {
    return this.partners.get(id);
  }

  public updatePartner(id: string, updates: Partial<Partner>, performedBy: string): Partner | null {
    const existing = this.partners.get(id);
    if (!existing) return null;

    const updated: Partner = {
      ...existing,
      ...updates,
    };

    this.partners.set(id, updated);
    this.recordAudit('PARTNER_CONFIG', `Updated details for partner ${updated.name}`, performedBy);
    this.saveToDisk();
    return updated;
  }

  public updatePartnerPercentages(
    percentages: Record<string, number>,
    isProfitShareOnly: boolean,
    performedBy: string
  ): { success: boolean; error?: string } {
    const sum = Object.values(percentages).reduce((a, b) => a + Number(b), 0);
    if (Math.abs(sum - 100) > 0.01) {
      return {
        success: false,
        error: `Total percentage must equal exactly 100%. Current total is ${sum}%.`,
      };
    }

    Object.entries(percentages).forEach(([partnerId, pct]) => {
      const partner = this.partners.get(partnerId);
      if (partner) {
        const val = Number(pct);
        partner.profitSharePercentage = val;
        if (!isProfitShareOnly) {
          partner.ownershipPercentage = val;
        }
        this.partners.set(partnerId, partner);
      }
    });

    this.recordAudit(
      'PARTNER_CONFIG',
      `Reconfigured partner profit-sharing percentages: ${JSON.stringify(percentages)}`,
      performedBy
    );

    this.saveToDisk();
    return { success: true };
  }

  // --- Server-Authoritative Profit Distribution ---
  public distributeProfit(
    periodLabel: string | undefined,
    performedBy: string
  ): { success: boolean; error?: string; distributedAmount?: number; transactionsCreated?: FinancialTransaction[] } {
    const partnersList = Array.from(this.partners.values());
    const totalPercentage = partnersList.reduce(
      (sum, p) => sum + ((p.profitSharePercentage ?? p.ownershipPercentage) || 0),
      0
    );

    if (Math.abs(totalPercentage - 100) > 0.01) {
      return {
        success: false,
        error: `Cannot distribute profit: Total profit-sharing percentage must equal exactly 100%. Current configured total is ${totalPercentage}%.`,
      };
    }

    // Authoritative calculation from approved transactions
    const allTransactions = Array.from(this.transactions.values());
    const pnl = calculateProfitAndLoss(allTransactions, partnersList, periodLabel || 'FY 2025-26');
    const netProfit = pnl.netProfit;

    if (netProfit === 0) {
      return {
        success: false,
        error: 'Calculated net profit is ₹0. No profit available for distribution.',
      };
    }

    const isProfit = netProfit > 0;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const label = periodLabel || pnl.period || 'FY 2025-26';
    const createdList: FinancialTransaction[] = [];

    // Atomically create distribution entries for all partners
    partnersList.forEach((partner, index) => {
      const pct = (partner.profitSharePercentage ?? partner.ownershipPercentage) || 0;
      const amount = Math.round((Math.abs(netProfit) * pct) / 100);
      if (amount <= 0) return;

      const txNumber = `TXN-${now.getFullYear()}-PRF-${String(Date.now() + index).slice(-5)}`;
      const newTx: FinancialTransaction = {
        id: `tx-profit-${partner.id}-${Date.now()}-${index}`,
        transactionNumber: txNumber,
        date: dateStr,
        type: isProfit ? 'PROFIT_ALLOCATION' : 'LOSS_ALLOCATION',
        category: isProfit ? 'Profit Allocation' : 'Loss Allocation',
        amount,
        paymentAccountId: 'acc-hdfc-current',
        partnerId: partner.id,
        referenceId: `DIST-${label.replace(/\s+/g, '-').toUpperCase()}-${partner.id}`,
        description: `${isProfit ? 'Profit' : 'Loss'} distribution for ${label} (${pct}% share) allocated to ${partner.name}.`,
        createdBy: performedBy,
        createdAt: now.toISOString(),
        status: 'APPROVED',
        approvedBy: performedBy,
        approvedAt: now.toISOString(),
      };

      this.transactions.set(newTx.id, newTx);
      createdList.push(newTx);
      this.syncPrismaTransaction(newTx);
    });

    if (createdList.length > 0) {
      this.recordAudit(
        'PARTNER_CONFIG',
        `Executed authoritative ${isProfit ? 'profit' : 'loss'} distribution of ₹${Math.abs(netProfit).toLocaleString('en-IN')} for ${label} across ${partnersList.length} partners.`,
        performedBy
      );
      this.saveToDisk();
    }

    return {
      success: true,
      distributedAmount: netProfit,
      transactionsCreated: createdList,
    };
  }

  // --- Reset Baseline ---
  public resetToBaseline(performedBy: string) {
    this.initializeBaseline();
    this.recordAudit('PARTNER_CONFIG', 'Reset financial accounts and ledger to baseline.', performedBy);
    return this.getFinancialSummary();
  }

  // --- Prisma Database Sync (Best Effort / Non-blocking) ---
  private async syncPrismaAccount(acc: FinancialAccount) {
    try {
      const prisma = getPrismaClient();
      if (!prisma || !prisma.financialAccount) return;
      await prisma.financialAccount.upsert({
        where: { id: acc.id },
        update: {
          accountName: acc.name,
          accountType: acc.type,
          accountNumber: acc.accountNumber,
          ifscOrRouting: acc.ifscCode,
          balance: acc.currentBalance,
          currency: acc.currency,
          isActive: acc.isActive,
        },
        create: {
          id: acc.id,
          accountName: acc.name,
          accountType: acc.type,
          accountNumber: acc.accountNumber,
          ifscOrRouting: acc.ifscCode,
          balance: acc.currentBalance,
          currency: acc.currency,
          isActive: acc.isActive,
        },
      });
    } catch {}
  }

  private async syncPrismaTransaction(tx: FinancialTransaction) {
    try {
      const prisma = getRawPrismaClient() || getPrismaClient();
      if (!prisma || !prisma.financialTransaction) return;

      const accountId = tx.paymentAccountId || 'acc-operating-hdfc';
      await prisma.financialAccount.upsert({
        where: { id: accountId },
        create: {
          id: accountId,
          accountName: 'Toriwear Main Operating Account',
          accountType: 'BANK',
          currency: 'INR',
        },
        update: {},
      });

      let validUserId: string | null = null;
      if (tx.createdBy && tx.createdBy.startsWith('usr-')) {
        try {
          const u = await prisma.user.findUnique({ where: { id: tx.createdBy } });
          if (u) validUserId = u.id;
        } catch {}
      }

      await prisma.financialTransaction.upsert({
        where: { id: tx.id },
        update: {
          type: tx.type,
          category: tx.category,
          amount: tx.amount,
          currency: 'INR',
          referenceType: tx.type,
          referenceId: tx.referenceId,
          description: tx.description,
        },
        create: {
          id: tx.id,
          accountId,
          type: tx.type,
          category: tx.category,
          amount: tx.amount,
          currency: 'INR',
          referenceType: tx.type,
          referenceId: tx.referenceId,
          description: tx.description,
          performedByUserId: validUserId,
        },
      });
    } catch (e) {
      console.warn('[FINANCE_REPO] Warning syncing transaction to Prisma:', e);
    }
  }
}

export const financeRepository = new FinanceRepository();
