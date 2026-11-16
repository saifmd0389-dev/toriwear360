import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FinancialAccount, 
  Partner, 
  FinancialTransaction, 
  FinancialAuditLog,
  FinancialTransactionType,
  TransactionApprovalStatus,
  PartnerAccountSummary,
  ProfitAndLossSummary
} from '../types/finance';
import { 
  INITIAL_PARTNERS, 
  INITIAL_FINANCIAL_ACCOUNTS, 
  INITIAL_TRANSACTIONS, 
  INITIAL_FINANCIAL_AUDIT_LOGS 
} from '../data/financeMockData';
import { 
  calculateAccountBalances, 
  calculateProfitAndLoss, 
  calculatePartnerSummaries, 
  calculateExecutiveKPIs,
  filterTransactionsByDate
} from '../services/financeService';
import { useAdmin } from '../AdminDataContext';
import { platformApi } from '../services/platformService';

export type DateRangePreset = 
  | 'ALL' 
  | 'THIS_MONTH' 
  | 'LAST_MONTH' 
  | 'THIS_QUARTER' 
  | 'FY25_26' 
  | 'FY24_25' 
  | 'CUSTOM';

interface FinanceContextType {
  // Stored State
  transactions: FinancialTransaction[];
  partners: Partner[];
  accounts: FinancialAccount[];
  auditLogs: FinancialAuditLog[];
  isLoading: boolean;
  refreshFinanceData: () => Promise<void>;

  // Date & Filter State
  datePreset: DateRangePreset;
  setDatePreset: (preset: DateRangePreset) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterType: FinancialTransactionType | 'ALL';
  setFilterType: (type: FinancialTransactionType | 'ALL') => void;
  filterCategory: string;
  setFilterCategory: (category: string) => void;
  filterAccount: string;
  setFilterAccount: (accountId: string) => void;
  filterPartner: string;
  setFilterPartner: (partnerId: string) => void;
  filterStatus: TransactionApprovalStatus | 'ALL';
  setFilterStatus: (status: TransactionApprovalStatus | 'ALL') => void;
  resetFilters: () => void;

  // Filtered lists
  filteredTransactions: FinancialTransaction[];

  // Computed Financial Intelligence (100% derived from transaction records)
  accountsWithBalances: FinancialAccount[];
  executiveKPIs: ReturnType<typeof calculateExecutiveKPIs>;
  currentPnL: ProfitAndLossSummary;
  partnerSummaries: PartnerAccountSummary[];
  pendingApprovalsCount: number;

