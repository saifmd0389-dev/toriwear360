import React from 'react';
import { ArrowLeft, ArrowRight, Users } from 'lucide-react';
import { Department } from '../types';

interface DepartmentCatalogHeaderProps {
  department: Department;
  productCount: number;
  onNavigateHome: () => void;
  onSwitchDepartment: (dept: Department) => void;
  onOpenComboModal?: () => void;
}

export const DepartmentCatalogHeader: React.FC<DepartmentCatalogHeaderProps> = ({
  department,
  productCount,
  onNavigateHome,
  onSwitchDepartment,
  onOpenComboModal,
}) => {
  const isMen = department === 'MEN';

  return (
    <div
      className={`border-b select-none transition-colors ${
        isMen
          ? 'bg-[#0a0a0f] border-neutral-800 text-white'
          : 'bg-gradient-to-b from-sky-50 via-white to-sky-50/50 border-sky-100 text-neutral-950'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Navigation Breadcrumb & Quick Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-xs font-mono">
            <button
              onClick={onNavigateHome}
              className={`hover:underline flex items-center gap-1 cursor-pointer transition ${
                isMen ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>HOME</span>
            </button>
            <span className={isMen ? 'text-neutral-600' : 'text-neutral-300'}>/</span>
            <span className={`font-bold uppercase ${isMen ? 'text-[#FF2028]' : 'text-sky-600'}`}>
              {isMen ? "MEN'S STREETWEAR" : "KIDS' STORYWEAR"}
            </span>
            <span className="text-[10px] font-mono text-neutral-400">
              ({productCount} PIECES)
            </span>
          </div>

          {/* Department Switcher & Family Twin Combo Action */}
          <div className="flex items-center gap-2">
            {onOpenComboModal && (
              <button
                onClick={onOpenComboModal}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 transition active:scale-95 cursor-pointer"
                title="View matching Men and Kid twinning pairs"
              >
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>TRY TWINNING COMBO (-10%)</span>
              </button>
            )}

            <button
              onClick={() => onSwitchDepartment(isMen ? 'KIDS' : 'MEN')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold uppercase transition active:scale-95 cursor-pointer border ${
                isMen
                  ? 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border-sky-500/30'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-900 shadow-sm'
              }`}
            >
              <span>{isMen ? "SWITCH TO KIDS' STORYWEAR" : "SWITCH TO MEN'S STREETWEAR"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Big Department Editorial Title & Lore */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                  isMen
                    ? 'bg-[#FF2028]/20 text-[#FF2028] border border-[#FF2028]/30'
                    : 'bg-sky-100 text-sky-700 border border-sky-200'
                }`}
              >
                {isMen ? 'HEAVYWEIGHT 240 GSM' : 'ULTRA-SOFT 180 GSM BIO-WASH'}
              </span>
              <span className={`text-xs font-mono ${isMen ? 'text-neutral-500' : 'text-neutral-400'}`}>
                {isMen ? 'OVERSIZED DROP-SHOULDER' : 'AGES 2 TO 13 YEARS'}
              </span>
            </div>

            <h1
              className={`font-heading text-3xl sm:text-5xl font-black uppercase tracking-tight ${
                isMen ? 'text-white' : 'text-neutral-950'
              }`}
            >
              {isMen ? "MEN'S TOKYO STREETWEAR" : "KIDS' STORYWEAR CHAPTER"}
            </h1>

            <p
              className={`mt-2 text-xs sm:text-sm font-sans max-w-2xl leading-relaxed ${
                isMen ? 'text-neutral-400' : 'text-neutral-600'
              }`}
            >
              {isMen
                ? 'Original Tokyo-inspired anime streetwear built on luxury 240 GSM combed cotton. Chiseled puff graphics, durable ribbed collars, and structured oversized drape.'
                : 'Playful, child-safe anime adventure apparel for kids ages 2–13. Made from 180 GSM bio-washed combed cotton, skin-friendly non-toxic inks, and original character stories.'}
            </p>
          </div>

          {/* Quick Features Strip */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <div
              className={`px-3 py-1.5 rounded-lg border ${
                isMen
                  ? 'bg-neutral-900 border-neutral-800 text-neutral-300'
                  : 'bg-white border-sky-100 text-neutral-700 shadow-sm'
              }`}
            >
              <span>{isMen ? '5 Menswear Worlds' : '5 Story Worlds'}</span>
            </div>
            <div
              className={`px-3 py-1.5 rounded-lg border ${
                isMen
                  ? 'bg-neutral-900 border-neutral-800 text-neutral-300'
                  : 'bg-white border-sky-100 text-neutral-700 shadow-sm'
              }`}
            >
              <span>Pre-Shrunk Cotton</span>
            </div>
            <div
              className={`px-3 py-1.5 rounded-lg border ${
                isMen
                  ? 'bg-neutral-900 border-neutral-800 text-neutral-300'
                  : 'bg-white border-sky-100 text-neutral-700 shadow-sm'
              }`}
            >
              <span>Twin Matching Available</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
