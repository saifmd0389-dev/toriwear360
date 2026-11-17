/**
 * TORIWEAR Finance & Accounting Types
 */

export type FinancialTransactionType = 
  | 'INCOME'
  | 'EXPENSE'
  | 'CAPITAL'
  | 'CAPITAL_RETURN'
  | 'PROFIT_ALLOCATION'
  | 'LOSS_ALLOCATION'
  | 'WITHDRAWAL'
  | 'PARTNER_EXPENSE'
  | 'REIMBURSEMENT'
  | 'TRANSFER'
  | 'REFUND'
  | 'ADJUSTMENT'
  | 'OTHER';

export type ExpenseCategory = 
  | 'Manufacturing'
  | 'Fabric'
  | 'Printing'
  | 'Packaging'
  | 'Shipping'
  | 'Marketing'
  | 'Advertising'
  | 'Website/domain'
  | 'Software'
  | 'Salaries'
  | 'Rent'
  | 'Payment gateway fees'
  | 'Refunds'
  | 'Taxes/fees'
  | 'Miscellaneous';

export type IncomeCategory = 
  | 'Customer Orders'
  | 'B2B Wholesale'
  | 'Pop-up Sales'
  | 'Licensing & Royalties'
  | 'Shipping Revenue'
  | 'Investment Income'
  | 'Miscellaneous Income';

export type TransactionApprovalStatus = 
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'VOIDED';

export type FinancialAccountType = 
  | 'BANK'
  | 'CASH'
  | 'UPI'
  | 'PAYMENT_GATEWAY'
  | 'OTHER';

export interface FinancialAccount {
  id: string;
  name: string;
  type: FinancialAccountType;
  accountNumber?: string;
  bankName?: string;
  ifscCode?: string;
  upiId?: string;
  initialBalance: number;
  currentBalance: number;
  currency: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Partner {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  ownershipPercentage: number; // e.g. 40, 25, 20, 15 (sum must equal 100)
  profitSharePercentage?: number; // Profit share % (editable, sums to 100%)
  initialCapital: number;
  active: boolean;
  joinDate: string;
  panNumber?: string;
  bankDetails?: string;
  notes?: string;
}

export interface FinancialTransaction {
  id: string;
  transactionNumber: string; // e.g. TXN-2026-00142
  date: string; // YYYY-MM-DD
  type: FinancialTransactionType;
  category: ExpenseCategory | IncomeCategory | string;
  amount: number;
  paymentAccountId: string;
  toPaymentAccountId?: string; // Used for TRANSFER type
  referenceId?: string; // Order #, Invoice #, Cheque #, UTR #
  orderId?: string; // Link to customer order
  partnerId?: string; // For CAPITAL, WITHDRAWAL, or Personal expenses paid by partner
  isPersonalExpenseByPartner?: boolean; // When partner paid company bill from personal funds
  description: string;
  notes?: string;
  attachmentName?: string;
  attachmentUrl?: string;
  attachmentSize?: string;
  createdBy: string;
  createdAt: string;
  status: TransactionApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  voidReason?: string;
  isCogs?: boolean; // Is Cost of Goods Sold (Fabric, Printing, Manufacturing)
}

export interface FinancialAuditLog {
  id: string;
  transactionId?: string;
  action: 'CREATE' | 'EDIT' | 'APPROVE' | 'REJECT' | 'VOID' | 'DELETE' | 'TRANSFER' | 'PARTNER_CONFIG';
  performedBy: string;
  timestamp: string;
  details: string;
  oldValue?: string;
  newValue?: string;
}

export interface PartnerAccountSummary {
  partner: Partner;
  capitalInvested: number;
  additionalContributions: number;
  capitalReturned: number;
  profitAllocated: number;
  lossAllocated: number;
  withdrawals: number;
  personalExpensesPaid: number;
  reimbursements: number;
  adjustments: number;
  currentBalance: number;
  transactionsCount: number;
}

export interface ProfitAndLossSummary {
  period: string;
  startDate: string;
  endDate: string;
  grossRevenue: number;
  salesDiscounts: number;
  netRevenue: number;
  cogs: {
    manufacturing: number;
    fabric: number;
    printing: number;
    packaging: number;
    other: number;
    total: number;
  };
  grossProfit: number;
  grossMarginPercent: number;
  operatingExpenses: {
    shipping: number;
    marketing: number;
    advertising: number;
    websiteDomain: number;
    software: number;
    salaries: number;
    rent: number;
    gatewayFees: number;
    taxes: number;
    miscellaneous: number;
    total: number;
  };
  otherExpenses: {
    refunds: number;
    adjustments: number;
    total: number;
  };
  totalExpenses: number;
  operatingProfit: number;
  netProfit: number;
  netProfitMarginPercent: number;
  partnerAllocations: {
    partnerId: string;
    partnerName: string;
    ownershipPercentage: number;
    allocatedAmount: number;
  }[];
}
