import React from 'react';
import { Sparkles, Bell, ArrowRight } from 'lucide-react';

interface EmptyDropStateProps {
  title?: string;
  subtitle?: string;
  description?: string;
  theme?: 'dark' | 'light';
  actionLabel?: string;
  onAction?: () => void;
  notifyBadgeText?: string;
}

export const EmptyDropState: React.FC<EmptyDropStateProps> = ({
  title = 'THE NEXT DROP IS COMING',
  subtitle = 'ARCHIVAL RELEASE IN PROGRESS',
  description = 'Our creative studio is currently preparing the next limited-quantity capsule. All pieces undergo strict quality inspection before release.',
  theme = 'dark',
  actionLabel,
  onAction,
  notifyBadgeText = 'EXCLUSIVE ACCESS',
}) => {
  const isDark = theme === 'dark';

  return (
    <div
      className={`w-full py-16 px-6 sm:px-12 rounded-3xl border text-center transition-all ${
        isDark
          ? 'bg-[#0d0e14] border-neutral-800/80 text-white shadow-2xl'
          : 'bg-white border-neutral-200 text-neutral-900 shadow-sm'
      }`}
    >
      <div className="max-w-xl mx-auto flex flex-col items-center">
        {/* Subtle Icon Badge */}
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${
            isDark
              ? 'bg-neutral-900 border border-neutral-800 text-[#FF2028]'
              : 'bg-neutral-100 border border-neutral-200 text-[#FF2028]'
          }`}
        >
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>

        {/* Micro-badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF2028]/10 border border-[#FF2028]/30 text-[10px] font-mono font-bold tracking-widest text-[#FF2028] uppercase mb-3">
          <Bell className="w-3 h-3" />
          <span>{notifyBadgeText}</span>
        </div>

        {/* Headline */}
        <h3
          className={`font-heading text-2xl sm:text-4xl font-black uppercase tracking-tight ${
            isDark ? 'text-white' : 'text-neutral-950'
          }`}
        >
          {title}
        </h3>

        {/* Subtitle */}
        <p className="mt-1 text-xs sm:text-sm font-mono tracking-wider font-semibold text-[#FF2028] uppercase">
          {subtitle}
        </p>

        {/* Description */}
        <p
          className={`mt-3 text-xs sm:text-sm leading-relaxed max-w-md ${
            isDark ? 'text-neutral-400' : 'text-neutral-600'
          }`}
        >
          {description}
        </p>

        {/* Actions */}
        {actionLabel && onAction && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onAction}
              className={`px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 ${
                isDark
                  ? 'bg-white hover:bg-neutral-200 text-black'
                  : 'bg-neutral-950 hover:bg-neutral-800 text-white'
              }`}
            >
              <span>{actionLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Footnote reassurance */}
        <div className="mt-6 pt-5 border-t border-neutral-800/40 w-full flex items-center justify-center gap-4 text-[11px] font-mono text-neutral-500">
          <span>• 100% Original IP</span>
          <span>• 240+ GSM Combed Cotton</span>
          <span>• Zero Placeholders</span>
        </div>
      </div>
    </div>
  );
};
