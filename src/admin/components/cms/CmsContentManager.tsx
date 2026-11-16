import React, { useState } from 'react';
import {
  BookOpen,
  Users,
  Palette,
  HelpCircle,
  Compass,
  Camera,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  ShieldCheck,
  ArrowRight,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { 
  FrontPageRealmCard,
  FrontPageUniverseLore,
  FrontPageCharacterProfile,
  FrontPageDesignStory,
  FrontPageLookbookItem,
  FrontPageSocialFeed,
  FrontPageFaqItem,
  FrontPageFooterSettings,
  uploadCmsImageAsset
} from '../../data/frontPageCmsData';

interface CmsContentManagerProps {
  realms: FrontPageRealmCard[];
  onUpdateRealms: (r: FrontPageRealmCard[]) => void;
  universe: FrontPageUniverseLore;
  onUpdateUniverse: (u: FrontPageUniverseLore) => void;
  characters: FrontPageCharacterProfile[];
  onUpdateCharacters: (c: FrontPageCharacterProfile[]) => void;
  stories: FrontPageDesignStory[];
  onUpdateStories: (s: FrontPageDesignStory[]) => void;
  lookbook: FrontPageLookbookItem[];
  onUpdateLookbook: (l: FrontPageLookbookItem[]) => void;
  socialFeed: FrontPageSocialFeed;
  onUpdateSocialFeed: (sf: FrontPageSocialFeed) => void;
  faqs: FrontPageFaqItem[];
  onUpdateFaqs: (f: FrontPageFaqItem[]) => void;
  footer: FrontPageFooterSettings;
  onUpdateFooter: (ft: FrontPageFooterSettings) => void;
  showToast: (msg: string) => void;
}

export const CmsContentManager: React.FC<CmsContentManagerProps> = ({
  realms,
  onUpdateRealms,
  universe,
  onUpdateUniverse,
  characters,
  onUpdateCharacters,
  stories,
  onUpdateStories,
  lookbook,
  onUpdateLookbook,
  socialFeed,
  onUpdateSocialFeed,
  faqs,
  onUpdateFaqs,
  footer,
  onUpdateFooter,
  showToast
}) => {
  const [subTab, setSubTab] = useState<'REALMS' | 'UNIVERSE' | 'CHARACTERS' | 'STORIES' | 'LOOKBOOK' | 'FAQS' | 'FOOTER'>('REALMS');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // Helper upload function to server persistent disk
  const handleImageFile = (callback: (url: string) => void, key = 'asset') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;
      setUploadingKey(key);
      try {
        const url = await uploadCmsImageAsset(file);
        callback(url);
        showToast('Image uploaded to server.');
      } catch (err: any) {
        showToast(err?.message || 'Image upload failed.');
      } finally {
        setUploadingKey(null);
        target.value = '';
      }
    };
    input.click();
  };

  return (
    <div className="space-y-5 text-xs font-mono">
      {/* Sub Tabs Selector */}
      <div className="flex items-center gap-1.5 border-b border-neutral-800 pb-2 overflow-x-auto">
        {[
          { key: 'REALMS', label: 'Choose Your World Realms', count: realms.length, icon: Compass },
          { key: 'UNIVERSE', label: 'Tori Universe & Lore', count: universe.chapters.length, icon: BookOpen },
          { key: 'CHARACTERS', label: 'Characters Roster', count: characters.length, icon: Users },
          { key: 'STORIES', label: 'Story Behind Designs', count: stories.length, icon: Palette },
          { key: 'LOOKBOOK', label: 'Lookbook & Marquee', count: lookbook.length, icon: Camera },
          { key: 'FAQS', label: 'Frequently Asked Questions', count: faqs.length, icon: HelpCircle },
          { key: 'FOOTER', label: 'Footer & Trust Badges', icon: ShieldCheck },
        ].map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setSubTab(item.key as any);
                setEditingId(null);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                subTab === item.key
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {typeof item.count === 'number' && (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-black/30">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 1. CHOOSE YOUR WORLD REALMS */}
      {subTab === 'REALMS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
            <div>
              <div className="text-white font-bold text-sm font-sans flex items-center gap-2">
                <Compass className="w-4 h-4 text-red-500" />
                <span>Choose Your World — Fictional Realms Showcase ({realms.length})</span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                Edit the 5 anime universe cards displayed on the homepage: Chapter badges, Japanese kanji, titles, lore, accent colors, and background artwork.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const num = String(realms.length + 1).padStart(2, '0');
                const newRealm: FrontPageRealmCard = {
                  id: `realm-${Date.now()}`,
                  title: 'NEW REALM',
                  department: 'MEN',
                  tag: `CHAPTER ${num}`,
                  badge: `CHAPTER ${num}`,
                  japanese: '新次元',
                  numberBadge: num,
                  franchiseVibe: 'Original Manga Universe & Graphic Streetwear',
                  description: 'Power. Mastery. Horizons. Unleashed.',
                  detailedLore: 'Custom oversized drop-shoulder cut with archival high-density back print.',
                  bannerImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1000&auto=format&fit=crop&q=80',
                  accentColor: '#FF2028',
                  ctaText: 'SHOP WORLD →',
                  worldId: 'DARK SHONEN',
                  bgGradient: 'from-purple-950/70 via-neutral-950 to-[#0A0A0A]',
                  enabled: true,
                  order: realms.length + 1,
                };
                onUpdateRealms([...realms, newRealm]);
                setEditingId(newRealm.id);
                showToast('Added new Realm card.');
              }}
              className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-lg shadow-red-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add New World Card</span>
            </button>
          </div>

          <div className="space-y-4">
            {realms.map((realm, index) => {
              const accent = realm.accentColor || '#FF2028';
              const numBadge = realm.numberBadge || String(index + 1).padStart(2, '0');
              const tagBadge = realm.badge || realm.tag || `CHAPTER 0${index + 1}`;
              const kanji = realm.japanese || '暗黒少年';

              return (
                <div key={realm.id} className="p-4 rounded-xl bg-[#12121a] border border-neutral-800 space-y-4 transition-all">
                  {/* Card Row Header */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-neutral-900 border border-neutral-700 shrink-0 relative group">
                        <img src={realm.bannerImage} alt={realm.title} className="w-full h-full object-cover" />
                        <div 
                          className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border border-black" 
                          style={{ backgroundColor: accent }} 
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-white font-bold text-sm flex items-center gap-2 truncate">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/60 font-mono text-neutral-300 border border-neutral-700">
                            {numBadge}
                          </span>
                          <span className="truncate">{realm.title}</span>
                          <span 
                            className="px-2 py-0.5 rounded text-[10px] font-mono border"
                            style={{ color: accent, borderColor: `${accent}40`, backgroundColor: `${accent}15` }}
                          >
                            {tagBadge}
                          </span>
                          {!realm.enabled && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-neutral-800 text-neutral-500 border border-neutral-700">
                              HIDDEN
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-400 font-mono mt-0.5 flex items-center gap-2">
                          <span className="text-neutral-500 font-bold">{kanji}</span>
                          <span>•</span>
                          <span className="truncate">{realm.description || realm.franchiseVibe}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = realms.map(r => r.id === realm.id ? { ...r, enabled: r.enabled === false ? true : false } : r);
                          onUpdateRealms(updated);
                          showToast(`World card ${realm.enabled === false ? 'enabled' : 'hidden'}.`);
                        }}
                        className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                          realm.enabled !== false 
                            ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' 
                            : 'border-neutral-800 text-neutral-500 bg-neutral-900'
                        }`}
                        title={realm.enabled !== false ? 'Card is live on storefront' : 'Card is hidden'}
                      >
                        {realm.enabled !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingId(editingId === realm.id ? null : realm.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                          editingId === realm.id
                            ? 'bg-neutral-700 text-white'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                        }`}
                      >
                        {editingId === realm.id ? 'Close' : 'Edit Card'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onUpdateRealms(realms.filter(r => r.id !== realm.id));
                          showToast(`Realm "${realm.title}" deleted.`);
                        }}
                        className="p-1.5 rounded-lg bg-neutral-900 hover:bg-red-950 text-neutral-500 hover:text-red-400 cursor-pointer border border-neutral-800"
                        title="Delete Realm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Edit Form & Live Preview */}
                  {editingId === realm.id && (
                    <div className="pt-4 border-t border-neutral-800 grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fadeIn">
                      {/* Left: Input Fields */}
                      <div className="lg:col-span-2 space-y-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] text-neutral-400 block mb-1 uppercase font-semibold">
                              Card Number (Badge)
                            </label>
                            <input
                              type="text"
                              value={realm.numberBadge || numBadge}
                              onChange={(e) => onUpdateRealms(realms.map(r => r.id === realm.id ? { ...r, numberBadge: e.target.value } : r))}
                              placeholder="01"
                              className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-red-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-neutral-400 block mb-1 uppercase font-semibold">
                              Chapter / Tag Badge
                            </label>
                            <input
                              type="text"
                              value={realm.badge || realm.tag || ''}
                              onChange={(e) => onUpdateRealms(realms.map(r => r.id === realm.id ? { ...r, badge: e.target.value, tag: e.target.value } : r))}
                              placeholder="CHAPTER 01 / PROTOCOL 2087"
                              className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-red-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-neutral-400 block mb-1 uppercase font-semibold">
                              Japanese Kanji Subtitle
                            </label>
                            <input
                              type="text"
                              value={realm.japanese || ''}
                              onChange={(e) => onUpdateRealms(realms.map(r => r.id === realm.id ? { ...r, japanese: e.target.value } : r))}
                              placeholder="暗黒少年 / 新東京サイバー"
                              className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-red-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-neutral-400 block mb-1 uppercase font-semibold">
                              World Title (Display Heading)
                            </label>
                            <input
                              type="text"
                              value={realm.title}
                              onChange={(e) => onUpdateRealms(realms.map(r => r.id === realm.id ? { ...r, title: e.target.value } : r))}
                              placeholder="DARK SHONEN / CYBERPUNK"
                              className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-red-500 font-bold"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-neutral-400 block mb-1 uppercase font-semibold">
                              Target World Filter (Links to Catalog)
                            </label>
                            <select
                              value={realm.worldId || realm.title}
                              onChange={(e) => onUpdateRealms(realms.map(r => r.id === realm.id ? { ...r, worldId: e.target.value } : r))}
                              className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-red-500 cursor-pointer"
                            >
                              <option value="DARK SHONEN">DARK SHONEN</option>
                              <option value="CYBERPUNK / NEO TOKYO">CYBERPUNK / NEO TOKYO</option>
                              <option value="RETRO Y2K">RETRO Y2K</option>
                              <option value="SAMURAI / MYTHIC JAPAN">SAMURAI / MYTHIC JAPAN</option>
                              <option value="STREET ANIME">STREET ANIME</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-neutral-400 block mb-1 uppercase font-semibold">
                            Headline / Tagline (e.g. Power. Rivalry. Shadows. Awakening.)
                          </label>
                          <input
                            type="text"
                            value={realm.description}
                            onChange={(e) => onUpdateRealms(realms.map(r => r.id === realm.id ? { ...r, description: e.target.value } : r))}
                            placeholder="Power. Rivalry. Shadows. Awakening."
                            className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-red-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-neutral-400 block mb-1 uppercase font-semibold">
                            Detailed Lore & Fabric Description (Appears below headline)
                          </label>
                          <textarea
                            rows={2}
                            value={realm.detailedLore || ''}
                            onChange={(e) => onUpdateRealms(realms.map(r => r.id === realm.id ? { ...r, detailedLore: e.target.value } : r))}
                            placeholder="Obsidian silhouettes, raw power, and high-density puff print dark energy flares."
                            className="w-full p-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs resize-none font-sans focus:outline-none focus:border-red-500"
                          />
                        </div>

                        {/* Accent Color Palette Selector */}
                        <div>
                          <label className="text-[10px] text-neutral-400 block mb-1 uppercase font-semibold">
                            Accent Color & Glowing Indicator Dot
                          </label>
                          <div className="flex flex-wrap items-center gap-2">
                            {[
                              { label: 'Purple (Dark Shonen)', hex: '#9333ea' },
                              { label: 'Cyan (Cyberpunk)', hex: '#06b6d4' },
                              { label: 'Pink (Retro Y2K)', hex: '#ec4899' },
                              { label: 'Red (Samurai)', hex: '#ef4444' },
                              { label: 'Tori Red (Street Anime)', hex: '#FF2028' },
                              { label: 'Gold (Mythic)', hex: '#eab308' },
                              { label: 'Emerald (Mecha)', hex: '#10b981' },
                            ].map((c) => (
                              <button
                                key={c.hex}
                                type="button"
                                onClick={() => onUpdateRealms(realms.map(r => r.id === realm.id ? { ...r, accentColor: c.hex } : r))}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1.5 cursor-pointer transition ${
                                  realm.accentColor?.toLowerCase() === c.hex.toLowerCase()
                                    ? 'border-white bg-neutral-800 text-white font-bold'
                                    : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
                                }`}
                              >
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.hex }} />
                                <span>{c.label.split(' ')[0]}</span>
                              </button>
                            ))}
                            <div className="flex items-center gap-1.5 ml-auto">
                              <span className="text-[10px] text-neutral-500 font-mono">Custom:</span>
                              <input
                                type="text"
                                value={realm.accentColor || '#FF2028'}
                                onChange={(e) => onUpdateRealms(realms.map(r => r.id === realm.id ? { ...r, accentColor: e.target.value } : r))}
                                className="w-20 px-2 py-0.5 bg-neutral-900 border border-neutral-700 rounded text-white font-mono text-[11px]"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Image URL & Upload */}
                        <div>
                          <label className="text-[10px] text-neutral-400 block mb-1 uppercase font-semibold">
                            Background Hero Artwork (URL or Local Upload)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={realm.bannerImage}
                              onChange={(e) => onUpdateRealms(realms.map(r => r.id === realm.id ? { ...r, bannerImage: e.target.value } : r))}
                              placeholder="Image URL"
                              className="flex-1 px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-red-500"
                            />
                            <button
                              type="button"
                              disabled={uploadingKey === `realm-${realm.id}`}
                              onClick={() => handleImageFile(url => onUpdateRealms(realms.map(r => r.id === realm.id ? { ...r, bannerImage: url } : r)), `realm-${realm.id}`)}
                              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0 border border-neutral-700"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>{uploadingKey === `realm-${realm.id}` ? 'Uploading...' : 'Upload File'}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Right: Live Interactive Storefront Preview Card */}
                      <div className="border border-neutral-800 rounded-xl p-3 bg-neutral-950/80 flex flex-col justify-between">
                        <div className="text-[10px] font-mono text-neutral-400 uppercase font-bold tracking-wider mb-2 flex items-center justify-between">
                          <span>Live Storefront Preview</span>
                          <span className="text-emerald-400">1:1 Replica</span>
                        </div>

                        {/* Preview Card */}
                        <div className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-[#121215] p-5 flex flex-col justify-between shadow-2xl min-h-[340px]">
                          <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <img
                              src={realm.bannerImage}
                              alt={realm.title}
                              className="w-full h-full object-cover object-center opacity-40 scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/85 to-[#0A0A0A]/60" />
                          </div>

                          <div className="relative z-10">
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <span className="text-[10px] font-mono font-bold tracking-wider text-neutral-300 bg-black/80 px-2 py-0.5 rounded uppercase border border-neutral-700">
                                {realm.numberBadge || numBadge}
                              </span>
                              <span 
                                className="text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded uppercase bg-black/60 border border-neutral-800"
                                style={{ color: accent }}
                              >
                                {realm.badge || realm.tag || tagBadge}
                              </span>
                            </div>

                            <div className="text-xs font-mono text-neutral-400 mb-0.5">
                              {realm.japanese || kanji}
                            </div>

                            <h4 className="font-heading text-lg font-black text-white uppercase tracking-tight">
                              {realm.title}
                            </h4>

                            <p className="mt-2 text-xs font-semibold text-neutral-100 leading-snug">
                              {realm.description || 'Power. Rivalry. Shadows. Awakening.'}
                            </p>

                            <p className="mt-1.5 text-[11px] text-neutral-300 leading-relaxed font-sans line-clamp-3">
                              {realm.detailedLore || 'Obsidian silhouettes, raw power, and high-density puff print dark energy flares.'}
                            </p>
                          </div>

                          <div className="relative z-10 pt-3 mt-3 border-t border-neutral-800/80 flex items-center justify-between">
                            <span className="text-[11px] font-heading font-black text-neutral-200 tracking-wider uppercase flex items-center gap-1">
                              <span>{realm.ctaText || 'SHOP WORLD'}</span>
                              <ArrowRight className="w-3 h-3" style={{ color: accent }} />
                            </span>
                            <span 
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: accent, boxShadow: `0 0 8px ${accent}` }}
                            />
                          </div>
                        </div>

                        <div className="text-[10px] text-neutral-500 font-mono text-center mt-3">
                          Changes sync instantly to the homepage storefront upon editing & saving.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. TORI UNIVERSE & LORE */}
      {subTab === 'UNIVERSE' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#12121a] border border-neutral-800 space-y-3">
            <div className="text-white font-bold text-xs uppercase text-red-400">Universe Backstory Narrative</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-neutral-400 block mb-0.5">Headline</label>
                <input
                  type="text"
                  value={universe.headline || ''}
                  onChange={(e) => onUpdateUniverse({ ...universe, headline: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-white text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 block mb-0.5">Subheadline</label>
                <input
                  type="text"
                  value={universe.subheadline || ''}
                  onChange={(e) => onUpdateUniverse({ ...universe, subheadline: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-white text-xs"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-neutral-400 block mb-0.5">Narrative Excerpt</label>
              <textarea
                rows={3}
                value={universe.narrativeText || ''}
                onChange={(e) => onUpdateUniverse({ ...universe, narrativeText: e.target.value })}
                className="w-full p-2 bg-neutral-900 border border-neutral-700 rounded text-white resize-none text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-400 block mb-0.5">Featured Quote</label>
              <input
                type="text"
                value={universe.quote || ''}
                onChange={(e) => onUpdateUniverse({ ...universe, quote: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-white text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-400 block mb-0.5">Universe Banner Image (URL or Upload)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={universe.bannerImage || ''}
                  onChange={(e) => onUpdateUniverse({ ...universe, bannerImage: e.target.value })}
                  placeholder="https://... or /generated-assets/..."
                  className="flex-1 px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-white text-xs"
                />
                <button
                  type="button"
                  disabled={uploadingKey === 'universe-banner'}
                  onClick={() => handleImageFile(url => onUpdateUniverse({ ...universe, bannerImage: url }), 'universe-banner')}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white rounded flex items-center gap-1.5 text-xs font-bold cursor-pointer border border-neutral-700"
                >
                  <Upload className="w-3.5 h-3.5 text-red-400" />
                  <span>{uploadingKey === 'universe-banner' ? 'Uploading...' : 'Upload'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Lore Pillars */}
          <div className="p-4 rounded-xl bg-[#12121a] border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white font-bold text-xs uppercase text-amber-400">Universe Lore Pillars ({(universe.pillars || []).length})</span>
            </div>
            <div className="space-y-2.5">
              {(universe.pillars || []).map((pillar, idx) => (
                <div key={pillar.id || idx} className="p-3 rounded-lg bg-neutral-900/70 border border-neutral-800 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-neutral-500 block mb-0.5">Num</label>
                    <input
                      type="text"
                      value={pillar.num}
                      onChange={(e) => {
                        const updated = [...(universe.pillars || [])];
                        updated[idx] = { ...pillar, num: e.target.value };
                        onUpdateUniverse({ ...universe, pillars: updated });
                      }}
                      className="w-full px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="text-[10px] text-neutral-500 block mb-0.5">Pillar Title</label>
                    <input
                      type="text"
                      value={pillar.title}
                      onChange={(e) => {
                        const updated = [...(universe.pillars || [])];
                        updated[idx] = { ...pillar, title: e.target.value };
                        onUpdateUniverse({ ...universe, pillars: updated });
                      }}
                      className="w-full px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                    />
                  </div>
                  <div className="sm:col-span-6">
                    <label className="text-[10px] text-neutral-500 block mb-0.5">Description</label>
                    <input
                      type="text"
                      value={pillar.description}
                      onChange={(e) => {
                        const updated = [...(universe.pillars || [])];
                        updated[idx] = { ...pillar, description: e.target.value };
                        onUpdateUniverse({ ...universe, pillars: updated });
                      }}
                      className="w-full px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-white font-bold text-xs">Timeline Chapters ({universe.chapters.length})</span>
              <button
                type="button"
                onClick={() => {
                  const newChap = {
                    id: `chap-${Date.now()}`,
                    chapterNumber: `CHAPTER 0${universe.chapters.length + 1}`,
                    title: 'NEW CHRONICLE',
                    era: 'NEO ERA',
                    excerpt: 'Story chronicle excerpt.',
                    bannerImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80',
                    enabled: true,
                    order: universe.chapters.length + 1,
                  };
                  onUpdateUniverse({ ...universe, chapters: [...universe.chapters, newChap] });
                  setEditingId(newChap.id);
                  showToast('Added chapter.');
                }}
                className="px-2.5 py-1 bg-red-600 text-white rounded text-[11px] font-bold cursor-pointer"
              >
                + Add Chapter
              </button>
            </div>

            {universe.chapters.map(chap => (
              <div key={chap.id} className={`p-3 rounded-lg border space-y-3 ${chap.enabled !== false ? 'bg-neutral-900/60 border-neutral-800' : 'bg-neutral-950/60 border-neutral-900 opacity-60'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] text-red-400 font-bold block">{chap.chapterNumber} • {chap.era}</span>
                    <span className="text-white font-bold">{chap.title}</span>
                    <p className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1">{chap.excerpt}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateUniverse({
                          ...universe,
                          chapters: universe.chapters.map(c => c.id === chap.id ? { ...c, enabled: c.enabled === false } : c),
                        });
                      }}
                      className={`p-1.5 rounded border cursor-pointer ${chap.enabled !== false ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-neutral-800 text-neutral-500 bg-neutral-900'}`}
                      title={chap.enabled !== false ? 'Visible' : 'Hidden'}
                    >
                      {chap.enabled !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(editingId === chap.id ? null : chap.id)}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs cursor-pointer"
                    >
                      {editingId === chap.id ? 'Close' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateUniverse({ ...universe, chapters: universe.chapters.filter(c => c.id !== chap.id) });
                        showToast('Chapter removed.');
                      }}
                      className="text-neutral-500 hover:text-red-400 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {editingId === chap.id && (
                  <div className="pt-3 border-t border-neutral-800 grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-fadeIn">
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Chapter Number</label>
                      <input
                        type="text"
                        value={chap.chapterNumber}
                        onChange={(e) => onUpdateUniverse({ ...universe, chapters: universe.chapters.map(c => c.id === chap.id ? { ...c, chapterNumber: e.target.value } : c) })}
                        className="w-full px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Chapter Title</label>
                      <input
                        type="text"
                        value={chap.title}
                        onChange={(e) => onUpdateUniverse({ ...universe, chapters: universe.chapters.map(c => c.id === chap.id ? { ...c, title: e.target.value } : c) })}
                        className="w-full px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Era Tag</label>
                      <input
                        type="text"
                        value={chap.era}
                        onChange={(e) => onUpdateUniverse({ ...universe, chapters: universe.chapters.map(c => c.id === chap.id ? { ...c, era: e.target.value } : c) })}
                        className="w-full px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Excerpt</label>
                      <textarea
                        rows={2}
                        value={chap.excerpt}
                        onChange={(e) => onUpdateUniverse({ ...universe, chapters: universe.chapters.map(c => c.id === chap.id ? { ...c, excerpt: e.target.value } : c) })}
                        className="w-full p-2 bg-neutral-950 border border-neutral-700 rounded text-white text-xs resize-none"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Banner Image (URL or Upload)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={chap.bannerImage || ''}
                          onChange={(e) => onUpdateUniverse({ ...universe, chapters: universe.chapters.map(c => c.id === chap.id ? { ...c, bannerImage: e.target.value } : c) })}
                          className="flex-1 px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                        />
                        <button
                          type="button"
                          disabled={uploadingKey === `chap-${chap.id}`}
                          onClick={() => handleImageFile(url => onUpdateUniverse({ ...universe, chapters: universe.chapters.map(c => c.id === chap.id ? { ...c, bannerImage: url } : c) }), `chap-${chap.id}`)}
                          className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer border border-neutral-700"
                        >
                          <Upload className="w-3 h-3 text-red-400" />
                          <span>{uploadingKey === `chap-${chap.id}` ? 'Uploading...' : 'Upload'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. CHARACTERS ROSTER */}
      {subTab === 'CHARACTERS' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-neutral-900/60 p-3.5 rounded-xl border border-neutral-800">
            <div>
              <div className="text-white font-bold text-xs">Original Characters Roster ({characters.length})</div>
              <div className="text-[11px] text-neutral-400">Pin-to-pin edit Ren, Yuki, Kai and add new characters.</div>
            </div>
            <button
              type="button"
              onClick={() => {
                const newChar: FrontPageCharacterProfile = {
                  id: `char-${Date.now()}`,
                  name: 'NEW CHARACTER // 新キャラ',
                  title: 'Streetwear Protagonist',
                  japaneseTitle: '新戦士',
                  avatarImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
                  quote: '“New era, new armor.”',
                  backstory: 'New character backstory summary.',
                  weaponAesthetic: 'Heavyweight Cotton Fit',
                  stats: { fabricGsm: '240 GSM', loreLevel: 'Rank A', agilityVibe: 'Kinetic' },
                  enabled: true,
                  order: characters.length + 1,
                };
                onUpdateCharacters([...characters, newChar]);
                showToast('Added new character.');
              }}
              className="px-3 py-1.5 bg-red-600 text-white font-bold rounded-lg cursor-pointer"
            >
              + Add Character
            </button>
          </div>

          <div className="space-y-3">
            {characters.map(char => (
              <div key={char.id} className={`p-3.5 rounded-xl border space-y-3 ${char.enabled !== false ? 'bg-[#12121a] border-neutral-800' : 'bg-neutral-950/60 border-neutral-900 opacity-60'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={char.avatarImage} alt={char.name} className="w-12 h-12 rounded-lg object-cover border border-neutral-700" />
                    <div>
                      <div className="text-white font-bold text-xs">{char.name}</div>
                      <div className="text-[10px] text-neutral-400">{char.title} ({char.japaneseTitle})</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateCharacters(characters.map(c => c.id === char.id ? { ...c, enabled: c.enabled === false } : c))}
                      className={`p-1.5 rounded-lg border cursor-pointer ${char.enabled !== false ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-neutral-800 text-neutral-500 bg-neutral-900'}`}
                      title={char.enabled !== false ? 'Visible on storefront' : 'Hidden'}
                    >
                      {char.enabled !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(editingId === char.id ? null : char.id)}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs cursor-pointer"
                    >
                      {editingId === char.id ? 'Close' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateCharacters(characters.filter(c => c.id !== char.id));
                        showToast(`Character "${char.name}" deleted.`);
                      }}
                      className="p-1 text-neutral-500 hover:text-red-400 cursor-pointer"
                      title="Delete Character"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {editingId === char.id && (
                  <div className="pt-3 border-t border-neutral-800 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Character Name</label>
                      <input
                        type="text"
                        value={char.name}
                        onChange={(e) => onUpdateCharacters(characters.map(c => c.id === char.id ? { ...c, name: e.target.value } : c))}
                        className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Title & Role</label>
                      <input
                        type="text"
                        value={char.title}
                        onChange={(e) => onUpdateCharacters(characters.map(c => c.id === char.id ? { ...c, title: e.target.value } : c))}
                        className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Japanese Kanji Title</label>
                      <input
                        type="text"
                        value={char.japaneseTitle || ''}
                        onChange={(e) => onUpdateCharacters(characters.map(c => c.id === char.id ? { ...c, japaneseTitle: e.target.value } : c))}
                        className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Signature Aesthetic / Fit</label>
                      <input
                        type="text"
                        value={char.weaponAesthetic || ''}
                        onChange={(e) => onUpdateCharacters(characters.map(c => c.id === char.id ? { ...c, weaponAesthetic: e.target.value } : c))}
                        className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Avatar Artwork (URL or Upload)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={char.avatarImage || ''}
                          onChange={(e) => onUpdateCharacters(characters.map(c => c.id === char.id ? { ...c, avatarImage: e.target.value } : c))}
                          className="flex-1 px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                        />
                        <button
                          type="button"
                          disabled={uploadingKey === `char-${char.id}`}
                          onClick={() => handleImageFile(url => onUpdateCharacters(characters.map(c => c.id === char.id ? { ...c, avatarImage: url } : c)), `char-${char.id}`)}
                          className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded flex items-center gap-1.5 text-xs font-bold cursor-pointer border border-neutral-700"
                        >
                          <Upload className="w-3.5 h-3.5 text-red-400" />
                          <span>{uploadingKey === `char-${char.id}` ? 'Uploading...' : 'Upload'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="sm:col-span-2 grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-neutral-400 block mb-0.5">Fabric Spec</label>
                        <input
                          type="text"
                          value={char.stats?.fabricGsm || ''}
                          onChange={(e) => onUpdateCharacters(characters.map(c => c.id === char.id ? { ...c, stats: { ...(c.stats || { fabricGsm: '', loreLevel: '', agilityVibe: '' }), fabricGsm: e.target.value } } : c))}
                          className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-400 block mb-0.5">Lore Rank</label>
                        <input
                          type="text"
                          value={char.stats?.loreLevel || ''}
                          onChange={(e) => onUpdateCharacters(characters.map(c => c.id === char.id ? { ...c, stats: { ...(c.stats || { fabricGsm: '', loreLevel: '', agilityVibe: '' }), loreLevel: e.target.value } } : c))}
                          className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-400 block mb-0.5">Vibe / Agility</label>
                        <input
                          type="text"
                          value={char.stats?.agilityVibe || ''}
                          onChange={(e) => onUpdateCharacters(characters.map(c => c.id === char.id ? { ...c, stats: { ...(c.stats || { fabricGsm: '', loreLevel: '', agilityVibe: '' }), agilityVibe: e.target.value } } : c))}
                          className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Quote</label>
                      <input
                        type="text"
                        value={char.quote}
                        onChange={(e) => onUpdateCharacters(characters.map(c => c.id === char.id ? { ...c, quote: e.target.value } : c))}
                        className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Backstory</label>
                      <textarea
                        rows={2}
                        value={char.backstory}
                        onChange={(e) => onUpdateCharacters(characters.map(c => c.id === char.id ? { ...c, backstory: e.target.value } : c))}
                        className="w-full p-2 bg-neutral-900 border border-neutral-700 rounded text-white resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. DESIGN STORIES */}
      {subTab === 'STORIES' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-neutral-900/60 p-3.5 rounded-xl border border-neutral-800">
            <div>
              <div className="text-white font-bold text-xs">Story Behind The Designs ({stories.length})</div>
              <div className="text-[11px] text-neutral-400">Craftsmanship, 240 GSM cotton specs, and archival capsules.</div>
            </div>
            <button
              type="button"
              onClick={() => {
                const newStory: FrontPageDesignStory = {
                  id: `story-${Date.now()}`,
                  title: 'NEW ARCHIVAL STORY',
                  capsuleCode: 'CAPSULE-2026',
                  concept: 'Design philosophy narrative.',
                  fabricSpec: '240 GSM pure combed cotton.',
                  printTechnology: 'High-density screen print.',
                  heroImage: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
                  enabled: true,
                  order: stories.length + 1,
                };
                onUpdateStories([...stories, newStory]);
                setEditingId(newStory.id);
                showToast('Story added.');
              }}
              className="px-3 py-1.5 bg-red-600 text-white font-bold rounded-lg cursor-pointer"
            >
              + Add Story
            </button>
          </div>

          <div className="space-y-3">
            {stories.map(st => (
              <div key={st.id} className={`p-3.5 rounded-xl border space-y-2.5 ${st.enabled !== false ? 'bg-[#12121a] border-neutral-800' : 'bg-neutral-950/60 border-neutral-900 opacity-60'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {st.heroImage && (
                      <img src={st.heroImage} alt={st.title} className="w-10 h-10 rounded-lg object-cover border border-neutral-700 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="text-white font-bold text-xs block truncate">{st.title} ({st.capsuleCode})</span>
                      <span className="text-[10px] text-red-400 font-bold">Fabric: {st.fabricSpec}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUpdateStories(stories.map(s => s.id === st.id ? { ...s, enabled: s.enabled === false } : s))}
                      className={`p-1.5 rounded-lg border cursor-pointer ${st.enabled !== false ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-neutral-800 text-neutral-500 bg-neutral-900'}`}
                      title={st.enabled !== false ? 'Visible' : 'Hidden'}
                    >
                      {st.enabled !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(editingId === st.id ? null : st.id)}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs cursor-pointer"
                    >
                      {editingId === st.id ? 'Close' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateStories(stories.filter(s => s.id !== st.id));
                        showToast('Story deleted.');
                      }}
                      className="p-1 text-neutral-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {editingId === st.id ? (
                  <div className="pt-3 border-t border-neutral-800 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Story Title</label>
                      <input
                        type="text"
                        value={st.title}
                        onChange={(e) => onUpdateStories(stories.map(s => s.id === st.id ? { ...s, title: e.target.value } : s))}
                        className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Capsule Code</label>
                      <input
                        type="text"
                        value={st.capsuleCode}
                        onChange={(e) => onUpdateStories(stories.map(s => s.id === st.id ? { ...s, capsuleCode: e.target.value } : s))}
                        className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Fabric Spec</label>
                      <input
                        type="text"
                        value={st.fabricSpec}
                        onChange={(e) => onUpdateStories(stories.map(s => s.id === st.id ? { ...s, fabricSpec: e.target.value } : s))}
                        className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Print Technology</label>
                      <input
                        type="text"
                        value={st.printTechnology}
                        onChange={(e) => onUpdateStories(stories.map(s => s.id === st.id ? { ...s, printTechnology: e.target.value } : s))}
                        className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Design Philosophy Concept</label>
                      <textarea
                        rows={2}
                        value={st.concept}
                        onChange={(e) => onUpdateStories(stories.map(s => s.id === st.id ? { ...s, concept: e.target.value } : s))}
                        className="w-full p-2 bg-neutral-900 border border-neutral-700 rounded text-white resize-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Hero Image (URL or Upload)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={st.heroImage || ''}
                          onChange={(e) => onUpdateStories(stories.map(s => s.id === st.id ? { ...s, heroImage: e.target.value } : s))}
                          className="flex-1 px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                        />
                        <button
                          type="button"
                          disabled={uploadingKey === `story-${st.id}`}
                          onClick={() => handleImageFile(url => onUpdateStories(stories.map(s => s.id === st.id ? { ...s, heroImage: url } : s)), `story-${st.id}`)}
                          className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded flex items-center gap-1.5 text-xs font-bold cursor-pointer border border-neutral-700"
                        >
                          <Upload className="w-3.5 h-3.5 text-red-400" />
                          <span>{uploadingKey === `story-${st.id}` ? 'Uploading...' : 'Upload'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-neutral-400 line-clamp-2">{st.concept}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. LOOKBOOK & SOCIAL FEED */}
      {subTab === 'LOOKBOOK' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-[#12121a] border border-neutral-800 space-y-2">
            <span className="text-white font-bold text-xs uppercase text-amber-400 block">
              Social Marquee Ticker Phrases
            </span>
            <div className="space-y-1.5">
              {socialFeed.marqueePhrases.map((phrase, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={phrase}
                    onChange={(e) => {
                      const updated = [...socialFeed.marqueePhrases];
                      updated[idx] = e.target.value;
                      onUpdateSocialFeed({ ...socialFeed, marqueePhrases: updated });
                    }}
                    className="flex-1 px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = socialFeed.marqueePhrases.filter((_, i) => i !== idx);
                      onUpdateSocialFeed({ ...socialFeed, marqueePhrases: updated });
                    }}
                    className="p-1 text-neutral-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => onUpdateSocialFeed({ ...socialFeed, marqueePhrases: [...socialFeed.marqueePhrases, 'NEW RUNNING PHRASE'] })}
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-[10px] font-bold"
              >
                + Add Marquee Phrase
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-white font-bold text-xs">Customer Lookbook Fits ({lookbook.length})</span>
              <button
                type="button"
                onClick={() => {
                  const newLb: FrontPageLookbookItem = {
                    id: `lb-${Date.now()}`,
                    customerHandle: '@customer_fit',
                    location: 'City, India',
                    caption: 'Drape is unbelievable.',
                    sizeWorn: 'Size L',
                    rating: 5,
                    taggedDrop: 'Tori Streetwear Drop',
                    imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80',
                    category: 'MEN',
                    enabled: true,
                    order: lookbook.length + 1,
                  };
                  onUpdateLookbook([...lookbook, newLb]);
                  setEditingId(newLb.id);
                  showToast('Lookbook entry added.');
                }}
                className="px-2.5 py-1 bg-red-600 text-white rounded text-[11px] font-bold cursor-pointer"
              >
                + Add Lookbook Fit
              </button>
            </div>

            {lookbook.map(lb => (
              <div key={lb.id} className={`p-3 rounded-lg border space-y-3 ${lb.enabled !== false ? 'bg-neutral-900/60 border-neutral-800' : 'bg-neutral-950/60 border-neutral-900 opacity-60'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={lb.imageUrl} alt={lb.customerHandle} className="w-10 h-10 rounded-lg object-cover border border-neutral-700 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-white font-bold text-xs block truncate">{lb.customerHandle} • {lb.location} ({lb.category})</span>
                      <p className="text-[10px] text-neutral-400 line-clamp-1">{lb.caption}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUpdateLookbook(lookbook.map(l => l.id === lb.id ? { ...l, enabled: l.enabled === false } : l))}
                      className={`p-1.5 rounded border cursor-pointer ${lb.enabled !== false ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-neutral-800 text-neutral-500 bg-neutral-900'}`}
                      title={lb.enabled !== false ? 'Visible' : 'Hidden'}
                    >
                      {lb.enabled !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(editingId === lb.id ? null : lb.id)}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs cursor-pointer"
                    >
                      {editingId === lb.id ? 'Close' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateLookbook(lookbook.filter(l => l.id !== lb.id));
                        showToast('Lookbook entry removed.');
                      }}
                      className="p-1 text-neutral-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {editingId === lb.id && (
                  <div className="pt-3 border-t border-neutral-800 grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-fadeIn">
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Customer Handle</label>
                      <input
                        type="text"
                        value={lb.customerHandle}
                        onChange={(e) => onUpdateLookbook(lookbook.map(l => l.id === lb.id ? { ...l, customerHandle: e.target.value } : l))}
                        className="w-full px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Location</label>
                      <input
                        type="text"
                        value={lb.location}
                        onChange={(e) => onUpdateLookbook(lookbook.map(l => l.id === lb.id ? { ...l, location: e.target.value } : l))}
                        className="w-full px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Filter Category</label>
                      <select
                        value={lb.category}
                        onChange={(e) => onUpdateLookbook(lookbook.map(l => l.id === lb.id ? { ...l, category: e.target.value as FrontPageLookbookItem['category'] } : l))}
                        className="w-full px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                      >
                        <option value="ALL">ALL</option>
                        <option value="MEN">MEN</option>
                        <option value="KIDS">KIDS</option>
                        <option value="CAMPUS">CAMPUS</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Size Worn</label>
                      <input
                        type="text"
                        value={lb.sizeWorn}
                        onChange={(e) => onUpdateLookbook(lookbook.map(l => l.id === lb.id ? { ...l, sizeWorn: e.target.value } : l))}
                        className="w-full px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Tagged Drop</label>
                      <input
                        type="text"
                        value={lb.taggedDrop}
                        onChange={(e) => onUpdateLookbook(lookbook.map(l => l.id === lb.id ? { ...l, taggedDrop: e.target.value } : l))}
                        className="w-full px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Star Rating (1–5)</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={lb.rating}
                        onChange={(e) => onUpdateLookbook(lookbook.map(l => l.id === lb.id ? { ...l, rating: Math.min(5, Math.max(1, Number(e.target.value) || 5)) } : l))}
                        className="w-full px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Review / Fit Caption</label>
                      <textarea
                        rows={2}
                        value={lb.caption}
                        onChange={(e) => onUpdateLookbook(lookbook.map(l => l.id === lb.id ? { ...l, caption: e.target.value } : l))}
                        className="w-full p-2 bg-neutral-950 border border-neutral-700 rounded text-white text-xs resize-none"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="text-[10px] text-neutral-400 block mb-0.5">Lookbook Image (URL or Upload)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={lb.imageUrl || ''}
                          onChange={(e) => onUpdateLookbook(lookbook.map(l => l.id === lb.id ? { ...l, imageUrl: e.target.value } : l))}
                          className="flex-1 px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                        />
                        <button
                          type="button"
                          disabled={uploadingKey === `lb-${lb.id}`}
                          onClick={() => handleImageFile(url => onUpdateLookbook(lookbook.map(l => l.id === lb.id ? { ...l, imageUrl: url } : l)), `lb-${lb.id}`)}
                          className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer border border-neutral-700"
                        >
                          <Upload className="w-3 h-3 text-red-400" />
                          <span>{uploadingKey === `lb-${lb.id}` ? 'Uploading...' : 'Upload'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Tori Feed Social Posts */}
          <div className="p-3.5 rounded-xl bg-[#12121a] border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white font-bold text-xs uppercase text-amber-400">
                Tori Social Feed Snaps ({(socialFeed.posts || []).length})
              </span>
              <button
                type="button"
                onClick={() => {
                  const newPost = {
                    id: `post-${Date.now()}`,
                    handle: '@toriwear.in',
                    caption: '240 GSM Heavyweight Atelier Drop.',
                    imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
                    likes: 120,
                    platform: 'Instagram' as const,
                    linkUrl: 'https://instagram.com/toriwear.in',
                    enabled: true,
                  };
                  onUpdateSocialFeed({ ...socialFeed, posts: [...(socialFeed.posts || []), newPost] });
                  setEditingId(newPost.id);
                  showToast('Social feed snap added.');
                }}
                className="px-2.5 py-1 bg-amber-600 text-black rounded text-[11px] font-bold cursor-pointer"
              >
                + Add Social Snap
              </button>
            </div>

            <div className="space-y-2.5">
              {(socialFeed.posts || []).map((post) => (
                <div key={post.id} className={`p-3 rounded-lg border space-y-2.5 ${post.enabled !== false ? 'bg-neutral-900/70 border-neutral-800' : 'bg-neutral-950/60 border-neutral-900 opacity-60'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {post.imageUrl && (
                        <img src={post.imageUrl} alt={post.handle} className="w-10 h-10 rounded-lg object-cover border border-neutral-700 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="text-white font-bold text-xs block truncate">{post.handle} • {post.platform} ({post.likes} likes)</span>
                        <p className="text-[10px] text-neutral-400 line-clamp-1">{post.caption}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onUpdateSocialFeed({
                          ...socialFeed,
                          posts: socialFeed.posts.map(p => p.id === post.id ? { ...p, enabled: p.enabled === false } : p),
                        })}
                        className={`p-1.5 rounded border cursor-pointer ${post.enabled !== false ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-neutral-800 text-neutral-500 bg-neutral-900'}`}
                      >
                        {post.enabled !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(editingId === post.id ? null : post.id)}
                        className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs cursor-pointer"
                      >
                        {editingId === post.id ? 'Close' : 'Edit'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateSocialFeed({
                          ...socialFeed,
                          posts: socialFeed.posts.filter(p => p.id !== post.id),
                        })}
                        className="p-1 text-neutral-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {editingId === post.id && (
                    <div className="pt-2.5 border-t border-neutral-800 grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-fadeIn">
                      <div>
                        <label className="text-[10px] text-neutral-400 block mb-0.5">Handle</label>
                        <input
                          type="text"
                          value={post.handle}
                          onChange={(e) => onUpdateSocialFeed({ ...socialFeed, posts: socialFeed.posts.map(p => p.id === post.id ? { ...p, handle: e.target.value } : p) })}
                          className="w-full px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-400 block mb-0.5">Platform</label>
                        <select
                          value={post.platform}
                          onChange={(e) => onUpdateSocialFeed({ ...socialFeed, posts: socialFeed.posts.map(p => p.id === post.id ? { ...p, platform: e.target.value as 'Instagram' | 'Twitter' | 'TikTok' } : p) })}
                          className="w-full px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                        >
                          <option value="Instagram">Instagram</option>
                          <option value="Twitter">Twitter</option>
                          <option value="TikTok">TikTok</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-400 block mb-0.5">Likes Count</label>
                        <input
                          type="number"
                          min={0}
                          value={post.likes}
                          onChange={(e) => onUpdateSocialFeed({ ...socialFeed, posts: socialFeed.posts.map(p => p.id === post.id ? { ...p, likes: Math.max(0, Number(e.target.value) || 0) } : p) })}
                          className="w-full px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-[10px] text-neutral-400 block mb-0.5">Caption</label>
                        <input
                          type="text"
                          value={post.caption}
                          onChange={(e) => onUpdateSocialFeed({ ...socialFeed, posts: socialFeed.posts.map(p => p.id === post.id ? { ...p, caption: e.target.value } : p) })}
                          className="w-full px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-[10px] text-neutral-400 block mb-0.5">Target Post Link</label>
                        <input
                          type="text"
                          value={post.linkUrl}
                          onChange={(e) => onUpdateSocialFeed({ ...socialFeed, posts: socialFeed.posts.map(p => p.id === post.id ? { ...p, linkUrl: e.target.value } : p) })}
                          className="w-full px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-[10px] text-neutral-400 block mb-0.5">Snap Image (URL or Upload)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={post.imageUrl}
                            onChange={(e) => onUpdateSocialFeed({ ...socialFeed, posts: socialFeed.posts.map(p => p.id === post.id ? { ...p, imageUrl: e.target.value } : p) })}
                            className="flex-1 px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                          />
                          <button
                            type="button"
                            disabled={uploadingKey === `post-${post.id}`}
                            onClick={() => handleImageFile(url => onUpdateSocialFeed({ ...socialFeed, posts: socialFeed.posts.map(p => p.id === post.id ? { ...p, imageUrl: url } : p) }), `post-${post.id}`)}
                            className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer border border-neutral-700"
                          >
                            <Upload className="w-3 h-3 text-red-400" />
                            <span>{uploadingKey === `post-${post.id}` ? 'Uploading...' : 'Upload'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. FAQS */}
      {subTab === 'FAQS' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-neutral-900/60 p-3.5 rounded-xl border border-neutral-800">
            <div>
              <div className="text-white font-bold text-xs">Frequently Asked Questions ({faqs.length})</div>
              <div className="text-[11px] text-neutral-400">Add, categorize, reorder, toggle, or delete storefront customer FAQs.</div>
            </div>
            <button
              type="button"
              onClick={() => {
                const newFaq: FrontPageFaqItem = {
                  id: `faq-${Date.now()}`,
                  category: 'ORDERS_SHIPPING',
                  question: 'New Question?',
                  answer: 'Detailed response for customers.',
                  enabled: true,
                  order: faqs.length + 1,
                };
                onUpdateFaqs([...faqs, newFaq]);
                showToast('FAQ item added.');
              }}
              className="px-3 py-1.5 bg-red-600 text-white font-bold rounded-lg cursor-pointer"
            >
              + Add FAQ
            </button>
          </div>

          <div className="space-y-2.5">
            {[...faqs].sort((a, b) => a.order - b.order).map((faq, idx, sortedArr) => (
              <div key={faq.id} className={`p-3.5 rounded-xl border space-y-2 ${faq.enabled !== false ? 'bg-[#12121a] border-neutral-800' : 'bg-neutral-950/60 border-neutral-900 opacity-60'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <select
                    value={faq.category}
                    onChange={(e) => onUpdateFaqs(faqs.map(f => f.id === faq.id ? { ...f, category: e.target.value as FrontPageFaqItem['category'] } : f))}
                    className="px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-amber-400 text-[11px] font-bold"
                  >
                    <option value="SIZING_FABRIC">SIZING & FABRIC</option>
                    <option value="ORDERS_SHIPPING">ORDERS & SHIPPING</option>
                    <option value="RETURNS_EXCHANGES">RETURNS & EXCHANGES</option>
                    <option value="AUTHENTICITY_IP">AUTHENTICITY & IP</option>
                  </select>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => {
                        const copy = [...sortedArr];
                        const [moved] = copy.splice(idx, 1);
                        if (!moved) return;
                        copy.splice(idx - 1, 0, moved);
                        onUpdateFaqs(copy.map((item, i) => ({ ...item, order: i + 1 })));
                      }}
                      className="p-1 bg-neutral-900 border border-neutral-800 rounded text-neutral-400 hover:text-white disabled:opacity-30 cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === sortedArr.length - 1}
                      onClick={() => {
                        const copy = [...sortedArr];
                        const [moved] = copy.splice(idx, 1);
                        if (!moved) return;
                        copy.splice(idx + 1, 0, moved);
                        onUpdateFaqs(copy.map((item, i) => ({ ...item, order: i + 1 })));
                      }}
                      className="p-1 bg-neutral-900 border border-neutral-800 rounded text-neutral-400 hover:text-white disabled:opacity-30 cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateFaqs(faqs.map(f => f.id === faq.id ? { ...f, enabled: f.enabled === false } : f))}
                      className={`p-1 rounded border cursor-pointer ${faq.enabled !== false ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-neutral-800 text-neutral-500 bg-neutral-900'}`}
                      title={faq.enabled !== false ? 'Visible' : 'Hidden'}
                    >
                      {faq.enabled !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateFaqs(faqs.filter(f => f.id !== faq.id))}
                      className="p-1 text-neutral-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={faq.question}
                  onChange={(e) => onUpdateFaqs(faqs.map(f => f.id === faq.id ? { ...f, question: e.target.value } : f))}
                  className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-xs font-bold"
                />
                <textarea
                  rows={2}
                  value={faq.answer}
                  onChange={(e) => onUpdateFaqs(faqs.map(f => f.id === faq.id ? { ...f, answer: e.target.value } : f))}
                  className="w-full p-2 bg-neutral-900 border border-neutral-700 rounded text-neutral-300 text-xs resize-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. FOOTER */}
      {subTab === 'FOOTER' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#12121a] border border-neutral-800 space-y-3">
            <span className="text-white font-bold text-xs uppercase text-red-400 block">
              Storefront Footer & Contact Architecture
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-neutral-400 block mb-0.5">Brand Tagline</label>
                <input
                  type="text"
                  value={footer.brandTagline || ''}
                  onChange={(e) => onUpdateFooter({ ...footer, brandTagline: e.target.value })}
                  className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 block mb-0.5">Operating Hours</label>
                <input
                  type="text"
                  value={footer.operatingHours || ''}
                  onChange={(e) => onUpdateFooter({ ...footer, operatingHours: e.target.value })}
                  className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] text-neutral-400 block mb-0.5">About Blurb</label>
                <textarea
                  rows={2}
                  value={footer.aboutBlurb || ''}
                  onChange={(e) => onUpdateFooter({ ...footer, aboutBlurb: e.target.value })}
                  className="w-full p-2 bg-neutral-900 border border-neutral-700 rounded text-white resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 block mb-0.5">Support Email</label>
                <input
                  type="email"
                  value={footer.supportEmail || ''}
                  onChange={(e) => onUpdateFooter({ ...footer, supportEmail: e.target.value })}
                  className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 block mb-0.5">Support Phone</label>
                <input
                  type="text"
                  value={footer.supportPhone || ''}
                  onChange={(e) => onUpdateFooter({ ...footer, supportPhone: e.target.value })}
                  className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] text-neutral-400 block mb-0.5">Atelier Address</label>
                <input
                  type="text"
                  value={footer.atelierAddress || ''}
                  onChange={(e) => onUpdateFooter({ ...footer, atelierAddress: e.target.value })}
                  className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] text-neutral-400 block mb-0.5">Copyright Notice</label>
                <input
                  type="text"
                  value={footer.copyrightText || ''}
                  onChange={(e) => onUpdateFooter({ ...footer, copyrightText: e.target.value })}
                  className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                />
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="p-4 rounded-xl bg-[#12121a] border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white font-bold text-xs uppercase text-amber-400">Social Links</span>
              <button
                type="button"
                onClick={() => onUpdateFooter({
                  ...footer,
                  socialLinks: [...(footer.socialLinks || []), { platform: 'Instagram', url: 'https://instagram.com/toriwear.in', enabled: true }],
                })}
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-[11px] font-bold cursor-pointer"
              >
                + Add Social Link
              </button>
            </div>
            <div className="space-y-2">
              {(footer.socialLinks || []).map((link, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    value={link.platform}
                    onChange={(e) => {
                      const updated = [...(footer.socialLinks || [])];
                      updated[idx] = { ...link, platform: e.target.value };
                      onUpdateFooter({ ...footer, socialLinks: updated });
                    }}
                    placeholder="Platform"
                    className="sm:col-span-3 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-xs"
                  />
                  <input
                    type="text"
                    value={link.url}
                    onChange={(e) => {
                      const updated = [...(footer.socialLinks || [])];
                      updated[idx] = { ...link, url: e.target.value };
                      onUpdateFooter({ ...footer, socialLinks: updated });
                    }}
                    placeholder="https://..."
                    className="sm:col-span-7 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-xs"
                  />
                  <div className="sm:col-span-2 flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...(footer.socialLinks || [])];
                        updated[idx] = { ...link, enabled: !link.enabled };
                        onUpdateFooter({ ...footer, socialLinks: updated });
                      }}
                      className={`p-1 rounded border cursor-pointer ${link.enabled ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-neutral-800 text-neutral-500 bg-neutral-900'}`}
                    >
                      {link.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateFooter({
                        ...footer,
                        socialLinks: (footer.socialLinks || []).filter((_, i) => i !== idx),
                      })}
                      className="p-1 text-neutral-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trust Badges */}
          <div className="p-4 rounded-xl bg-[#12121a] border border-neutral-800 space-y-3">
            <span className="text-white font-bold text-xs uppercase text-emerald-400 block">
              Pre-Footer Trust Badges ({(footer.trustBadges || []).length})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(footer.trustBadges || []).map((badge, idx) => (
                <div key={badge.id || idx} className="p-3 rounded-lg bg-neutral-900/70 border border-neutral-800 space-y-2">
                  <div>
                    <label className="text-[10px] text-neutral-500 block mb-0.5">Badge Title</label>
                    <input
                      type="text"
                      value={badge.title}
                      onChange={(e) => {
                        const updated = [...(footer.trustBadges || [])];
                        updated[idx] = { ...badge, title: e.target.value };
                        onUpdateFooter({ ...footer, trustBadges: updated });
                      }}
                      className="w-full px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500 block mb-0.5">Subtitle</label>
                    <input
                      type="text"
                      value={badge.subtitle}
                      onChange={(e) => {
                        const updated = [...(footer.trustBadges || [])];
                        updated[idx] = { ...badge, subtitle: e.target.value };
                        onUpdateFooter({ ...footer, trustBadges: updated });
                      }}
                      className="w-full px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-white text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
