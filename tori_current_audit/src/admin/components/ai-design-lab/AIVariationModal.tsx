import React, { useState } from 'react';
import { useAdmin } from '../../AdminDataContext';
import { AIDesignConcept } from '../../types/ai';
import { generateVariations } from '../../services/aiService';
import { X, Sparkles, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

interface AIVariationModalProps {
  concept: AIDesignConcept | null;
  isOpen: boolean;
  onClose: () => void;
  onVariationCreated: (newConcept: AIDesignConcept) => void;
}

const VARIATION_OPTIONS = [
  { id: 'Different pose', label: 'Different Pose', desc: 'Preserves outfit and face; adjusts kinetic body stance.' },
  { id: 'Different expression', label: 'Different Expression', desc: 'Subtle shift from stoic to intense or calm.' },
  { id: 'Different color palette', label: 'Alternative Colorway', desc: 'Generates secondary or inverse color scheme.' },
  { id: 'Different composition', label: 'Alternative Composition', desc: 'Reframes character placement and backdrop framing.' },
  { id: 'Minimal version', label: 'Minimalist Line Edition', desc: 'Reduces detail for high-contrast monochrome prints.' },
  { id: 'Aggressive version', label: 'Aggressive / High-Impact', desc: 'Intensifies shadows, flares, and brushstroke energy.' },
  { id: 'Premium version', label: 'Premium Gold / Silver Edition', desc: 'Adds metallic foil or high-density accents.' },
  { id: 'Back-print version', label: 'Back Print Composition', desc: 'Expands artwork to fill 14"x18" oversize back area.' },
  { id: 'Chest-logo version', label: 'Small Chest Emblem', desc: 'Distills character into a clean 3.5" crest.' },
  { id: 'Kids-friendly version', label: 'Kids-Friendly Adaptation', desc: 'Softens expressions with gentle rounded forms and playful palette.' },
  { id: 'Dark version', label: 'Obsidian Nocturne Edition', desc: 'Deep black-on-black tones with subtle stippling.' },
  { id: 'Light version', label: 'High-Key Light Edition', desc: 'Clean white/cream base with crisp line definition.' },
];

export const AIVariationModal: React.FC<AIVariationModalProps> = ({
  concept,
  isOpen,
  onClose,
  onVariationCreated,
}) => {
  const { addAIConcept, showToast } = useAdmin();
  const [selectedVariation, setSelectedVariation] = useState('Different color palette');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !concept) return null;

  const handleGenerate = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const variation = await generateVariations(concept, selectedVariation);
      addAIConcept(variation);
      onVariationCreated(variation);
      showToast(`Variation "${selectedVariation}" created.`);
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to create variation with Gemini. Please try again.';
      setErrorMessage(msg);
      showToast(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#11121c] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-[#161724]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-mono uppercase">
                CREATE DESIGN VARIATION
              </h3>
              <p className="text-[11px] text-neutral-400 font-mono">
                Preserves character identity ({concept.character}) while varying visual parameters.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-500/40 text-red-300 text-xs font-mono flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block uppercase">Gemini Variation Notice</span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          <div className="text-xs font-mono uppercase text-neutral-400 font-bold">
            Select Variation Mode:
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {VARIATION_OPTIONS.map((opt) => (
              <div
                key={opt.id}
                onClick={() => setSelectedVariation(opt.id)}
                className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                  selectedVariation === opt.id
                    ? 'bg-red-950/20 border-red-500 text-white shadow-md shadow-red-950/20'
                    : 'bg-[#171826] border-neutral-800 text-neutral-300 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold font-mono">{opt.label}</span>
                  {selectedVariation === opt.id && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  )}
                </div>
                <p className="text-[10px] text-neutral-400 leading-tight">
                  {opt.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-[#141522] flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-mono transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isProcessing}
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold uppercase transition flex items-center gap-2 cursor-pointer shadow-lg shadow-red-600/25"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>GENERATING VARIATION...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>GENERATE VARIATION</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
