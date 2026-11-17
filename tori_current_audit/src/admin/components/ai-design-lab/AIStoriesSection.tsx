import React, { useState } from 'react';
import { useAdmin } from '../../AdminDataContext';
import { AIDesignConcept } from '../../types/ai';
import {
  BookOpen,
  Sparkles,
  Copy,
  Eye,
} from 'lucide-react';

interface AIStoriesSectionProps {
  onOpenConcept: (concept: AIDesignConcept) => void;
}

export const AIStoriesSection: React.FC<AIStoriesSectionProps> = ({
  onOpenConcept,
}) => {
  const { aiConcepts, aiCharacters, aiWorlds, showToast } = useAdmin();
  const [selectedWorld, setSelectedWorld] = useState('ALL');
  const [selectedCharacter, setSelectedCharacter] = useState('ALL');
  const [previewStoryModal, setPreviewStoryModal] = useState<AIDesignConcept | null>(null);

  // Filtered concepts that have stories
  const filteredConcepts = aiConcepts.filter((c) => {
    const matchesWorld = selectedWorld === 'ALL' || c.world === selectedWorld;
    const matchesChar = selectedCharacter === 'ALL' || c.character === selectedCharacter;
    return matchesWorld && matchesChar;
  });

  const handleCopyStory = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Story text copied to clipboard.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <h2 className="text-xl font-black text-white font-sans uppercase tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-red-500" />
            <span>TORIWEAR STORY & LORE VAULT</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Every garment tells an unwritten legend. Explore and manage cinematic narratives, one-line hooks, and character backstories.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <select
            value={selectedWorld}
            onChange={(e) => setSelectedWorld(e.target.value)}
            className="p-2 rounded-xl bg-[#141622] border border-neutral-800 text-xs font-mono text-white outline-none focus:border-red-500 cursor-pointer"
          >
            <option value="ALL">All Universes</option>
            {aiWorlds.map((w) => (
              <option key={w.id} value={w.name}>
                {w.name}
              </option>
            ))}
          </select>

          <select
            value={selectedCharacter}
            onChange={(e) => setSelectedCharacter(e.target.value)}
            className="p-2 rounded-xl bg-[#141622] border border-neutral-800 text-xs font-mono text-white outline-none focus:border-red-500 cursor-pointer"
          >
            <option value="ALL">All Characters</option>
            {aiCharacters.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Brand Identity Manifesto Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#171827] via-[#13141f] to-[#0f1018] border border-neutral-800/80 shadow-xl space-y-2">
        <div className="text-[10px] font-mono text-red-400 uppercase tracking-widest font-bold">
          BRAND MANIFESTO // THE TORIWEAR CREED
        </div>
        <h3 className="text-lg font-black text-white font-sans uppercase">
          "WE DON’T FOLLOW STORIES — WE WEAR THEM."
        </h3>
        <p className="text-xs text-neutral-300 leading-relaxed max-w-3xl">
          At TORIWEAR, apparel is more than fabric—it is an artifact of identity. Each collection delivers an episodic chapter where characters confront inner challenges, navigate neon dystopias or playful starlight worlds, and wear their courage on their sleeves.
        </p>
      </div>

      {/* Stories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredConcepts.map((concept) => (
          <div
            key={concept.id}
            className="rounded-2xl bg-[#12131c] border border-neutral-800/80 hover:border-neutral-700 p-5 space-y-4 shadow-xl transition flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={concept.imageUrl}
                    alt={concept.designName}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-lg object-cover border border-neutral-700 shrink-0"
                  />
                  <div>
                    <div className="text-[10px] font-mono text-neutral-400">
                      {concept.world} • <strong className="text-white">{concept.character}</strong>
                    </div>
                    <h4 className="text-sm font-bold text-white uppercase font-sans line-clamp-1">
                      {concept.designName}
                    </h4>
                  </div>
                </div>

                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/60 text-red-400 border border-neutral-800">
                  {concept.designNumber}
                </span>
              </div>

              {/* One-Line Narrative Hook */}
              {concept.oneLineStory && (
                <div className="p-3 rounded-lg bg-gradient-to-r from-red-950/20 to-[#161726] border-l-2 border-red-500 text-xs italic text-neutral-200 font-sans">
                  "{concept.oneLineStory}"
                </div>
              )}

              {/* Full Narrative */}
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase text-neutral-400 font-bold">
                  Story Narrative:
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed font-sans line-clamp-4">
                  {concept.story}
                </p>
              </div>

              {/* Garment Lore Context */}
              {concept.whyWearing && (
                <div className="text-[11px] text-neutral-400 font-sans italic bg-black/30 p-2.5 rounded-lg border border-neutral-800/80">
                  <strong>Why they wear it:</strong> {concept.whyWearing}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewStoryModal(concept)}
                  className="px-3 py-1.5 rounded-lg bg-[#181928] hover:bg-[#202235] text-xs font-mono text-white transition flex items-center gap-1.5 cursor-pointer border border-neutral-700"
                >
                  <Eye className="w-3.5 h-3.5 text-red-400" />
                  <span>"Show Story" Customer Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyStory(`${concept.designName}\n\n"${concept.oneLineStory}"\n\n${concept.story}`)}
                  className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
                  title="Copy Story"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => onOpenConcept(concept)}
                className="text-xs font-mono text-neutral-400 hover:text-white transition cursor-pointer"
              >
                Inspect Design
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Customer-Facing Story Card Preview Modal */}
      {previewStoryModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-[#10111a] border border-neutral-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
              <div className="flex items-center gap-2 text-xs font-mono uppercase text-red-400 font-bold">
                <Sparkles className="w-4 h-4" />
                <span>CUSTOMER STOREFRONT "SHOW STORY" PREVIEW</span>
              </div>
              <button
                onClick={() => setPreviewStoryModal(null)}
                className="text-neutral-400 hover:text-white text-xs font-mono cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Simulated Storefront Story Card */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-[#181a28] to-[#0e0f17] border border-neutral-700/80 p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-4">
                <img
                  src={previewStoryModal.imageUrl}
                  alt={previewStoryModal.designName}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-xl object-cover border border-neutral-600 shadow-md shrink-0"
                />
                <div>
                  <div className="text-[10px] font-mono text-red-400 uppercase tracking-widest font-bold">
                    {previewStoryModal.world} // CHAPTER ARCHIVE
                  </div>
                  <h3 className="text-lg font-black text-white font-sans uppercase">
                    {previewStoryModal.designName}
                  </h3>
                  <div className="text-xs font-mono text-neutral-400">
                    Protagonist: {previewStoryModal.character}
                  </div>
                </div>
              </div>

              {previewStoryModal.oneLineStory && (
                <div className="text-sm italic font-sans text-white border-l-2 border-red-500 pl-3 py-1">
                  "{previewStoryModal.oneLineStory}"
                </div>
              )}

              <p className="text-xs text-neutral-300 leading-relaxed font-sans whitespace-pre-line">
                {previewStoryModal.story}
              </p>

              <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px] font-mono text-neutral-400">
                <span>TORIWEAR ORIGINALS</span>
                <span>AUTHENTIC CHAPTER ARTIFACT</span>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={() => setPreviewStoryModal(null)}
                className="px-6 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-mono font-bold uppercase transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
