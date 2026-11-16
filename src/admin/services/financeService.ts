import { 
  FinancialAccount, 
  Partner, 
  FinancialTransaction, 
  PartnerAccountSummary, 
  ProfitAndLossSummary 
} from '../types/finance';

/**
 * Filter transactions by date range
 */
export function filterTransactionsByDate(
  transactions: FinancialTransaction[],
  startDate?: string,
  endDate?: string
): FinancialTransaction[] {
  return transactions.filter(tx => {
    if (startDate && tx.date < startDate) return false;
    if (endDate && tx.date > endDate) return false;
    return true;
  });
}

/**
 * Calculate running balances for all financial accounts based on APPROVED transactions
 */
export function calculateAccountBalances(
  accounts: FinancialAccount[],
  transactions: FinancialTransaction[]
): FinancialAccount[] {
  const approved = transactions.filter(t => t.status === 'APPROVED');

  return accounts.map(account => {
    let balance = account.initialBalance || 0;

    approved.forEach(tx => {
      // Direct credits to this account
      if (tx.paymentAccountId === account.id) {
        if (tx.type === 'INCOME' || tx.type === 'CAPITAL') {
          balance += tx.amount;
        } else if (tx.type === 'EXPENSE' || tx.type === 'WITHDRAWAL' || tx.type === 'REFUND') {
          // If a partner paid personally, company cash is not reduced immediately
          if (!tx.isPersonalExpenseByPartner) {
            balance -= tx.amount;
          }
        } else if (tx.type === 'TRANSFER') {
          // Outgoing transfer
          balance -= tx.amount;
        } else if (tx.type === 'ADJUSTMENT') {
          balance += tx.amount; // Can be positive or negative
        }
      }

      // Incoming transfers to this account
      if (tx.type === 'TRANSFER' && tx.toPaymentAccountId === account.id) {
        balance += tx.amount;
      }
    });

    return {
      ...account,
      currentBalance: balance,
    };
  });
}

/**
 * Calculate comprehensive Profit & Loss for a given period
 */
