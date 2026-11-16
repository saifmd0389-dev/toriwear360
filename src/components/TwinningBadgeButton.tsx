import React from 'react';
import { Sparkles, Users } from 'lucide-react';
import { Product } from '../types';

interface TwinningBadgeButtonProps {
  product: Product;
  onClick: (e: React.MouseEvent) => void;
  variant?: 'pill' | 'card-footer' | 'banner';
  theme?: 'dark' | 'light';
  className?: string;
}

export const TwinningBadgeButton: React.FC<TwinningBadgeButtonProps> = ({
  product,
  onClick,
  variant = 'pill',
  theme = 'dark',
  className = '',
}) => {
  const isMen = product.department === 'MEN';
  const label = isMen ? 'Try Men & Kid Twin Combo' : 'Try Kid & Dad Twin Combo';
  const isLight = theme === 'light';

  if (variant === 'banner') {
    return (
      <div
        onClick={onClick}
        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
          isLight
            ? 'bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-amber-200 hover:border-amber-400 text-amber-950 shadow-sm'
            : 'bg-gradient-to-r from-amber-950/40 via-[#181512] to-amber-950/40 border-amber-500/40 hover:border-amber-400 text-amber-200 shadow-md'
        } ${className}`}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Users className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-[11px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5">
              <span>{isMen ? 'FAMILY TWINNING AVAILABLE' : 'KID & PARENT TWIN COMBO'}</span>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-bold">SAVE 10%</span>
            </div>
            <div className="text-[10px] text-neutral-400 font-sans">
              Get the matching {isMen ? "Kids' edition" : "Adults' edition"} in this exact anime artwork.
            </div>
          </div>
        </div>

        <button
          type="button"
          className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 text-[10px] font-mono font-bold uppercase shrink-0 transition"
        >
          VIEW COMBO
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider transition active:scale-95 cursor-pointer rounded-full px-2.5 py-1 shadow-sm select-none ${
        isLight
          ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 shadow-amber-100'
          : 'bg-black/80 hover:bg-amber-950/60 text-amber-300 border border-amber-500/40 hover:border-amber-400 backdrop-blur-md shadow-black/40'
      } ${className}`}
      title="View matching Men and Kid twinning pair with 10% discount"
    >
      <Sparkles className="w-3 h-3 text-amber-400 animate-pulse shrink-0" />
      <span>{label}</span>
      <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 rounded font-mono font-bold">
        -10%
      </span>
    </button>
  );
};
