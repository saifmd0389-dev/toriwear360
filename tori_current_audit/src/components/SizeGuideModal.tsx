import React, { useState } from 'react';
import { X, CheckCircle, HelpCircle, User, Smile } from 'lucide-react';
import { SIZE_CHART, KIDS_SIZE_CHART } from '../data/constants';

interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDepartment?: 'MEN' | 'KIDS';
}

export const SizeGuideModal: React.FC<SizeGuideModalProps> = ({ 
  isOpen, 
  onClose,
  initialDepartment = 'MEN' 
}) => {
  const [activeTab, setActiveTab] = useState<'MEN' | 'KIDS'>(initialDepartment);

  // Sync tab with initialDepartment on open
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialDepartment);
    }
  }, [isOpen, initialDepartment]);

  // Keyboard shortcut (Escape) to close modal
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background page scrolling when size guide modal is open
  React.useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      style={{ zIndex: 9999 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        id="size-guide-modal"
        className="bg-[#101117] border border-neutral-800 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-[#151620]">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-[#FF2028] font-bold">
              TORIWEAR FIT PROTOCOL
            </div>
            <h3 className="font-heading text-2xl font-bold text-white uppercase">
              OFFICIAL SIZE CHARTS
            </h3>
          </div>
          <button
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
            aria-label="Close Size Guide"
            title="Close Size Guide (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle: MEN vs KIDS */}
        <div className="px-6 pt-5 flex items-center gap-3">
          <button
            onClick={() => setActiveTab('MEN')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-2 border cursor-pointer ${
              activeTab === 'MEN'
                ? 'bg-[#FF2028] text-white border-[#FF2028] shadow-lg shadow-[#FF2028]/25'
                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span>MEN’S STREETWEAR (S–XXXL)</span>
          </button>

          <button
            onClick={() => setActiveTab('KIDS')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-2 border cursor-pointer ${
              activeTab === 'KIDS'
                ? 'bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/25'
                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
            }`}
          >
            <Smile className="w-4 h-4" />
            <span>KIDS’ STORYWEAR (AGES 2–13Y)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {activeTab === 'MEN' ? (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-xl border border-neutral-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#181822] text-neutral-300 font-mono uppercase border-b border-neutral-800">
                    <tr>
                      <th className="py-3 px-4">Size</th>
                      <th className="py-3 px-4 text-center">Chest (Round)</th>
                      <th className="py-3 px-4 text-center">Length</th>
                      <th className="py-3 px-4 text-center">Shoulder</th>
                      <th className="py-3 px-4 text-center">Sleeve</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800 text-neutral-200 font-mono">
                    {SIZE_CHART.map((row) => (
                      <tr key={row.size} className="hover:bg-neutral-800/40 transition">
                        <td className="py-3 px-4 font-bold text-white font-heading text-base">{row.size}</td>
                        <td className="py-3 px-4 text-center text-[#FF2028] font-bold">{row.chest}</td>
                        <td className="py-3 px-4 text-center">{row.length}</td>
                        <td className="py-3 px-4 text-center text-neutral-400">{row.shoulder}</td>
                        <td className="py-3 px-4 text-center text-neutral-400">{row.sleeve}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 rounded-xl bg-[#FF2028]/10 border border-[#FF2028]/30 flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-[#FF2028] flex-shrink-0 mt-0.5" />
                <div className="text-xs text-neutral-200 leading-relaxed">
                  <strong className="text-white block font-semibold mb-0.5">FIT RECOMMENDATION:</strong>
                  All Men's tees are designed with relaxed, drop-shoulder proportions (240–260 GSM). Choose your standard size for an authentic Tokyo oversized drape, or size down one if you prefer a classic boxy fit.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-xl border border-neutral-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0f172a] text-neutral-300 font-mono uppercase border-b border-neutral-800">
                    <tr>
                      <th className="py-3 px-4">Age Size</th>
                      <th className="py-3 px-4 text-center">Chest (Inches)</th>
                      <th className="py-3 px-4 text-center">Length (Inches)</th>
                      <th className="py-3 px-4 text-center">Shoulder (Inches)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800 text-neutral-200 font-mono">
                    {KIDS_SIZE_CHART.map((row) => (
                      <tr key={row.size} className="hover:bg-neutral-800/40 transition">
                        <td className="py-3 px-4 font-bold text-sky-400 font-heading text-sm">{row.size}</td>
                        <td className="py-3 px-4 text-center text-white font-bold">{row.chest}</td>
                        <td className="py-3 px-4 text-center text-neutral-300">{row.length}</td>
                        <td className="py-3 px-4 text-center text-neutral-400">{row.shoulder}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-400/30 flex items-start gap-3">
                <Smile className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-neutral-200 leading-relaxed">
                  <strong className="text-white block font-semibold mb-0.5">KIDS SIZING ADVICE:</strong>
                  Children grow fast! If your child is on the taller side or between age brackets, we recommend choosing one size up. All kids tees are crafted from 180 GSM bio-washed pre-shrunk cotton for maximum softness.
                </div>
              </div>
            </div>
          )}

          {/* Measuring Tips */}
          <div className="space-y-2 text-xs text-neutral-400 border-t border-neutral-800 pt-4">
            <div className="text-neutral-200 font-semibold uppercase font-mono text-[11px]">How to measure:</div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span><strong>Chest:</strong> Measure round the fullest part under armpits, keeping tape flat.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span><strong>Length:</strong> Measure straight from high shoulder seam down to bottom hem.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span><strong>Exchanges:</strong> Free 7-day size exchanges if it doesn't fit like a dream.</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-mono font-bold uppercase rounded-xl transition cursor-pointer"
          >
            CLOSE SIZE GUIDE
          </button>
        </div>
      </div>
    </div>
  );
};
