import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminDataContext';
import { WebsiteSection, HeroSettings } from '../types';
import {
  Layout,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Save,
  Monitor,
  Smartphone,
  Sliders,
  CheckCircle2,
  Shield,
  Upload,
  AlertCircle,
  RotateCcw,
  Download,
  Megaphone,
  FolderTree,
  BookOpen,
  Compass,
  Loader2,
} from 'lucide-react';
import { OfficialToriwearLogo, notifyBrandLogoUpdated } from '../../components/OfficialToriwearLogo';
import {
  loadFrontPageCmsData,
  saveFrontPageCmsData,
  fetchFrontPageCmsDataFromServer,
  saveFrontPageCmsDataToServer,
  flushPendingCmsSave,
  resetFrontPageCmsDataOnServer,
  normalizeFrontPageCmsData,
  uploadCmsImageAsset,
  FrontPageCmsData,
} from '../data/frontPageCmsData';
import { getSessionToken } from '../services/platformService';
import { CmsAdsManager } from './cms/CmsAdsManager';
import { CmsTabsManager } from './cms/CmsTabsManager';
import { CmsContentManager } from './cms/CmsContentManager';

export const WebsiteCMSView: React.FC = () => {
  const {
    websiteSections,
    heroSettings,
    syncCmsStateLocally,
    showToast,
  } = useAdmin();

  const [activeTab, setActiveTab] = useState<'SECTIONS' | 'HERO' | 'ADS_PROMOS' | 'TABS_NAV' | 'CONTENT_VAULT' | 'BRAND_LOCK'>('SECTIONS');
  const [cmsData, setCmsData] = useState<FrontPageCmsData>(() => loadFrontPageCmsData());
  const [sections, setSections] = useState<WebsiteSection[]>(() => {
    const loaded = loadFrontPageCmsData();
    return loaded.sections && loaded.sections.length > 0 ? loaded.sections : websiteSections;
  });
  const [hero, setHero] = useState<HeroSettings>(() => {
    const loaded = loadFrontPageCmsData();
    return loaded.hero || heroSettings;
  });
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [logoStatus, setLogoStatus] = useState<{
    exists: boolean;
    secondaryExists?: boolean;
    path?: string;
    secondaryPath?: string;
    sizeBytes: number;
    timestamp?: number;
  } | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState<'both' | 'primary' | 'secondary' | false>(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  // Keep unified ref so hero/section/tab/ad updates never overwrite each other
  const updateUnifiedCms = (updater: (prev: FrontPageCmsData) => FrontPageCmsData, persistMode: 'debounce' | 'local' = 'debounce') => {
    setCmsData((prev) => {
      const next = updater(prev);
      if (persistMode === 'debounce') {
        saveFrontPageCmsData(next);
      }
      return next;
    });
  };

  const updateHeroField = (patch: Partial<HeroSettings>) => {
    setHero((prevHero) => {
      const nextHero = { ...prevHero, ...patch };
      updateUnifiedCms((prevCms) => ({ ...prevCms, hero: nextHero }), 'debounce');
      return nextHero;
    });
  };

  // Authoritative server fetch on mount, flush pending saves on unmount/pagehide, & listen to sync status
  useEffect(() => {
    let isMounted = true;
    fetchFrontPageCmsDataFromServer()
      .then((serverData) => {
        if (isMounted && serverData) {
          setCmsData(serverData);
          if (serverData.sections && serverData.sections.length > 0) {
            setSections(serverData.sections);
          }
          if (serverData.hero) {
            setHero(serverData.hero);
          }
        }
      })
      .catch(() => {});

    const handleSyncStatus = (e: any) => {
      if (!isMounted) return;
      const status = e?.detail?.status;
      if (status) setSyncStatus(status);
      if (status === 'error') {
        setSyncError(e?.detail?.error || 'Failed to sync changes to server.');
      } else if (status === 'saved') {
        setSyncError(null);
      }
    };

    const handleSyncError = (e: any) => {
      if (!isMounted) return;
      const msg = e?.detail?.error || 'Background save failed on server.';
      setSyncStatus('error');
      setSyncError(msg);
      showToast(msg);
    };

    const handlePageHide = () => {
      flushPendingCmsSave({ keepalive: true }).catch(() => {});
    };

    window.addEventListener('tori-cms-sync-status', handleSyncStatus);
    window.addEventListener('tori-cms-sync-error', handleSyncError);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      isMounted = false;
      window.removeEventListener('tori-cms-sync-status', handleSyncStatus);
      window.removeEventListener('tori-cms-sync-error', handleSyncError);
      window.removeEventListener('pagehide', handlePageHide);
      flushPendingCmsSave({ keepalive: true }).catch(() => {});
    };
  }, []);

  const persistFullCmsToServer = async (nextData: FrontPageCmsData, successMessage: string) => {
    setIsSaving(true);
    setSyncError(null);
    const result = await saveFrontPageCmsDataToServer(nextData);
    setIsSaving(false);

    if (result.success && result.data) {
      setCmsData(result.data);
      setSections(result.data.sections);
      setHero(result.data.hero);
      syncCmsStateLocally(result.data.sections, result.data.hero);
      showToast(successMessage);
    } else {
      const errMsg = result.error || 'Failed to persist CMS changes to server.';
      setSyncError(errMsg);
      showToast(errMsg);
    }
  };

  const handleSaveAllFrontPageChanges = async () => {
    const updatedData: FrontPageCmsData = {
      ...cmsData,
      sections,
      hero,
    };
    await persistFullCmsToServer(updatedData, 'All Front Page configurations permanently saved & published!');
  };

  const handleResetDefaults = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    setConfirmReset(false);
    setIsSaving(true);
    setSyncError(null);
    const result = await resetFrontPageCmsDataOnServer();
    setIsSaving(false);

    if (result.success && result.data) {
      setCmsData(result.data);
      setSections(result.data.sections);
      setHero(result.data.hero);
      syncCmsStateLocally(result.data.sections, result.data.hero);
      showToast('Reset all front page configurations to factory defaults.');
    } else {
      const errMsg = result.error || 'Failed to reset CMS defaults on server.';
      setSyncError(errMsg);
      showToast(errMsg);
    }
  };

  const handleExportJson = () => {
    const toExport = { ...cmsData, sections, hero };
    const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `toriwear-frontpage-cms-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Exported front page CMS backup JSON.');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!parsed || typeof parsed !== 'object') {
          showToast('Invalid CMS JSON format.');
          return;
        }
        const normalized = normalizeFrontPageCmsData(parsed);
        setCmsData(normalized);
        setSections(normalized.sections);
        setHero(normalized.hero);
        await persistFullCmsToServer(normalized, 'Imported & permanently saved CMS configuration from JSON!');
      } catch (err: any) {
        showToast(err?.message || 'Failed to parse CMS JSON file.');
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleHeroImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'bgImage' | 'mobileImage' | 'leftCardImage' | 'rightCardImage',
    label: string
  ) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setUploadingField(field);
    try {
      const uploadedUrl = await uploadCmsImageAsset(file);
      const updatedHero = { ...hero, [field]: uploadedUrl };
      setHero(updatedHero);
      const next = { ...cmsData, hero: updatedHero };
      setCmsData(next);
      saveFrontPageCmsData(next);
      showToast(`${label} uploaded & staged. Click Publish to confirm.`);
    } catch (err: any) {
      showToast(err?.message || `Failed to upload ${label}.`);
    } finally {
      setUploadingField(null);
      input.value = '';
    }
  };

  const fetchLogoStatus = async () => {
    try {
      const res = await fetch('/api/brand/logo-status');
      const data = await res.json();
      if (data.success) {
        setLogoStatus(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLogoStatus();
  }, []);

  const handleLogoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'both' | 'primary' | 'secondary' = 'both'
  ) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setUploadingLogo(target);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const token = getSessionToken();
        const res = await fetch('/api/brand/upload-logo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {}),
          },
          body: JSON.stringify({ imageBase64: base64, target }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) {
          const ts = String(json.timestamp || Date.now());
          notifyBrandLogoUpdated({
            primaryUrl: json.primaryUrl,
            secondaryUrl: json.secondaryUrl,
            timestamp: ts,
          });
          window.dispatchEvent(
            new CustomEvent('tori-logo-updated', {
              detail: {
                timestamp: ts,
                primaryUrl: json.primaryUrl,
                secondaryUrl: json.secondaryUrl,
              },
            })
          );
          showToast(
            target === 'secondary'
              ? 'Scrolled Header Wordmark Logo saved permanently!'
              : target === 'primary'
              ? 'Primary Emblem Logo saved permanently!'
              : 'Brand Logo updated across Header, Footer & Storefront permanently!'
          );
          await fetchLogoStatus();
        } else {
          showToast(json.error || `Failed to save logo asset (${res.status})`);
        }
      } catch (err: any) {
        showToast(err.message || 'Upload error');
      } finally {
        setUploadingLogo(false);
        input.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleToggleSection = (id: string) => {
    const updated = sections.map((s) => (s.id === id ? { ...s, isEnabled: !s.isEnabled } : s));
    setSections(updated);
    const next = { ...cmsData, sections: updated };
    setCmsData(next);
    saveFrontPageCmsData(next);
  };

  const handleMoveSection = (index: number, direction: 'UP' | 'DOWN') => {
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;

    const updated = sections.map((s) => ({ ...s }));
    const temp = updated[index];
    const target = updated[targetIdx];
    if (!temp || !target) return;
    updated[index] = target;
    updated[targetIdx] = temp;
    updated.forEach((s, i) => {
      s.order = i + 1;
    });

    setSections(updated);
    const next = { ...cmsData, sections: updated };
    setCmsData(next);
    saveFrontPageCmsData(next);
  };

  const handleSaveSections = async () => {
    const next = { ...cmsData, sections };
    await persistFullCmsToServer(next, 'Homepage section order & visibility saved permanently!');
  };

  const handleSaveHero = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = { ...cmsData, hero };
    await persistFullCmsToServer(next, 'Hero & Spotlight scene saved permanently & published!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Layout className="w-5 h-5 text-indigo-500" />
              <span>Storefront CMS & Interactive Scene Architect</span>
            </h1>
            {syncStatus === 'saving' && (
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>SYNCING TO SERVER...</span>
              </span>
            )}
            {syncStatus === 'saved' && !syncError && (
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>SAVED ON SERVER</span>
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Configure homepage sections order, hero billboard copy, ads & banners, tabs, content hub, and master brand logos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleResetDefaults}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 cursor-pointer border disabled:opacity-50 ${
              confirmReset
                ? 'bg-red-600 hover:bg-red-500 text-white border-red-500 font-bold'
                : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border-neutral-700'
            }`}
            title="Reset all front page content to factory defaults"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${confirmReset ? 'text-white' : 'text-neutral-400'}`} />
            <span>{confirmReset ? 'Confirm Reset Defaults?' : 'Reset Defaults'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 text-xs font-mono transition flex items-center gap-1.5 cursor-pointer"
            title="Backup all front page CMS configuration as JSON"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Backup JSON</span>
          </button>

          <label className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 text-xs font-mono transition flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span>Restore JSON</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleImportJson}
              className="hidden"
            />
          </label>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveAllFrontPageChanges}
            className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-red-950/60 cursor-pointer disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'Publishing...' : 'Save All Front Page Changes'}</span>
          </button>
        </div>
      </div>

      {/* Explicit Server Error Alert Banner */}
      {syncError && (
        <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/60 text-red-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              <strong>Server Persistence Warning:</strong> {syncError}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSyncError(null)}
            className="px-2 py-0.5 rounded bg-red-900/60 hover:bg-red-800 text-white text-[10px] font-mono cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('SECTIONS')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'SECTIONS'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white bg-neutral-900'
          }`}
        >
          <Layout className="w-3.5 h-3.5" />
          <span>Sections Architecture ({sections.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('HERO')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'HERO'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white bg-neutral-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Hero &amp; Spotlight Scene</span>
        </button>

        <button
          onClick={() => setActiveTab('ADS_PROMOS')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'ADS_PROMOS'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white bg-neutral-900'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5 text-amber-400" />
          <span>Ads &amp; Banners ({cmsData.advertisements.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('TABS_NAV')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'TABS_NAV'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white bg-neutral-900'
          }`}
        >
          <FolderTree className="w-3.5 h-3.5 text-blue-400" />
          <span>Tabs &amp; Navigation ({cmsData.tabs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('CONTENT_VAULT')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'CONTENT_VAULT'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white bg-neutral-900'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
          <span>Content Hub (Realms, Lore, Characters)</span>
        </button>

        <button
          onClick={() => setActiveTab('BRAND_LOCK')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'BRAND_LOCK'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white bg-neutral-900'
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-amber-400" />
          <span>Master Logo Lock</span>
        </button>
      </div>

      {/* TAB 1: HOMEPAGE SECTIONS ARCHITECTURE */}
      {activeTab === 'SECTIONS' && (
        <div className="space-y-4">
          <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-4 text-xs text-neutral-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span>
              Use arrow buttons to rearrange the customer storefront render order. Toggle the eye icon to show or hide sections live.
            </span>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveSections}
              className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Sections Architecture</span>
            </button>
          </div>

          <div className="space-y-2">
            {sections.map((sec, idx) => {
              const displayName = sec.name || sec.title || `Section ${idx + 1}`;
              const displayDesc = sec.description || sec.key || sec.type || '';
              return (
                <div
                  key={sec.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    sec.isEnabled
                      ? 'bg-[#14141c] border-neutral-800 text-white'
                      : 'bg-neutral-950/60 border-neutral-900 text-neutral-500 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded bg-neutral-900 border border-neutral-800 flex items-center justify-center font-mono text-xs text-neutral-400 font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{displayName}</div>
                      <div className="text-[11px] text-neutral-400 font-mono truncate">{displayDesc}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(displayName.includes('Choose Your World') || sec.key === 'choose_your_world' || sec.type === 'choose_your_world' || sec.id === 'sec-4') && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('CONTENT_VAULT')}
                        className="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 font-mono text-[11px] font-bold flex items-center gap-1.5 cursor-pointer border border-red-500/30 transition shadow-sm"
                        title="Edit the 5 World cards in Content Hub"
                      >
                        <Compass className="w-3.5 h-3.5 text-red-400" />
                        <span>Edit 5 World Cards</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleSection(sec.id)}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        sec.isEnabled
                          ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                          : 'border-neutral-800 text-neutral-500 bg-neutral-900'
                      }`}
                      title={sec.isEnabled ? 'Section is Visible' : 'Section is Hidden'}
                    >
                      {sec.isEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveSection(idx, 'UP')}
                      className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      disabled={idx === sections.length - 1}
                      onClick={() => handleMoveSection(idx, 'DOWN')}
                      className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: HERO SCENE & BILLBOARD EDITOR */}
      {activeTab === 'HERO' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Form */}
          <form onSubmit={handleSaveHero} className="lg:col-span-7 bg-[#14141c] border border-neutral-800 rounded-2xl p-5 space-y-5 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div>
                <h3 className="font-bold text-white text-sm">Hero Scene &amp; Spotlight Cards Configuration</h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">Customize the main hero billboard, mobile image, scrim opacity, side spotlight boxes, and CTA buttons.</p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-600/20 text-red-400 border border-red-500/30">
                HOMEPAGE HERO
              </span>
            </div>

            {/* SECTION A: MAIN HEADLINE & BANNER */}
            <div className="space-y-3 p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <span className="font-bold text-neutral-200 text-xs uppercase tracking-wider block">
                1. Center Billboard Headline, Media &amp; Pill Tag
              </span>

              <div className="p-2.5 rounded-lg bg-neutral-950/70 border border-neutral-800 space-y-2">
                <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider block">
                  Top Pill Badge
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[10px]">
                      Tag Label
                    </label>
                    <input
                      type="text"
                      value={hero.preheaderTag ?? ''}
                      onChange={(e) => updateHeroField({ preheaderTag: e.target.value })}
                      placeholder="e.g. ORIGINAL TOKYO-INSPIRED STREETWEAR"
                      className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[10px]">
                      Red Highlight Text
                    </label>
                    <input
                      type="text"
                      value={hero.preheaderHighlight ?? ''}
                      onChange={(e) => updateHeroField({ preheaderHighlight: e.target.value })}
                      placeholder="e.g. 240 GSM"
                      className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                  Main Headline *
                </label>
                <input
                  type="text"
                  required
                  value={hero.headline ?? ''}
                  onChange={(e) => updateHeroField({ headline: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                  Sub-Headline Narrative *
                </label>
                <textarea
                  rows={2}
                  required
                  value={hero.subheadline ?? ''}
                  onChange={(e) => updateHeroField({ subheadline: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                  Desktop Background Imagery URL or Upload
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={hero.bgImage ?? ''}
                    onChange={(e) => updateHeroField({ bgImage: e.target.value })}
                    placeholder="https://... or /generated-assets/..."
                    className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                  />
                  <label className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 border border-neutral-700">
                    <Upload className="w-3.5 h-3.5 text-red-400" />
                    <span>{uploadingField === 'bgImage' ? 'Uploading...' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleHeroImageUpload(e, 'bgImage', 'Desktop background image')}
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                    Mobile Hero Imagery URL or Upload
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={hero.mobileImage ?? ''}
                      onChange={(e) => updateHeroField({ mobileImage: e.target.value })}
                      placeholder="Optional mobile crop"
                      className="flex-1 px-2.5 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                    />
                    <label className="px-2.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0 border border-neutral-700">
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>{uploadingField === 'mobileImage' ? '...' : 'Upload'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleHeroImageUpload(e, 'mobileImage', 'Mobile background image')}
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                    Backdrop Dark Scrim Opacity ({hero.overlayOpacity ?? 75}%)
                  </label>
                  <div className="flex items-center gap-3 pt-1.5">
                    <input
                      type="range"
                      min={10}
                      max={95}
                      value={hero.overlayOpacity ?? 75}
                      onChange={(e) => updateHeroField({ overlayOpacity: Number(e.target.value) })}
                      className="flex-1 accent-red-500 cursor-pointer"
                    />
                    <span className="text-xs font-mono text-neutral-300 w-10 text-right">{hero.overlayOpacity ?? 75}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION B: LEFT HERO SIDE BOX */}
            <div className="space-y-3 p-3.5 rounded-xl bg-neutral-900/60 border border-red-500/30">
              <div className="flex items-center justify-between">
                <span className="font-bold text-red-400 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  2. Left Spotlight Box (Lore 01)
                </span>
                <span className="text-[10px] font-mono text-neutral-400">Desktop Floating Box</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                    Top Badge / Tag
                  </label>
                  <input
                    type="text"
                    value={hero.leftCardTag ?? ''}
                    onChange={(e) => updateHeroField({ leftCardTag: e.target.value })}
                    placeholder="e.g. ORIGINAL LORE · 01"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                    Title / Character / Product Name
                  </label>
                  <input
                    type="text"
                    value={hero.leftCardTitle ?? ''}
                    onChange={(e) => updateHeroField({ leftCardTitle: e.target.value })}
                    placeholder="e.g. REN // DARK SHONEN"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                  Description / Story Quote
                </label>
                <textarea
                  rows={2}
                  value={hero.leftCardDesc ?? ''}
                  onChange={(e) => updateHeroField({ leftCardDesc: e.target.value })}
                  placeholder="Enter quote or product highlight"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                  Box Image URL or Upload
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={hero.leftCardImage ?? ''}
                    onChange={(e) => updateHeroField({ leftCardImage: e.target.value })}
                    placeholder="https://... or /generated-assets/..."
                    className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                  />
                  <label className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 border border-neutral-700">
                    <Upload className="w-3.5 h-3.5 text-red-400" />
                    <span>{uploadingField === 'leftCardImage' ? 'Uploading...' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleHeroImageUpload(e, 'leftCardImage', 'Left spotlight image')}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* SECTION C: RIGHT HERO SIDE BOX */}
            <div className="space-y-3 p-3.5 rounded-xl bg-neutral-900/60 border border-cyan-500/30">
              <div className="flex items-center justify-between">
                <span className="font-bold text-cyan-400 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  3. Right Spotlight Box (Lore 02)
                </span>
                <span className="text-[10px] font-mono text-neutral-400">Desktop Floating Box</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                    Top Badge / Tag
                  </label>
                  <input
                    type="text"
                    value={hero.rightCardTag ?? ''}
                    onChange={(e) => updateHeroField({ rightCardTag: e.target.value })}
                    placeholder="e.g. ORIGINAL LORE · 02"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                    Title / Character / Product Name
                  </label>
                  <input
                    type="text"
                    value={hero.rightCardTitle ?? ''}
                    onChange={(e) => updateHeroField({ rightCardTitle: e.target.value })}
                    placeholder="e.g. YUKI // CYBERPUNK"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                  Description / Story Quote
                </label>
                <textarea
                  rows={2}
                  value={hero.rightCardDesc ?? ''}
                  onChange={(e) => updateHeroField({ rightCardDesc: e.target.value })}
                  placeholder="Enter quote or product highlight"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                  Box Image URL or Upload
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={hero.rightCardImage ?? ''}
                    onChange={(e) => updateHeroField({ rightCardImage: e.target.value })}
                    placeholder="https://... or /generated-assets/..."
                    className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                  />
                  <label className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 border border-neutral-700">
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{uploadingField === 'rightCardImage' ? 'Uploading...' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleHeroImageUpload(e, 'rightCardImage', 'Right spotlight image')}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* SECTION D: HERO ACTION BUTTONS */}
            <div className="space-y-3 p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <span className="font-bold text-neutral-200 text-xs uppercase tracking-wider block">
                4. Hero Action Buttons &amp; Links
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                    Button 1 (Primary)
                  </label>
                  <input
                    type="text"
                    value={hero.ctaText ?? ''}
                    onChange={(e) => updateHeroField({ ctaText: e.target.value })}
                    placeholder="SHOP MEN"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                    Button 2 (Secondary)
                  </label>
                  <input
                    type="text"
                    value={hero.secondaryCtaText ?? ''}
                    onChange={(e) => updateHeroField({ secondaryCtaText: e.target.value })}
                    placeholder="SHOP KIDS"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                    Button 3 (Combo)
                  </label>
                  <input
                    type="text"
                    value={hero.tertiaryCtaText ?? ''}
                    onChange={(e) => updateHeroField({ tertiaryCtaText: e.target.value })}
                    placeholder="TRY TWIN COMBO 👯"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                    Primary CTA Route / Target
                  </label>
                  <input
                    type="text"
                    value={hero.ctaLink ?? '/men'}
                    onChange={(e) => updateHeroField({ ctaLink: e.target.value })}
                    placeholder="/men, /kids, or #choose-your-world-section"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                    Combo Button Badge Text
                  </label>
                  <input
                    type="text"
                    value={hero.tertiaryCtaBadge ?? 'SAVE 10%'}
                    onChange={(e) => updateHeroField({ tertiaryCtaBadge: e.target.value })}
                    placeholder="SAVE 10%"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>
            </div>

            {/* SECTION E: QUALITY & TRUST COMMITMENTS */}
            <div className="space-y-3 p-3.5 rounded-xl bg-neutral-900/60 border border-red-500/30">
              <div className="flex items-center justify-between">
                <span className="font-bold text-red-400 text-xs uppercase tracking-wider block">
                  5. Quality &amp; Trust Commitments
                </span>
                <span className="text-[10px] font-mono text-neutral-400">Strip under Buttons</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                    Badge 1 (Left)
                  </label>
                  <input
                    type="text"
                    value={hero.trustBadge1 ?? ''}
                    onChange={(e) => updateHeroField({ trustBadge1: e.target.value })}
                    placeholder="240 GSM Combed Cotton"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                    Badge 2 (Center)
                  </label>
                  <input
                    type="text"
                    value={hero.trustBadge2 ?? ''}
                    onChange={(e) => updateHeroField({ trustBadge2: e.target.value })}
                    placeholder="100% Original Japanese Anime IP"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1 text-[11px]">
                    Badge 3 (Right)
                  </label>
                  <input
                    type="text"
                    value={hero.trustBadge3 ?? ''}
                    onChange={(e) => updateHeroField({ trustBadge3: e.target.value })}
                    placeholder="Free Pan-India Delivery Over ₹999"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 cursor-pointer disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'Publishing Hero Scene...' : 'Publish Hero & Spotlight Changes'}</span>
            </button>
          </form>

          {/* Live Device Preview Frame */}
          <div className="lg:col-span-5 bg-[#14141c] border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Live Viewport Simulator
                </span>
                <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    className={`p-1.5 rounded ${previewDevice === 'desktop' ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('mobile')}
                    className={`p-1.5 rounded ${previewDevice === 'mobile' ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Viewport Frame */}
              <div
                className={`mx-auto rounded-xl overflow-hidden border border-neutral-700 relative shadow-2xl transition-all ${
                  previewDevice === 'desktop' ? 'w-full h-84' : 'w-60 h-96'
                }`}
              >
                <img
                  src={
                    (previewDevice === 'mobile' ? hero.mobileImage || hero.bgImage : hero.bgImage) ||
                    'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1600&auto=format&fit=crop&q=80'
                  }
                  alt="Hero"
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0 bg-black"
                  style={{ opacity: (hero.overlayOpacity ?? 75) / 100 }}
                />

                {/* Left Card in Preview (Desktop Only) */}
                {previewDevice === 'desktop' && (
                  <div className="absolute top-4 left-3 w-28 aspect-[3/4] rounded-lg overflow-hidden border border-neutral-800 bg-[#151515] p-2 flex flex-col justify-end text-[9px] shadow-lg">
                    <img
                      src={hero.leftCardImage || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80'}
                      alt="Left Box"
                      className="absolute inset-0 w-full h-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                    <div className="relative z-10 text-left">
                      <span className="text-[7px] font-mono text-red-500 font-bold block">{hero.leftCardTag || 'ORIGINAL LORE · 01'}</span>
                      <span className="text-[8px] font-bold text-white block uppercase truncate">{hero.leftCardTitle || 'REN // DARK SHONEN'}</span>
                    </div>
                  </div>
                )}

                {/* Right Card in Preview (Desktop Only) */}
                {previewDevice === 'desktop' && (
                  <div className="absolute top-4 right-3 w-28 aspect-[3/4] rounded-lg overflow-hidden border border-neutral-800 bg-[#151515] p-2 flex flex-col justify-end text-[9px] shadow-lg">
                    <img
                      src={hero.rightCardImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80'}
                      alt="Right Box"
                      className="absolute inset-0 w-full h-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                    <div className="relative z-10 text-left">
                      <span className="text-[7px] font-mono text-cyan-400 font-bold block">{hero.rightCardTag || 'ORIGINAL LORE · 02'}</span>
                      <span className="text-[8px] font-bold text-white block uppercase truncate">{hero.rightCardTitle || 'YUKI // CYBERPUNK'}</span>
                    </div>
                  </div>
                )}

                {/* Center Stage Preview */}
                <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-3 z-10">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-900/90 border border-neutral-800 text-[8px] font-mono font-medium text-neutral-300 uppercase mb-1">
                    <span>{hero.preheaderTag || 'ORIGINAL TOKYO-INSPIRED STREETWEAR'}</span>
                    <span className="text-neutral-600">·</span>
                    <span className="text-red-500 font-bold">{hero.preheaderHighlight || '240 GSM'}</span>
                  </div>
                  <h4 className="text-base sm:text-lg font-black text-white tracking-tight">{hero.headline}</h4>
                  <p className="text-[10px] text-neutral-300 max-w-xs mt-0.5 line-clamp-2">{hero.subheadline}</p>

                  <div className="mt-2.5 flex items-center gap-1.5 flex-wrap justify-center">
                    <div className="px-2 py-0.5 bg-white text-black rounded font-black text-[9px] tracking-wider uppercase">
                      {hero.ctaText || 'SHOP MEN'}
                    </div>
                    <div className="px-2 py-0.5 bg-neutral-900 border border-neutral-700 text-white rounded font-bold text-[9px] tracking-wider uppercase">
                      {hero.secondaryCtaText || 'SHOP KIDS'}
                    </div>
                    <div className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded font-bold text-[8px] tracking-wider uppercase">
                      {hero.tertiaryCtaText || 'TRY TWIN COMBO 👯'}
                    </div>
                  </div>

                  <div className="mt-2 text-[7px] font-mono text-neutral-400 flex items-center gap-1.5 justify-center flex-wrap">
                    <span>{hero.trustBadge1 || '240 GSM Combed Cotton'}</span>
                    <span className="text-neutral-700">·</span>
                    <span>{hero.trustBadge2 || '100% Original Japanese Anime IP'}</span>
                    <span className="text-neutral-700">·</span>
                    <span>{hero.trustBadge3 || 'Free Pan-India Delivery Over ₹999'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-neutral-400 text-center mt-3 font-mono p-2 bg-neutral-900/60 rounded-xl border border-neutral-800">
              Changes published here persist on server disk &amp; update the live storefront immediately!
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PROMOTIONAL ADS & BANNERS */}
      {activeTab === 'ADS_PROMOS' && (
        <CmsAdsManager
          ads={cmsData.advertisements}
          onUpdateAds={(updatedAds) => {
            updateUnifiedCms((prev) => ({ ...prev, advertisements: updatedAds }));
          }}
          showToast={showToast}
        />
      )}

      {/* TAB 4: EVERY TAB & NAVIGATION LINKS */}
      {activeTab === 'TABS_NAV' && (
        <CmsTabsManager
          tabs={cmsData.tabs}
          onUpdateTabs={(updatedTabs) => {
            updateUnifiedCms((prev) => ({ ...prev, tabs: updatedTabs }));
          }}
          showToast={showToast}
        />
      )}

      {/* TAB 5: COMPLETE CONTENT VAULT */}
      {activeTab === 'CONTENT_VAULT' && (
        <CmsContentManager
          realms={cmsData.realms}
          onUpdateRealms={(updatedRealms) => {
            updateUnifiedCms((prev) => ({ ...prev, realms: updatedRealms }));
          }}
          universe={cmsData.universe}
          onUpdateUniverse={(updatedUniverse) => {
            updateUnifiedCms((prev) => ({ ...prev, universe: updatedUniverse }));
          }}
          characters={cmsData.characters}
          onUpdateCharacters={(updatedChars) => {
            updateUnifiedCms((prev) => ({ ...prev, characters: updatedChars }));
          }}
          stories={cmsData.designStories}
          onUpdateStories={(updatedStories) => {
            updateUnifiedCms((prev) => ({ ...prev, designStories: updatedStories }));
          }}
          lookbook={cmsData.lookbook}
          onUpdateLookbook={(updatedLb) => {
            updateUnifiedCms((prev) => ({ ...prev, lookbook: updatedLb }));
          }}
          socialFeed={cmsData.socialFeed}
          onUpdateSocialFeed={(updatedFeed) => {
            updateUnifiedCms((prev) => ({ ...prev, socialFeed: updatedFeed }));
          }}
          faqs={cmsData.faqs}
          onUpdateFaqs={(updatedFaqs) => {
            updateUnifiedCms((prev) => ({ ...prev, faqs: updatedFaqs }));
          }}
          footer={cmsData.footer}
          onUpdateFooter={(updatedFooter) => {
            updateUnifiedCms((prev) => ({ ...prev, footer: updatedFooter }));
          }}
          showToast={showToast}
        />
      )}

      {/* TAB 6: OFFICIAL MASTER BRAND LOGO ASSET LOCK */}
      {activeTab === 'BRAND_LOCK' && (
        <div className="space-y-6 text-xs max-w-4xl">
          <div className="bg-[#14141c] border border-neutral-800 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-red-500/20 text-red-400 font-mono text-[10px] font-bold border border-red-500/30 uppercase mb-2">
                  <Shield className="w-3 h-3 text-red-500" />
                  <span>CRITICAL ASSET SPECIFICATION &amp; LOCK</span>
                </div>
                <h2 className="text-lg font-bold text-white tracking-wide">
                  TORIWEAR Official Logo Master Asset Lock
                </h2>
                <p className="text-neutral-400 text-xs mt-1 leading-relaxed max-w-2xl">
                  The uploaded image asset is locked as the immutable single source of truth for the TORIWEAR brand identity. Uploaded logos persist on disk and propagate across Header, Footer, and Admin views.
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] font-mono text-neutral-400 block">ACTIVE PATH:</span>
                <code className="text-red-400 font-mono text-[11px] bg-black/60 px-2 py-1 rounded border border-neutral-800 block mt-1">
                  {logoStatus?.path || '/assets/branding/toriwear-official-logo.png'}
                </code>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-neutral-800 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-4">
                <div className="bg-black/80 border border-neutral-800 rounded-xl p-6 flex flex-col items-center justify-center min-h-[180px]">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">
                    Primary Brand Emblem (Top Header, Hero &amp; Footer)
                  </span>
                  <OfficialToriwearLogo
                    variant="primary"
                    className="max-h-32 w-auto object-contain drop-shadow-xl"
                  />
                </div>

                <div className="bg-black/80 border border-neutral-800 rounded-xl p-5 flex flex-col items-center justify-center min-h-[120px]">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">
                    Secondary Scrolled Wordmark (Sticky Header on Scroll)
                  </span>
                  <OfficialToriwearLogo
                    variant="secondary"
                    className="max-h-16 w-auto object-contain drop-shadow-xl"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-300">Disk Asset Status</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        logoStatus?.exists
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {logoStatus?.exists ? 'VERIFIED ON DISK' : 'PENDING MASTER UPLOAD'}
                    </span>
                  </div>
                  {logoStatus?.exists && (
                    <div className="text-[11px] text-neutral-400 font-mono">
                      File Size: {(logoStatus.sizeBytes / 1024).toFixed(1)} KB
                    </div>
                  )}
                  <p className="text-[11px] text-neutral-400 leading-normal">
                    Uploaded logos are persisted directly to static disk &amp; store settings so changes stay locked across server restarts and logins.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/40 space-y-2">
                  <span className="font-semibold text-white block">
                    Upload &amp; Sync Brand Logo Everywhere (Primary + Scrolled)
                  </span>
                  <p className="text-[11px] text-neutral-400">
                    Replaces both your Primary Emblem and Scrolled Header Wordmark at once so the old logo never reappears on scroll or login.
                  </p>
                  <label className="mt-2 inline-flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs cursor-pointer transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingLogo === 'both' ? 'Saving to Disk...' : 'Upload Logo Everywhere'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(e) => handleLogoUpload(e, 'both')}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-bold text-[11px] cursor-pointer border border-neutral-700 transition">
                    <Upload className="w-3.5 h-3.5 text-red-400" />
                    <span>{uploadingLogo === 'primary' ? 'Saving...' : 'Primary Emblem Only'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(e) => handleLogoUpload(e, 'primary')}
                      className="hidden"
                    />
                  </label>

                  <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-bold text-[11px] cursor-pointer border border-neutral-700 transition">
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>{uploadingLogo === 'secondary' ? 'Saving...' : 'Scrolled Wordmark Only'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(e) => handleLogoUpload(e, 'secondary')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#14141c] border border-neutral-800 space-y-2">
              <span className="font-bold text-white text-xs block">Brand Typography Systems</span>
              <ul className="space-y-1 text-neutral-400 text-[11px]">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span><strong>Brand Display:</strong> Bebas Neue, Arial Black, Impact</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span><strong>Body UI:</strong> Inter, Helvetica Neue, sans-serif</span>
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-[#14141c] border border-neutral-800 space-y-2">
              <span className="font-bold text-white text-xs block">Pixel-Faithful Rules</span>
              <ul className="space-y-1 text-neutral-400 text-[11px]">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Zero AI regeneration or font recreation</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Proportional scaling only (no cropping or stretching)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
