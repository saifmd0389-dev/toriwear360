import React, { useState } from 'react';
import { useAdmin } from '../../AdminDataContext';
import { AIDesignConcept } from '../../types/ai';
import { generateArtworkForConcept, testGeminiConnection } from '../../services/aiService';
import {
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Package,
  Download,
  Trash2,
  Copy,
  Printer,
  Image as ImageIcon,
  RefreshCw,
  Info,
} from 'lucide-react';

interface AIDesignWorkspaceModalProps {
  concept: AIDesignConcept | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenVariationModal: (concept: AIDesignConcept) => void;
}

export const AIDesignWorkspaceModal: React.FC<AIDesignWorkspaceModalProps> = ({
  concept,
  isOpen,
  onClose,
  onOpenVariationModal,
}) => {
  const {
    updateAIConcept,
    deleteAIConcept,
    convertConceptToProductDraft,
    hasPermission,
    showToast,
  } = useAdmin();

  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'STORY' | 'PRINT_CHECK' | 'ADMIN_NOTES' | 'VERSIONS'
  >('OVERVIEW');

  // Editable local state for fine-tuning
  const [designName, setDesignName] = useState(concept?.designName || '');
  const [story, setStory] = useState(concept?.story || '');
  const [oneLineStory, setOneLineStory] = useState(concept?.oneLineStory || '');
  const [internalNote, setInternalNote] = useState(concept?.adminNotes?.internal || '');
  const [revisionNote, setRevisionNote] = useState(concept?.adminNotes?.revision || '');
  const [productionNote, setProductionNote] = useState(concept?.adminNotes?.production || '');
  const [isEditingStory, setIsEditingStory] = useState(false);

  // Sync state if concept changes
  React.useEffect(() => {
    if (concept) {
      setDesignName(concept.designName);
      setStory(concept.story);
      setOneLineStory(concept.oneLineStory || '');
      setInternalNote(concept.adminNotes?.internal || '');
      setRevisionNote(concept.adminNotes?.revision || '');
      setProductionNote(concept.adminNotes?.production || '');
      setIsEditingStory(false);
    }
  }, [concept]);

  const [isGeneratingArtwork, setIsGeneratingArtwork] = useState(false);
  const [isImageEnabled, setIsImageEnabled] = useState(false);

  React.useEffect(() => {
    testGeminiConnection()
      .then((res) => setIsImageEnabled(res?.imageAI?.enabled ?? false))
      .catch(() => {});
  }, []);

  const handleGenerateArtworkModal = async () => {
    if (!concept || isGeneratingArtwork) return;
    setIsGeneratingArtwork(true);
    try {
      const promptToUse =
        concept.imagePrompt ||
        `${concept.designName} apparel graphic, ${concept.world}, ${concept.mood} mood, ${concept.colorDirection}`;
      const result = await generateArtworkForConcept(promptToUse, '1:1', '1K');
      const updated: AIDesignConcept = {
        ...concept,
        imageUrl: result.imageUrl,
        thumbnailUrl: result.imageUrl,
        artworkStatus: 'READY',
        artworkNotice: undefined,
        updatedAt: new Date().toISOString(),
      };
      updateAIConcept(updated);
      showToast('Artwork generated and added to concept!');
    } catch (err: any) {
      showToast(err?.message || 'Failed to generate artwork.');
    } finally {
      setIsGeneratingArtwork(false);
    }
  };

  if (!isOpen || !concept) return null;

  const handleSaveConceptChanges = () => {
    const updated: AIDesignConcept = {
      ...concept,
      designName,
      story,
      oneLineStory,
      adminNotes: {
        ...concept.adminNotes,
        internal: internalNote,
        revision: revisionNote,
        production: productionNote,
      },
      updatedAt: new Date().toISOString(),
    };
    updateAIConcept(updated);
    setIsEditingStory(false);
    showToast('Concept details saved.');
  };

  const handleStatusChange = (newStatus: AIDesignConcept['status']) => {
    if (!hasPermission('ai.approve') && newStatus === 'APPROVED') {
      showToast('You do not have permission to approve AI designs.');
      return;
    }
    const updated: AIDesignConcept = {
      ...concept,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };
    updateAIConcept(updated);
    showToast(`Concept status updated to ${newStatus}.`);
  };

  const handleCreateProduct = async () => {
    const result = await convertConceptToProductDraft(concept);
    if (result.success) {
      onClose();
    }
  };

  const handleDownloadArtwork = () => {
    // Open image in new window or prompt download
    const link = document.createElement('a');
    link.href = concept.imageUrl;
    link.download = `${concept.designNumber}-${concept.designName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    link.target = '_blank';
    link.click();
    showToast('Artwork download initiated.');
  };

  const handleDelete = () => {
    deleteAIConcept(concept.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl bg-[#0f1118] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header Bar */}
        <div className="p-4 sm:p-5 border-b border-neutral-800/90 flex flex-wrap items-center justify-between gap-4 bg-[#141622]">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded bg-black/60 border border-neutral-700 text-xs font-mono font-bold text-red-400">
              {concept.designNumber}
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white font-sans uppercase tracking-tight">
                {concept.designName}
              </h2>
              <div className="text-[11px] font-mono text-neutral-400 flex items-center gap-2">
                <span>{concept.department}</span>
                <span>•</span>
                <span>{concept.world}</span>
                <span>•</span>
                <span>Version {concept.version}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Badge */}
            <div className="flex items-center gap-1 bg-[#1a1c2c] px-3 py-1.5 rounded-xl border border-neutral-700">
              <span className="text-[10px] font-mono text-neutral-400 uppercase">Status:</span>
              <select
                value={concept.status}
                onChange={(e) => handleStatusChange(e.target.value as any)}
                className="bg-transparent text-xs font-mono font-bold uppercase text-white outline-none cursor-pointer"
              >
                <option value="DRAFT" className="bg-[#1a1c2c] text-neutral-300">DRAFT</option>
                <option value="REVIEW" className="bg-[#1a1c2c] text-amber-300">REVIEW</option>
                <option value="APPROVED" className="bg-[#1a1c2c] text-emerald-400">APPROVED</option>
                <option value="ARCHIVED" className="bg-[#1a1c2c] text-neutral-500">ARCHIVED</option>
              </select>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-neutral-800 bg-[#12141e] overflow-x-auto no-scrollbar">
          {[
            { id: 'OVERVIEW', label: 'Overview & Design' },
            { id: 'STORY', label: 'Story & Lore' },
            { id: 'PRINT_CHECK', label: 'Print Readiness & Quality' },
            { id: 'ADMIN_NOTES', label: 'Admin Notes' },
            { id: 'VERSIONS', label: `Versions (${concept.versionHistory.length || 1})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 px-3 text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer whitespace-nowrap border-b-2 ${
                activeTab === tab.id
                  ? 'border-red-500 text-white'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {activeTab === 'OVERVIEW' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Artwork Presentation */}
              <div className="lg:col-span-5 space-y-4">
                {concept.imageUrl ? (
                  <div className="relative group rounded-2xl overflow-hidden bg-black aspect-square border border-neutral-800 shadow-2xl flex items-center justify-center">
                    <img
                      src={concept.imageUrl}
                      alt={concept.designName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                      <span className="px-2.5 py-1 rounded bg-black/80 backdrop-blur-md text-[10px] font-mono font-bold text-white border border-neutral-700">
                        {concept.placement}
                      </span>
                      <button
                        type="button"
                        onClick={handleDownloadArtwork}
                        className="pointer-events-auto p-2 rounded-lg bg-black/80 hover:bg-black text-white text-xs border border-neutral-700 transition cursor-pointer"
                        title="Download Artwork"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#0d0e17] via-[#141525] to-[#0d0e17] aspect-square border border-neutral-800/90 shadow-2xl flex flex-col justify-between p-6">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded bg-black/80 text-[10px] font-mono font-bold text-red-400 border border-neutral-800">
                        {concept.designNumber}
                      </span>
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        Artwork Pending
                      </span>
                    </div>

                    <div className="text-center space-y-2.5 py-2">
                      <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-700/80 mx-auto flex items-center justify-center text-red-500 shadow-inner">
                        <Sparkles className="w-7 h-7" />
                      </div>
                      <div className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                        Concept Blueprint
                      </div>
                      <p className="text-xs text-neutral-400 font-sans max-w-xs mx-auto leading-relaxed">
                        Design lore, character specs, and apparel placement are stored. Generate artwork on demand when ready.
                      </p>
                      {isImageEnabled ? (
                        <button
                          type="button"
                          onClick={handleGenerateArtworkModal}
                          disabled={isGeneratingArtwork}
                          className="mt-3 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold uppercase transition flex items-center gap-1.5 mx-auto cursor-pointer shadow-lg shadow-red-600/30"
                        >
                          {isGeneratingArtwork ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ImageIcon className="w-3.5 h-3.5" />
                          )}
                          <span>{isGeneratingArtwork ? 'Generating Artwork...' : 'Generate Artwork'}</span>
                        </button>
                      ) : (
                        <div className="pt-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-neutral-400 bg-neutral-900/90 border border-neutral-800 px-3.5 py-1.5 rounded-xl">
                            <Info className="w-3.5 h-3.5 text-neutral-500" />
                            Image Generation — Coming Soon
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono text-neutral-400 border-t border-neutral-800/80 pt-3">
                      <span>Placement: {concept.placement}</span>
                      <span>{concept.garmentType || 'Streetwear'}</span>
                    </div>
                  </div>
                )}

                {/* Color Swatches */}
                <div className="p-4 rounded-xl bg-[#141622] border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                    <span className="uppercase font-bold">Color Palette ({concept.colorDirection})</span>
                    <span>{concept.palette.length} Spot Colors</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {concept.palette.map((color, idx) => (
                      <div key={idx} className="flex-1 space-y-1 text-center">
                        <div
                          className="h-8 rounded-lg border border-neutral-700 shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-[10px] font-mono text-neutral-400 block truncate">
                          {color}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Original Prompt */}
                <div className="p-4 rounded-xl bg-[#141622] border border-neutral-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono uppercase text-neutral-400">
                    <span className="font-bold">Original Creative Prompt</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(concept.prompt);
                        showToast('Prompt copied to clipboard.');
                      }}
                      className="text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <p className="text-xs text-neutral-300 italic font-sans leading-relaxed">
                    "{concept.prompt}"
                  </p>
                </div>
              </div>

              {/* Right Column: Concept Specs & Metadata */}
              <div className="lg:col-span-7 space-y-5">
                {/* Originality Banner */}
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    concept.originalityStatus === 'SAFE FOR ORIGINAL CONCEPT'
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                      : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                    <div>
                      <div className="text-xs font-mono font-bold uppercase">
                        {concept.originalityStatus}
                      </div>
                      <div className="text-[10px] text-neutral-300">
                        {concept.originalityNotes}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 text-neutral-400">
                    Proprietary IP
                  </span>
                </div>

                {/* Character & Lore Snapshot */}
                <div className="p-4 rounded-xl bg-[#141622] border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono uppercase text-neutral-400">
                    <span className="font-bold">Character Identity</span>
                    <span className="text-white">{concept.character}</span>
                  </div>
                  <div className="text-xs text-neutral-200">
                    <strong>Role:</strong> {concept.characterRole || 'Street Courier'}
                  </div>
                  {concept.characterAbility && (
                    <div className="text-xs text-neutral-200">
                      <strong>Signature Ability:</strong> {concept.characterAbility}
                    </div>
                  )}
                  {concept.oneLineStory && (
                    <div className="p-2.5 rounded bg-black/40 border-l-2 border-red-500 text-xs italic text-neutral-300">
                      "{concept.oneLineStory}"
                    </div>
                  )}
                </div>

                {/* Apparel Specifications Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-[#141622] border border-neutral-800">
                    <div className="text-[10px] font-mono uppercase text-neutral-400">Department</div>
                    <div className="text-xs font-bold text-white mt-0.5">{concept.department}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#141622] border border-neutral-800">
                    <div className="text-[10px] font-mono uppercase text-neutral-400">World Universe</div>
                    <div className="text-xs font-bold text-white mt-0.5 truncate">{concept.world}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#141622] border border-neutral-800">
                    <div className="text-[10px] font-mono uppercase text-neutral-400">Collection</div>
                    <div className="text-xs font-bold text-white mt-0.5 truncate">{concept.collection}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#141622] border border-neutral-800">
                    <div className="text-[10px] font-mono uppercase text-neutral-400">Design Type</div>
                    <div className="text-xs font-bold text-white mt-0.5">{concept.designType}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#141622] border border-neutral-800">
                    <div className="text-[10px] font-mono uppercase text-neutral-400">Print Placement</div>
                    <div className="text-xs font-bold text-white mt-0.5">{concept.placement}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#141622] border border-neutral-800">
                    <div className="text-[10px] font-mono uppercase text-neutral-400">Print Style</div>
                    <div className="text-xs font-bold text-white mt-0.5">{concept.printStyle}</div>
                  </div>
                </div>

                {/* Product Description Copy */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase font-bold text-white">
                    Generated Product Description
                  </label>
                  <p className="text-xs text-neutral-300 leading-relaxed p-3.5 rounded-xl bg-[#141622] border border-neutral-800">
                    {concept.productDescription}
                  </p>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {concept.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded text-[11px] font-mono bg-neutral-800/80 text-neutral-300 border border-neutral-700"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'STORY' && (
            <div className="space-y-5 max-w-4xl">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <h3 className="text-sm font-mono font-bold uppercase text-white">
                  The Story Behind The Design
                </h3>
                <button
                  onClick={() => setIsEditingStory(!isEditingStory)}
                  className="px-3 py-1 rounded bg-[#1c1d2c] border border-neutral-700 text-xs font-mono text-neutral-300 hover:text-white cursor-pointer"
                >
                  {isEditingStory ? 'Cancel Editing' : 'Edit Story & Lore'}
                </button>
              </div>

              {isEditingStory ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-neutral-400">One-Line Hook</label>
                    <input
                      type="text"
                      value={oneLineStory}
                      onChange={(e) => setOneLineStory(e.target.value)}
                      className="w-full p-3 rounded-lg bg-[#141622] border border-neutral-700 text-sm text-white outline-none focus:border-red-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-neutral-400">Full Story Narrative</label>
                    <textarea
                      rows={6}
                      value={story}
                      onChange={(e) => setStory(e.target.value)}
                      className="w-full p-3 rounded-lg bg-[#141622] border border-neutral-700 text-sm text-white outline-none focus:border-red-500"
                    />
                  </div>
                  <button
                    onClick={handleSaveConceptChanges}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold uppercase cursor-pointer"
                  >
                    Save Story Changes
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {concept.oneLineStory && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-red-950/20 to-transparent border-l-4 border-red-500">
                      <div className="text-[11px] font-mono uppercase text-red-400 font-bold mb-1">
                        One-Line Narrative Hook
                      </div>
                      <div className="text-sm italic font-sans text-neutral-100">
                        "{concept.oneLineStory}"
                      </div>
                    </div>
                  )}

                  <div className="p-5 rounded-xl bg-[#141622] border border-neutral-800 space-y-2">
                    <div className="text-xs font-mono uppercase text-neutral-400 font-bold">
                      Cinematic Lore
                    </div>
                    <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-line font-sans">
                      {concept.story}
                    </p>
                  </div>

                  {concept.whyWearing && (
                    <div className="p-4 rounded-xl bg-[#141622] border border-neutral-800 space-y-1.5">
                      <div className="text-xs font-mono uppercase text-neutral-400 font-bold">
                        Why The Character Wears This Garment
                      </div>
                      <p className="text-xs text-neutral-300 leading-relaxed font-sans">
                        {concept.whyWearing}
                      </p>
                    </div>
                  )}

                  {concept.designLore && (
                    <div className="p-4 rounded-xl bg-[#141622] border border-neutral-800 space-y-1.5">
                      <div className="text-xs font-mono uppercase text-neutral-400 font-bold">
                        World Lore Integration
                      </div>
                      <p className="text-xs text-neutral-300 leading-relaxed font-sans">
                        {concept.designLore}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'PRINT_CHECK' && (
            <div className="space-y-6 max-w-4xl">
              {/* Print Readiness Card */}
              <div className="p-5 rounded-xl bg-[#141622] border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-white">
                    <Printer className="w-4 h-4 text-sky-400" />
                    <span>PRINT READINESS EVALUATION</span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded text-xs font-mono font-bold uppercase ${
                      concept.printReadiness === 'GOOD'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : concept.printReadiness === 'REVIEW'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {concept.printReadiness}
                  </span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {concept.printNotes}
                </p>
                <div className="text-[11px] font-mono text-neutral-400 italic">
                  Recommendations: Screen printing requires 4-5 screen separations; high-density discharge ink recommended for dark garment body.
                </div>
              </div>

              {/* Quality Checklist */}
              {concept.qualityReview && (
                <div className="p-5 rounded-xl bg-[#141622] border border-neutral-800 space-y-4">
                  <div className="text-xs font-mono font-bold uppercase text-white border-b border-neutral-800 pb-2">
                    AI CREATIVE REVIEW & SCORECARD
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="p-3 rounded-lg bg-black/40 border border-neutral-800 text-center">
                      <div className="text-[10px] font-mono uppercase text-neutral-400">Originality</div>
                      <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                        {concept.qualityReview.originalityScore}%
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-black/40 border border-neutral-800 text-center">
                      <div className="text-[10px] font-mono uppercase text-neutral-400">Character Distinct</div>
                      <div className="text-xl font-bold font-mono text-sky-400 mt-1">
                        {concept.qualityReview.characterDistinctiveness}%
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-black/40 border border-neutral-800 text-center">
                      <div className="text-[10px] font-mono uppercase text-neutral-400">Streetwear Fit</div>
                      <div className="text-xl font-bold font-mono text-red-400 mt-1">
                        {concept.qualityReview.streetwearAppeal}%
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-black/40 border border-neutral-800 text-center">
                      <div className="text-[10px] font-mono uppercase text-neutral-400">Print Clarity</div>
                      <div className="text-xl font-bold font-mono text-purple-400 mt-1">
                        {concept.qualityReview.printReadability}%
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-black/40 border border-neutral-800 text-center col-span-2 sm:col-span-1">
                      <div className="text-[10px] font-mono uppercase text-neutral-400">Brand Fit</div>
                      <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                        {concept.qualityReview.brandFit}%
                      </div>
                    </div>
                  </div>

                  {concept.qualityReview.feedback.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <div className="text-[11px] font-mono uppercase text-neutral-400 font-bold">
                        Creative Director Feedback:
                      </div>
                      <ul className="text-xs space-y-1 text-neutral-300">
                        {concept.qualityReview.feedback.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-red-500 font-bold">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'ADMIN_NOTES' && (
            <div className="space-y-4 max-w-3xl">
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase text-neutral-400 font-bold">
                  Internal Team Notes
                </label>
                <textarea
                  rows={2}
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Add internal production observations or designer feedback..."
                  className="w-full p-3 rounded-lg bg-[#141622] border border-neutral-700 text-xs text-white outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase text-neutral-400 font-bold">
                  Revision Notes
                </label>
                <textarea
                  rows={2}
                  value={revisionNote}
                  onChange={(e) => setRevisionNote(e.target.value)}
                  placeholder="Requests for variations, altered colorways, or alternative placements..."
                  className="w-full p-3 rounded-lg bg-[#141622] border border-neutral-700 text-xs text-white outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase text-neutral-400 font-bold">
                  Production & Mill Notes
                </label>
                <textarea
                  rows={2}
                  value={productionNote}
                  onChange={(e) => setProductionNote(e.target.value)}
                  placeholder="Technical strike-off guidelines, ink formulation, or packaging details..."
                  className="w-full p-3 rounded-lg bg-[#141622] border border-neutral-700 text-xs text-white outline-none focus:border-red-500"
                />
              </div>

              <button
                onClick={handleSaveConceptChanges}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold uppercase cursor-pointer"
              >
                Save Notes
              </button>
            </div>
          )}

          {activeTab === 'VERSIONS' && (
            <div className="space-y-4 max-w-3xl">
              <div className="flex items-center justify-between text-xs font-mono uppercase text-neutral-400 font-bold">
                <span>Concept Version History</span>
                <span className="text-neutral-500">{concept.versionHistory.length} Recorded Versions</span>
              </div>

              <div className="space-y-3">
                {concept.versionHistory.map((v) => (
                  <div
                    key={v.versionNumber}
                    className={`p-4 rounded-xl border flex items-start gap-4 transition ${
                      v.versionNumber === concept.version
                        ? 'bg-[#181a29] border-red-500/40 shadow-lg'
                        : 'bg-[#141622] border-neutral-800'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center font-mono font-bold text-red-400 text-xs shrink-0">
                      v{v.versionNumber}
                    </div>

                    {v.imageUrl && (
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-black border border-neutral-700 shrink-0">
                        <img src={v.imageUrl} alt={v.designName} className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white flex items-center gap-2">
                          <span>{v.designName}</span>
                          {v.versionNumber === concept.version && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-600/30 text-red-400 border border-red-500/30 uppercase font-mono">
                              Active Version
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-500">
                          {new Date(v.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-300">{v.changesSummary}</p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] font-mono text-neutral-500">
                          By {v.createdBy}
                        </span>
                        {v.versionNumber !== concept.version && (
                          <button
                            type="button"
                            onClick={() => {
                              const restored: AIDesignConcept = {
                                ...concept,
                                designName: v.designName,
                                imageUrl: v.imageUrl,
                                thumbnailUrl: v.imageUrl,
                                story: v.story || concept.story,
                                version: v.versionNumber,
                                updatedAt: new Date().toISOString(),
                              };
                              updateAIConcept(restored);
                              showToast(`Restored version v${v.versionNumber}`);
                            }}
                            className="px-2.5 py-1 rounded bg-[#202235] hover:bg-red-600/30 border border-neutral-700 hover:border-red-500/50 text-[11px] font-mono text-neutral-200 transition cursor-pointer"
                          >
                            Restore Version
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="p-4 sm:p-5 border-t border-neutral-800/90 bg-[#12141e] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenVariationModal(concept)}
              className="px-3.5 py-2 rounded-xl bg-[#1c1d2c] hover:bg-[#25273b] border border-neutral-700 text-neutral-200 text-xs font-mono font-bold uppercase transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-red-400" />
              <span>CREATE VARIATIONS</span>
            </button>
            <button
              onClick={handleDelete}
              className="p-2 rounded-xl bg-red-950/20 hover:bg-red-900/30 border border-red-500/30 text-red-400 transition cursor-pointer"
              title="Delete Concept"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {concept.status !== 'APPROVED' ? (
              <button
                onClick={() => handleStatusChange('APPROVED')}
                className="px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 text-xs font-mono font-bold uppercase transition flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>APPROVE DESIGN</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>APPROVED</span>
              </span>
            )}

            <button
              onClick={handleCreateProduct}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 text-white text-xs font-mono font-bold uppercase tracking-wider shadow-lg shadow-red-600/25 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Package className="w-4 h-4" />
              <span>SEND TO PRODUCT CMS</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
