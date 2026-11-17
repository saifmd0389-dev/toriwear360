import React from 'react';
import { useAdmin } from '../../AdminDataContext';
import { AIDesignConcept } from '../../types/ai';
import { 
  Sparkles, 
  Palette, 
  Users, 
  Globe, 
  Layers, 
  CheckCircle2, 
  Package, 
  ArrowRight, 
  Clock, 
  ShieldCheck, 
  TrendingUp, 
  Eye, 
  Plus, 
  BookOpen
} from 'lucide-react';

interface AIDashboardSectionProps {
  onNavigateSection: (section: string) => void;
  onOpenConcept: (concept: AIDesignConcept) => void;
}

export const AIDashboardSection: React.FC<AIDashboardSectionProps> = ({
  onNavigateSection,
  onOpenConcept,
}) => {
  const { aiConcepts, aiCharacters, aiWorlds, aiCollections } = useAdmin();

  // Derived statistics
  const totalConcepts = aiConcepts.length;
  const approvedDesigns = aiConcepts.filter((c) => c.status === 'APPROVED').length;
  const draftProducts = aiConcepts.filter((c) => c.convertedToProductId || c.status === 'APPROVED').length;
  const recentlyGenerated = [...aiConcepts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3);
  const recentlyApproved = aiConcepts.filter((c) => c.status === 'APPROVED').slice(0, 3);
  const recentlyUsedInProducts = aiConcepts.filter((c) => c.convertedToProductId).slice(0, 3);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Studio Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-mono font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-red-600" />
              <span>Original IP Creative Engine • TORIWEAR Universe</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 font-sans uppercase">
              TORIWEAR AI DESIGN LAB
            </h1>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Create original anime-inspired characters, cinematic street lore, and high-density apparel artwork with AI. Every concept is 100% newly created for TORIWEAR.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap sm:flex-col gap-2.5 shrink-0">
            <button
              onClick={() => onNavigateSection('Create Design')}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider shadow-md shadow-red-600/25 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
              style={{ color: '#ffffff' }}
            >
              <Sparkles className="w-4 h-4 text-white" />
              <span>CREATE NEW DESIGN</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigateSection('Characters')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-slate-500" />
                <span>Character</span>
              </button>
              <button
                onClick={() => onNavigateSection('Stories')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                <span>Story</span>
              </button>
              <button
                onClick={() => onNavigateSection('Design Library')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5 text-slate-500" />
                <span>Library</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Statistics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Concepts</span>
            <Sparkles className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{totalConcepts}</div>
          <div className="text-[10px] text-slate-500 font-medium">Total generated</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Designs</span>
            <Palette className="w-3.5 h-3.5 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-sky-600 font-mono">{totalConcepts}</div>
          <div className="text-[10px] text-slate-500 font-medium">Apparel artwork</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Approved</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">{approvedDesigns}</div>
          <div className="text-[10px] text-slate-500 font-medium">Human validated</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Drafts</span>
            <Package className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono">{draftProducts}</div>
          <div className="text-[10px] text-slate-500 font-medium">In Products CMS</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Characters</span>
            <Users className="w-3.5 h-3.5 text-red-500" />
          </div>
          <div className="text-2xl font-black text-red-600 font-mono">{aiCharacters.length}</div>
          <div className="text-[10px] text-slate-500 font-medium">Original protagonists</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Worlds</span>
            <Globe className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-600 font-mono">{aiWorlds.length}</div>
          <div className="text-[10px] text-slate-500 font-medium">Active universes</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Collections</span>
            <Layers className="w-3.5 h-3.5 text-pink-500" />
          </div>
          <div className="text-2xl font-black text-pink-600 font-mono">{aiCollections.length}</div>
          <div className="text-[10px] text-slate-500 font-medium">Chapter capsules</div>
        </div>
      </div>

      {/* Featured / Active Concept Showcase */}
      {(() => {
        const flagshipConcept = aiConcepts[0];
        if (!flagshipConcept) return null;
        return (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">
                  FLAGSHIP AI CONCEPT HIGHLIGHT
                </h2>
              </div>
              <button
                onClick={() => onOpenConcept(flagshipConcept)}
                className="text-xs text-red-600 hover:text-red-700 font-bold font-mono flex items-center gap-1 cursor-pointer"
              >
                <span>Inspect Workspace</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-4 relative group rounded-xl overflow-hidden bg-slate-900 aspect-square border border-slate-200 shadow-inner">
                <img
                  src={flagshipConcept.imageUrl}
                  alt={flagshipConcept.designName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div 
                  className="absolute top-3 left-3 px-2 py-1 rounded bg-slate-900/90 backdrop-blur-md text-[10px] font-mono font-bold text-white border border-slate-700"
                  style={{ color: '#ffffff' }}
                >
                  {flagshipConcept.designNumber}
                </div>
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <span 
                    className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-mono font-bold uppercase"
                    style={{ color: '#ffffff' }}
                  >
                    {flagshipConcept.department}
                  </span>
                  <span 
                    className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-mono font-bold uppercase"
                    style={{ color: '#ffffff' }}
                  >
                    {flagshipConcept.originalityStatus === 'SAFE FOR ORIGINAL CONCEPT' ? 'Original IP' : 'Transformed'}
                  </span>
                </div>
              </div>

              <div className="md:col-span-8 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500">
                  <span>{flagshipConcept.world}</span>
                  <span>•</span>
                  <span>CHARACTER: <strong className="text-slate-900">{flagshipConcept.character}</strong></span>
                  <span>•</span>
                  <span>{flagshipConcept.placement}</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-slate-900 font-sans tracking-tight">
                  {flagshipConcept.designName}
                </h3>

                <p className="text-slate-600 text-sm leading-relaxed line-clamp-3 font-sans">
                  {flagshipConcept.story}
                </p>

                {flagshipConcept.oneLineStory && (
                  <div className="p-3 rounded-xl bg-slate-50 border-l-4 border-red-500 text-xs italic text-slate-700 font-medium">
                    "{flagshipConcept.oneLineStory}"
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    onClick={() => onOpenConcept(flagshipConcept)}
                    className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold font-mono uppercase tracking-wider shadow-sm transition cursor-pointer"
                    style={{ color: '#ffffff' }}
                  >
                    OPEN CONCEPT WORKSPACE
                  </button>
                  <button
                    onClick={() => onNavigateSection('Create Design')}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                  >
                    CREATE SIMILAR IN THIS WORLD
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tri-Column Activity Feeds */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Recently Generated */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-900 uppercase">
              <Clock className="w-3.5 h-3.5 text-sky-600" />
              <span>Recently Generated</span>
            </div>
            <button
              onClick={() => onNavigateSection('Saved Concepts')}
              className="text-[11px] font-mono text-slate-500 hover:text-slate-800 font-medium"
            >
              All
            </button>
          </div>

          <div className="space-y-3">
            {recentlyGenerated.map((concept) => (
              <div
                key={concept.id}
                onClick={() => onOpenConcept(concept)}
                className="group p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition cursor-pointer flex items-center gap-3"
              >
                <img
                  src={concept.imageUrl}
                  alt={concept.designName}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 group-hover:text-red-600 transition truncate">
                    {concept.designName}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 truncate">
                    {concept.character} • {concept.world}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {concept.designNumber}
                  </div>
                </div>
                <Eye className="w-4 h-4 text-slate-400 group-hover:text-slate-700 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Recently Approved */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-900 uppercase">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Recently Approved</span>
            </div>
            <button
              onClick={() => onNavigateSection('Design Library')}
              className="text-[11px] font-mono text-slate-500 hover:text-slate-800 font-medium"
            >
              Library
            </button>
          </div>

          <div className="space-y-3">
            {recentlyApproved.length > 0 ? (
              recentlyApproved.map((concept) => (
                <div
                  key={concept.id}
                  onClick={() => onOpenConcept(concept)}
                  className="group p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition cursor-pointer flex items-center gap-3"
                >
                  <img
                    src={concept.imageUrl}
                    alt={concept.designName}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-emerald-700 truncate">
                      {concept.designName}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 truncate">
                      Approved • {concept.printReadiness}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {concept.collection}
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-slate-500 font-mono">
                No approved concepts yet. Open a concept to approve.
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Recently Used in Products */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-900 uppercase">
              <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
              <span>In Products CMS</span>
            </div>
            <button
              onClick={() => onNavigateSection('Design Library')}
              className="text-[11px] font-mono text-slate-500 hover:text-slate-800 font-medium"
            >
              Vault
            </button>
          </div>

          <div className="space-y-3">
            {recentlyUsedInProducts.length > 0 ? (
              recentlyUsedInProducts.map((concept) => (
                <div
                  key={concept.id}
                  onClick={() => onOpenConcept(concept)}
                  className="group p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition cursor-pointer flex items-center gap-3"
                >
                  <img
                    src={concept.imageUrl}
                    alt={concept.designName}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-amber-800 truncate">
                      {concept.designName}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 truncate">
                      Draft Product Created
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {concept.department} • 240 GSM
                    </div>
                  </div>
                  <Package className="w-4 h-4 text-amber-600 shrink-0" />
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-slate-500 font-mono">
                Select an approved concept and click "Create Product Draft" to send it to the CMS.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
