import React, { useState } from 'react';
import { useAdmin } from '../../AdminDataContext';
import { AIDesignConcept } from '../../types/ai';
import { Sparkles, Eye, Package } from 'lucide-react';

interface AISavedConceptsSectionProps {
  onOpenConcept: (concept: AIDesignConcept) => void;
}

export const AISavedConceptsSection: React.FC<AISavedConceptsSectionProps> = ({
  onOpenConcept,
}) => {
  const { aiConcepts, convertConceptToProductDraft } = useAdmin();
  const [activeTab, setActiveTab] = useState<'ALL' | 'DRAFT' | 'REVIEW' | 'APPROVED' | 'IN_PRODUCTS'>('ALL');

  const filtered = aiConcepts.filter((c) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'IN_PRODUCTS') return Boolean(c.convertedToProductId);
    return c.status === activeTab;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <h2 className="text-xl font-black text-white font-sans uppercase tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-red-500" />
            <span>SAVED CONCEPTS & CREATIVE QUEUE</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Review work-in-progress apparel designs, pending approvals, and concepts queued for production.
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center p-1 rounded-xl bg-[#161724] border border-neutral-800 overflow-x-auto no-scrollbar">
          {[
            { id: 'ALL', label: 'All Concepts' },
            { id: 'DRAFT', label: 'Drafts' },
            { id: 'REVIEW', label: 'In Review' },
            { id: 'APPROVED', label: 'Approved' },
            { id: 'IN_PRODUCTS', label: 'In Products CMS' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((concept) => (
          <div
            key={concept.id}
            className="rounded-2xl bg-[#12131c] border border-neutral-800/80 hover:border-neutral-700 p-5 space-y-4 shadow-xl transition flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                {concept.imageUrl ? (
                  <img
                    src={concept.imageUrl}
                    alt={concept.designName}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-xl object-cover border border-neutral-700 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#181926] to-[#0f101a] border border-neutral-700/80 flex flex-col items-center justify-center text-center p-1 shrink-0">
                    <Sparkles className="w-4 h-4 text-red-400 mb-0.5" />
                    <span className="text-[8px] font-mono font-bold text-neutral-400 uppercase leading-none">
                      Draft Spec
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-mono text-red-400 uppercase font-bold">
                    {concept.designNumber} • {concept.department}
                  </div>
                  <h4 className="text-sm font-bold text-white uppercase font-sans line-clamp-1">
                    {concept.designName}
                  </h4>
                  <div className="text-xs text-neutral-400 font-mono mt-0.5">
                    {concept.world} • {concept.character}
                  </div>
                </div>
              </div>

              {concept.oneLineStory && (
                <div className="text-xs italic text-neutral-300 line-clamp-2 border-l-2 border-red-500 pl-2">
                  "{concept.oneLineStory}"
                </div>
              )}

              <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-neutral-800/80">
                <span className="text-neutral-500">
                  {new Date(concept.createdAt).toLocaleDateString()}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    concept.status === 'APPROVED'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  {concept.status}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between">
              <button
                type="button"
                onClick={() => onOpenConcept(concept)}
                className="text-xs font-mono font-bold text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Concept</span>
              </button>

              <button
                type="button"
                onClick={() => convertConceptToProductDraft(concept)}
                className="px-3 py-1.5 rounded-lg bg-[#181928] hover:bg-[#202235] text-xs font-mono text-white transition flex items-center gap-1 cursor-pointer border border-neutral-700"
              >
                <Package className="w-3.5 h-3.5 text-amber-400" />
                <span>Draft Product</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
