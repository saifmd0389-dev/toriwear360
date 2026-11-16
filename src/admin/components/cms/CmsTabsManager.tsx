import React, { useState } from 'react';
import {
  FolderTree,
  Plus,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { FrontPageTabItem } from '../../data/frontPageCmsData';

interface CmsTabsManagerProps {
  tabs: FrontPageTabItem[];
  onUpdateTabs: (updated: FrontPageTabItem[]) => void;
  showToast: (msg: string) => void;
}

export const CmsTabsManager: React.FC<CmsTabsManagerProps> = ({ tabs, onUpdateTabs, showToast }) => {
  const [activeCategory, setActiveCategory] = useState<FrontPageTabItem['category']>('HEADER_NAV');
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTabForm, setNewTabForm] = useState<Partial<FrontPageTabItem>>({
    label: '',
    targetLink: '',
    badge: '',
    icon: '',
    description: '',
  });

  const categoryTabs = [...tabs.filter(t => t.category === activeCategory)].sort((a, b) => a.order - b.order);

  const handleToggle = (id: string) => {
    const updated = tabs.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t);
    onUpdateTabs(updated);
    showToast('Tab visibility updated.');
  };

  const handleDelete = (id: string) => {
    const updated = tabs.filter(t => t.id !== id);
    onUpdateTabs(updated);
    showToast('Tab deleted.');
  };

  const handleMove = (indexInCategory: number, direction: 'UP' | 'DOWN') => {
    const targetIdx = direction === 'UP' ? indexInCategory - 1 : indexInCategory + 1;
    if (targetIdx < 0 || targetIdx >= categoryTabs.length) return;

    const reorderedCategory = [...categoryTabs];
    const [moved] = reorderedCategory.splice(indexInCategory, 1);
    if (!moved) return;
    reorderedCategory.splice(targetIdx, 0, moved);

    const orderMap = new Map<string, number>();
    reorderedCategory.forEach((t, idx) => orderMap.set(t.id, idx + 1));

    const updated = tabs.map(t =>
      orderMap.has(t.id) ? { ...t, order: orderMap.get(t.id)! } : t
    );

    onUpdateTabs(updated);
    showToast('Tab order updated.');
  };

  const handleFieldChange = (id: string, field: keyof FrontPageTabItem, val: any) => {
    const updated = tabs.map(t => t.id === id ? { ...t, [field]: val } : t);
    onUpdateTabs(updated);
  };

  const handleCreateNewTab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTabForm.label) return;

    const newTab: FrontPageTabItem = {
      id: `tab-${Date.now()}`,
      category: activeCategory,
      label: newTabForm.label,
      targetLink: newTabForm.targetLink || '#',
      badge: newTabForm.badge || undefined,
      icon: newTabForm.icon || undefined,
      description: newTabForm.description || undefined,
      enabled: true,
      order: categoryTabs.length + 1,
    };

    onUpdateTabs([...tabs, newTab]);
    setNewTabForm({ label: '', targetLink: '', badge: '', icon: '', description: '' });
    setShowAddModal(false);
    showToast(`Added new tab: "${newTab.label}"`);
  };

  return (
    <div className="space-y-5 text-xs font-mono">
      {/* Category Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
        <div>
          <div className="flex items-center gap-2 text-white font-bold text-sm font-sans">
            <FolderTree className="w-4 h-4 text-amber-500" />
            <span>Storefront Tabs & Navigation Architecture ({tabs.length} Total Tabs)</span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Configure every navigation menu tab, department switchers, category tabs, and lookbook filters.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Tab</span>
        </button>
      </div>

      {/* Category Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 overflow-x-auto">
        {[
          { key: 'HEADER_NAV', label: 'Header Menu Tabs', count: tabs.filter(t => t.category === 'HEADER_NAV').length },
          { key: 'DEPARTMENT_SWITCHER', label: 'Department Switcher', count: tabs.filter(t => t.category === 'DEPARTMENT_SWITCHER').length },
          { key: 'REALM_WORLDS', label: 'Choose Your World Tabs', count: tabs.filter(t => t.category === 'REALM_WORLDS').length },
          { key: 'LOOKBOOK_FILTER', label: 'Lookbook Filter Tabs', count: tabs.filter(t => t.category === 'LOOKBOOK_FILTER').length },
        ].map(cat => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setActiveCategory(cat.key as any)}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeCategory === cat.key
                ? 'bg-amber-500 text-black shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-white'
            }`}
          >
            <span>{cat.label}</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] ${
              activeCategory === cat.key ? 'bg-black/20 text-black' : 'bg-neutral-800 text-neutral-400'
            }`}>
              {cat.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tabs List */}
      <div className="space-y-2.5">
        {categoryTabs
          .sort((a, b) => a.order - b.order)
          .map((tab, idx) => {
            const isEditing = editingTabId === tab.id;

            return (
              <div
                key={tab.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  tab.enabled 
                    ? 'bg-[#12121a] border-neutral-800' 
                    : 'bg-neutral-950/60 border-neutral-900 opacity-60'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded bg-neutral-900 border border-neutral-800 flex items-center justify-center font-mono text-[10px] text-neutral-400 font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-white font-bold text-xs truncate flex items-center gap-2">
                        <span>{tab.label}</span>
                        {tab.badge && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-red-950 text-red-400 border border-red-800">
                            {tab.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5 truncate flex items-center gap-2">
                        <span className="text-neutral-500">Target:</span>
                        <code className="text-neutral-300 font-mono">{tab.targetLink}</code>
                        {tab.description && <span className="hidden sm:inline text-neutral-500">• {tab.description}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, 'UP')}
                      className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={idx === categoryTabs.length - 1}
                      onClick={() => handleMove(idx, 'DOWN')}
                      className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggle(tab.id)}
                      className={`p-1.5 rounded-lg border transition cursor-pointer ${
                        tab.enabled 
                          ? 'border-emerald-500/40 text-emerald-400 bg-emerald-950/30' 
                          : 'border-neutral-800 text-neutral-500 bg-neutral-900'
                      }`}
                      title={tab.enabled ? 'Tab is Visible' : 'Tab is Hidden'}
                    >
                      {tab.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingTabId(isEditing ? null : tab.id)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                        isEditing 
                          ? 'bg-neutral-200 text-neutral-900 border-white' 
                          : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{isEditing ? 'Done' : 'Edit'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(tab.id)}
                      className="p-1.5 rounded-lg bg-neutral-900 hover:bg-red-950 text-neutral-500 hover:text-red-400 border border-neutral-800 transition cursor-pointer"
                      title="Delete Tab"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Edit Form */}
                {isEditing && (
                  <div className="mt-3 pt-3 border-t border-neutral-800 grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-fadeIn">
                    <div>
                      <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Tab Label</label>
                      <input
                        type="text"
                        value={tab.label}
                        onChange={(e) => handleFieldChange(tab.id, 'label', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Target Link / URL / Anchor</label>
                      <input
                        type="text"
                        value={tab.targetLink}
                        onChange={(e) => handleFieldChange(tab.id, 'targetLink', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Pill Badge Tag (Optional)</label>
                      <input
                        type="text"
                        value={tab.badge || ''}
                        onChange={(e) => handleFieldChange(tab.id, 'badge', e.target.value)}
                        placeholder="e.g. 30 DROPS, NEW"
                        className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Description / Sub-label</label>
                      <input
                        type="text"
                        value={tab.description || ''}
                        onChange={(e) => handleFieldChange(tab.id, 'description', e.target.value)}
                        placeholder="Optional subtitle for dropdowns or mobile views"
                        className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Add Tab Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#101018] border border-neutral-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <span className="font-bold text-white text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Add Navigation Tab ({activeCategory})</span>
              </span>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewTab} className="space-y-3">
              <div>
                <label className="block text-[10px] text-neutral-400 uppercase font-bold mb-1">Tab Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cyberpunk Vault"
                  value={newTabForm.label}
                  onChange={(e) => setNewTabForm({ ...newTabForm, label: e.target.value })}
                  className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 uppercase font-bold mb-1">Target Link / URL *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. /men?world=Cyberpunk or #tori-universe"
                  value={newTabForm.targetLink}
                  onChange={(e) => setNewTabForm({ ...newTabForm, targetLink: e.target.value })}
                  className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 uppercase font-bold mb-1">Badge Tag</label>
                <input
                  type="text"
                  placeholder="e.g. HOT, 30 DROPS"
                  value={newTabForm.badge}
                  onChange={(e) => setNewTabForm({ ...newTabForm, badge: e.target.value })}
                  className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 uppercase font-bold mb-1">Description / Subtitle</label>
                <input
                  type="text"
                  placeholder="Optional brief description"
                  value={newTabForm.description}
                  onChange={(e) => setNewTabForm({ ...newTabForm, description: e.target.value })}
                  className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-bold"
                >
                  Create Tab
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