export function calculateProfitAndLoss(
  transactions: FinancialTransaction[],
  partners: Partner[],
  periodLabel: string = 'Current Financial Year',
  startDate?: string,
  endDate?: string
): ProfitAndLossSummary {
  // Only APPROVED transactions count towards P&L
  const filtered = filterTransactionsByDate(
    transactions.filter(t => t.status === 'APPROVED'),
    startDate,
    endDate
  );

  let grossRevenue = 0;
  let salesDiscounts = 0;

  const cogsBreakdown = {
    manufacturing: 0,
    fabric: 0,
    printing: 0,
    packaging: 0,
    other: 0,
    total: 0,
  };

  const opexBreakdown = {
    shipping: 0,
    marketing: 0,
    advertising: 0,
    websiteDomain: 0,
    software: 0,
    salaries: 0,
    rent: 0,
    gatewayFees: 0,
    taxes: 0,
    miscellaneous: 0,
    total: 0,
  };

  const otherBreakdown = {
    refunds: 0,
    adjustments: 0,
    total: 0,
  };

  filtered.forEach(tx => {
    if (tx.type === 'INCOME') {
      grossRevenue += tx.amount;
    } else if (tx.type === 'EXPENSE') {
      const cat = (tx.category || '').toLowerCase();

      // Check if COGS
      const isCogs = tx.isCogs || 
        ['manufacturing', 'fabric', 'printing', 'packaging'].some(k => cat.includes(k));

      if (isCogs) {
        if (cat.includes('fabric')) cogsBreakdown.fabric += tx.amount;
        else if (cat.includes('printing')) cogsBreakdown.printing += tx.amount;
        else if (cat.includes('packaging')) cogsBreakdown.packaging += tx.amount;
        else if (cat.includes('manufacturing')) cogsBreakdown.manufacturing += tx.amount;
        else cogsBreakdown.other += tx.amount;
        cogsBreakdown.total += tx.amount;
      } else {
        // Operating Expense
        if (cat.includes('shipping') || cat.includes('courier')) opexBreakdown.shipping += tx.amount;
        else if (cat.includes('advertising') || cat.includes('meta') || cat.includes('ad')) opexBreakdown.advertising += tx.amount;
        else if (cat.includes('marketing') || cat.includes('campaign')) opexBreakdown.marketing += tx.amount;
        else if (cat.includes('website') || cat.includes('domain') || cat.includes('cloud')) opexBreakdown.websiteDomain += tx.amount;
        else if (cat.includes('software') || cat.includes('saas') || cat.includes('app')) opexBreakdown.software += tx.amount;
        else if (cat.includes('salary') || cat.includes('salaries') || cat.includes('stipend')) opexBreakdown.salaries += tx.amount;
        else if (cat.includes('rent') || cat.includes('lease')) opexBreakdown.rent += tx.amount;
        else if (cat.includes('gateway') || cat.includes('mdr') || cat.includes('fee')) opexBreakdown.gatewayFees += tx.amount;
        else if (cat.includes('tax') || cat.includes('gst')) opexBreakdown.taxes += tx.amount;
        else opexBreakdown.miscellaneous += tx.amount;
        opexBreakdown.total += tx.amount;
      }
    } else if (tx.type === 'REFUND') {
      otherBreakdown.refunds += tx.amount;
      otherBreakdown.total += tx.amount;
    } else if (tx.type === 'ADJUSTMENT' && tx.amount < 0) {
      otherBreakdown.adjustments += Math.abs(tx.amount);
      otherBreakdown.total += Math.abs(tx.amount);
    }
  });

  const netRevenue = grossRevenue - salesDiscounts;
  const grossProfit = netRevenue - cogsBreakdown.total;
  const grossMarginPercent = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
  
  const totalExpenses = cogsBreakdown.total + opexBreakdown.total + otherBreakdown.total;
  const operatingProfit = grossProfit - opexBreakdown.total;
  const netProfit = operatingProfit - otherBreakdown.total;
  const netProfitMarginPercent = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

  // Allocate profit/loss to partners based on configurable ownership percentages
  const partnerAllocations = partners.map(partner => {
    const pct = partner.ownershipPercentage || 0;
    const allocatedAmount = (netProfit * pct) / 100;
    return {
      partnerId: partner.id,
      partnerName: partner.name,
      ownershipPercentage: pct,
      allocatedAmount: Math.round(allocatedAmount),
    };
  });

  return {
    period: periodLabel,
    startDate: startDate || '',
    endDate: endDate || '',
    grossRevenue,
    salesDiscounts,
    netRevenue,
    cogs: cogsBreakdown,
    grossProfit,
    grossMarginPercent,
    operatingExpenses: opexBreakdown,
    otherExpenses: otherBreakdown,
    totalExpenses,
    operatingProfit,
    netProfit,
    netProfitMarginPercent,
    partnerAllocations,
  };
}

export interface PartnerLedgerRow {
  id: string;
  date: string;
  transactionNumber: string;
  description: string;
  type: string;
  credit: number;
  debit: number;
  balance: number;
  reference: string;
  status: string;
}

/**
 * Calculate individual Partner Account summaries and ledgers
 */
