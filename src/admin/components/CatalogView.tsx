import React, { useState } from 'react';
import { useAdmin } from '../AdminDataContext';
import { FileText, Printer } from 'lucide-react';

export const CatalogView: React.FC = () => {
  const { products, settings } = useAdmin();

  const [selectedFranchise, setSelectedFranchise] = useState<string>('ALL');
  const [pricingMode, setPricingMode] = useState<'RETAIL' | 'WHOLESALE' | 'BOTH'>('BOTH');
  const [catalogTitle, setCatalogTitle] = useState('TORIWEAR • THE ANIMATED STREETWEAR UNIVERSE');
  const [seasonSubtitle] = useState('AUTUMN / WINTER 2026 OFFICIAL LINE SHEET & LOOKBOOK');
  const contactInfo = [settings?.supportEmail || 'support@thetoriwearstore.in', settings?.phone, settings?.businessAddress]
    .filter(Boolean)
    .join(' • ');

  const filteredProducts = products.filter(p => {
    if (selectedFranchise !== 'ALL' && p.franchise !== selectedFranchise) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-500" />
            <span>Digital Catalogue & Wholesale Line Sheet Generator</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Export print-ready PDF lookbooks with SKUs, barcodes, GSM specs, and wholesale MOQs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-red-600/20 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save as PDF Lookbook</span>
          </button>
        </div>
      </div>

      {/* Generator Configuration Controls */}
      <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-5 space-y-4 text-xs">
        <h3 className="font-bold text-white text-sm">Catalogue Parameters</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
              Select Franchise / Universe
            </label>
            <select
              value={selectedFranchise}
              onChange={(e) => setSelectedFranchise(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500 cursor-pointer"
            >
              <option value="ALL">Entire Product Vault ({products.length} Tees)</option>
              <option value="Solo Leveling">Solo Leveling Shadow Monarch Drop</option>
              <option value="Naruto">Naruto Shinobi Collection</option>
              <option value="One Piece">One Piece Grand Line</option>
              <option value="Demon Slayer">Demon Slayer Breathing Forms</option>
              <option value="Jujutsu Kaisen">Jujutsu Kaisen Cursed Tech</option>
              <option value="Toriwear Originals">Toriwear Originals (Owned IP)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
              Pricing Mode
            </label>
            <select
              value={pricingMode}
              onChange={(e) => setPricingMode(e.target.value as any)}
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500 cursor-pointer"
            >
              <option value="BOTH">Retail MRP + Wholesale Trade Price</option>
              <option value="RETAIL">Retail D2C Prices Only</option>
              <option value="WHOLESALE">Wholesale Trade Only (For B2B Buyers)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
              Catalogue Cover Headline
            </label>
            <input
              type="text"
              value={catalogTitle}
              onChange={(e) => setCatalogTitle(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
            />
          </div>
        </div>
      </div>

      {/* Printable Interactive Lookbook Sheet */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 sm:p-8 space-y-8 print:bg-white print:text-black print:p-0 print:border-none">
        {/* Cover / Header Section */}
        <div className="border-b-2 border-red-600 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded bg-red-600 flex items-center justify-center font-black text-white text-sm">
                T
              </div>
              <span className="text-xl font-black tracking-widest text-white print:text-black">TORIWEAR</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 print:border">
                OFFICIAL B2B & RETAIL LINE SHEET
              </span>
            </div>
            <h2 className="text-2xl font-black text-white print:text-black tracking-tight uppercase">
              {catalogTitle}
            </h2>
            <p className="text-xs text-neutral-400 print:text-neutral-600 font-mono mt-1">
              {seasonSubtitle}
            </p>
          </div>

          <div className="text-left md:text-right text-xs font-mono text-neutral-400 print:text-neutral-700 space-y-0.5">
            <div>Fabric: 100% Combed Heavy Cotton (240 GSM)</div>
            <div>Fits: Drop-Shoulder Super-Oversized Boxy Fit</div>
            <div>{contactInfo}</div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((p) => {
            const wholesalePrice = Math.round(p.price * 0.55); // 45% wholesale markup standard
            return (
              <div 
                key={p.id} 
                className="bg-[#14141c] print:bg-neutral-50 border border-neutral-800 print:border-neutral-300 rounded-xl overflow-hidden flex flex-col justify-between p-4 space-y-3"
              >
                <div className="relative h-60 rounded-lg overflow-hidden bg-neutral-900">
                  <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 bg-black/80 print:bg-neutral-200 print:text-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                    CAT #{p.catalogNumber}
                  </span>
                  <span className="absolute bottom-2 right-2 bg-red-600 text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                    {p.gsm} GSM
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono text-neutral-400 print:text-neutral-600 font-semibold">
                      {p.franchise}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-500">
                      SKU: {p.sku}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white print:text-black mt-0.5 leading-snug">
                    {p.name}
                  </h3>
                  <p className="text-[11px] text-neutral-400 print:text-neutral-600 mt-1 line-clamp-2">
                    {p.shortDescription}
                  </p>
                </div>

                <div className="pt-2 border-t border-neutral-800 print:border-neutral-200 flex items-center justify-between font-mono text-xs">
                  <div>
                    {pricingMode !== 'WHOLESALE' && (
                      <div>
                        <span className="text-neutral-500 text-[10px]">RETAIL MRP: </span>
                        <strong className="text-white print:text-black">₹{p.price}</strong>
                      </div>
                    )}
                    {pricingMode !== 'RETAIL' && (
                      <div className="text-emerald-400 print:text-emerald-700 font-bold">
                        <span className="text-[10px] text-neutral-500">TRADE MOQ 25: </span>
                        ₹{wholesalePrice}/pc
                      </div>
                    )}
                  </div>

                  <div className="text-right text-[10px] text-neutral-400 print:text-neutral-600">
                    <div>Sizes: S–XXL</div>
                    <div>GST: {p.gstRate}% Slab</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Lookbook Footer */}
        <div className="pt-6 border-t border-neutral-800 print:border-neutral-300 text-center font-mono text-xs text-neutral-500">
          TORIWEAR STREETWEAR LABS • ALL RIGHTS RESERVED • STRICT CONFIDENTIAL TRADE CATALOGUE
        </div>
      </div>
    </div>
  );
};
