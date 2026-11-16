import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../AdminDataContext';
import {
  AIDepartment,
  AIDesignConcept,
  AIGenerationMode,
  AIMood,
  AIColorDirection,
  AIPlacement,
  AIDesignType,
} from '../../types/ai';
import {
  generateAIDesignConcept,
  generateVariations,
  checkOriginalityGuard,
  testGeminiConnection,
  generateArtworkForConcept,
} from '../../services/aiService';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Info,
  Maximize2,
  Sliders,
  Eye,
  Package,
  ChevronDown,
  ChevronUp,
  RotateCw,
  UserCheck,
  Code,
  Image as ImageIcon,
} from 'lucide-react';

interface AICreateDesignSectionProps {
  onOpenConcept: (concept: AIDesignConcept) => void;
}

const MEN_WORLDS = [
  'Dark Shonen',
  'Cyberpunk / Neo Tokyo',
  'Retro Y2K / Nostalgia',
  'Samurai / Mythic Japan',
  'Street Anime / Everyday',
];

const KIDS_WORLDS = [
  'Cute Adventure',
  'Robot & Future',
  'Retro Game',
  'Mini Samurai',
  'Fantasy Creatures',
];

const DESIGN_TYPES: AIDesignType[] = [
  'Full Streetwear Composition',
  'Character Portrait',
  'Action Scene',
  'Back Print',
  'Front Graphic',
  'Front + Back',
  'Minimal Chest Graphic',
  'Manga Panel',
  'Typography Graphic',
  'Symbol / Emblem',
  'Creature',
];

const PLACEMENTS: AIPlacement[] = [
  'Large Back',
  'Small Chest',
  'Front',
  'Front + Back',
  'Sleeve',
  'Oversized Center',
  'Full Garment Artwork',
];

const MOODS: AIMood[] = [
  'Dark',
  'Mysterious',
  'Energetic',
  'Emotional',
  'Nostalgic',
  'Futuristic',
  'Cute',
  'Playful',
  'Aggressive',
  'Calm',
  'Epic',
  'Street',
  'Dreamlike',
];

const COLOR_DIRECTIONS: AIColorDirection[] = [
  'Black / White',
  'Monochrome',
  'Blue / Black',
  'Red / Black',
  'Neon',
  'Pastel',
  'Earth Tone',
  'Purple / Black',
  'Custom',
];

const GENERATION_MODES: AIGenerationMode[] = [
  'STORY + DESIGN',
  'DESIGN ONLY',
  'CHARACTER + STORY',
  'FULL PRODUCT',
];

const VARIATION_OPTIONS = [
  'Change pose',
  'Change color palette',
  'Change background',
  'Change composition',
  'Change outfit',
  'Change expression',
  'Make darker',
  'Make more minimal',
  'Make more aggressive',
  'Make more futuristic',
  'Make more premium',
  'Make more streetwear',
];

