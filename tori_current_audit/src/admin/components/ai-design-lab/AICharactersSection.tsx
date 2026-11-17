import React, { useState } from 'react';
import { useAdmin } from '../../AdminDataContext';
import { AICharacter } from '../../types/ai';
import {
  Users,
  Plus,
  Sparkles,
  Edit2,
  Search,
  ArrowRight,
  X,
} from 'lucide-react';

interface AICharactersSectionProps {
  onUseCharacterInDesign: (characterName: string, world: string) => void;
}

export const AICharactersSection: React.FC<AICharactersSectionProps> = ({
  onUseCharacterInDesign,
}) => {
  const { aiCharacters, addAICharacter, updateAICharacter, showToast } = useAdmin();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorldFilter, setSelectedWorldFilter] = useState('ALL');
  const [selectedCharacter, setSelectedCharacter] = useState<AICharacter | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Form State for Editing/Creating
  const [charName, setCharName] = useState('');
  const [alias, setAlias] = useState('');
  const [role, setRole] = useState('');
  const [world, setWorld] = useState('DARK SHONEN');
  const [ageRange, setAgeRange] = useState('18-22');
  const [genderPresentation, setGenderPresentation] = useState('Ambiguous');
  const [ability, setAbility] = useState('');
  const [weaponTool, setWeaponTool] = useState('');
  const [symbol, setSymbol] = useState('');
  const [quote, setQuote] = useState('');
  const [backstory, setBackstory] = useState('');
  const [outfit, setOutfit] = useState('');
  const [status, setStatus] = useState<AICharacter['status']>('APPROVED');

  const filtered = aiCharacters.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.alias.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWorld = selectedWorldFilter === 'ALL' || c.world === selectedWorldFilter;
    return matchesSearch && matchesWorld;
  });

  const handleOpenCreate = () => {
    setSelectedCharacter(null);
    setCharName('');
    setAlias('');
    setRole('Urban Shadow Runner');
    setWorld('DARK SHONEN');
    setAgeRange('19-21');
    setGenderPresentation('Ambiguous');
    setAbility('Velocity Distortion');
    setWeaponTool('Titanium baton');
    setSymbol('⚡ Apex Sigil');
    setQuote('We wear our stories.');
    setBackstory('Born in the underground districts of the metropolis...');
    setOutfit('Oversized tactical windbreaker and modular cargo pants.');
    setStatus('APPROVED');
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (char: AICharacter) => {
    setSelectedCharacter(char);
    setCharName(char.name);
    setAlias(char.alias);
    setRole(char.role);
    setWorld(char.world);
    setAgeRange(char.ageRange);
    setGenderPresentation(char.genderPresentation);
    setAbility(char.ability);
    setWeaponTool(char.weaponTool);
    setSymbol(char.symbol);
    setQuote(char.quote);
    setBackstory(char.backstory);
    setOutfit(char.outfit);
    setStatus(char.status);
    setIsEditorOpen(true);
  };

  const handleSave = () => {
    if (!charName.trim()) {
      showToast('Please provide a character name.');
      return;
    }

    if (selectedCharacter) {
      const updated: AICharacter = {
        ...selectedCharacter,
        name: charName,
        alias,
        role,
        world,
        ageRange,
        genderPresentation,
        ability,
        weaponTool,
        symbol,
        quote,
        backstory,
        outfit,
        status,
        updatedAt: new Date().toISOString(),
      };
      updateAICharacter(updated);
      showToast(`Character ${charName} updated.`);
    } else {
      const newChar: AICharacter = {
        id: `char-${Date.now()}`,
        name: charName.toUpperCase(),
        alias: alias.toUpperCase() || 'STREET RUNNER',
        role,
        world,
        ageRange,
        genderPresentation,
        ability,
        weaponTool,
        symbol,
        quote,
        backstory,
        outfit,
        status,
        personality: ['Determined', 'Silent', 'Independent'],
        strength: 'Adaptive street reflexes',
        weakness: 'Solitary tendency',
        colorPalette: ['#111115', '#FF2028', '#ffffff'],
        hair: 'Dark styled anime hair',
        eyes: 'Intense amber',
        bodyType: 'Athletic streetwear frame',
        silhouette: 'Drop shoulder silhouette',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addAICharacter(newChar);
      showToast(`Character ${charName} added to TORIWEAR Universe.`);
    }
    setIsEditorOpen(false);
  };

  const handleGenerateAICharacter = () => {
    // Quick AI generator trigger for new original character
    const names = ['KAGE', 'HIKARI', 'RYU', 'SHIN', 'SORA', 'NEXUS'];
    const selectedName = names[Math.floor(Math.random() * names.length)] || 'KAGE';
    const newChar: AICharacter = {
      id: `char-${Date.now()}`,
      name: selectedName,
      alias: 'STREET APEX',
      ageRange: '20-23',
      genderPresentation: 'Ambiguous',
      role: 'High-Altitude Rooftop Courier',
      world: 'CYBERPUNK / NEO CITY',
      personality: ['Resolute', 'Intuitive', 'Fast'],
      strength: 'Electro-magnetic friction boots allowing wall-runs',
      weakness: 'Vulnerable in heavy electromagnetic storms',
      ability: 'Pulse Sprint — instantaneous 10-meter burst',
      weaponTool: 'Thermal grapple wire',
      symbol: '⚡ Dual Kanji Seal',
      colorPalette: ['#0f172a', '#06b6d4', '#ffffff'],
      outfit: 'Asymmetric weather-proof shell with reflective Tokyo transit coordinates',
      hair: 'Silver-tipped crop',
      eyes: 'Cyan glow HUD',
      bodyType: 'Lean courier physique',
      silhouette: 'Broad technical shoulder taper',
      backstory: 'Patrols the upper sky-bridges of Neo City delivering analog consciousness drives.',
      quote: 'The sky belongs to those who dare leap first.',
      status: 'APPROVED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addAICharacter(newChar);
    showToast(`AI generated original character: ${selectedName}.`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <h2 className="text-xl font-black text-white font-sans uppercase tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-red-500" />
            <span>TORIWEAR CHARACTER REGISTRY</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Proprietary anime characters designed exclusively for TORIWEAR. Used across collections to maintain narrative and visual consistency.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateAICharacter}
            className="px-3.5 py-2 rounded-xl bg-[#1c1d2c] hover:bg-[#25273b] border border-neutral-700 text-xs font-mono text-neutral-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-red-400" />
            <span>Generate Character</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold uppercase transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-600/25"
          >
            <Plus className="w-4 h-4" />
            <span>NEW CHARACTER</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
          <input
            type="text"
            placeholder="Search characters by name, alias, role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#141622] border border-neutral-800 text-xs text-white outline-none focus:border-red-500 placeholder-neutral-500"
          />
        </div>

        <select
          value={selectedWorldFilter}
          onChange={(e) => setSelectedWorldFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[#141622] border border-neutral-800 text-xs font-mono text-white outline-none focus:border-red-500 cursor-pointer"
        >
          <option value="ALL">All Worlds</option>
          <option value="DARK SHONEN">Dark Shonen</option>
          <option value="CYBERPUNK / NEO CITY">Cyberpunk / Neo City</option>
          <option value="RETRO Y2K">Retro Y2K</option>
          <option value="SAMURAI / MYTHIC">Samurai / Mythic</option>
          <option value="STREET ANIME">Street Anime</option>
          <option value="CUTE ADVENTURE">Cute Adventure (Kids)</option>
          <option value="FANTASY CREATURES">Fantasy Creatures (Kids)</option>
        </select>
      </div>

      {/* Character Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((char) => (
          <div
            key={char.id}
            className="group rounded-2xl bg-[#12131c] border border-neutral-800/80 hover:border-neutral-700 p-5 space-y-4 shadow-xl transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-mono text-red-400 uppercase tracking-wider">
                    {char.alias || 'ORIGINAL PROTAGONIST'}
                  </div>
                  <h3 className="text-xl font-black text-white font-sans uppercase tracking-tight">
                    {char.name}
                  </h3>
                  <div className="text-xs text-neutral-400 font-mono mt-0.5">
                    {char.role}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {char.status}
                </span>
              </div>

              {/* World & Symbol */}
              <div className="flex items-center justify-between text-xs font-mono p-2.5 rounded-lg bg-[#181926] border border-neutral-800/80">
                <span className="text-neutral-400">{char.world}</span>
                <span className="text-white font-bold">{char.symbol}</span>
              </div>

              {/* Quote */}
              {char.quote && (
                <div className="text-xs italic text-neutral-300 font-sans border-l-2 border-red-500 pl-2.5 py-0.5">
                  "{char.quote}"
                </div>
              )}

              {/* Ability & Backstory snippet */}
              <div className="space-y-1 text-xs">
                <div className="text-neutral-400 font-mono text-[11px]">
                  <strong>Ability:</strong> {char.ability}
                </div>
                <p className="text-neutral-300 line-clamp-2 text-xs leading-relaxed">
                  {char.backstory}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between">
              <button
                type="button"
                onClick={() => onUseCharacterInDesign(char.name, char.world)}
                className="text-xs font-mono font-bold text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
              >
                <span>Use In Design</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleOpenEdit(char)}
                className="p-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer"
                title="Edit Character"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Character Editor Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-[#11121c] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-[#161724]">
              <h3 className="text-sm font-bold text-white font-mono uppercase">
                {selectedCharacter ? `EDIT CHARACTER: ${selectedCharacter.name}` : 'CREATE NEW CHARACTER'}
              </h3>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-1 rounded bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase text-neutral-400">Character Name *</label>
                  <input
                    type="text"
                    value={charName}
                    onChange={(e) => setCharName(e.target.value)}
                    placeholder="e.g. REN"
                    className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase text-neutral-400">Alias / Moniker</label>
                  <input
                    type="text"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="e.g. VOID WALKER"
                    className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase text-neutral-400">World Universe</label>
                  <select
                    value={world}
                    onChange={(e) => setWorld(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500 cursor-pointer"
                  >
                    <option value="DARK SHONEN">Dark Shonen</option>
                    <option value="CYBERPUNK / NEO CITY">Cyberpunk / Neo City</option>
                    <option value="RETRO Y2K">Retro Y2K</option>
                    <option value="SAMURAI / MYTHIC">Samurai / Mythic</option>
                    <option value="STREET ANIME">Street Anime</option>
                    <option value="CUTE ADVENTURE">Cute Adventure (Kids)</option>
                    <option value="FANTASY CREATURES">Fantasy Creatures (Kids)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase text-neutral-400">Role</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Exiled Shadow Warrior"
                    className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase text-neutral-400">Ability / Power</label>
                  <input
                    type="text"
                    value={ability}
                    onChange={(e) => setAbility(e.target.value)}
                    placeholder="e.g. Velocity Shift"
                    className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase text-neutral-400">Signature Symbol</label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    placeholder="e.g. ⚡ Flying Phoenix Sigil"
                    className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase text-neutral-400">Character Quote</label>
                <input
                  type="text"
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  placeholder="e.g. We don’t follow stories — we wear them."
                  className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase text-neutral-400">Backstory Lore</label>
                <textarea
                  rows={3}
                  value={backstory}
                  onChange={(e) => setBackstory(e.target.value)}
                  placeholder="Describe origins, motivations, and journey in the TORIWEAR universe..."
                  className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase text-neutral-400">Streetwear Outfit & Aesthetic</label>
                <input
                  type="text"
                  value={outfit}
                  onChange={(e) => setOutfit(e.target.value)}
                  placeholder="e.g. Oversized storm jacket with modular magnetic pouches"
                  className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-neutral-800 bg-[#141522] flex items-center justify-end gap-2.5">
              <button
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-mono cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold uppercase transition cursor-pointer"
              >
                Save Character
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
