import React, { useState } from 'react';
import { useAdmin } from '../../AdminDataContext';
import { AIWorld } from '../../types/ai';
import {
  Globe,
  Plus,
  Edit2,
  ArrowRight,
  X,
} from 'lucide-react';

interface AIWorldsSectionProps {
  onUseWorldInDesign: (worldName: string, dept: 'MEN' | 'KIDS') => void;
}

export const AIWorldsSection: React.FC<AIWorldsSectionProps> = ({
  onUseWorldInDesign,
}) => {
  const { aiWorlds, addAIWorld, updateAIWorld, showToast } = useAdmin();
  const [departmentFilter, setDepartmentFilter] = useState<'ALL' | 'MEN' | 'KIDS'>('ALL');
  const [selectedWorld, setSelectedWorld] = useState<AIWorld | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [department, setDepartment] = useState<'MEN' | 'KIDS'>('MEN');
  const [description, setDescription] = useState('');
  const [visualStyle, setVisualStyle] = useState('');
  const [environment, setEnvironment] = useState('');
  const [technologyLevel, setTechnologyLevel] = useState('');
  const [culture, setCulture] = useState('');
  const [accentColor, setAccentColor] = useState('#FF2028');

  const filtered = aiWorlds.filter(
    (w) => departmentFilter === 'ALL' || w.department === departmentFilter
  );

  const handleOpenCreate = () => {
    setSelectedWorld(null);
    setName('');
    setSubtitle('NEW UNIVERSE HORIZON');
    setDepartment('MEN');
    setDescription('An unwritten sector of the TORIWEAR multiverse waiting for creative emergence.');
    setVisualStyle('High-density monochrome lines with sharp vector accents.');
    setEnvironment('Neo-metropolitan urban rooftops and subterranean hubs.');
    setTechnologyLevel('Near-future analog hybrid tech.');
    setCulture('Underground streetwear clans and nocturnal couriers.');
    setAccentColor('#FF2028');
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (w: AIWorld) => {
    setSelectedWorld(w);
    setName(w.name);
    setSubtitle(w.subtitle);
    setDepartment(w.department);
    setDescription(w.description);
    setVisualStyle(w.visualStyle);
    setEnvironment(w.environment);
    setTechnologyLevel(w.technologyLevel);
    setCulture(w.culture);
    setAccentColor(w.accentColor || '#FF2028');
    setIsEditorOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      showToast('Please enter a world name.');
      return;
    }

    if (selectedWorld) {
      const updated: AIWorld = {
        ...selectedWorld,
        name: name.toUpperCase(),
        subtitle: subtitle.toUpperCase(),
        department,
        description,
        visualStyle,
        environment,
        technologyLevel,
        culture,
        accentColor,
        updatedAt: new Date().toISOString(),
      };
      updateAIWorld(updated);
      showToast(`World ${name} updated.`);
    } else {
      const newWorld: AIWorld = {
        id: `world-${Date.now()}`,
        name: name.toUpperCase(),
        subtitle: subtitle.toUpperCase(),
        department,
        description,
        visualStyle,
        environment,
        technologyLevel,
        culture,
        accentColor,
        colorPalette: ['#111115', accentColor, '#ffffff'],
        architecture: 'Urban brutalist steel and concrete',
        characterTypes: ['Shadow Runners', 'Urban Explorers'],
        storyThemes: ['Independence', 'Courage', 'Creativity'],
        rules: 'Style is an attitude; stories belong to the streets.',
        symbols: ['⚡ Seal', '★ Star Crest'],
        badge: `${name.toUpperCase()} // UNIVERSE`,
        status: 'APPROVED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addAIWorld(newWorld);
      showToast(`World ${name} created in TORIWEAR CMS.`);
    }
    setIsEditorOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <h2 className="text-xl font-black text-white font-sans uppercase tracking-tight flex items-center gap-2">
            <Globe className="w-5 h-5 text-purple-400" />
            <span>TORIWEAR CREATIVE WORLDS</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Canonical story universes powering TORIWEAR streetwear drops across Men and Kids departments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Department Filter Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-[#161724] border border-neutral-800">
            {(['ALL', 'MEN', 'KIDS'] as const).map((dept) => (
              <button
                key={dept}
                onClick={() => setDepartmentFilter(dept)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition cursor-pointer ${
                  departmentFilter === dept
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold uppercase transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-600/25"
          >
            <Plus className="w-4 h-4" />
            <span>NEW WORLD</span>
          </button>
        </div>
      </div>

      {/* Worlds Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((w) => (
          <div
            key={w.id}
            className="rounded-2xl bg-[#12131c] border border-neutral-800/80 hover:border-neutral-700 overflow-hidden shadow-xl transition flex flex-col justify-between"
          >
            {w.heroImage && (
              <div className="relative h-40 overflow-hidden bg-black">
                <img
                  src={w.heroImage}
                  alt={w.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#12131c] via-transparent to-transparent" />
                <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-[10px] font-mono font-bold text-white border border-neutral-700 uppercase">
                  {w.department}
                </div>
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  {w.colorPalette.slice(0, 3).map((col, idx) => (
                    <div
                      key={idx}
                      className="w-3.5 h-3.5 rounded-full border border-neutral-800 shadow-sm"
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="text-[10px] font-mono text-purple-400 uppercase tracking-wider">
                  {w.subtitle}
                </div>
                <h3 className="text-xl font-black text-white font-sans uppercase tracking-tight">
                  {w.name}
                </h3>
                <p className="text-xs text-neutral-300 leading-relaxed line-clamp-3">
                  {w.description}
                </p>

                <div className="space-y-1 pt-1 text-[11px] text-neutral-400 font-mono">
                  <div><strong>Style:</strong> {w.visualStyle}</div>
                  <div><strong>Culture:</strong> {w.culture}</div>
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onUseWorldInDesign(w.name, w.department)}
                  className="text-xs font-mono font-bold text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                >
                  <span>Create in this World</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(w)}
                  className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                  title="Edit World"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* World Editor Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-[#11121c] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-[#161724]">
              <h3 className="text-sm font-bold text-white font-mono uppercase">
                {selectedWorld ? `EDIT WORLD: ${selectedWorld.name}` : 'CREATE NEW WORLD'}
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
                  <label className="text-[11px] font-mono uppercase text-neutral-400">World Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. CYBERPUNK / NEO CITY"
                    className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase text-neutral-400">Subtitle / Tagline</label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="e.g. MIDNIGHT COURIERS & NEON GRIDS"
                    className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase text-neutral-400">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value as any)}
                    className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500 cursor-pointer"
                  >
                    <option value="MEN">MEN</option>
                    <option value="KIDS">KIDS</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase text-neutral-400">Accent Color</label>
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase text-neutral-400">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Atmosphere, setting, and themes of this universe..."
                  className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase text-neutral-400">Visual Art Style</label>
                <input
                  type="text"
                  value={visualStyle}
                  onChange={(e) => setVisualStyle(e.target.value)}
                  placeholder="e.g. Dual-tone cyan and magenta screen printing, blueprint lines"
                  className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase text-neutral-400">Culture & Society</label>
                <input
                  type="text"
                  value={culture}
                  onChange={(e) => setCulture(e.target.value)}
                  placeholder="e.g. Midnight underground couriers, code of honor"
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
                Save World
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
