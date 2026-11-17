import React, { useState } from 'react';
import { useAdmin } from '../../AdminDataContext';
import { AIDesignConcept } from '../../types/ai';
import {
  Palette,
  Search,
  Eye,
  Sparkles,
  Package,
  LayoutGrid,
  List,
} from 'lucide-react';

interface AIDesignLibrarySectionProps {
  onOpenConcept: (concept: AIDesignConcept) => void;
  onOpenVariationModal: (concept: AIDesignConcept) => void;
  initialCollectionFilter?: string;
}

export const AIDesignLibrarySection: React.FC<AIDesignLibrarySectionProps> = ({
  onOpenConcept,
  onOpenVariationModal,
  initialCollectionFilter,
}) => {
  const { aiConcepts, aiWorlds, convertConceptToProductDraft } =
    useAdmin();

  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<'ALL' | 'MEN' | 'KIDS'>('ALL');
  const [worldFilter, setWorldFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [collectionFilter] = useState(initialCollectionFilter || 'ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');

  const filtered = aiConcepts.filter((concept) => {
    const matchesSearch =
      concept.designName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      concept.character.toLowerCase().includes(searchQuery.toLowerCase()) ||
      concept.designNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      concept.prompt.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDept = departmentFilter === 'ALL' || concept.department === departmentFilter;
    const matchesWorld = worldFilter === 'ALL' || concept.world === worldFilter;
    const matchesStatus = statusFilter === 'ALL' || concept.status === statusFilter;
    const matchesCol = collectionFilter === 'ALL' || concept.collection === collectionFilter;

    return matchesSearch && matchesDept && matchesWorld && matchesStatus && matchesCol;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <h2 className="text-xl font-black text-white font-sans uppercase tracking-tight flex items-center gap-2">
            <Palette className="w-5 h-5 text-sky-400" />
            <span>DESIGN LIBRARY & ASSET VAULT</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Browse, filter, and inspect {aiConcepts.length} generated anime streetwear apparel designs.
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-[#161724] border border-neutral-800">
            <button
              onClick={() => setViewMode('GRID')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'GRID' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('LIST')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'LIST' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Search Input */}
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
          <input
            type="text"
            placeholder="Search by design name, character, SKU, prompt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#141622] border border-neutral-800 text-xs text-white outline-none focus:border-red-500 placeholder-neutral-500 font-sans"
          />
        </div>

        {/* Department Filter */}
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value as any)}
          className="p-2.5 rounded-xl bg-[#141622] border border-neutral-800 text-xs font-mono text-white outline-none focus:border-red-500 cursor-pointer"
        >
          <option value="ALL">All Departments</option>
          <option value="MEN">Men Streetwear</option>
          <option value="KIDS">Kids Storywear</option>
        </select>

        {/* World Filter */}
        <select
          value={worldFilter}
          onChange={(e) => setWorldFilter(e.target.value)}
          className="p-2.5 rounded-xl bg-[#141622] border border-neutral-800 text-xs font-mono text-white outline-none focus:border-red-500 cursor-pointer"
        >
          <option value="ALL">All Universes</option>
          {aiWorlds.map((w) => (
            <option key={w.id} value={w.name}>
              {w.name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="p-2.5 rounded-xl bg-[#141622] border border-neutral-800 text-xs font-mono text-white outline-none focus:border-red-500 cursor-pointer"
        >
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="REVIEW">In Review</option>
          <option value="APPROVED">Approved</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {/* Grid or List Representation */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#12131c] border border-neutral-800/80 space-y-2">
          <Palette className="w-8 h-8 text-neutral-600 mx-auto" />
          <h4 className="text-sm font-bold font-mono text-neutral-300 uppercase">
            No designs match the current filters
          </h4>
          <p className="text-xs text-neutral-500">
            Try adjusting your search terms or filter selections.
          </p>
        </div>
      ) : viewMode === 'GRID' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filtered.map((concept) => (
            <div
              key={concept.id}
              className="group rounded-2xl bg-[#12131c] border border-neutral-800/80 hover:border-neutral-700 overflow-hidden shadow-xl transition flex flex-col justify-between"
            >
              {/* Image Box */}
              <div
                onClick={() => onOpenConcept(concept)}
                className="relative aspect-square overflow-hidden bg-black cursor-pointer"
              >
                <img
                  src={concept.imageUrl}
                  alt={concept.designName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-[10px] font-mono font-bold text-white border border-neutral-700">
                  {concept.designNumber}
                </div>
                <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                  <span className="px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-[10px] font-mono text-neutral-300 border border-neutral-700">
                    {concept.placement}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      concept.status === 'APPROVED'
                        ? 'bg-emerald-500/90 text-white'
                        : 'bg-black/80 text-amber-300 border border-neutral-700'
                    }`}
                  >
                    {concept.status}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-neutral-400 truncate">
                    {concept.world} • <strong className="text-white">{concept.character}</strong>
                  </div>
                  <h4
                    onClick={() => onOpenConcept(concept)}
                    className="text-sm font-bold text-white uppercase font-sans line-clamp-1 group-hover:text-red-400 transition cursor-pointer"
                  >
                    {concept.designName}
                  </h4>
                  <p className="text-xs text-neutral-400 line-clamp-2 font-sans">
                    {concept.story}
                  </p>
                </div>

                <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onOpenConcept(concept)}
                    className="text-xs font-mono font-bold text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Workspace</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenVariationModal(concept)}
                      className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer"
                      title="Create Variations"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-red-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => convertConceptToProductDraft(concept)}
                      className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer"
                      title="Send to Products CMS"
                    >
                      <Package className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="rounded-2xl bg-[#12131c] border border-neutral-800/80 overflow-hidden shadow-xl divide-y divide-neutral-800/80">
          {filtered.map((concept) => (
            <div
              key={concept.id}
              className="p-4 hover:bg-[#161726] transition flex items-center gap-4 cursor-pointer"
              onClick={() => onOpenConcept(concept)}
            >
              <img
                src={concept.imageUrl}
                alt={concept.designName}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-lg object-cover border border-neutral-700 shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-red-400 font-bold">
                    {concept.designNumber}
                  </span>
                  <span className="text-xs text-neutral-500">•</span>
                  <span className="text-xs font-mono text-neutral-400">{concept.world}</span>
                  <span className="text-xs text-neutral-500">•</span>
                  <span className="text-xs font-mono text-white font-bold">{concept.character}</span>
                </div>
                <h4 className="text-sm font-bold text-white font-sans uppercase truncate">
                  {concept.designName}
                </h4>
                <p className="text-xs text-neutral-400 truncate font-sans">
                  {concept.oneLineStory || concept.story}
                </p>
              </div>

              <div className="text-right shrink-0 space-y-1">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    concept.status === 'APPROVED'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  {concept.status}
                </span>
                <div className="text-[10px] font-mono text-neutral-500">
                  {concept.department} • {concept.placement}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
