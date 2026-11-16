import React, { useState } from 'react';
import { useAdmin } from '../../AdminDataContext';
import { AICollection } from '../../types/ai';
import {
  Layers,
  Plus,
  Edit2,
  ArrowRight,
  X,
} from 'lucide-react';

interface AICollectionsSectionProps {
  onFilterByCollection: (collectionName: string) => void;
}

export const AICollectionsSection: React.FC<AICollectionsSectionProps> = ({
  onFilterByCollection,
}) => {
  const { aiCollections, addAICollection, updateAICollection, aiConcepts, showToast } = useAdmin();
  const [departmentFilter, setDepartmentFilter] = useState<'ALL' | 'MEN' | 'KIDS'>('ALL');
  const [selectedCol, setSelectedCol] = useState<AICollection | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [chapterNumber, setChapterNumber] = useState('01');
  const [department, setDepartment] = useState<'MEN' | 'KIDS'>('MEN');
  const [theme, setTheme] = useState('');
  const [heroCharacter, setHeroCharacter] = useState('REN');
  const [status, setStatus] = useState<AICollection['status']>('IN DESIGN');
  const [targetLaunch, setTargetLaunch] = useState('OCTOBER 2026');

  const filtered = aiCollections.filter(
    (c) => departmentFilter === 'ALL' || c.department === departmentFilter
  );

  const handleOpenCreate = () => {
    setSelectedCol(null);
    setName('CHAPTER 04 — SOLAR ECLIPSE');
    setChapterNumber('04');
    setDepartment('MEN');
    setTheme('Celestial streetwear with reflective gold foil detailing');
    setHeroCharacter('KAI');
    setStatus('PLANNING');
    setTargetLaunch('DECEMBER 2026');
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (col: AICollection) => {
    setSelectedCol(col);
    setName(col.name);
    setChapterNumber(col.chapterNumber || '01');
    setDepartment(col.department || 'MEN');
    setTheme(col.theme);
    setHeroCharacter(col.heroCharacter || 'REN');
    setStatus(col.status);
    setTargetLaunch(col.targetLaunch || '2026');
    setIsEditorOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      showToast('Please enter a collection name.');
      return;
    }

    if (selectedCol) {
      const updated: AICollection = {
        ...selectedCol,
        name: name.toUpperCase(),
        chapterNumber,
        department,
        theme,
        heroCharacter,
        status,
        targetLaunch,
        updatedAt: new Date().toISOString(),
      };
      updateAICollection(updated);
      showToast(`Collection ${name} updated.`);
    } else {
      const newCol: AICollection = {
        id: `col-${Date.now()}`,
        name: name.toUpperCase(),
        chapterNumber,
        department,
        theme,
        heroCharacter,
        worlds: ['DARK SHONEN'],
        characters: [heroCharacter],
        status,
        targetLaunch,
        designCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addAICollection(newCol);
      showToast(`Collection ${name} created.`);
    }
    setIsEditorOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <h2 className="text-xl font-black text-white font-sans uppercase tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-pink-400" />
            <span>COLLECTION CAPSULES // CHAPTER DROPS</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Curate episodic streetwear drops and children’s seasonal story wear collections.
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
            <span>NEW CHAPTER</span>
          </button>
        </div>
      </div>

      {/* Collections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((col) => {
          const associatedConcepts = aiConcepts.filter((c) => c.collection === col.name);

          return (
            <div
              key={col.id}
              className="rounded-2xl bg-[#12131c] border border-neutral-800/80 hover:border-neutral-700 p-5 space-y-4 shadow-xl transition flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/60 text-red-400 border border-neutral-800 font-bold uppercase">
                    CHAPTER {col.chapterNumber} • {col.department}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      col.status === 'LIVE'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : col.status === 'READY'
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {col.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black text-white font-sans uppercase tracking-tight">
                    {col.name}
                  </h3>
                  <p className="text-xs text-neutral-300 leading-relaxed mt-1 font-sans">
                    {col.theme}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono p-3 rounded-xl bg-[#181926] border border-neutral-800/80">
                  <div>
                    <div className="text-[10px] text-neutral-500 uppercase">Hero Protagonist</div>
                    <div className="text-white font-bold truncate">{col.heroCharacter || 'Multi'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-500 uppercase">Target Launch</div>
                    <div className="text-white font-bold truncate">{col.targetLaunch || 'TBD'}</div>
                  </div>
                </div>

                <div className="text-xs text-neutral-400 font-mono">
                  Contains <strong>{associatedConcepts.length}</strong> active design concept(s)
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onFilterByCollection(col.name)}
                  className="text-xs font-mono font-bold text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                >
                  <span>View Designs</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(col)}
                  className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                  title="Edit Collection"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Collection Editor Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-xl bg-[#11121c] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-[#161724]">
              <h3 className="text-sm font-bold text-white font-mono uppercase">
                {selectedCol ? `EDIT COLLECTION: ${selectedCol.name}` : 'CREATE NEW CHAPTER COLLECTION'}
              </h3>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-1 rounded bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-[11px] font-mono uppercase text-neutral-400">Collection Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. CHAPTER 02 — MIDNIGHT PROTOCOL"
                    className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase text-neutral-400">Chapter #</label>
                  <input
                    type="text"
                    value={chapterNumber}
                    onChange={(e) => setChapterNumber(e.target.value)}
                    placeholder="e.g. 02"
                    className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500 font-mono"
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
                  <label className="text-[11px] font-mono uppercase text-neutral-400">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500 cursor-pointer"
                  >
                    <option value="PLANNING">PLANNING</option>
                    <option value="IN DESIGN">IN DESIGN</option>
                    <option value="READY">READY</option>
                    <option value="LIVE">LIVE</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase text-neutral-400">Hero Protagonist</label>
                  <input
                    type="text"
                    value={heroCharacter}
                    onChange={(e) => setHeroCharacter(e.target.value)}
                    placeholder="e.g. REN"
                    className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase text-neutral-400">Target Launch Date</label>
                  <input
                    type="text"
                    value={targetLaunch}
                    onChange={(e) => setTargetLaunch(e.target.value)}
                    placeholder="e.g. OCTOBER 2026"
                    className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase text-neutral-400">Theme & Capsule Narrative</label>
                <textarea
                  rows={3}
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="Streetwear narrative, color stories, and garment silhouettes for this drop..."
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
                Save Chapter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