export const AICreateDesignSection: React.FC<AICreateDesignSectionProps> = ({
  onOpenConcept,
}) => {
  const {
    aiConcepts,
    addAIConcept,
    updateAIConcept,
    aiCharacters,
    convertConceptToProductDraft,
    hasPermission,
    showToast,
  } = useAdmin();

  // Form State
  const [prompt, setPrompt] = useState('');
  const [department, setDepartment] = useState<AIDepartment>('MEN');
  const [world, setWorld] = useState<string>('Dark Shonen');
  const [isCustomWorld, setIsCustomWorld] = useState(false);
  const [customWorldInput, setCustomWorldInput] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('AUTO_CREATE');
  const [designType, setDesignType] = useState<string>('Full Streetwear Composition');
  const [placement, setPlacement] = useState<string>('Large Back');
  const [mood, setMood] = useState<string>('Mysterious');
  const [colorDirection, setColorDirection] = useState<string>('Blue / Black');
  const [generationMode, setGenerationMode] = useState<string>('STORY + DESIGN');
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [imageSize, setImageSize] = useState<string>('1K');

  // Generation execution state
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [lastGeneratedConcept, setLastGeneratedConcept] = useState<AIDesignConcept | null>(null);

  // Server AI Feature Flag & Health State
  const [aiHealth, setAiHealth] = useState<any>(null);
  const [isGeneratingArtwork, setIsGeneratingArtwork] = useState(false);

  useEffect(() => {
    testGeminiConnection().then(setAiHealth).catch(() => {});
  }, []);

  const isImageEnabled = aiHealth?.imageAI?.enabled ?? false;

  const generationSteps = isImageEnabled
    ? [
        'Step 1: Analyzing idea...',
        'Step 2: Creating original concept...',
        'Step 3: Building character & world lore...',
        'Step 4: Writing story narrative...',
        'Step 5: Synthesizing print specifications & tags...',
        'Step 6: Generating artwork with AI provider...',
        'Step 7: Finalizing concept & artwork...',
      ]
    : [
        'Step 1: Analyzing idea...',
        'Step 2: Creating original concept...',
        'Step 3: Building character & world lore...',
        'Step 4: Writing story narrative...',
        'Step 5: Formulating color palette & typography...',
        'Step 6: Synthesizing print specifications & tags...',
        'Step 7: Finalizing concept blueprint & prompt...',
      ];

  // Variation / Regenerate State
  const [isVariationOpen, setIsVariationOpen] = useState(false);
  const [selectedVariationDirective, setSelectedVariationDirective] = useState(VARIATION_OPTIONS[0]);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showPromptDetails, setShowPromptDetails] = useState(false);

  // Originality real-time feedback
  const originalityCheck = prompt.trim() ? checkOriginalityGuard(prompt) : null;

  // Selected character details for consistency lock
  const activeCharacter = aiCharacters.find((c) => c.id === selectedCharacterId);

  // Auto-switch default worlds when department changes
  useEffect(() => {
    if (department === 'MEN') {
      setWorld(MEN_WORLDS[0] || 'CYBERPUNK / NEO CITY');
      setDesignType('Full Streetwear Composition');
      setPlacement('Large Back');
      setMood('Mysterious');
      setColorDirection('Blue / Black');
    } else {
      setWorld(KIDS_WORLDS[0] || 'CUTE ADVENTURE');
      setDesignType('Front Graphic');
      setPlacement('Front');
      setMood('Cute');
      setColorDirection('Pastel');
    }
  }, [department]);

  const activeWorlds = department === 'MEN' ? MEN_WORLDS : KIDS_WORLDS;
  const filteredCharacters = aiCharacters.filter(
    (c) => (department === 'MEN' ? c.world !== 'CUTE ADVENTURE' : c.world === 'CUTE ADVENTURE' || c.world === 'FANTASY CREATURES')
  );

  const handleCreateDesign = async () => {
    if (!prompt.trim() || isGenerating) return;
    if (!hasPermission('ai.create')) {
      showToast('You do not have permission to create AI designs.');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setCurrentStepIndex(0);

    // Step progression animation
    const stepInterval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < generationSteps.length - 1) return prev + 1;
        return prev;
      });
    }, 1200);

    try {
      const finalWorld = isCustomWorld ? customWorldInput || 'Toriwear Universe' : world;
      const finalCharacterName = activeCharacter ? activeCharacter.name : undefined;

      const characterDetails = activeCharacter
        ? {
            hair: activeCharacter.hair,
            eyes: activeCharacter.eyes,
            outfit: activeCharacter.outfit,
            silhouette: activeCharacter.silhouette,
            weaponTool: activeCharacter.weaponTool,
            symbol: activeCharacter.symbol,
          }
        : undefined;

      const concept = await generateAIDesignConcept(
        {
          prompt,
          department,
          world: finalWorld,
          character: finalCharacterName,
          designType,
          placement,
          mood,
          colorDirection,
          generationMode,
          aspectRatio,
          imageSize,
          characterDetails,
        },
        aiConcepts.length
      );

      clearInterval(stepInterval);
      addAIConcept(concept);
      setLastGeneratedConcept(concept);
      if (concept.imageUrl) {
        showToast('Real AI design and artwork generated successfully!');
      } else {
        showToast('Design concept, lore narrative, and specs created and saved!');
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      setGenerationError(err?.message || 'Design concept generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateArtworkForConcept = async () => {
    if (!lastGeneratedConcept || isGeneratingArtwork) return;
    setIsGeneratingArtwork(true);
    try {
      const promptToUse =
        lastGeneratedConcept.imagePrompt ||
        `${lastGeneratedConcept.designName} apparel graphic, ${lastGeneratedConcept.world}, ${lastGeneratedConcept.mood} mood, ${lastGeneratedConcept.colorDirection}`;
      const result = await generateArtworkForConcept(promptToUse, aspectRatio, imageSize);
      const updated: AIDesignConcept = {
        ...lastGeneratedConcept,
        imageUrl: result.imageUrl,
        thumbnailUrl: result.imageUrl,
        artworkStatus: 'READY',
        artworkNotice: undefined,
        updatedAt: new Date().toISOString(),
      };
      updateAIConcept(updated);
      setLastGeneratedConcept(updated);
      showToast('Artwork generated successfully!');
    } catch (err: any) {
      showToast(err?.message || 'Artwork generation failed.');
    } finally {
      setIsGeneratingArtwork(false);
    }
  };

  const handleRegenerate = async () => {
    if (!lastGeneratedConcept || isRegenerating) return;
    setIsRegenerating(true);
    try {
      const regenerated = await generateAIDesignConcept(
        {
          prompt: lastGeneratedConcept.prompt,
          department: lastGeneratedConcept.department,
          world: lastGeneratedConcept.world,
          character: lastGeneratedConcept.character,
          designType: lastGeneratedConcept.designType,
          placement: lastGeneratedConcept.placement,
          mood: lastGeneratedConcept.mood,
          colorDirection: lastGeneratedConcept.colorDirection,
          generationMode: lastGeneratedConcept.generationMode,
          aspectRatio,
          imageSize,
        },
        aiConcepts.length
      );

      // Create as updated version
      const newVersion = (lastGeneratedConcept.version || 1) + 1;
      const updatedConcept: AIDesignConcept = {
        ...lastGeneratedConcept,
        id: `concept-${Date.now()}`,
        imageUrl: regenerated.imageUrl,
        thumbnailUrl: regenerated.thumbnailUrl,
        version: newVersion,
        versionHistory: [
          {
            versionNumber: newVersion,
            prompt: lastGeneratedConcept.prompt,
            designName: lastGeneratedConcept.designName,
            story: lastGeneratedConcept.story,
            imageUrl: regenerated.imageUrl,
            character: lastGeneratedConcept.character,
            world: lastGeneratedConcept.world,
            changesSummary: 'Regenerated using real Google Gemini image generation.',
            createdBy: 'Admin Session',
            createdAt: new Date().toISOString(),
          },
          ...(lastGeneratedConcept.versionHistory || []),
        ],
        updatedAt: new Date().toISOString(),
      };

      addAIConcept(updatedConcept);
      setLastGeneratedConcept(updatedConcept);
      showToast('New version generated with Gemini!');
    } catch (err: any) {
      showToast(err.message || 'Regeneration failed.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCreateVariation = async () => {
    if (!lastGeneratedConcept || isRegenerating) return;
    setIsRegenerating(true);
    try {
      const directive = selectedVariationDirective || VARIATION_OPTIONS[0] || 'Darker cyberpunk mood';
      const variation = await generateVariations(lastGeneratedConcept, directive);
      addAIConcept(variation);
      setLastGeneratedConcept(variation);
      setIsVariationOpen(false);
      showToast(`Variation "${directive}" created!`);
    } catch (err: any) {
      showToast(err.message || 'Failed to generate variation.');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-800/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Creative Director Studio • Real Gemini Engine</span>
          </div>
          <h1 className="text-3xl font-black text-white font-sans tracking-tight uppercase">
            CREATE YOUR NEXT WORLD.
          </h1>
          <p className="text-neutral-400 text-sm mt-1 max-w-2xl">
            Enter a creative prompt. The AI Creative Director transforms your vision into 100% original TORIWEAR lore, character identity, and apparel artwork powered by Google Gemini.
          </p>
        </div>

        {/* Department Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-[#161724] border border-neutral-800 shrink-0">
          <button
            type="button"
            onClick={() => setDepartment('MEN')}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase transition cursor-pointer ${
              department === 'MEN'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            MEN STREETWEAR
          </button>
          <button
            type="button"
            onClick={() => setDepartment('KIDS')}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase transition cursor-pointer ${
              department === 'KIDS'
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            KIDS STORYWEAR
          </button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Creative Input & Controls */}
        <div className="lg:col-span-7 space-y-6">
          {/* Prompt Field Card */}
          <div className="p-5 rounded-2xl bg-[#12131c] border border-neutral-800/80 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold uppercase text-white tracking-wider flex items-center gap-1.5">
                <span>What do you want to create?</span>
                <span className="text-red-400">*</span>
              </label>
              <span className="text-[11px] font-mono text-neutral-400">
                {prompt.length} chars
              </span>
            </div>

            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
              placeholder={
                department === 'MEN'
                  ? 'Create a mysterious teenage street warrior who protects a futuristic city at 2:17 AM. He uses an unusual energy ability and has a broken mechanical mask. The design should feel emotional, dark and premium.'
                  : 'A cheerful baby robot with glowing green antenna eyes helping little woodland animals build an acorn observatory under the stars.'
              }
              className="w-full p-4 rounded-xl bg-[#171825] border border-neutral-700/80 focus:border-red-500 focus:ring-1 focus:ring-red-500 text-white text-sm placeholder-neutral-500 outline-none transition resize-none font-sans"
            />

            {/* Quick Inspiration Fillers */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-mono uppercase text-neutral-400">Inspiration:</span>
              <button
                type="button"
                onClick={() =>
                  setPrompt(
                    department === 'MEN'
                      ? 'Create a solitary midnight runner on a rain-soaked Shibuya overpass at 02:17 AM. He wears a heavy cowl windbreaker and emits cyan pulse energy.'
                      : 'A fluffy two-tailed star fox sleeping peacefully on a smiling yellow crescent moon surrounded by pastel dream bubbles.'
                  )
                }
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1c1d2c] hover:bg-[#25273b] text-neutral-300 border border-neutral-700 transition cursor-pointer"
              >
                {department === 'MEN' ? 'Midnight Runner 02:17' : 'Star Fox & Moon'}
              </button>
              <button
                type="button"
                onClick={() =>
                  setPrompt(
                    department === 'MEN'
                      ? 'An exiled dark shonen martialist unleashing a fiery dragon avatar from his knuckles. Aggressive brushwork, high-contrast red and obsidian inks.'
                      : 'A friendly yellow construction robot with cute round wheels planting glowing crystal flowers on the moon.'
                  )
                }
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1c1d2c] hover:bg-[#25273b] text-neutral-300 border border-neutral-700 transition cursor-pointer"
              >
                {department === 'MEN' ? 'Infernal Dragon Martialist' : 'Moon Explorer Bot'}
              </button>
            </div>

            {/* Originality / IP Guard Real-Time Badge */}
            {originalityCheck && (
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
                  originalityCheck.status === 'SAFE FOR ORIGINAL CONCEPT'
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                }`}
              >
                {originalityCheck.status === 'SAFE FOR ORIGINAL CONCEPT' ? (
                  <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                )}
                <div className="space-y-1 text-xs">
                  <div className="font-mono font-bold uppercase tracking-wider flex items-center gap-2">
                    <span>ORIGINALITY CHECK:</span>
                    <span className="font-extrabold">{originalityCheck.status}</span>
                  </div>
                  <p className="text-neutral-300 text-[11px] leading-relaxed">
                    {originalityCheck.notes}
                  </p>
                  <p className="text-[10px] text-neutral-400 italic font-mono">
                    TORIWEAR Creative Guard automatically synthesizes 100% original characters, avoiding third-party franchise IP.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Structured Controls Section */}
          <div className="p-5 rounded-2xl bg-[#12131c] border border-neutral-800/80 shadow-xl space-y-5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-white border-b border-neutral-800 pb-2">
              <Sliders className="w-3.5 h-3.5 text-red-500" />
              <span>Creative Controls & Character Consistency</span>
            </div>

            {/* SECTION 22: CHARACTER CONSISTENCY SELECTOR */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono uppercase text-neutral-400 font-bold flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-red-400" />
                  <span>CHARACTER CONSISTENCY / ANCHOR</span>
                </label>
                {activeCharacter && (
                  <span className="text-[10px] font-mono text-emerald-400">
                    Identity Locked: {activeCharacter.name}
                  </span>
                )}
              </div>

              <select
                value={selectedCharacterId}
                onChange={(e) => setSelectedCharacterId(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-[#171825] border border-neutral-700 text-xs font-mono text-white outline-none focus:border-red-500 cursor-pointer"
              >
                <option value="AUTO_CREATE">⚡ AUTO-CREATE NEW ORIGINAL CHARACTER</option>
                {filteredCharacters.map((char) => (
                  <option key={char.id} value={char.id}>
                    USE EXISTING CHARACTER: {char.name} ({char.alias || char.role})
                  </option>
                ))}
              </select>

              {activeCharacter && (
                <div className="p-3 rounded-xl bg-[#181a29] border border-neutral-700/80 flex items-start gap-3">
                  <img
                    src={activeCharacter.avatarUrl}
                    alt={activeCharacter.name}
                    className="w-12 h-12 rounded-lg object-cover border border-neutral-600 shrink-0"
                  />
                  <div className="text-xs space-y-0.5">
                    <div className="font-bold text-white font-mono flex items-center gap-2">
                      <span>{activeCharacter.name}</span>
                      <span className="text-[10px] text-red-400 font-normal">{activeCharacter.symbol}</span>
                    </div>
                    <p className="text-[11px] text-neutral-300 line-clamp-1">
                      <strong>Outfit:</strong> {activeCharacter.outfit}
                    </p>
                    <p className="text-[10px] text-neutral-400 font-mono">
                      Hair: {activeCharacter.hair} • Silhouette: {activeCharacter.silhouette}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* World Selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase text-neutral-400 font-bold">
                  WORLD UNIVERSE
                </label>
                <div className="space-y-2">
                  <select
                    value={isCustomWorld ? '__CUSTOM__' : world}
                    onChange={(e) => {
                      if (e.target.value === '__CUSTOM__') {
                        setIsCustomWorld(true);
                      } else {
                        setIsCustomWorld(false);
                        setWorld(e.target.value);
                      }
                    }}
                    className="w-full p-2.5 rounded-lg bg-[#171825] border border-neutral-700 text-xs font-mono text-white outline-none focus:border-red-500 cursor-pointer"
                  >
                    {activeWorlds.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                    <option value="__CUSTOM__">⚡ CUSTOM WORLD...</option>
                  </select>

                  {isCustomWorld && (
                    <input
                      type="text"
                      placeholder="Enter custom world name..."
                      value={customWorldInput}
                      onChange={(e) => setCustomWorldInput(e.target.value)}
                      className="w-full p-2.5 rounded-lg bg-[#171825] border border-red-500/50 text-xs font-mono text-white outline-none focus:border-red-500 placeholder-neutral-500"
                    />
                  )}
                </div>
              </div>

              {/* Design Type */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase text-neutral-400 font-bold">
                  DESIGN TYPE
                </label>
                <select
                  value={designType}
                  onChange={(e) => setDesignType(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-[#171825] border border-neutral-700 text-xs font-mono text-white outline-none focus:border-red-500 cursor-pointer"
                >
                  {DESIGN_TYPES.map((dt) => (
                    <option key={dt} value={dt}>
                      {dt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Garment Placement */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase text-neutral-400 font-bold">
                  PRINT PLACEMENT
                </label>
                <select
                  value={placement}
                  onChange={(e) => setPlacement(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-[#171825] border border-neutral-700 text-xs font-mono text-white outline-none focus:border-red-500 cursor-pointer"
                >
                  {PLACEMENTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mood */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase text-neutral-400 font-bold">
                  AESTHETIC MOOD
                </label>
                <select
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-[#171825] border border-neutral-700 text-xs font-mono text-white outline-none focus:border-red-500 cursor-pointer"
                >
                  {MOODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Color Direction */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase text-neutral-400 font-bold">
                  COLOR DIRECTION
                </label>
                <select
                  value={colorDirection}
                  onChange={(e) => setColorDirection(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-[#171825] border border-neutral-700 text-xs font-mono text-white outline-none focus:border-red-500 cursor-pointer"
                >
                  {COLOR_DIRECTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Generation Mode */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase text-neutral-400 font-bold">
                  GENERATION MODE
                </label>
                <select
                  value={generationMode}
                  onChange={(e) => setGenerationMode(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-[#171825] border border-neutral-700 text-xs font-mono text-white outline-none focus:border-red-500 cursor-pointer"
                >
                  {GENERATION_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Aspect Ratio and Image Size Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-neutral-800/80">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase text-neutral-400 font-bold">
                  ASPECT RATIO
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['1:1', '3:4', '4:5', '16:9'].map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setAspectRatio(ratio)}
                      className={`py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                        aspectRatio === ratio
                          ? 'bg-red-600/30 border-red-500 text-white'
                          : 'bg-[#171825] border-neutral-700 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase text-neutral-400 font-bold">
                  IMAGE RESOLUTION
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['1K', '2K', '4K'].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setImageSize(size)}
                      className={`py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                        imageSize === size
                          ? 'bg-red-600/30 border-red-500 text-white'
                          : 'bg-[#171825] border-neutral-700 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Disabled State Notice (Requirement 4) */}
            {!isImageEnabled && (
              <div className="p-4 rounded-xl bg-[#141522] border border-neutral-700/60 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold uppercase text-white flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-neutral-400" />
                    AI Artwork Generation
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-800 text-neutral-300 border border-neutral-700">
                    Optional Mode
                  </span>
                </div>
                <p className="text-neutral-300 leading-relaxed font-sans">
                  Image generation is currently unavailable.
                  <br />
                  Your concepts, stories and designs can still be created and saved. Connect an image AI provider when you're ready to generate artwork.
                </p>
                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    disabled
                    className="px-3.5 py-1.5 rounded-lg bg-neutral-800/80 border border-neutral-700 text-neutral-400 text-xs font-mono font-semibold cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Image Generation — Coming Soon</span>
                  </button>
                </div>
              </div>
            )}

            {/* Error Message Display */}
            {generationError && (
              <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/40 text-red-300 text-xs space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>AI Design Lab Notice</span>
                </div>
                <p className="leading-relaxed">{generationError}</p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCreateDesign}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-mono font-bold uppercase transition hover:bg-red-500 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>RETRY GENERATION</span>
                  </button>
                </div>
              </div>
            )}

            {/* Primary Action Button - Protected against duplicate submission */}
            <button
              type="button"
              onClick={handleCreateDesign}
              disabled={isGenerating || !prompt.trim()}
              className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold font-mono uppercase tracking-wider transition-all shadow-xl cursor-pointer ${
                isGenerating || !prompt.trim()
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                  : 'bg-gradient-to-r from-red-600 via-red-500 to-red-600 hover:from-red-500 hover:to-red-600 text-white shadow-red-600/30 transform hover:-translate-y-0.5 active:translate-y-0'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>{generationSteps[currentStepIndex]}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{isImageEnabled ? 'CREATE DESIGN & ARTWORK' : 'CREATE DESIGN CONCEPT (AI LORE & SPECS)'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Live Output & Pipeline Monitor */}
        <div className="lg:col-span-5 space-y-6">
          {/* SECTION 18: EXACT 7-STEP PROGRESSION */}
          {isGenerating && (
            <div className="p-6 rounded-2xl bg-[#12131c] border border-red-500/40 shadow-2xl space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span className="text-xs font-mono font-bold uppercase text-white">
                    AI PIPELINE IN PROGRESS
                  </span>
                </div>
                <span className="text-xs font-mono text-red-400">
                  Step {currentStepIndex + 1} of {generationSteps.length}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-500"
                  style={{
                    width: `${((currentStepIndex + 1) / generationSteps.length) * 100}%`,
                  }}
                />
              </div>

              {/* Exact 7-Step List */}
              <div className="space-y-2.5 pt-1">
                {generationSteps.map((stepText, idx) => {
                  const isDone = idx < currentStepIndex;
                  const isCurrent = idx === currentStepIndex;
                  return (
                    <div
                      key={stepText}
                      className={`flex items-center gap-3 text-xs font-mono transition-colors ${
                        isCurrent
                          ? 'text-white font-bold bg-[#181a29] p-2 rounded-lg border border-red-500/30'
                          : isDone
                          ? 'text-emerald-400 opacity-80'
                          : 'text-neutral-600'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : isCurrent ? (
                        <RefreshCw className="w-4 h-4 text-red-400 animate-spin shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-neutral-700 shrink-0" />
                      )}
                      <span>{stepText}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 18 & 21: GENERATED DESIGN DISPLAY & ACTIONS */}
          {lastGeneratedConcept ? (
            <div className="p-5 rounded-2xl bg-[#12131c] border border-neutral-800/80 shadow-2xl space-y-4 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-mono font-bold text-white uppercase">
                    ## GENERATED DESIGN CONCEPT
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {lastGeneratedConcept.originalityStatus}
                </span>
              </div>

              {/* Artwork Box or Concept Blueprint Box */}
              {lastGeneratedConcept.imageUrl ? (
                <div className="relative group rounded-xl overflow-hidden bg-black aspect-square border border-neutral-800 shadow-xl">
                  <img
                    src={lastGeneratedConcept.imageUrl}
                    alt={lastGeneratedConcept.designName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/80 backdrop-blur-md text-[10px] font-mono font-bold text-white border border-neutral-700">
                    {lastGeneratedConcept.designNumber} (v{lastGeneratedConcept.version})
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenConcept(lastGeneratedConcept)}
                    className="absolute bottom-3 right-3 p-2 rounded-lg bg-black/80 hover:bg-black text-white text-xs font-mono flex items-center gap-1 border border-neutral-700 transition cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Inspect</span>
                  </button>
                </div>
              ) : (
                <div className="relative group rounded-xl overflow-hidden bg-gradient-to-br from-[#0c0d14] via-[#121320] to-[#0c0d14] aspect-square border border-neutral-800/90 shadow-xl flex flex-col justify-between p-5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded bg-black/80 text-[10px] font-mono font-bold text-red-400 border border-neutral-800">
                      {lastGeneratedConcept.designNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      Artwork Pending
                    </span>
                  </div>

                  <div className="text-center space-y-2 py-4">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-700/80 mx-auto flex items-center justify-center text-red-500 shadow-inner">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                        Concept Blueprint Ready
                      </div>
                      <div className="text-[11px] text-neutral-400 font-sans mt-0.5 max-w-xs mx-auto">
                        Lore narrative, character specs, color swatches, and prompt are locked.
                      </div>
                    </div>

                    {isImageEnabled ? (
                      <button
                        type="button"
                        onClick={handleGenerateArtworkForConcept}
                        disabled={isGeneratingArtwork}
                        className="mt-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold uppercase transition flex items-center gap-1.5 mx-auto cursor-pointer shadow-lg shadow-red-600/30"
                      >
                        {isGeneratingArtwork ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ImageIcon className="w-3.5 h-3.5" />
                        )}
                        <span>{isGeneratingArtwork ? 'Generating Artwork...' : 'Generate Artwork'}</span>
                      </button>
                    ) : (
                      <div className="pt-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-400 bg-neutral-900/90 border border-neutral-800 px-3 py-1 rounded-lg">
                          <Info className="w-3 h-3 text-neutral-400" />
                          Image Generation — Coming Soon
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 border-t border-neutral-800/80 pt-2.5">
                    <span>Placement: {lastGeneratedConcept.placement}</span>
                    <button
                      type="button"
                      onClick={() => onOpenConcept(lastGeneratedConcept)}
                      className="text-neutral-300 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Inspect</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Friendly Artwork Notice if Generation is Unavailable */}
              {lastGeneratedConcept.artworkNotice && (
                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 text-neutral-300 text-xs font-sans flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{lastGeneratedConcept.artworkNotice}</span>
                </div>
              )}

              {/* Required Fields: Design Name, Character, World, Mood, Placement */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-neutral-400">
                  <span className="text-red-400 font-bold">{lastGeneratedConcept.character}</span>
                  <span>•</span>
                  <span>{lastGeneratedConcept.world}</span>
                  <span>•</span>
                  <span>{lastGeneratedConcept.mood}</span>
                  <span>•</span>
                  <span className="text-neutral-200">{lastGeneratedConcept.placement}</span>
                </div>
                <h3 className="text-base font-bold text-white font-sans">
                  {lastGeneratedConcept.designName}
                </h3>
              </div>

              {/* Story & Lore */}
              <div className="space-y-1.5 p-3 rounded-xl bg-[#161726] border border-neutral-800 text-xs">
                <div className="text-[10px] font-mono uppercase text-neutral-400 font-bold">
                  Story Narrative
                </div>
                <p className="text-neutral-200 leading-relaxed font-sans">
                  {lastGeneratedConcept.story}
                </p>
                {lastGeneratedConcept.designLore && (
                  <p className="text-neutral-400 text-[11px] pt-1 border-t border-neutral-800/80 font-sans italic">
                    {lastGeneratedConcept.designLore}
                  </p>
                )}
              </div>

              {/* Color Palette */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] font-mono uppercase text-neutral-400 font-bold">Palette:</span>
                <div className="flex items-center gap-1.5">
                  {lastGeneratedConcept.palette.map((color, idx) => (
                    <div
                      key={idx}
                      className="w-4 h-4 rounded-full border border-neutral-700 shadow"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-mono text-neutral-500 ml-auto">
                  {lastGeneratedConcept.colorDirection}
                </span>
              </div>

              {/* Image Generation Prompt Viewer */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowPromptDetails(!showPromptDetails)}
                  className="flex items-center justify-between w-full text-[11px] font-mono text-neutral-400 hover:text-white cursor-pointer py-1"
                >
                  <span className="flex items-center gap-1">
                    <Code className="w-3 h-3 text-red-400" />
                    <span>Gemini Image Generation Prompt</span>
                  </span>
                  {showPromptDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showPromptDetails && (
                  <pre className="p-3 mt-1 rounded-lg bg-black text-[10px] font-mono text-neutral-300 whitespace-pre-wrap border border-neutral-800 leading-relaxed max-h-40 overflow-y-auto">
                    {lastGeneratedConcept.imagePrompt}
                  </pre>
                )}
              </div>

              {/* SECTION 21: RETRY & VARIATION BUTTONS */}
              <div className="space-y-2 pt-2 border-t border-neutral-800">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="py-2.5 px-3 rounded-xl bg-[#1c1d2c] hover:bg-[#25273b] border border-neutral-700 text-neutral-200 text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : 'text-red-400'}`} />
                    <span>{isRegenerating ? 'REGENERATING...' : 'REGENERATE'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsVariationOpen(!isVariationOpen)}
                    disabled={isRegenerating}
                    className="py-2.5 px-3 rounded-xl bg-[#1c1d2c] hover:bg-[#25273b] border border-neutral-700 text-neutral-200 text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>GENERATE VARIATION</span>
                  </button>
                </div>

                {/* Variation Directives Drawer */}
                {isVariationOpen && (
                  <div className="p-3.5 rounded-xl bg-[#151726] border border-neutral-800 space-y-3 animate-in fade-in duration-200">
                    <span className="text-[10px] font-mono uppercase text-neutral-400 font-bold block">
                      Select Controlled Variation:
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                      {VARIATION_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSelectedVariationDirective(opt)}
                          className={`p-2 rounded text-left text-[11px] font-mono transition cursor-pointer border ${
                            selectedVariationDirective === opt
                              ? 'bg-red-600/20 border-red-500 text-white font-bold'
                              : 'bg-[#181926] border-neutral-800 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateVariation}
                      disabled={isRegenerating}
                      className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>APPLY VARIATION: {(selectedVariationDirective || VARIATION_OPTIONS[0] || '').toUpperCase()}</span>
                    </button>
                  </div>
                )}

                {/* Secondary Workflow Actions */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onOpenConcept(lastGeneratedConcept)}
                    className="py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-red-600/25"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>WORKSPACE & PRINT</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => convertConceptToProductDraft(lastGeneratedConcept)}
                    className="py-2.5 px-3 rounded-xl bg-[#1a1c2d] hover:bg-[#22253c] border border-neutral-700 text-neutral-200 text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Package className="w-3.5 h-3.5 text-emerald-400" />
                    <span>CREATE PRODUCT DRAFT</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Standby Guide Card */
            <div className="p-6 rounded-2xl bg-[#12131c] border border-neutral-800/80 text-neutral-400 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-white border-b border-neutral-800 pb-2">
                <Info className="w-3.5 h-3.5 text-neutral-400" />
                <span>TORIWEAR CREATIVE PRINCIPLES</span>
              </div>
              <ul className="text-xs space-y-2.5 leading-relaxed text-neutral-300">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span><strong>Real Google Gemini Image Generation:</strong> Uses server-side `@google/genai` with `gemini-3.1-flash-image`. Never generates fake artwork.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span><strong>100% Original Intellectual Property:</strong> Enforces Originality Guard to transform franchise inspirations into proprietary TORIWEAR characters.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span><strong>Apparel-First Composition:</strong> Generates isolated streetwear graphics optimized for high-density screen printing.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span><strong>Dual-Department Discipline:</strong> Dedicated creative universes tailored for Men's Streetwear and Kids' Storywear collections.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span><strong>Publishing Safety Workflow:</strong> Generated products start as DRAFT and require admin approval before live release.</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