  // Mutation Handlers (authoritative backend persisted)
  createTransaction: (data: Partial<FinancialTransaction>) => FinancialTransaction;
  updateTransaction: (id: string, updates: Partial<FinancialTransaction>) => void;
  approveTransaction: (id: string, notes?: string) => void;
  rejectTransaction: (id: string, reason: string) => void;
  voidTransaction: (id: string, reason: string) => void;
  deleteTransaction: (id: string) => void;
  batchApproveTransactions: (ids: string[]) => void;
  createAccount: (data: Partial<FinancialAccount>) => FinancialAccount;
  updateAccount: (id: string, updates: Partial<FinancialAccount>) => void;
  transferBetweenAccounts: (fromId: string, toId: string, amount: number, description: string, referenceId?: string) => void;
  updatePartner: (id: string, updates: Partial<Partner>) => void;
  updatePartnerPercentages: (percentages: Record<string, number>, isProfitShareOnly?: boolean) => Promise<{ success: boolean; error?: string }> | { success: boolean; error?: string };
  distributeProfit: (periodLabel?: string) => Promise<{ success: boolean; error?: string; distributedAmount?: number }> | { success: boolean; error?: string; distributedAmount?: number };
  resetFinanceData: () => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

// Temporary UI cache key (non-authoritative fallback only)
const UI_CACHE_KEYS = {
  TRANSACTIONS: 'toriwear_admin_finance_cache_tx_v2',
  PARTNERS: 'toriwear_admin_finance_cache_partners_v2',
  ACCOUNTS: 'toriwear_admin_finance_cache_accounts_v2',
  AUDIT_LOGS: 'toriwear_admin_finance_cache_audit_v2',
};

// Purge any legacy authoritative mock storage keys from user browser
try {
  const legacyKeys = [
    'toriwear_admin_finance_transactions_zero_v1',
    'toriwear_admin_finance_partners_zero_v1',
    'toriwear_admin_finance_accounts_zero_v1',
    'toriwear_admin_finance_audit_zero_v1',
    'toriwear_admin_finance_transactions_v1',
    'toriwear_admin_finance_transactions_v2',
    'toriwear_admin_finance_transactions_v3',
    'toriwear_admin_finance_transactions_v4',
    'toriwear_admin_finance_transactions_v5',
    'toriwear_admin_finance_transactions_v6',
    'toriwear_admin_finance_partners_v1',
    'toriwear_admin_finance_partners_v2',
    'toriwear_admin_finance_partners_v3',
    'toriwear_admin_finance_partners_v4',
    'toriwear_admin_finance_partners_v5',
    'toriwear_admin_finance_partners_v6',
    'toriwear_admin_finance_accounts_v1',
    'toriwear_admin_finance_accounts_v2',
    'toriwear_admin_finance_accounts_v3',
    'toriwear_admin_finance_accounts_v4',
    'toriwear_admin_finance_accounts_v5',
    'toriwear_admin_finance_accounts_v6',
    'toriwear_admin_finance_audit_v1',
    'toriwear_admin_finance_audit_v2',
    'toriwear_admin_finance_audit_v3',
    'toriwear_admin_finance_audit_v4',
    'toriwear_admin_finance_audit_v5',
    'toriwear_admin_finance_audit_v6',
  ];
  legacyKeys.forEach(k => localStorage.removeItem(k));
} catch {}

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isAuthenticated } = useAdmin();
  const userName = currentUser?.name || 'Administrator';

  // --- Authoritative State ---
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(() => {
    try {
      const cached = localStorage.getItem(UI_CACHE_KEYS.TRANSACTIONS);
      if (cached && (cached.includes('TXN-ORD-TORI2026') || cached.includes('TXN-REF-TORI2026') || cached.includes('TXN-2026-'))) {
        localStorage.removeItem(UI_CACHE_KEYS.TRANSACTIONS);
        return INITIAL_TRANSACTIONS;
      }
      return cached ? JSON.parse(cached) : INITIAL_TRANSACTIONS;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  const [partners, setPartners] = useState<Partner[]>(() => {
    try {
      const cached = localStorage.getItem(UI_CACHE_KEYS.PARTNERS);
      return cached ? JSON.parse(cached) : INITIAL_PARTNERS;
    } catch {
      return INITIAL_PARTNERS;
    }
  });

  const [accounts, setAccounts] = useState<FinancialAccount[]>(() => {
    try {
      const cached = localStorage.getItem(UI_CACHE_KEYS.ACCOUNTS);
      return cached ? JSON.parse(cached) : INITIAL_FINANCIAL_ACCOUNTS;
    } catch {
      return INITIAL_FINANCIAL_ACCOUNTS;
    }
  });

  const [auditLogs, setAuditLogs] = useState<FinancialAuditLog[]>(() => {
    try {
      const cached = localStorage.getItem(UI_CACHE_KEYS.AUDIT_LOGS);
      return cached ? JSON.parse(cached) : INITIAL_FINANCIAL_AUDIT_LOGS;
    } catch {
      return INITIAL_FINANCIAL_AUDIT_LOGS;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync to temporary UI cache
  useEffect(() => {
    try {
      localStorage.setItem(UI_CACHE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    } catch {}
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem(UI_CACHE_KEYS.PARTNERS, JSON.stringify(partners));
    } catch {}
  }, [partners]);

  useEffect(() => {
    try {
      localStorage.setItem(UI_CACHE_KEYS.ACCOUNTS, JSON.stringify(accounts));
    } catch {}
  }, [accounts]);

  useEffect(() => {
    try {
      localStorage.setItem(UI_CACHE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));
    } catch {}
  }, [auditLogs]);

  // --- 1. Load Authoritative Data from Backend ---
  const refreshFinanceData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoading(true);
      const res = await platformApi.getFinanceSummary();
      if (res && res.success && res.data) {
        if (Array.isArray(res.data.accounts)) setAccounts(res.data.accounts);
        if (Array.isArray(res.data.partners)) setPartners(res.data.partners);
        if (Array.isArray(res.data.transactions)) setTransactions(res.data.transactions);
        if (Array.isArray(res.data.auditLogs)) setAuditLogs(res.data.auditLogs);
      }
    } catch (err) {
      console.warn('[FINANCE-CONTEXT] Error fetching finance summary from server:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshFinanceData();
  }, [refreshFinanceData]);

  // --- 2. Filter & Date Range State ---
  const [datePreset, setDatePreset] = useState<DateRangePreset>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<FinancialTransactionType | 'ALL'>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterAccount, setFilterAccount] = useState<string>('ALL');
  const [filterPartner, setFilterPartner] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<TransactionApprovalStatus | 'ALL'>('ALL');

  // Handle Preset Changes
  const handleDatePresetChange = useCallback((preset: DateRangePreset) => {
    setDatePreset(preset);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const pad = (n: number) => String(n).padStart(2, '0');

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'THIS_MONTH') {
      const start = `${currentYear}-${pad(currentMonth + 1)}-01`;
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      const end = `${currentYear}-${pad(currentMonth + 1)}-${pad(lastDay)}`;
      setStartDate(start);
      setEndDate(end);
    } else if (preset === 'LAST_MONTH') {
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const lastMonthNum = currentMonth === 0 ? 12 : currentMonth;
      const start = `${lastMonthYear}-${pad(lastMonthNum)}-01`;
      const lastDay = new Date(lastMonthYear, lastMonthNum, 0).getDate();
      const end = `${lastMonthYear}-${pad(lastMonthNum)}-${pad(lastDay)}`;
      setStartDate(start);
      setEndDate(end);
    } else if (preset === 'THIS_QUARTER') {
      const q = Math.floor(currentMonth / 3);
      const startMonth = q * 3 + 1;
      const endMonth = startMonth + 2;
      const start = `${currentYear}-${pad(startMonth)}-01`;
      const lastDay = new Date(currentYear, endMonth, 0).getDate();
      const end = `${currentYear}-${pad(endMonth)}-${pad(lastDay)}`;
      setStartDate(start);
      setEndDate(end);
    } else if (preset === 'FY25_26') {
      setStartDate('2025-04-01');
      setEndDate('2026-03-31');
    } else if (preset === 'FY24_25') {
      setStartDate('2024-04-01');
      setEndDate('2025-03-31');
    }
  }, []);

  const resetFilters = useCallback(() => {
    setDatePreset('ALL');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
    setFilterType('ALL');
    setFilterCategory('ALL');
    setFilterAccount('ALL');
    setFilterPartner('ALL');
    setFilterStatus('ALL');
  }, []);

  // --- 3. Filtered Transactions List ---
  const filteredTransactions = useMemo(() => {
    let list = transactions;

    if (startDate || endDate) {
      list = filterTransactionsByDate(list, startDate, endDate);
    }
    if (filterType !== 'ALL') {
      list = list.filter(t => t.type === filterType);
    }
    if (filterCategory !== 'ALL') {
      list = list.filter(t => t.category === filterCategory);
    }
    if (filterAccount !== 'ALL') {
      list = list.filter(t => t.paymentAccountId === filterAccount || t.toPaymentAccountId === filterAccount);
    }
    if (filterPartner !== 'ALL') {
      list = list.filter(t => t.partnerId === filterPartner);
    }
    if (filterStatus !== 'ALL') {
      list = list.filter(t => t.status === filterStatus);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(t => 
        t.transactionNumber.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.referenceId && t.referenceId.toLowerCase().includes(q)) ||
        t.category.toLowerCase().includes(q)
      );
    }

    return list;
  }, [transactions, startDate, endDate, filterType, filterCategory, filterAccount, filterPartner, filterStatus, searchQuery]);

  // --- 4. Computed Financial Intelligence ---
  const accountsWithBalances = useMemo(() => {
    return calculateAccountBalances(accounts, transactions);
  }, [accounts, transactions]);

  const executiveKPIs = useMemo(() => {
    return calculateExecutiveKPIs(transactions, accounts, partners, startDate, endDate);
  }, [transactions, accounts, partners, startDate, endDate]);

  const currentPnL = useMemo(() => {
    const label = datePreset === 'ALL' ? 'All Time Performance' : `Period: ${datePreset}`;
    return calculateProfitAndLoss(transactions, partners, label, startDate, endDate);
  }, [transactions, partners, datePreset, startDate, endDate]);

  const partnerSummaries = useMemo(() => {
    return calculatePartnerSummaries(partners, transactions, currentPnL.netProfit);
  }, [partners, transactions, currentPnL.netProfit]);

  const pendingApprovalsCount = useMemo(() => {
    return transactions.filter(t => t.status === 'PENDING_APPROVAL').length;
  }, [transactions]);

  // --- 5. Authoritative Mutation Handlers ---
  const createTransaction = useCallback((data: Partial<FinancialTransaction>): FinancialTransaction => {
    const now = new Date();
    const count = transactions.length + 1;
    const defaultTxNumber = `TXN-${now.getFullYear()}-${String(count).padStart(5, '0')}`;

    const tempTx: FinancialTransaction = {
      id: data.id || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      transactionNumber: data.transactionNumber || defaultTxNumber,
      date: data.date || now.toISOString().slice(0, 10),
      type: data.type || 'EXPENSE',
      category: data.category || 'Miscellaneous',
      amount: Math.abs(Number(data.amount)) || 0,
      paymentAccountId: data.paymentAccountId || accounts[0]?.id || 'acc-hdfc-current',
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
      createdBy: data.createdBy || userName,
      createdAt: data.createdAt || now.toISOString(),
      status: data.status || 'APPROVED',
      approvedBy: data.status === 'APPROVED' ? (data.approvedBy || userName) : undefined,
      approvedAt: data.status === 'APPROVED' ? (data.approvedAt || now.toISOString()) : undefined,
      approvalNotes: data.approvalNotes,
      isCogs: data.isCogs,
    };

    // Optimistic append
    setTransactions(prev => [tempTx, ...prev]);

    // Authoritative backend persistence call
    platformApi.createFinancialTransaction(tempTx).then(res => {
      if (res && res.success && res.data) {
        setTransactions(prev => prev.map(t => (t.id === tempTx.id ? res.data : t)));
      }
    }).catch(err => {
      console.error('[FINANCE] Failed to persist transaction to backend:', err);
    });

    return tempTx;
  }, [accounts, transactions.length, userName]);

  const updateTransaction = useCallback((id: string, updates: Partial<FinancialTransaction>) => {
    setTransactions(prev => prev.map(tx => (tx.id === id ? { ...tx, ...updates } : tx)));

    platformApi.updateFinancialTransaction(id, updates).then(res => {
      if (res && res.success && res.data) {
        setTransactions(prev => prev.map(t => (t.id === id ? res.data : t)));
      }
    }).catch(err => {
      console.error('[FINANCE] Failed to update transaction on backend:', err);
    });
  }, []);

  const approveTransaction = useCallback((id: string, notes?: string) => {
    const now = new Date().toISOString();
    setTransactions(prev => prev.map(tx => {
      if (tx.id !== id) return tx;
      return {
        ...tx,
        status: 'APPROVED',
        approvedBy: userName,
        approvedAt: now,
        approvalNotes: notes,
      };
    }));

    platformApi.approveFinancialTransaction(id, notes).catch(err => {
      console.error('[FINANCE] Failed to approve transaction on backend:', err);
    });
  }, [userName]);

  const rejectTransaction = useCallback((id: string, reason: string) => {
    const now = new Date().toISOString();
    setTransactions(prev => prev.map(tx => {
      if (tx.id !== id) return tx;
      return {
        ...tx,
        status: 'REJECTED',
        rejectedBy: userName,
        rejectedAt: now,
        rejectionReason: reason,
      };
    }));

    platformApi.rejectFinancialTransaction(id, reason).catch(err => {
      console.error('[FINANCE] Failed to reject transaction on backend:', err);
    });
  }, [userName]);

  const voidTransaction = useCallback((id: string, reason: string) => {
    const now = new Date().toISOString();
    setTransactions(prev => prev.map(tx => {
      if (tx.id !== id) return tx;
      return {
        ...tx,
        status: 'VOIDED',
        voidedBy: userName,
        voidedAt: now,
        voidReason: reason,
      };
    }));

    platformApi.voidFinancialTransaction(id, reason).catch(err => {
      console.error('[FINANCE] Failed to void transaction on backend:', err);
    });
  }, [userName]);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    platformApi.deleteFinancialTransaction(id).catch(err => {
      console.error('[FINANCE] Failed to delete transaction on backend:', err);
    });
  }, []);


  const batchApproveTransactions = useCallback((ids: string[]) => {
    const now = new Date().toISOString();
    setTransactions(prev => prev.map(tx => {
      if (!ids.includes(tx.id) || tx.status === 'APPROVED') return tx;
      return {
        ...tx,
        status: 'APPROVED',
        approvedBy: userName,
        approvedAt: now,
        approvalNotes: 'Batch approved',
      };
    }));

    platformApi.batchApproveFinancialTransactions(ids).catch(err => {
      console.error('[FINANCE] Failed to batch approve on backend:', err);
    });
  }, [userName]);

  const createAccount = useCallback((data: Partial<FinancialAccount>): FinancialAccount => {
    const tempAcc: FinancialAccount = {
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
      isActive: true,
      notes: data.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setAccounts(prev => [...prev, tempAcc]);

    platformApi.createFinancialAccount(tempAcc).then(res => {
      if (res && res.success && res.data) {
        setAccounts(prev => prev.map(a => (a.id === tempAcc.id ? res.data : a)));
      }
    }).catch(err => {
      console.error('[FINANCE] Failed to create account on backend:', err);
    });

    return tempAcc;
  }, []);

  const updateAccount = useCallback((id: string, updates: Partial<FinancialAccount>) => {
    setAccounts(prev => prev.map(acc => {
      if (acc.id !== id) return acc;
      return { ...acc, ...updates, updatedAt: new Date().toISOString() };
    }));

    platformApi.updateFinancialAccount(id, updates).catch(err => {
      console.error('[FINANCE] Failed to update account on backend:', err);
    });
  }, []);

  const transferBetweenAccounts = useCallback((
    fromId: string, 
    toId: string, 
    amount: number, 
    description: string, 
    referenceId?: string
  ) => {
    createTransaction({
      type: 'TRANSFER',
      category: 'Internal Transfer',
      amount,
      paymentAccountId: fromId,
      toPaymentAccountId: toId,
      description,
      referenceId: referenceId || `TRF-${Date.now()}`,
      status: 'APPROVED',
    });
  }, [createTransaction]);

  const updatePartner = useCallback((id: string, updates: Partial<Partner>) => {
    setPartners(prev => prev.map(p => {
      if (p.id !== id) return p;
      return { ...p, ...updates };
    }));

    platformApi.updateFinancePartner(id, updates).catch(err => {
      console.error('[FINANCE] Failed to update partner on backend:', err);
    });
  }, []);

  const updatePartnerPercentages = useCallback(async (
    percentages: Record<string, number>, 
    isProfitShareOnly = false
  ): Promise<{ success: boolean; error?: string }> => {
    const sum = Object.values(percentages).reduce((a, b) => a + Number(b), 0);
    if (Math.abs(sum - 100) > 0.01) {
      return {
        success: false,
        error: `Total percentage must equal exactly 100%. Current total is ${sum}%.`,
      };
    }

    try {
      const res = await platformApi.updatePartnerPercentages(percentages, isProfitShareOnly);
      if (res && res.success) {
        if (Array.isArray(res.partners)) {
          setPartners(res.partners);
        } else {
          setPartners(prev => prev.map(p => {
            const newPct = percentages[p.id];
            if (newPct !== undefined) {
              const val = Number(newPct);
              return { 
                ...p, 
                ownershipPercentage: isProfitShareOnly ? p.ownershipPercentage : val,
                profitSharePercentage: val
              };
            }
            return p;
          }));
        }
        return { success: true };
      }
      return { success: false, error: res.error || 'Server error saving partner percentages.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error communicating with server.' };
    }
  }, []);

  const distributeProfit = useCallback(async (periodLabel?: string): Promise<{ success: boolean; error?: string; distributedAmount?: number }> => {
    try {
      const res = await platformApi.distributeProfit(periodLabel);
      if (res && res.success) {
        if (Array.isArray(res.transactionsCreated) && res.transactionsCreated.length > 0) {
          setTransactions(prev => [...res.transactionsCreated, ...prev]);
        } else {
          refreshFinanceData();
        }
        return { success: true, distributedAmount: res.distributedAmount };
      }
      return { success: false, error: res?.error || 'Failed to distribute profit.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error executing profit distribution.' };
    }
  }, [refreshFinanceData]);

  const resetFinanceData = useCallback(async () => {
    try {
      const res = await platformApi.resetFinanceData();
      if (res && res.success && res.data) {
        if (Array.isArray(res.data.accounts)) setAccounts(res.data.accounts);
        if (Array.isArray(res.data.partners)) setPartners(res.data.partners);
        if (Array.isArray(res.data.transactions)) setTransactions(res.data.transactions);
        if (Array.isArray(res.data.auditLogs)) setAuditLogs(res.data.auditLogs);
      } else {
        refreshFinanceData();
      }
    } catch {
      refreshFinanceData();
    }
  }, [refreshFinanceData]);

  return (
    <FinanceContext.Provider
      value={{
        transactions,
        partners,
        accounts,
        auditLogs,
        isLoading,
        refreshFinanceData,
        datePreset,
        setDatePreset: handleDatePresetChange,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        searchQuery,
        setSearchQuery,
        filterType,
        setFilterType,
        filterCategory,
        setFilterCategory,
        filterAccount,
        setFilterAccount,
        filterPartner,
        setFilterPartner,
        filterStatus,
        setFilterStatus,
        resetFilters,
        filteredTransactions,
        accountsWithBalances,
        executiveKPIs,
        currentPnL,
        partnerSummaries,
        pendingApprovalsCount,
        createTransaction,
        updateTransaction,
        approveTransaction,
        rejectTransaction,
        voidTransaction,
        deleteTransaction,
        batchApproveTransactions,
        createAccount,
        updateAccount,
        transferBetweenAccounts,
        updatePartner,
        updatePartnerPercentages,
        distributeProfit,
        resetFinanceData,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
