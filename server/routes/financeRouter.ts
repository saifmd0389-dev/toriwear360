import { Router, Request, Response, NextFunction } from 'express';
import { financeRepository } from '../repositories/financeRepository';
import { extractSessionToken } from '../middleware/authMiddleware';
import { authStore } from '../authStore';
import { userService } from '../services/userService';
import { PlatformUser, PlatformRole, PermissionAction } from '../rbacTypes';

export const financeRouter = Router();

// Extend Request type with user & session
declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: PlatformUser | { id: string; name: string; email: string; role: PlatformRole; permissions?: any };
    }
  }
}

/**
 * Authentication and Role-Based Authorization Middleware for Finance & Accounting
 */
function requireFinanceAccess(action: PermissionAction = 'view') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = extractSessionToken(req);
    if (!token) {
      res.status(401).json({
        success: false,
        code: 'UNAUTHENTICATED',
        error: 'Authentication required to access financial operations.',
      });
      return;
    }

    let user: any = await authStore.getUserByTokenAsync(token);
    if (!user) {
      const session = await userService.validateSession(token);
      if (session) {
        user = session.user;
      }
    }

    if (!user || user.role === 'CUSTOMER') {
      res.status(401).json({
        success: false,
        code: 'INVALID_SESSION',
        error: 'Session is invalid or expired. Please sign in again.',
      });
      return;
    }

    req.authenticatedUser = user;

    // Super Admin and Partners have unrestricted finance access
    if (user.role === 'SUPER_ADMIN' || user.role === 'PARTNER') {
      return next();
    }

    // All other staff/manager roles require explicit granular finance permission
    const perms = user.permissions?.finance || [];
    if (Array.isArray(perms) && (perms.includes(action) || perms.includes('*'))) {
      return next();
    }

    res.status(403).json({
      success: false,
      code: 'PERMISSION_DENIED',
      error: `Access denied. Role "${user.role}" requires "finance:${action}" permission.`,
    });
    return;
  };
}

/**
 * Super Admin or Partner-Only Guard for Executive Governance Actions
 */
function requirePartnerOrSuperAdmin() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.authenticatedUser;
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'PARTNER')) {
      res.status(403).json({
        success: false,
        code: 'EXECUTIVE_ONLY',
        error: 'This financial governance action requires Super Admin or Partner authority.',
      });
      return;
    }
    next();
  };
}

// ============================================================================
// 1. FINANCIAL SUMMARY & INTELLIGENCE
// ============================================================================
financeRouter.get('/summary', requireFinanceAccess('view'), (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  const summary = financeRepository.getFinancialSummary(
    typeof startDate === 'string' ? startDate : undefined,
    typeof endDate === 'string' ? endDate : undefined
  );
  res.json({
    success: true,
    data: summary,
  });
});

// ============================================================================
// 2. FINANCIAL ACCOUNTS (BANK, CASH, UPI, GATEWAY)
// ============================================================================
financeRouter.get('/accounts', requireFinanceAccess('view'), (_req: Request, res: Response) => {
  const accounts = financeRepository.getAccounts();
  res.json({ success: true, data: accounts });
});

financeRouter.get('/accounts/:id', requireFinanceAccess('view'), (req: Request, res: Response) => {
  const account = financeRepository.getAccountById(String(req.params.id || ''));
  if (!account) {
    return res.status(404).json({ success: false, error: 'Financial account not found.' });
  }
  return res.json({ success: true, data: account });
});

financeRouter.post('/accounts', requireFinanceAccess('create'), (req: Request, res: Response) => {
  const user = req.authenticatedUser!;
  const newAccount = financeRepository.createAccount(req.body, user.name);
  res.status(201).json({ success: true, data: newAccount });
});

financeRouter.put('/accounts/:id', requireFinanceAccess('edit'), (req: Request, res: Response) => {
  const user = req.authenticatedUser!;
  const updated = financeRepository.updateAccount(String(req.params.id || ''), req.body, user.name);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Financial account not found.' });
  }
  return res.json({ success: true, data: updated });
});

