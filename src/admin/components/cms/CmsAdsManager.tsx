import React, { useState } from 'react';
import {
  Megaphone,
  Plus,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  Upload,
} from 'lucide-react';
import { FrontPageAdvertisement, uploadCmsImageAsset } from '../../data/frontPageCmsData';

interface CmsAdsManagerProps {
  ads: FrontPageAdvertisement[];
  onUpdateAds: (updated: FrontPageAdvertisement[]) => void;
  showToast: (msg: string) => void;
}

export const CmsAdsManager: React.FC<CmsAdsManagerProps> = ({ ads, onUpdateAds, showToast }) => {
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const [uploadingAdId, setUploadingAdId] = useState<string | null>(null);
  const [uploadingNewModal, setUploadingNewModal] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newAdForm, setNewAdForm] = useState<Partial<FrontPageAdvertisement>>({
    title: 'New Promotional Campaign',
    type: 'IN_FEED_AD',
    enabled: true,
    headline: 'SPECIAL CAPSULE OFFER',
    tagline: 'Limited time drop promotion',
    description: 'Exclusive 240 GSM heavyweight cotton streetwear discount.',
    badge: 'LIMITED DROP',
    promoCode: 'TORI20',
    discountValue: '20% OFF',
    imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
    linkUrl: '/men',
    ctaText: 'CLAIM OFFER →',
  });

  const handleToggle = (id: string) => {
    const updated = ads.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
    onUpdateAds(updated);
    showToast('Ad visibility updated.');
  };

  const handleDelete = (id: string) => {
    const updated = ads.filter(a => a.id !== id);
    onUpdateAds(updated);
    showToast('Advertisement deleted.');
  };

  const handleFieldChange = (id: string, field: keyof FrontPageAdvertisement, val: any) => {
    const updated = ads.map(a => a.id === id ? { ...a, [field]: val } : a);
    onUpdateAds(updated);
  };

  const handleCreateNewAd = (e: React.FormEvent) => {
    e.preventDefault();
    const newAd: FrontPageAdvertisement = {
      id: `ad-${Date.now()}`,
      title: newAdForm.title || 'Promotional Banner',
      type: newAdForm.type || 'IN_FEED_AD',
      enabled: newAdForm.enabled ?? true,
      headline: newAdForm.headline || '',
      tagline: newAdForm.tagline || '',
      description: newAdForm.description || '',
      badge: newAdForm.badge || '',
      promoCode: newAdForm.promoCode || '',
      discountValue: newAdForm.discountValue || '',
      imageUrl: newAdForm.imageUrl || '',
      linkUrl: newAdForm.linkUrl || '',
      ctaText: newAdForm.ctaText || 'SHOP NOW',
      bgColor: newAdForm.bgColor || undefined,
      textColor: newAdForm.textColor || undefined,
    };
    onUpdateAds([...ads, newAd]);
    setShowNewModal(false);
    showToast('New advertisement created!');
  };

  return (
    <div className="space-y-5 text-xs font-mono">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
        <div>
          <div className="flex items-center gap-2 text-white font-bold text-sm font-sans">
            <Megaphone className="w-4 h-4 text-red-500" />
            <span>Storefront Promotional Ads & Banners Suite ({ads.length})</span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Full pin-to-pin control: Edit copy, promo codes, banners, placement, toggle active status, add, or delete any advertisement.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm shadow-red-950/40"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Ad / Banner</span>
        </button>
      </div>

      {/* Ads List */}
      <div className="space-y-3.5">
        {ads.map((ad) => {
          const isExpanded = editingAdId === ad.id;

          return (
            <div 
              key={ad.id}
              className={`p-4 rounded-xl border transition-all ${
                ad.enabled 
                  ? 'bg-[#12121a] border-neutral-800' 
                  : 'bg-neutral-950/60 border-neutral-900 opacity-60'
              }`}
            >
              {/* Ad Bar Header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0">
                    <Megaphone className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-bold text-xs truncate flex items-center gap-2">
                      <span>{ad.title}</span>
                      <span className="px-2 py-0.2 rounded text-[9px] bg-red-950/80 text-red-400 border border-red-800/80">
                        {ad.type}
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5 truncate">
                      Headline: <span className="text-neutral-200">"{ad.headline || ad.title}"</span>
                      {ad.promoCode && ` • Code: ${ad.promoCode}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggle(ad.id)}
                    className={`p-1.5 rounded-lg border transition cursor-pointer ${
                      ad.enabled 
                        ? 'border-emerald-500/40 text-emerald-400 bg-emerald-950/30' 
                        : 'border-neutral-800 text-neutral-500 bg-neutral-900'
                    }`}
                    title={ad.enabled ? 'Ad is Live on Storefront' : 'Ad is Hidden'}
                  >
                    {ad.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingAdId(isExpanded ? null : ad.id)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                      isExpanded 
                        ? 'bg-neutral-200 text-neutral-900 border-white' 
                        : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white'
                    }`}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{isExpanded ? 'Done Editing' : 'Edit Pin-to-Pin'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(ad.id)}
                    className="p-1.5 rounded-lg bg-neutral-900 hover:bg-red-950 text-neutral-500 hover:text-red-400 border border-neutral-800 hover:border-red-900/60 transition cursor-pointer"
                    title="Delete Advertisement"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Pin-to-Pin Detail Edit Panel */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-neutral-800 grid grid-cols-1 md:grid-cols-2 gap-3.5 animate-fadeIn">
                  <div>
                    <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">
                      Ad Campaign Title (Admin Name)
                    </label>
                    <input
                      type="text"
                      value={ad.title}
                      onChange={(e) => handleFieldChange(ad.id, 'title', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">
                      Ad Type / Placement Format
                    </label>
                    <select
                      value={ad.type}
                      onChange={(e) => handleFieldChange(ad.id, 'type', e.target.value as any)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-xs focus:outline-none focus:border-red-500"
                    >
                      <option value="TOP_ANNOUNCEMENT">Top Sticky Announcement Ticker</option>
                      <option value="POPUP_MODAL">Floating Welcome / Promo Popup</option>
                      <option value="TWINNING_SPOTLIGHT">Twinning Spotlight Duo Ad</option>
                      <option value="SALE_BANNER">Mid-Page Sale Billboard Strip</option>
                      <option value="IN_FEED_AD">In-Feed Custom Promotional Ad</option>
                      <option value="FOOTER_BANNER">Pre-Footer Guarantee Banner</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">
                      Headline / Announcement Ticker Copy
                    </label>
                    <input
                      type="text"
                      value={ad.headline || ''}
                      onChange={(e) => handleFieldChange(ad.id, 'headline', e.target.value)}
                      placeholder="e.g. FREE SHIPPING OVER ₹999 | COD AVAILABLE"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">
                      Sub-Headline / Tagline
                    </label>
                    <input
                      type="text"
                      value={ad.tagline || ''}
                      onChange={(e) => handleFieldChange(ad.id, 'tagline', e.target.value)}
                      placeholder="e.g. Claim flat 15% off duo sets"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">
                      Badge Text / Discount Value
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={ad.badge || ''}
                        onChange={(e) => handleFieldChange(ad.id, 'badge', e.target.value)}
                        placeholder="e.g. LIMITED TIME"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-xs focus:outline-none focus:border-red-500"
                      />
                      <input
                        type="text"
                        value={ad.discountValue || ''}
                        onChange={(e) => handleFieldChange(ad.id, 'discountValue', e.target.value)}
                        placeholder="e.g. ₹100 OFF"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-xs focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">
                      Promo Code (If applicable)
                    </label>
                    <input
                      type="text"
                      value={ad.promoCode || ''}
                      onChange={(e) => handleFieldChange(ad.id, 'promoCode', e.target.value.toUpperCase())}
                      placeholder="e.g. TORI100"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-xs uppercase focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">
                      CTA Button Text & Target Link
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={ad.ctaText || ''}
                        onChange={(e) => handleFieldChange(ad.id, 'ctaText', e.target.value)}
                        placeholder="e.g. SHOP NOW"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-xs focus:outline-none focus:border-red-500"
                      />
                      <input
                        type="text"
                        value={ad.linkUrl || ''}
                        onChange={(e) => handleFieldChange(ad.id, 'linkUrl', e.target.value)}
                        placeholder="e.g. /men"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-xs focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">
                      Ad Creative / Image URL or Upload
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={ad.imageUrl || ''}
                        onChange={(e) => handleFieldChange(ad.id, 'imageUrl', e.target.value)}
                        placeholder="https://... or /generated-assets/..."
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-xs focus:outline-none focus:border-red-500"
                      />
                      <label className={`px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 border border-neutral-700 ${uploadingAdId === ad.id ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}>
                        <Upload className="w-3 h-3 text-red-400" />
                        <span>{uploadingAdId === ad.id ? 'Uploading...' : 'Upload'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingAdId === ad.id}
                          className="hidden"
                          onChange={async (e) => {
                            const inputEl = e.currentTarget;
                            const file = inputEl.files?.[0];
                            if (!file) return;
                            setUploadingAdId(ad.id);
                            try {
                              const url = await uploadCmsImageAsset(file);
                              handleFieldChange(ad.id, 'imageUrl', url);
                              showToast('Ad creative uploaded to server.');
                            } catch (err: any) {
                              showToast(err?.message || 'Upload failed.');
                            } finally {
                              setUploadingAdId(null);
                              inputEl.value = '';
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">
                      Background Color (Optional)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={ad.bgColor && /^#[0-9a-fA-F]{6}$/.test(ad.bgColor) ? ad.bgColor : '#FF2028'}
                        onChange={(e) => handleFieldChange(ad.id, 'bgColor', e.target.value)}
                        className="w-9 h-8 rounded bg-neutral-900 border border-neutral-700 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={ad.bgColor || ''}
                        onChange={(e) => handleFieldChange(ad.id, 'bgColor', e.target.value)}
                        placeholder="#FF2028"
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-xs font-mono focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">
                      Text Color (Optional)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={ad.textColor && /^#[0-9a-fA-F]{6}$/.test(ad.textColor) ? ad.textColor : '#FFFFFF'}
                        onChange={(e) => handleFieldChange(ad.id, 'textColor', e.target.value)}
                        className="w-9 h-8 rounded bg-neutral-900 border border-neutral-700 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={ad.textColor || ''}
                        onChange={(e) => handleFieldChange(ad.id, 'textColor', e.target.value)}
                        placeholder="#FFFFFF"
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-xs font-mono focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">
                      Long Promotional Description (Popup / Spotlight)
                    </label>
                    <textarea
                      rows={2}
                      value={ad.description || ''}
                      onChange={(e) => handleFieldChange(ad.id, 'description', e.target.value)}
                      className="w-full p-2.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-xs focus:outline-none focus:border-red-500 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New Ad Creation Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#101018] border border-neutral-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <span className="font-bold text-white text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-red-400" />
                <span>Create New Front Page Advertisement</span>
              </span>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewAd} className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-[10px] text-neutral-400 uppercase font-bold mb-1">Campaign Title</label>
                <input
                  type="text"
                  required
                  value={newAdForm.title || ''}
                  onChange={(e) => setNewAdForm({ ...newAdForm, title: e.target.value })}
                  className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-neutral-400 uppercase font-bold mb-1">Ad Placement</label>
                  <select
                    value={newAdForm.type || 'IN_FEED_AD'}
                    onChange={(e) => setNewAdForm({ ...newAdForm, type: e.target.value as any })}
                    className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs"
                  >
                    <option value="IN_FEED_AD">In-Feed Promotional Banner</option>
                    <option value="TOP_ANNOUNCEMENT">Top Sticky Announcement Ticker</option>
                    <option value="POPUP_MODAL">Welcome Modal Popup</option>
                    <option value="TWINNING_SPOTLIGHT">Twinning Spotlight Duo Ad</option>
                    <option value="SALE_BANNER">Sale Strip Billboard</option>
                    <option value="FOOTER_BANNER">Pre-Footer Guarantee Banner</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-400 uppercase font-bold mb-1">Badge Tag</label>
                  <input
                    type="text"
                    value={newAdForm.badge || ''}
                    onChange={(e) => setNewAdForm({ ...newAdForm, badge: e.target.value })}
                    placeholder="e.g. LIMITED DROP"
                    className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 uppercase font-bold mb-1">Headline</label>
                <input
                  type="text"
                  value={newAdForm.headline || ''}
                  onChange={(e) => setNewAdForm({ ...newAdForm, headline: e.target.value })}
                  placeholder="e.g. FLASH WEEKEND DROP"
                  className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 uppercase font-bold mb-1">Tagline / Subtitle</label>
                <input
                  type="text"
                  value={newAdForm.tagline || ''}
                  onChange={(e) => setNewAdForm({ ...newAdForm, tagline: e.target.value })}
                  placeholder="e.g. Limited time capsule offer"
                  className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-neutral-400 uppercase font-bold mb-1">Promo Code</label>
                  <input
                    type="text"
                    value={newAdForm.promoCode || ''}
                    onChange={(e) => setNewAdForm({ ...newAdForm, promoCode: e.target.value.toUpperCase() })}
                    placeholder="e.g. TORI20"
                    className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-400 uppercase font-bold mb-1">Discount Value</label>
                  <input
                    type="text"
                    value={newAdForm.discountValue || ''}
                    onChange={(e) => setNewAdForm({ ...newAdForm, discountValue: e.target.value })}
                    placeholder="e.g. 20% OFF"
                    className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-neutral-400 uppercase font-bold mb-1">CTA Button Text</label>
                  <input
                    type="text"
                    value={newAdForm.ctaText || ''}
                    onChange={(e) => setNewAdForm({ ...newAdForm, ctaText: e.target.value })}
                    placeholder="CLAIM OFFER →"
                    className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-400 uppercase font-bold mb-1">Target Link URL</label>
                  <input
                    type="text"
                    value={newAdForm.linkUrl || ''}
                    onChange={(e) => setNewAdForm({ ...newAdForm, linkUrl: e.target.value })}
                    placeholder="/men"
                    className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 uppercase font-bold mb-1">Creative Image URL or Upload</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newAdForm.imageUrl || ''}
                    onChange={(e) => setNewAdForm({ ...newAdForm, imageUrl: e.target.value })}
                    placeholder="https://... or /generated-assets/..."
                    className="flex-1 px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs"
                  />
                  <label className={`px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 border border-neutral-700 shrink-0 ${uploadingNewModal ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}>
                    <Upload className="w-3 h-3 text-red-400" />
                    <span>{uploadingNewModal ? 'Uploading...' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingNewModal}
                      className="hidden"
                      onChange={async (e) => {
                        const inputEl = e.currentTarget;
                        const file = inputEl.files?.[0];
                        if (!file) return;
                        setUploadingNewModal(true);
                        try {
                          const url = await uploadCmsImageAsset(file);
                          setNewAdForm((prev) => ({ ...prev, imageUrl: url }));
                          showToast('Ad creative uploaded to server.');
                        } catch (err: any) {
                          showToast(err?.message || 'Upload failed.');
                        } finally {
                          setUploadingNewModal(false);
                          inputEl.value = '';
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={newAdForm.enabled ?? true}
                  onChange={(e) => setNewAdForm({ ...newAdForm, enabled: e.target.checked })}
                  className="rounded border-neutral-700 bg-neutral-900 text-red-600"
                />
                <span>Enable immediately on storefront</span>
              </label>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer"
                >
                  Create Advertisement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