export function calculatePartnerSummaries(
  partners: Partner[],
  transactions: FinancialTransaction[],
  totalCumulativeNetProfit: number
): PartnerAccountSummary[] {
  const approved = transactions.filter(t => t.status === 'APPROVED');

  return partners.map(partner => {
    const partnerTxs = approved.filter(t => t.partnerId === partner.id);

    let additionalContributions = 0;
    let capitalReturned = 0;
    let explicitProfitAllocated = 0;
    let explicitLossAllocated = 0;
    let withdrawals = 0;
    let personalExpensesPaid = 0;
    let reimbursements = 0;
    let adjustments = 0;

    partnerTxs.forEach(tx => {
      if (tx.type === 'CAPITAL') {
        // Only count as additional if it is not the initial seed voucher or marked as additional
        if (tx.id !== 'tx-001' && tx.id !== 'tx-002' && tx.id !== 'tx-003' && tx.id !== 'tx-004') {
          additionalContributions += tx.amount;
        }
      } else if (tx.type === 'CAPITAL_RETURN') {
        capitalReturned += tx.amount;
      } else if (tx.type === 'PROFIT_ALLOCATION') {
        explicitProfitAllocated += tx.amount;
      } else if (tx.type === 'LOSS_ALLOCATION') {
        explicitLossAllocated += tx.amount;
      } else if (tx.type === 'WITHDRAWAL') {
        withdrawals += tx.amount;
      } else if (tx.isPersonalExpenseByPartner || tx.type === 'PARTNER_EXPENSE') {
        personalExpensesPaid += tx.amount;
      } else if (tx.type === 'REIMBURSEMENT') {
        reimbursements += tx.amount;
      } else if (tx.type === 'ADJUSTMENT') {
        adjustments += tx.amount;
      }
    });

    const sharePct = ((partner.profitSharePercentage ?? partner.ownershipPercentage) || 0) / 100;
    const netShare = totalCumulativeNetProfit * sharePct;
    const computedProfitAllocated = netShare > 0 ? Math.round(netShare) : 0;
    const computedLossAllocated = netShare < 0 ? Math.round(Math.abs(netShare)) : 0;

    // Use explicit profit allocations if present, otherwise computed distribution share
    const profitAllocated = explicitProfitAllocated > 0 ? explicitProfitAllocated : computedProfitAllocated;
    const lossAllocated = explicitLossAllocated > 0 ? explicitLossAllocated : computedLossAllocated;

    // Current Account Balance:
    // Initial Capital + Additional Capital - Capital Returned + Profit Allocated - Loss Allocated - Withdrawals + Personal Expenses - Reimbursements + Adjustments
    const currentBalance = Math.round(
      (partner.initialCapital || 0) +
      additionalContributions -
      capitalReturned +
      profitAllocated -
      lossAllocated -
      withdrawals +
      personalExpensesPaid -
      reimbursements +
      adjustments
    );

    return {
      partner,
      capitalInvested: partner.initialCapital || 0,
      additionalContributions,
      capitalReturned,
      profitAllocated,
      lossAllocated,
      withdrawals,
      personalExpensesPaid,
      reimbursements,
      adjustments,
      currentBalance,
      transactionsCount: partnerTxs.length,
    };
  });
}

/**
 * Calculate complete chronological partner financial ledger with running balance
 */