financeRouter.post('/transfer', requireFinanceAccess('create'), (req: Request, res: Response) => {
  const user = req.authenticatedUser!;
  const { fromAccountId, toAccountId, amount, description, referenceId } = req.body;

  if (!fromAccountId || !toAccountId || !amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Source account, destination account, and positive transfer amount are required.',
    });
  }

  const tx = financeRepository.createTransaction(
    {
      type: 'TRANSFER',
      category: 'Internal Transfer',
      amount: Number(amount),
      paymentAccountId: fromAccountId,
      toPaymentAccountId: toAccountId,
      description: description || `Transfer from ${fromAccountId} to ${toAccountId}`,
      referenceId: referenceId || `TRF-${Date.now()}`,
      status: 'APPROVED',
      createdBy: user.name,
      approvedBy: user.name,
      approvedAt: new Date().toISOString(),
    },
    user.name
  );

  return res.json({ success: true, data: tx });
});

// ============================================================================
// 3. TRANSACTIONS LEDGER (DOUBLE-ENTRY & IDEMPOTENT)
// ============================================================================
financeRouter.get('/transactions', requireFinanceAccess('view'), (req: Request, res: Response) => {
  const filters = {
    startDate: req.query.startDate as string,
    endDate: req.query.endDate as string,
    type: req.query.type as string,
    category: req.query.category as string,
    accountId: req.query.accountId as string,
    partnerId: req.query.partnerId as string,
    status: req.query.status as string,
    search: req.query.search as string,
  };

  const list = financeRepository.getTransactions(filters);
  res.json({ success: true, count: list.length, data: list });
});

financeRouter.get('/transactions/:id', requireFinanceAccess('view'), (req: Request, res: Response) => {
  const tx = financeRepository.getTransactionById(String(req.params.id || ''));
  if (!tx) {
    return res.status(404).json({ success: false, error: 'Transaction record not found.' });
  }
  return res.json({ success: true, data: tx });
});

financeRouter.post('/transactions', requireFinanceAccess('create'), (req: Request, res: Response) => {
  const user = req.authenticatedUser!;
  const { amount, paymentAccountId } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ success: false, error: 'A valid positive amount is required.' });
  }
  if (!paymentAccountId) {
    return res.status(400).json({ success: false, error: 'A valid payment account is required.' });
  }

  const tx = financeRepository.createTransaction(req.body, user.name);
  return res.status(201).json({ success: true, data: tx });
});

financeRouter.put('/transactions/:id', requireFinanceAccess('edit'), (req: Request, res: Response) => {
  const user = req.authenticatedUser!;
  const updated = financeRepository.updateTransaction(String(req.params.id || ''), req.body, user.name);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Transaction record not found.' });
  }
  return res.json({ success: true, data: updated });
});

financeRouter.post('/transactions/:id/approve', requireFinanceAccess('approve'), (req: Request, res: Response) => {
  const user = req.authenticatedUser!;
  const { notes } = req.body;
  const approved = financeRepository.approveTransaction(String(req.params.id || ''), notes, user.name);
  if (!approved) {
    return res.status(404).json({ success: false, error: 'Transaction not found.' });
  }
  return res.json({ success: true, data: approved });
});

financeRouter.post('/transactions/:id/reject', requireFinanceAccess('approve'), (req: Request, res: Response) => {
  const user = req.authenticatedUser!;
  const { reason } = req.body;
  if (!reason) {
    return res.status(400).json({ success: false, error: 'Rejection reason is required.' });
  }
  const rejected = financeRepository.rejectTransaction(String(req.params.id || ''), reason, user.name);
  if (!rejected) {
    return res.status(404).json({ success: false, error: 'Transaction not found.' });
  }
  return res.json({ success: true, data: rejected });
});

financeRouter.post('/transactions/:id/void', requireFinanceAccess('approve'), requirePartnerOrSuperAdmin(), (req: Request, res: Response) => {
  const user = req.authenticatedUser!;
  const { reason } = req.body;
  if (!reason) {
    return res.status(400).json({ success: false, error: 'Void/reversal reason is required.' });
  }
  const voided = financeRepository.voidTransaction(String(req.params.id || ''), reason, user.name);
  if (!voided) {
    return res.status(404).json({ success: false, error: 'Transaction not found.' });
  }
  return res.json({ success: true, data: voided });
});

financeRouter.post('/transactions/batch-approve', requireFinanceAccess('approve'), (req: Request, res: Response) => {
  const user = req.authenticatedUser!;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, error: 'List of transaction IDs is required.' });
  }
  const count = financeRepository.batchApprove(ids, user.name);
  return res.json({ success: true, countApproved: count });
});

