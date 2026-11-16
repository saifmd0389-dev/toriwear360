import React, { useState } from 'react';
import {
  LayoutDashboard,
  Table,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  BarChart3,
  Landmark,
  ShieldCheck,
  FileText,
  Plus,
  Settings,
  ArrowRightLeft,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { FinancialTransaction } from '../types/finance';

import { FinanceDashboardTab } from './finance/FinanceDashboardTab';
import { TransactionsLedgerTab } from './finance/TransactionsLedgerTab';
import { IncomeTrackerTab } from './finance/IncomeTrackerTab';
import { ExpensesTrackerTab } from './finance/ExpensesTrackerTab';
import { PartnerAccountsTab } from './finance/PartnerAccountsTab';
import { ProfitAndLossTab } from './finance/ProfitAndLossTab';
import { CashBankAccountsTab } from './finance/CashBankAccountsTab';
import { FinancialAuditLogTab } from './finance/FinancialAuditLogTab';
import { FinancialReportsTab } from './finance/FinancialReportsTab';

import { TransactionModal } from './finance/TransactionModal';
import { PartnerConfigModal } from './finance/PartnerConfigModal';
import { TransferModal } from './finance/TransferModal';

export type FinanceTabId = 
  | 'dashboard' 
  | 'transactions' 
  | 'income' 
  | 'expenses' 
  | 'partners' 
  | 'pnl' 
  | 'accounts' 
  | 'audit' 
  | 'reports';

export type FinanceUserRole = 'SUPER_ADMIN' | 'PARTNER' | 'FINANCE_MANAGER' | 'VIEWER';

export const FinanceView: React.FC = () => {
  const { pendingApprovalsCount } = useFinance();

  const [activeTab, setActiveTab] = useState<FinanceTabId>('dashboard');
  const [activeRole, setActiveRole] = useState<FinanceUserRole>('SUPER_ADMIN');

  // Modal States
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalInitialType, setTxModalInitialType] = useState<any>(undefined);
  const [txModalPartnerId, setTxModalPartnerId] = useState<string | undefined>(undefined);
  const [txToEdit, setTxToEdit] = useState<FinancialTransaction | null>(null);

  const [isPartnerConfigOpen, setIsPartnerConfigOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Tab definitions
  const tabs: { id: FinanceTabId; label: string; icon: any; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions Ledger', icon: Table, badge: pendingApprovalsCount },
    { id: 'income', label: 'Income', icon: ArrowUpRight },
    { id: 'expenses', label: 'Expenses', icon: ArrowDownRight },
    { id: 'partners', label: 'Partners', icon: Users },
    { id: 'pnl', label: 'Profit & Loss', icon: BarChart3 },
    { id: 'accounts', label: 'Cash & Bank', icon: Landmark },
    { id: 'audit', label: 'Audit Trail', icon: ShieldCheck },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  const handleOpenNewTransaction = (type?: any, partnerId?: string) => {
    setTxToEdit(null);
    setTxModalInitialType(type);
    setTxModalPartnerId(partnerId);
    setIsTxModalOpen(true);
  };

  const handleEditTransaction = (tx: FinancialTransaction) => {
    setTxToEdit(tx);
    setTxModalInitialType(tx.type);
    setTxModalPartnerId(tx.partnerId);
    setIsTxModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Role & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Finance & Accounting</h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-bold border border-red-200">
              TORIWEAR ERP
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time partner equity ledgers, multi-account treasury, accrual P&L, and immutable audit logs
          </p>
        </div>

        {/* Security Role Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Active Role Simulator for Security testing */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold text-slate-500 text-[11px]">Role:</span>
            <select
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as FinanceUserRole)}
              className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="PARTNER">Partner</option>
              <option value="FINANCE_MANAGER">Finance Manager</option>
              <option value="VIEWER">Viewer (Read Only)</option>
            </select>
          </div>

          {activeRole !== 'VIEWER' && (
            <>
              <button
                onClick={() => setIsTransferModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Transfer</span>
              </button>

              {activeRole === 'SUPER_ADMIN' && (
                <button
                  onClick={() => setIsPartnerConfigOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-sm transition-all cursor-pointer"
                  title="Configure Partner Ownership & Profit-Sharing %"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Partner Equity</span>
                </button>
              )}

              <button
                onClick={() => handleOpenNewTransaction()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm shadow-red-600/20 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Transaction</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Top Module Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              style={isActive ? { color: '#ffffff', backgroundColor: '#0f172a' } : undefined}
            >
              <Icon 
                className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} 
                style={isActive ? { color: '#ffffff' } : undefined} 
              />
              <span style={isActive ? { color: '#ffffff' } : undefined}>{tab.label}</span>
              {tab.badge && tab.badge > 0 ? (
                <span 
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'
                  }`}
                  style={{ color: '#ffffff' }}
                >
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* 3. Tab Content Modules */}
      <div>
        {activeTab === 'dashboard' && (
          <FinanceDashboardTab
            onOpenNewTransaction={handleOpenNewTransaction}
            onNavigateToTab={(tabId) => setActiveTab(tabId as FinanceTabId)}
            onOpenTransferModal={() => setIsTransferModalOpen(true)}
            onOpenPartnerConfig={() => setIsPartnerConfigOpen(true)}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsLedgerTab
            onOpenNewTransaction={handleOpenNewTransaction}
            onEditTransaction={handleEditTransaction}
          />
        )}

        {activeTab === 'income' && (
          <IncomeTrackerTab
            onOpenNewTransaction={handleOpenNewTransaction}
            onEditTransaction={handleEditTransaction}
          />
        )}

        {activeTab === 'expenses' && (
          <ExpensesTrackerTab
            onOpenNewTransaction={handleOpenNewTransaction}
            onEditTransaction={handleEditTransaction}
          />
        )}

        {activeTab === 'partners' && (
          <PartnerAccountsTab
            onOpenNewTransaction={handleOpenNewTransaction}
            onOpenPartnerConfig={() => setIsPartnerConfigOpen(true)}
            onEditTransaction={handleEditTransaction}
          />
        )}

        {activeTab === 'pnl' && (
          <ProfitAndLossTab />
        )}

        {activeTab === 'accounts' && (
          <CashBankAccountsTab
            onOpenNewTransaction={handleOpenNewTransaction}
            onEditTransaction={handleEditTransaction}
          />
        )}

        {activeTab === 'audit' && (
          <FinancialAuditLogTab />
        )}

        {activeTab === 'reports' && (
          <FinancialReportsTab />
        )}
      </div>

      {/* 4. Global Modals */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => {
          setIsTxModalOpen(false);
          setTxToEdit(null);
        }}
        initialType={txModalInitialType}
        initialPartnerId={txModalPartnerId}
        transactionToEdit={txToEdit}
      />

      <PartnerConfigModal
        isOpen={isPartnerConfigOpen}
        onClose={() => setIsPartnerConfigOpen(false)}
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
      />
    </div>
  );
};
export default FinanceView;