export function calculatePartnerChronologicalLedger(
  partner: Partner,
  transactions: FinancialTransaction[]
): PartnerLedgerRow[] {
  const approved = transactions
    .filter(t => t.partnerId === partner.id && t.status === 'APPROVED')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let currentBalance = 0;
  const rows: PartnerLedgerRow[] = [];

  // Check if initial capital is already represented by an initial transaction (e.g. tx-001, tx-002, etc.)
  const hasInitialCapitalTx = approved.some(
    t => t.type === 'CAPITAL' && (t.id === 'tx-001' || t.id === 'tx-002' || t.id === 'tx-003' || t.id === 'tx-004')
  );

  if (!hasInitialCapitalTx && partner.initialCapital > 0) {
    currentBalance += partner.initialCapital;
    rows.push({
      id: `seed-cap-${partner.id}`,
      date: partner.joinDate || '2025-04-01',
      transactionNumber: `EQUITY-${partner.id.toUpperCase()}`,
      description: `Initial Seed Capital Subscribed by ${partner.name} (${partner.ownershipPercentage}% Equity)`,
      type: 'Capital Contribution',
      credit: partner.initialCapital,
      debit: 0,
      balance: currentBalance,
      reference: partner.bankDetails || 'FOUNDING-SHARES',
      status: 'APPROVED',
    });
  }

  approved.forEach(tx => {
    let credit = 0;
    let debit = 0;
    let displayType = 'Other';

    if (tx.type === 'CAPITAL') {
      displayType = 'Capital Contribution';
      credit = tx.amount;
      currentBalance += credit;
    } else if (tx.type === 'CAPITAL_RETURN') {
      displayType = 'Capital Return';
      debit = tx.amount;
      currentBalance -= debit;
    } else if (tx.type === 'PROFIT_ALLOCATION') {
      displayType = 'Profit Allocation';
      credit = tx.amount;
      currentBalance += credit;
    } else if (tx.type === 'LOSS_ALLOCATION') {
      displayType = 'Loss Allocation';
      debit = tx.amount;
      currentBalance -= debit;
    } else if (tx.type === 'WITHDRAWAL') {
      displayType = 'Partner Withdrawal';
      debit = tx.amount;
      currentBalance -= debit;
    } else if (tx.isPersonalExpenseByPartner || tx.type === 'PARTNER_EXPENSE') {
      displayType = 'Business Expense Paid by Partner';
      credit = tx.amount;
      currentBalance += credit;
    } else if (tx.type === 'REIMBURSEMENT') {
      displayType = 'Reimbursement';
      debit = tx.amount;
      currentBalance -= debit;
    } else if (tx.type === 'ADJUSTMENT') {
      displayType = 'Adjustment';
      if (tx.amount >= 0) {
        credit = tx.amount;
        currentBalance += credit;
      } else {
        debit = Math.abs(tx.amount);
        currentBalance -= debit;
      }
    } else {
      displayType = tx.category || 'Other';
      if (tx.amount >= 0) {
        credit = tx.amount;
        currentBalance += credit;
      } else {
        debit = Math.abs(tx.amount);
        currentBalance -= debit;
      }
    }

    rows.push({
      id: tx.id,
      date: tx.date,
      transactionNumber: tx.transactionNumber,
      description: tx.description,
      type: displayType,
      credit,
      debit,
      balance: currentBalance,
      reference: tx.referenceId || tx.orderId || 'N/A',
      status: tx.status,
    });
  });

  return rows;
}

/**
 * Calculate high-level Executive Financial KPIs
 */
export function calculateExecutiveKPIs(
  transactions: FinancialTransaction[],
  accounts: FinancialAccount[],
  partners: Partner[],
  startDate?: string,
  endDate?: string
) {
  const pnl = calculateProfitAndLoss(transactions, partners, 'Selected Period', startDate, endDate);
  const updatedAccounts = calculateAccountBalances(accounts, transactions);
  const partnerSummaries = calculatePartnerSummaries(partners, transactions, pnl.netProfit);

  let cashBalance = 0;
  let bankBalance = 0;
  let gatewayBalance = 0;

  updatedAccounts.forEach(acc => {
    if (acc.type === 'CASH') cashBalance += acc.currentBalance;
    else if (acc.type === 'BANK') bankBalance += acc.currentBalance;
    else gatewayBalance += acc.currentBalance;
  });

  const totalLiquid = cashBalance + bankBalance + gatewayBalance;

  // Partner totals
  const totalPartnerCapital = partnerSummaries.reduce(
    (sum, p) => sum + p.capitalInvested + p.additionalContributions - p.capitalReturned, 
    0
  );
  const totalPartnerWithdrawals = partnerSummaries.reduce((sum, p) => sum + p.withdrawals, 0);

  // Accounts Payable: Pending approval expenses or non-cleared expenses
  const accountsPayable = transactions
    .filter(t => t.status === 'PENDING_APPROVAL' && (t.type === 'EXPENSE' || t.type === 'REFUND'))
    .reduce((sum, t) => sum + t.amount, 0);

  // Accounts Receivable: Pending UPI/B2B incomes or un-settled gateway funds
  const accountsReceivable = gatewayBalance;

  return {
    pnl,
    cashBalance,
    bankBalance,
    gatewayBalance,
    totalLiquid,
    totalPartnerCapital,
    totalPartnerWithdrawals,
    accountsPayable,
    accountsReceivable,
    partnerSummaries,
    updatedAccounts,
  };
}
