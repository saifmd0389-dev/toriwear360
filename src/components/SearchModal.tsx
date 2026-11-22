import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, ArrowRight } from 'lucide-react';
import { Product, Department } from '../types';
import { isPublishedProduct } from '../utils/productFilters';
import { useCustomerAuth } from '../context/CustomerAuthContext';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  initialQuery?: string;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  products,
  onSelectProduct,
  initialQuery = '',
}) => {
  const { recordSearch } = useCustomerAuth();
  const [query, setQuery] = useState(initialQuery);

  React.useEffect(() => {
    if (isOpen && initialQuery) {
      setQuery(initialQuery);
      recordSearch(initialQuery);
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    if (query.trim().length < 3) return;
    const timer = setTimeout(() => {
      recordSearch(query.trim());
    }, 800);
    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard shortcut (Escape) to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background page scrolling when search modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const [selectedDept, setSelectedDept] = useState<'ALL' | Department>('ALL');

  const popularSearches = [
    'Void Walker',
    'Dark Shonen',
    'Neon Ronin',
    'Kami & Zero',
    '240 GSM',
    'Mecha',
    'Samurai',
    'Kids Storywear',
  ];

  const filteredProducts = useMemo(() => {
    // Only published products can ever appear in search
    let list = (products || []).filter(isPublishedProduct);
    if (selectedDept !== 'ALL') {
      list = list.filter((p) => p.department === selectedDept);
    }
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.catalogNumber.toLowerCase().includes(q) ||
          `#${p.catalogNumber.toLowerCase()}`.includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.universe && p.universe.toLowerCase().includes(q)) ||
          (p.franchise && p.franchise.toLowerCase().includes(q)) ||
          (p.character && p.character.toLowerCase().includes(q)) ||
          p.world.toLowerCase().includes(q) ||
          p.fit.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.department.toLowerCase().includes(q) ||
          (p.storyQuote && p.storyQuote.toLowerCase().includes(q))
      );
    }
    return list;
  }, [products, query, selectedDept]);

  if (!isOpen) return null;

  return (
    <div 
      style={{ zIndex: 9999 }}
      className="fixed inset-0 z-[9999] flex items-start justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        id="search-catalog-modal"
        className="bg-[#0f1017] border border-neutral-800 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl mt-12 animate-in zoom-in-95 max-h-[85vh] flex flex-col"
      >
        {/* Search Header Input */}
        <div className="p-4 border-b border-neutral-800 bg-[#141520] flex items-center gap-3">
          <Search className="w-5 h-5 text-[#FF2028]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search characters, worlds, fits (e.g. Void Walker, Cyberpunk, Kami, 240 GSM)..."
            className="flex-1 bg-transparent border-none text-sm text-white placeholder-neutral-500 focus:outline-none font-mono"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center p-1 text-neutral-400 hover:text-white rounded cursor-pointer"
              aria-label="Clear Search Query"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
            aria-label="Close Search"
            title="Close Search (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Department Filters & Quick Tags */}
        <div className="px-4 py-3 border-b border-neutral-800/80 bg-[#0c0d12] flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            {(['ALL', 'MEN', 'KIDS'] as const).map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-3 py-1 rounded-lg text-xs font-sans font-semibold uppercase tracking-[0.05em] transition cursor-pointer ${
                  selectedDept === dept
                    ? 'bg-[#FF2028] text-white'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-sans text-neutral-500 overflow-x-auto no-scrollbar">
            <span className="font-medium tracking-[0.04em]">POPULAR:</span>
            {popularSearches.map((term) => (
              <button
                key={term}
                onClick={() => setQuery(term)}
                className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-medium transition cursor-pointer"
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-4 divide-y divide-neutral-800/60 max-h-[60vh]">
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 text-xs font-sans">
              NO PIECES FOUND MATCHING "{query.toUpperCase()}".<br />
              TRY SEARCHING BY WORLD (E.G. "DARK SHONEN", "CYBERPUNK", "KAMI & ZERO").
            </div>
          ) : (
            filteredProducts.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  onSelectProduct(p);
                  onClose();
                }}
                className="py-3 px-2 flex items-center justify-between gap-4 hover:bg-neutral-900/60 rounded-xl transition cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={p.images[0]}
                    alt={p.name}
                    className="w-12 h-14 rounded-lg object-cover bg-neutral-900 border border-neutral-800"
                  />
                  <div>
                    <div className="text-[11px] font-sans text-[#FF2028] uppercase font-semibold tracking-[0.04em]">
                      {p.department} // {p.world}
                    </div>
                    <div className="font-brush text-lg sm:text-xl font-normal text-white tracking-wide leading-tight group-hover:text-[#FF2028] transition">
                      {p.name}
                    </div>
                    <div className="text-[11px] font-sans text-neutral-400">
                      {p.gsm} • {p.fit}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right font-sans tabular-nums">
                    <div className="text-sm font-bold text-white">
                      ₹{p.price}
                    </div>
                    <div className="text-[11px] text-neutral-500 line-through">
                      ₹{p.originalPrice}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-white group-hover:translate-x-1 transition" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
