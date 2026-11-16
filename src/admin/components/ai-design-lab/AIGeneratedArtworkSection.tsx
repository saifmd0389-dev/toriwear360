import React, { useState } from 'react';
import { useAdmin } from '../../AdminDataContext';
import { AIDesignConcept } from '../../types/ai';
import {
  Download,
  X,
  Palette,
  Sparkles,
} from 'lucide-react';

interface AIGeneratedArtworkSectionProps {
  onOpenConcept: (concept: AIDesignConcept) => void;
}

export const AIGeneratedArtworkSection: React.FC<AIGeneratedArtworkSectionProps> = ({
  onOpenConcept,
}) => {
  const { aiConcepts, showToast } = useAdmin();
  const [lightboxConcept, setLightboxConcept] = useState<AIDesignConcept | null>(null);

  const handleDownload = (concept: AIDesignConcept) => {
    if (!concept.imageUrl) {
      showToast('Artwork has not been generated for this concept yet.');
      return;
    }
    const link = document.createElement('a');
    link.href = concept.imageUrl;
    link.download = `${concept.designNumber}-${concept.designName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    link.target = '_blank';
    link.click();
    showToast('Artwork download started.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <h2 className="text-xl font-black text-white font-sans uppercase tracking-tight flex items-center gap-2">
            <Palette className="w-5 h-5 text-purple-400" />
            <span>GENERATED ARTWORK & APPAREL GRAPHICS</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Isolated high-resolution apparel graphics suitable for screen printing, direct-to-film, and high-density ink strike-offs.
          </p>
        </div>
      </div>

      {/* Visual Art Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {aiConcepts.map((concept) => (
          <div
            key={concept.id}
            className="group relative rounded-xl overflow-hidden bg-black aspect-square border border-neutral-800 shadow-lg cursor-pointer"
          >
            {concept.imageUrl ? (
              <img
                src={concept.imageUrl}
                alt={concept.designName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onClick={() => setLightboxConcept(concept)}
              />
            ) : (
              <div
                className="w-full h-full bg-gradient-to-br from-[#11121e] via-[#161726] to-[#0d0e17] flex flex-col items-center justify-center p-4 text-center"
                onClick={() => onOpenConcept(concept)}
              >
                <Sparkles className="w-8 h-8 text-neutral-500 mb-2" />
                <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">
                  Blueprint Ready
                </span>
                <span className="text-[9px] font-mono text-neutral-400 mt-0.5">
                  Artwork Pending
                </span>
              </div>
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white border border-neutral-700 font-bold">
                  {concept.designNumber}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(concept);
                  }}
                  className="p-1.5 rounded-lg bg-black/80 hover:bg-black text-white text-xs border border-neutral-700 transition cursor-pointer"
                  title="Download Artwork"
                >
                  <Download className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-mono text-red-400 font-bold truncate">
                  {concept.character} • {concept.placement}
                </div>
                <div className="text-xs font-bold text-white truncate">
                  {concept.designName}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenConcept(concept);
                  }}
                  className="w-full mt-1 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-mono font-bold uppercase transition"
                >
                  Inspect Concept
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {lightboxConcept && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full flex flex-col items-center">
            <button
              onClick={() => setLightboxConcept(null)}
              className="absolute -top-12 right-0 p-2 text-neutral-400 hover:text-white text-sm font-mono cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="relative max-h-[75vh] rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl bg-black">
              <img
                src={lightboxConcept.imageUrl}
                alt={lightboxConcept.designName}
                referrerPolicy="no-referrer"
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>

            <div className="w-full mt-4 flex items-center justify-between text-xs font-mono text-neutral-300 px-2">
              <div>
                <span className="text-white font-bold">{lightboxConcept.designName}</span> —{' '}
                <span>{lightboxConcept.character}</span> ({lightboxConcept.world})
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleDownload(lightboxConcept)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Artwork</span>
                </button>
                <button
                  onClick={() => {
                    onOpenConcept(lightboxConcept);
                    setLightboxConcept(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer"
                >
                  Open in Workspace
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
