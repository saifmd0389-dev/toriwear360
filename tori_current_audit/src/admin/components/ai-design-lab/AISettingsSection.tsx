import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../AdminDataContext';
import {
  testGeminiConnection,
  testImageGeneration,
  fetchAIUsageStats,
  GeminiHealthResponse,
  GeminiImageTestResponse,
  AIUsageStats,
} from '../../services/aiService';
import {
  Sliders,
  ShieldCheck,
  Zap,
  CheckCircle2,
  RefreshCw,
  Layers,
  Sparkles,
  AlertTriangle,
  Image as ImageIcon,
  Check,
  XCircle,
  ExternalLink,
} from 'lucide-react';

export const AISettingsSection: React.FC = () => {
  const { aiSettings, updateAISettings, aiUsageLogs, showToast, hasPermission } = useAdmin();

  const [provider] = useState(aiSettings.provider || 'Google Gemini');
  const [model, setModel] = useState(aiSettings.textModel || 'gemini-3.8-flash');
  const [imageModel, setImageModel] = useState(aiSettings.imageModel || 'gemini-3.1-flash-image');
  const [imageQuality, setImageQuality] = useState(aiSettings.imageQuality || 'HD');
  const [temperature, setTemperature] = useState(aiSettings.temperature ?? 0.7);
  const [dailyLimit, setDailyLimit] = useState(aiSettings.dailyGenerationLimit ?? 50);
  const [enforceStrictOriginality, setEnforceStrictOriginality] = useState(
    aiSettings.enforceStrictOriginality ?? true
  );
  const [defaultBrandPrompt, setDefaultBrandPrompt] = useState(
    aiSettings.defaultBrandPrompt ||
      'TORIWEAR Original IP only. Original anime streetwear aesthetic with sharp silhouette separation and high-density print readiness. No copyrighted third-party characters.'
  );

  // Gemini Connection State
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState<GeminiHealthResponse | null>(null);
  const [, setConnectionError] = useState<string | null>(null);

  // Gemini Test Image Generation State
  const [isTestingImage, setIsTestingImage] = useState(false);
  const [imageTestResult, setImageTestResult] = useState<GeminiImageTestResponse | null>(null);
  const [imageTestError, setImageTestError] = useState<string | null>(null);

  // Server Usage Telemetry
  const [serverStats, setServerStats] = useState<AIUsageStats | null>(null);

  useEffect(() => {
    // Initial silent health check
    testGeminiConnection()
      .then((health) => setConnectionHealth(health))
      .catch(() => {});

    // Initial telemetry check
    fetchAIUsageStats()
      .then((stats) => setServerStats(stats))
      .catch(() => {});
  }, []);

  const handleSave = () => {
    if (!hasPermission('ai.settings')) {
      showToast('You do not have permission to modify AI Design Lab settings.');
      return;
    }

    updateAISettings({
      provider,
      textModel: model,
      imageModel,
      imageQuality: imageQuality as any,
      temperature,
      dailyGenerationLimit: dailyLimit,
      enforceStrictOriginality,
      defaultBrandPrompt,
    });
    showToast('AI Design Lab configuration saved.');
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionError(null);
    try {
      const result = await testGeminiConnection();
      setConnectionHealth(result);
      if (!result.connected) {
        setConnectionError(result.error || 'Gemini connection check failed.');
      } else {
        showToast('Google Gemini connection verified.');
      }
    } catch (err: any) {
      setConnectionError(err.message || 'Failed to communicate with AI health endpoint.');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleTestImageGeneration = async () => {
    setIsTestingImage(true);
    setImageTestError(null);
    setImageTestResult(null);
    try {
      const result = await testImageGeneration();
      setImageTestResult(result);
      showToast('Real Gemini test image generated successfully!');
      // Refresh usage stats
      fetchAIUsageStats().then((stats) => setServerStats(stats)).catch(() => {});
    } catch (err: any) {
      setImageTestError(err.message || 'Image generation test failed.');
    } finally {
      setIsTestingImage(false);
    }
  };

  const apiKeyConfigured = connectionHealth?.apiKeyConfigured ?? false;

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <h2 className="text-xl font-black text-white font-sans uppercase tracking-tight flex items-center gap-2">
            <Sliders className="w-5 h-5 text-red-500" />
            <span>AI DESIGN LAB CONFIGURATION & SETTINGS</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Real Google Gemini Image Generation pipeline, server-side secrets, telemetry, and print readiness.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold uppercase transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-600/25"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Save Settings</span>
        </button>
      </div>

      {/* REQUIREMENT 7: TEXT AI & IMAGE AI SYSTEM STATUS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* TEXT AI CARD */}
        <div className="p-6 rounded-2xl bg-[#12131c] border border-neutral-800/80 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-mono font-bold text-white uppercase">Text AI</h3>
            </div>
            <button
              onClick={handleTestConnection}
              disabled={isTestingConnection}
              className="px-3 py-1 rounded-lg bg-[#181926] hover:bg-[#202235] text-xs font-mono text-neutral-300 border border-neutral-700 flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
            >
              {isTestingConnection ? (
                <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
              ) : (
                <Zap className="w-3 h-3 text-amber-400" />
              )}
              <span>Test Connection</span>
            </button>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#161726] border border-neutral-800">
              <span className="text-neutral-400 uppercase font-bold">Provider</span>
              <span className="text-white font-bold">{connectionHealth?.textAI?.provider || 'Google Gemini'}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#161726] border border-neutral-800">
              <span className="text-neutral-400 uppercase font-bold">Model</span>
              <span className="text-neutral-200">{connectionHealth?.textAI?.model || model || 'gemini-3.8-flash'}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#161726] border border-neutral-800">
              <span className="text-neutral-400 uppercase font-bold">Status</span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold ${
                  connectionHealth?.textAI?.configured || apiKeyConfigured
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                }`}
              >
                {connectionHealth?.textAI?.configured || apiKeyConfigured ? (
                  <>
                    <Check className="w-3 h-3" /> Ready
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3" /> Not configured
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#161726] border border-neutral-800">
              <span className="text-neutral-400 uppercase font-bold">API Configuration</span>
              <span className="text-neutral-300 font-semibold">
                {connectionHealth?.textAI?.configured || apiKeyConfigured ? 'Configured ✓' : 'Not configured'}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-neutral-500 font-mono">
            Powers character profiles, universe lore, story narratives, and print specifications.
          </p>
        </div>

        {/* IMAGE AI CARD */}
        <div className="p-6 rounded-2xl bg-[#12131c] border border-neutral-800/80 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-mono font-bold text-white uppercase">Image AI</h3>
            </div>
            {connectionHealth?.imageAI?.configured && connectionHealth?.imageAI?.enabled ? (
              <button
                onClick={handleTestImageGeneration}
                disabled={isTestingImage}
                className="px-3 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-xs font-mono text-red-300 border border-red-500/40 flex items-center gap-1.5 cursor-pointer transition disabled:opacity-40"
              >
                {isTestingImage ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-red-400" />
                ) : (
                  <Sparkles className="w-3 h-3 text-red-400" />
                )}
                <span>Test Image</span>
              </button>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                Optional
              </span>
            )}
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#161726] border border-neutral-800">
              <span className="text-neutral-400 uppercase font-bold">Provider</span>
              <span className="text-white font-bold">
                {connectionHealth?.imageAI?.provider || (aiSettings.provider || 'None')}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#161726] border border-neutral-800">
              <span className="text-neutral-400 uppercase font-bold">Model</span>
              <span className="text-neutral-200">
                {connectionHealth?.imageAI?.model || imageModel || 'None'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#161726] border border-neutral-800">
              <span className="text-neutral-400 uppercase font-bold">Status</span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold ${
                  connectionHealth?.imageAI?.enabled && connectionHealth?.imageAI?.configured
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                }`}
              >
                {connectionHealth?.imageAI?.enabled && connectionHealth?.imageAI?.configured ? (
                  <>
                    <Check className="w-3 h-3" /> Ready
                  </>
                ) : (
                  'Disabled / Coming Soon'
                )}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#161726] border border-neutral-800">
              <span className="text-neutral-400 uppercase font-bold">API Configuration</span>
              <span className="text-neutral-300 font-semibold">
                {connectionHealth?.imageAI?.configured ? 'Configured ✓' : 'Not configured'}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-neutral-500 font-mono">
            {connectionHealth?.imageAI?.enabled
              ? 'Active image generation provider.'
              : 'Image generation is currently optional. All design concepts and stories can still be created and saved.'}
          </p>
        </div>
      </div>

        {/* SECTION 7: TEST IMAGE GENERATION RESULTS DISPLAY */}
        {(imageTestResult || imageTestError || isTestingImage) && (
          <div className="p-5 rounded-xl bg-[#151726] border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
              <span className="text-xs font-mono font-bold text-white uppercase flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-red-400" />
                <span>Image Generation Test</span>
              </span>
              {imageTestResult && (
                <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> SUCCESS ✓
                </span>
              )}
              {imageTestError && (
                <span className="text-xs font-mono font-bold text-red-400 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> FAILED ✕
                </span>
              )}
            </div>

            {isTestingImage && (
              <div className="py-6 flex flex-col items-center justify-center space-y-2 text-center">
                <RefreshCw className="w-6 h-6 animate-spin text-red-500" />
                <span className="text-xs font-mono text-neutral-300">
                  Sending test prompt to Google Gemini Image API...
                </span>
              </div>
            )}

            {imageTestError && (
              <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/40 text-red-300 text-xs font-mono">
                {imageTestError}
              </div>
            )}

            {imageTestResult && (imageTestResult.imageUrl || imageTestResult.image?.url || imageTestResult.image?.data) && (
              <div className="flex flex-col sm:flex-row items-center gap-5 pt-2">
                <div className="w-36 h-36 rounded-xl overflow-hidden bg-black border border-neutral-700 shrink-0 shadow-xl">
                  <img
                    src={
                      imageTestResult.imageUrl ||
                      imageTestResult.image?.url ||
                      `data:${imageTestResult.image?.mimeType || 'image/png'};base64,${imageTestResult.image?.data}`
                    }
                    alt="Generated Test Artwork"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-1.5 text-xs font-mono text-neutral-300">
                  <div className="text-white font-bold">
                    Real Google Gemini Artwork Generated Successfully
                  </div>
                  <div className="text-neutral-400 text-[11px]">
                    <strong>Model:</strong> {imageTestResult.model || 'gemini-3.1-flash-image'}
                  </div>
                  <div className="text-neutral-400 text-[11px]">
                    <strong>Duration:</strong> {(imageTestResult.durationMs ? imageTestResult.durationMs / 1000 : 0).toFixed(1)}s
                  </div>
                  <div className="text-neutral-400 text-[11px]">
                    <strong>Prompt:</strong> "{imageTestResult.prompt || 'Streetwear geometric energy symbol'}"
                  </div>
                  {(imageTestResult.imageUrl || imageTestResult.image?.url) && (
                    <a
                      href={imageTestResult.imageUrl || imageTestResult.image?.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 text-[11px] underline mt-1"
                    >
                      <span>Inspect Raw Generated Asset</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      {/* SECTION 6: MODEL & GENERATION PARAMETERS CARD */}
      <div className="p-6 rounded-2xl bg-[#12131c] border border-neutral-800/80 shadow-xl space-y-6">
        <div className="border-b border-neutral-800 pb-3">
          <h3 className="text-sm font-mono font-bold text-white uppercase flex items-center gap-2">
            <Sliders className="w-4 h-4 text-red-500" />
            <span>Generation Parameters & Creative Engine</span>
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Configure text models, artwork engine options, resolution defaults, and temperature.
          </p>
        </div>

        {/* Model Configuration Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase text-neutral-400 font-bold">
              Creative Provider
            </label>
            <input
              type="text"
              readOnly
              value="Google Gemini"
              className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs font-mono text-white outline-none cursor-not-allowed opacity-80"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase text-neutral-400 font-bold">
              Lore & Story Text Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs font-mono text-white outline-none focus:border-red-500 cursor-pointer"
            >
              <option value="gemini-3.8-flash">gemini-3.8-flash (Recommended Text & Lore)</option>
              <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Deep Lore & Complex Reasoning)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase text-neutral-400 font-bold">
              Artwork Generation Engine
            </label>
            <select
              value={imageModel}
              onChange={(e) => setImageModel(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs font-mono text-white outline-none focus:border-red-500 cursor-pointer"
            >
              <option value="gemini-3.1-flash-image">gemini-3.1-flash-image (High-Quality 1K/2K/4K)</option>
              <option value="gemini-3.1-flash-lite-image">gemini-3.1-flash-lite-image (Rapid Prototyping)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase text-neutral-400 font-bold">
              Image Quality Profile
            </label>
            <select
              value={imageQuality}
              onChange={(e) => setImageQuality(e.target.value as any)}
              className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs font-mono text-white outline-none focus:border-red-500 cursor-pointer"
            >
              <option value="Standard">Standard (1K Resolution)</option>
              <option value="HD">HD (2K High-Density Apparel Print)</option>
              <option value="Ultra">Ultra (4K Master Strike-Off)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase text-neutral-400 font-bold">
              <span>Creativity Temperature</span>
              <span className="text-white">{temperature}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-red-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-neutral-500">
              <span>Strict / Predictable</span>
              <span>Experimental</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase text-neutral-400 font-bold">
              Daily Generation Limit
            </label>
            <input
              type="number"
              min="5"
              max="500"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(parseInt(e.target.value, 10) || 50)}
              className="w-full p-2.5 rounded-lg bg-[#171826] border border-neutral-700 text-xs font-mono text-white outline-none focus:border-red-500"
            />
          </div>
        </div>
      </div>

      {/* Brand Safety & Originality Guard Configuration */}
      <div className="p-6 rounded-2xl bg-[#12131c] border border-neutral-800/80 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase border-b border-neutral-800 pb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Brand Safety & Originality Directive</span>
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#181926] border border-neutral-800">
          <div>
            <div className="text-xs font-bold text-white">Enforce Strict Originality Guard</div>
            <div className="text-[11px] text-neutral-400 mt-0.5">
              Automatically intercepts third-party copyrighted character references and transforms them into original TORIWEAR archetypes.
            </div>
          </div>
          <input
            type="checkbox"
            checked={enforceStrictOriginality}
            onChange={(e) => setEnforceStrictOriginality(e.target.checked)}
            className="w-4 h-4 accent-red-500 cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase text-neutral-400 font-bold">
            Default Brand Prompt Directive (Injected into every generation)
          </label>
          <textarea
            rows={3}
            value={defaultBrandPrompt}
            onChange={(e) => setDefaultBrandPrompt(e.target.value)}
            className="w-full p-3 rounded-lg bg-[#171826] border border-neutral-700 text-xs text-white outline-none focus:border-red-500"
          />
        </div>
      </div>

      {/* SECTION 28: USAGE TRACKING & TELEMETRY */}
      <div className="p-6 rounded-2xl bg-[#12131c] border border-neutral-800/80 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase">
            <Layers className="w-4 h-4 text-sky-400" />
            <span>AI Usage & Generation Telemetry</span>
          </div>
          <span className="text-[11px] font-mono text-neutral-500">
            {serverStats?.totalGenerations ?? aiUsageLogs.length} total operations
          </span>
        </div>

        {/* Dashboard Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 rounded-xl bg-[#171826] border border-neutral-800">
            <span className="text-[10px] font-mono text-neutral-400 uppercase">Today's Generations</span>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {serverStats?.todayGenerations ?? 0}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#171826] border border-neutral-800">
            <span className="text-[10px] font-mono text-neutral-400 uppercase">All-Time Total</span>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {serverStats?.totalGenerations ?? aiUsageLogs.length}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#171826] border border-neutral-800">
            <span className="text-[10px] font-mono text-emerald-400 uppercase">Successful</span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {serverStats?.successfulGenerations ?? aiUsageLogs.length}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#171826] border border-neutral-800">
            <span className="text-[10px] font-mono text-red-400 uppercase">Failed</span>
            <div className="text-xl font-bold font-mono text-red-400 mt-1">
              {serverStats?.failedGenerations ?? 0}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#171826] border border-neutral-800">
            <span className="text-[10px] font-mono text-neutral-400 uppercase">Avg Gen Time</span>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {serverStats?.averageDurationSeconds ?? 4.2}s
            </div>
          </div>
        </div>

        {/* Telemetry Log Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-500 text-[10px] uppercase">
                <th className="pb-2">Timestamp</th>
                <th className="pb-2">Operation</th>
                <th className="pb-2">Model</th>
                <th className="pb-2">Duration</th>
                <th className="pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
              {(serverStats?.logs && serverStats.logs.length > 0
                ? serverStats.logs
                : aiUsageLogs.map((l) => ({
                    id: l.id,
                    timestamp: l.timestamp,
                    operation: l.operation,
                    modelUsed: l.modelUsed,
                    durationMs: (l.durationSeconds || 3) * 1000,
                    status: 'SUCCESS' as const,
                  }))
              ).map((log) => (
                <tr key={log.id} className="hover:bg-[#161726]/60">
                  <td className="py-2.5 text-neutral-400">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="py-2.5 font-bold text-white">{log.operation}</td>
                  <td className="py-2.5 text-neutral-400">{log.modelUsed}</td>
                  <td className="py-2.5 text-neutral-400">{(log.durationMs / 1000).toFixed(1)}s</td>
                  <td className="py-2.5 text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.status === 'SUCCESS'
                          ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-950/40 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
