import { 
  FinancialAccount, 
  Partner, 
  FinancialTransaction, 
  FinancialAuditLog 
} from '../types/finance';

/**
 * Initial Configurable Four Partners of TORIWEAR
 * Equal 25% partnership. Initialized at clean zero balance.
 */
export const INITIAL_PARTNERS: Partner[] = [
  {
    id: 'ptr-01',
    name: 'Mohammed Saif',
    role: 'Founder & Managing Partner',
    email: 'saif@toriwear.com',
    phone: '+91 98450 12091',
    ownershipPercentage: 25,
    profitSharePercentage: 25,
    initialCapital: 0,
    active: true,
    joinDate: '2025-04-01',
    panNumber: 'ABCPS1234F',
    bankDetails: 'HDFC Bank - A/C 50200049102941',
    notes: 'Primary brand visionary, product direction, and executive operations.',
  },
  {
    id: 'ptr-02',
    name: 'Simranjeet Singh',
    role: 'Operations & Production Partner',
    email: 'simranjeet@toriwear.com',
    phone: '+91 98201 44810',
    ownershipPercentage: 25,
    profitSharePercentage: 25,
    initialCapital: 0,
    active: true,
    joinDate: '2025-04-01',
    panNumber: 'DEFPK5678M',
    bankDetails: 'ICICI Bank - A/C 001201592810',
    notes: '240 GSM combed cotton mills procurement, Tirupur knitting, and print QC.',
  },
  {
    id: 'ptr-03',
    name: 'Lokesh Kottala',
    role: 'Creative & Brand Art Director',
    email: 'lokesh@toriwear.com',
    phone: '+91 97112 88203',
    ownershipPercentage: 25,
    profitSharePercentage: 25,
    initialCapital: 0,
    active: true,
    joinDate: '2025-04-01',
    panNumber: 'GHIPA9012K',
    bankDetails: 'Kotak Bank - A/C 2210948192',
    notes: 'Anime IP illustrations, character universes, and artwork licensing.',
  },
  {
    id: 'ptr-04',
    name: 'Nagesh M',
    role: 'Growth & Retail Distribution Partner',
    email: 'nagesh@toriwear.com',
    phone: '+91 99304 77192',
    ownershipPercentage: 25,
    profitSharePercentage: 25,
    initialCapital: 0,
    active: true,
    joinDate: '2025-04-01',
    panNumber: 'JKLPR3456L',
    bankDetails: 'Axis Bank - A/C 919020048192',
    notes: 'Performance marketing, pan-India courier contracts, and tech stack.',
  },
];

/**
 * Initial Financial Accounts - Zero initial balances
 */
export const INITIAL_FINANCIAL_ACCOUNTS: FinancialAccount[] = [
  {
    id: 'acc-hdfc-current',
    name: 'HDFC Business Current Account',
    type: 'BANK',
    accountNumber: '50200088910482',
    bankName: 'HDFC Bank Ltd, Indiranagar Branch, Bengaluru',
    ifscCode: 'HDFC0000142',
    initialBalance: 0,
    currentBalance: 0,
    currency: 'INR',
    isActive: true,
    notes: 'Primary operating business account for vendor payouts, salaries, and statutory payments.',
    createdAt: '2025-04-01',
    updatedAt: '2026-03-30',
  },
  {
    id: 'acc-cash-vault',
    name: 'Cash in Hand / Storefront Petty Cash',
    type: 'CASH',
    accountNumber: 'CASH-VAULT-01',
    initialBalance: 0,
    currentBalance: 0,
    currency: 'INR',
    isActive: true,
    notes: 'Office petty cash, warehouse local packing supplies, and minor cash outlays.',
    createdAt: '2025-04-01',
    updatedAt: '2026-03-30',
  },
  {
    id: 'acc-razorpay-pg',
    name: 'Razorpay Payment Gateway Settlement A/C',
    type: 'PAYMENT_GATEWAY',
    accountNumber: 'RZP-MERCHANT-TORI',
    initialBalance: 0,
    currentBalance: 0,
    currency: 'INR',
    isActive: true,
    notes: 'Customer online store checkout gateway settlements.',
    createdAt: '2025-04-01',
    updatedAt: '2026-03-30',
  },
  {
    id: 'acc-corporate-upi',
    name: 'Corporate Merchant UPI (HDFC QR)',
    type: 'UPI',
    accountNumber: 'toriwear@hdfcbank',
    initialBalance: 0,
    currentBalance: 0,
    currency: 'INR',
    isActive: true,
    notes: 'Direct UPI collections, pop-up stall QR payments, and instant settlements.',
    createdAt: '2025-05-01',
    updatedAt: '2026-03-30',
  },
  {
    id: 'acc-statutory-tax',
    name: 'Statutory GST & Advance Tax Reserve',
    type: 'OTHER',
    accountNumber: 'RES-TAX-2025-01',
    initialBalance: 0,
    currentBalance: 0,
    currency: 'INR',
    isActive: true,
    notes: 'GST payments and annual emergency working capital reserves.',
    createdAt: '2025-06-01',
    updatedAt: '2026-03-30',
  },
];

/**
 * Baseline Transaction Ledger
 * Initialized to empty zero baseline. All financial calculations derive dynamically
 * from actual transaction records recorded by authorized users.
 */
export const INITIAL_TRANSACTIONS: FinancialTransaction[] = [];

/**
 * Initial Financial Audit History
 * Starts clean. Records all future transaction creations, approvals, and edits.
 */
export const INITIAL_FINANCIAL_AUDIT_LOGS: FinancialAuditLog[] = [];