financeRouter.delete('/transactions/:id', requireFinanceAccess('delete'), (req: Request, res: Response) => {
  const user = req.authenticatedUser!;
  const success = financeRepository.deleteTransaction(String(req.params.id || ''), user.name);
  if (!success) {
    return res.status(404).json({ success: false, error: 'Transaction not found.' });
  }
  return res.json({ success: true, message: 'Transaction deleted successfully.' });
});


// ============================================================================
// 4. EXPENSES & INCOME SUB-APIS (COMPLIANT WITH PRISMA SPEC)
// ============================================================================
financeRouter.get('/expenses', requireFinanceAccess('view'), (_req: Request, res: Response) => {
  const expenses = financeRepository.getTransactions({ type: 'EXPENSE' });
  res.json({ success: true, data: expenses });
});

financeRouter.post('/expenses', requireFinanceAccess('create'), (req: Request, res: Response) => {
  const user = req.authenticatedUser!;
  const payload = {
    ...req.body,
    type: 'EXPENSE' as const,
  };
  const tx = financeRepository.createTransaction(payload, user.name);
  res.status(201).json({ success: true, data: tx });
});

financeRouter.get('/income', requireFinanceAccess('view'), (_req: Request, res: Response) => {
  const income = financeRepository.getTransactions({ type: 'INCOME' });
  res.json({ success: true, data: income });
});

financeRouter.post('/income', requireFinanceAccess('create'), (req: Request, res: Response) => {
  const user = req.authenticatedUser!;
  const payload = {
    ...req.body,
    type: 'INCOME' as const,
  };
  const tx = financeRepository.createTransaction(payload, user.name);
  res.status(201).json({ success: true, data: tx });
});

// ============================================================================
// 5. PARTNERS & EXECUTIVE GOVERNANCE
// ============================================================================
financeRouter.get('/partners', requireFinanceAccess('view'), (_req: Request, res: Response) => {
  const partners = financeRepository.getPartners();
  res.json({ success: true, data: partners });
});

financeRouter.get('/partners/:id', requireFinanceAccess('view'), (req: Request, res: Response) => {
  const partner = financeRepository.getPartnerById(String(req.params.id || ''));
  if (!partner) {
    return res.status(404).json({ success: false, error: 'Partner record not found.' });
  }
  return res.json({ success: true, data: partner });
});

financeRouter.put('/partners/:id', requireFinanceAccess('edit'), requirePartnerOrSuperAdmin(), (req: Request, res: Response) => {
  const user = req.authenticatedUser!;
  const updated = financeRepository.updatePartner(String(req.params.id || ''), req.body, user.name);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Partner record not found.' });
  }
  return res.json({ success: true, data: updated });
});

financeRouter.post('/partners/percentages', requireFinanceAccess('edit'), requirePartnerOrSuperAdmin(), (req: Request, res: Response) => {
  const user = req.authenticatedUser!;
  const { percentages, isProfitShareOnly } = req.body;
  if (!percentages || typeof percentages !== 'object') {
    return res.status(400).json({ success: false, error: 'Percentages dictionary is required.' });
  }

  const result = financeRepository.updatePartnerPercentages(
    percentages,
    Boolean(isProfitShareOnly),
    user.name
  );

  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.json({ success: true, partners: financeRepository.getPartners() });
});

financeRouter.post('/partners/distribute-profit', requireFinanceAccess('approve'), requirePartnerOrSuperAdmin(), (req: Request, res: Response) => {
  const user = req.authenticatedUser!;
  const { periodLabel } = req.body;

  const result = financeRepository.distributeProfit(periodLabel, user.name);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

// ============================================================================
// 6. FINANCIAL AUDIT TRAIL
// ============================================================================
financeRouter.get('/audit-logs', requireFinanceAccess('view'), (_req: Request, res: Response) => {
  const summary = financeRepository.getFinancialSummary();
  res.json({ success: true, data: summary.auditLogs });
});

// ============================================================================
// 7. BASELINE RESET (SUPER ADMIN ONLY)
// ============================================================================
financeRouter.post('/reset', requireFinanceAccess('delete'), async (req: Request, res: Response) => {
  const user = req.authenticatedUser!;
  if (user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      code: 'SUPER_ADMIN_ONLY',
      error: 'Only the Super Admin can reset the financial ledger to baseline.',
    });
  }

  const newSummary = financeRepository.resetToBaseline(user.name);
  return res.json({ success: true, data: newSummary });
});
