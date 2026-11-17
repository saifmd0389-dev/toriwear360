import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Users, ShieldCheck } from 'lucide-react';
import { Partner } from '../../types/finance';
import { useFinance } from '../../context/FinanceContext';

interface PartnerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PartnerConfigModal: React.FC<PartnerConfigModalProps> = ({ isOpen, onClose }) => {
  const { partners, updatePartner, updatePartnerPercentages } = useFinance();

  const [partnerEdits, setPartnerEdits] = useState<Partner[]>([]);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setPartnerEdits(JSON.parse(JSON.stringify(partners)));
      setError('');
      setSuccessMsg('');
    }
  }, [isOpen, partners]);

  if (!isOpen) return null;

  const totalPercentage = partnerEdits.reduce((sum, p) => sum + (Number(p.ownershipPercentage) || 0), 0);
  const isPercentageValid = Math.abs(totalPercentage - 100) < 0.01;

  const handleFieldChange = (index: number, field: keyof Partner, value: any) => {
    setPartnerEdits(prev => {
      const copy = [...prev];
      const cur = copy[index];
      if (!cur) return prev;
      copy[index] = { ...cur, [field]: value };
      return copy;
    });
    setError('');
  };

  const handleSave = async () => {
    if (!isPercentageValid) {
      setError(`Total profit-sharing percentage must equal exactly 100%. Current total is ${totalPercentage}%.`);
      return;
    }

    // Save individual details
    partnerEdits.forEach(p => {
      updatePartner(p.id, {
        name: p.name.trim(),
        role: p.role.trim(),
        email: p.email.trim(),
        phone: p.phone.trim(),
        panNumber: p.panNumber?.trim(),
        bankDetails: p.bankDetails?.trim(),
        notes: p.notes?.trim(),
        ownershipPercentage: Number(p.ownershipPercentage),
        profitSharePercentage: Number(p.profitSharePercentage ?? p.ownershipPercentage),
        initialCapital: Number(p.initialCapital) || 0,
      });
    });

    const percentagesMap: Record<string, number> = {};
    partnerEdits.forEach(p => {
      percentagesMap[p.id] = Number(p.profitSharePercentage ?? p.ownershipPercentage);
    });

    const res = await updatePartnerPercentages(percentagesMap);
    if (res && !res.success) {
      setError(res.error || 'Failed to save partner percentages.');
      return;
    }

    setSuccessMsg('Partner configuration saved successfully.');
    setTimeout(() => {
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-red-600" />
              <span>Configure TORIWEAR Partners & Profit-Sharing</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Edit partner profiles, contact information, and equity/profit allocation percentages.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ownership Percentage Validation Bar */}
        <div className={`px-6 py-3 border-b flex items-center justify-between ${
          isPercentageValid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <div className="flex items-center gap-2 text-xs font-semibold">
            {isPercentageValid ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600" />
            )}
            <span>
              Cumulative Profit-Sharing Ratio: <strong className="font-mono text-sm">{totalPercentage}%</strong> / 100%
            </span>
          </div>
          {!isPercentageValid && (
            <span className="text-[11px] font-medium text-amber-700">
              * Must equal exactly 100% before saving ({100 - totalPercentage > 0 ? `Needs +${100 - totalPercentage}%` : `Excess ${totalPercentage - 100}%`})
            </span>
          )}
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="space-y-5">
            {partnerEdits.map((partner, idx) => (
              <div 
                key={partner.id} 
                className="p-5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center font-mono">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{partner.name || `Partner ${idx + 1}`}</span>
                    <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      ID: {partner.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">Ownership:</label>
                      <div className="relative w-20">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={partner.ownershipPercentage}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            handleFieldChange(idx, 'ownershipPercentage', val);
                            if (partner.profitSharePercentage === undefined || partner.profitSharePercentage === partner.ownershipPercentage) {
                              handleFieldChange(idx, 'profitSharePercentage', val);
                            }
                          }}
                          className="w-full pl-2 pr-6 py-1 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-mono font-bold text-right focus:outline-none focus:border-red-500"
                        />
                        <span className="absolute right-2 top-1 text-slate-400 text-xs font-bold">%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">Profit Share:</label>
                      <div className="relative w-20">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={partner.profitSharePercentage ?? partner.ownershipPercentage}
                          onChange={e => handleFieldChange(idx, 'profitSharePercentage', parseFloat(e.target.value) || 0)}
                          className="w-full pl-2 pr-6 py-1 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-mono font-bold text-right text-red-600 focus:outline-none focus:border-red-500"
                        />
                        <span className="absolute right-2 top-1 text-slate-400 text-xs font-bold">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Partner Full Name *
                    </label>
                    <input
                      type="text"
                      value={partner.name}
                      onChange={e => handleFieldChange(idx, 'name', e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-medium focus:outline-none focus:border-red-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Designation / Role
                    </label>
                    <input
                      type="text"
                      value={partner.role}
                      onChange={e => handleFieldChange(idx, 'role', e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">
                      Initial Capital Investment (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 20000"
                      value={partner.initialCapital ?? ''}
                      onChange={e => handleFieldChange(idx, 'initialCapital', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-emerald-500 ring-1 ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={partner.email}
                      onChange={e => handleFieldChange(idx, 'email', e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={partner.phone}
                      onChange={e => handleFieldChange(idx, 'phone', e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      PAN / Tax Identifier
                    </label>
                    <input
                      type="text"
                      value={partner.panNumber || ''}
                      onChange={e => handleFieldChange(idx, 'panNumber', e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-mono uppercase focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Bank Settlement Details
                    </label>
                    <input
                      type="text"
                      value={partner.bankDetails || ''}
                      onChange={e => handleFieldChange(idx, 'bankDetails', e.target.value)}
                      placeholder="Bank & Account Number"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div className="text-xs text-slate-500">
            * All Profit & Loss distributions and current accounts will immediately recompute.
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isPercentageValid}
              className={`px-5 py-2 text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer ${
                isPercentageValid 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Save Configurations</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
