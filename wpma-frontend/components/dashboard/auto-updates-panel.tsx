'use client';

import { useState, useEffect } from 'react';
import { 
  Download, 
  RefreshCw, 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Loader2,
  Settings,
  ChevronRight,
  Package,
  Palette,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AutoUpdatesPanelProps {
  siteId: string;
  className?: string;
}

interface Update {
  name: string;
  slug: string;
  current_version: string;
  new_version: string;
  compatible_php?: boolean;
  compatible_wp?: boolean;
}

interface UpdateData {
  core: { current: string; new: string } | null;
  plugins: Update[];
  themes: Update[];
  total: number;
}

interface UpdateAnalysis {
  risk_level: 'low' | 'medium' | 'high';
  can_auto_update: boolean;
  requires_backup: boolean;
  recommendation: string;
}

interface AutoUpdateSettings {
  enabled: boolean;
  updateCore: boolean;
  updatePlugins: boolean;
  updateThemes: boolean;
  schedule: 'daily' | 'weekly' | 'monthly';
}

export default function AutoUpdatesPanel({ siteId, className }: AutoUpdatesPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updates, setUpdates] = useState<UpdateData | null>(null);
  const [analysis, setAnalysis] = useState<UpdateAnalysis | null>(null);
  const [settings, setSettings] = useState<AutoUpdateSettings>({
    enabled: false,
    updateCore: false,
    updatePlugins: true,
    updateThemes: true,
    schedule: 'weekly'
  });
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUpdateStatus();
    fetchSettings();
  }, [siteId]);

  const fetchUpdateStatus = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('wpma_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/updates/${siteId}/check`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success && data.data) {
        setUpdates(data.data.updates || null);
        setAnalysis(data.data.analysis || null);
      }
    } catch (err) {
      console.error('Error fetching update status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('wpma_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/updates/${siteId}/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success && data.data) {
        setSettings(data.data);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const checkForUpdates = async () => {
    setIsChecking(true);
    await fetchUpdateStatus();
    setIsChecking(false);
  };

  const performAutoUpdate = async (forceUpdate = false) => {
    try {
      setIsUpdating(true);
      setError(null);
      
      const token = localStorage.getItem('wpma_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/updates/${siteId}/auto-update`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ forceUpdate })
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (data.data.performed) {
          await fetchUpdateStatus();
        } else {
          setError(data.data.message || 'Update nicht durchgeführt');
        }
      } else {
        setError(data.error || 'Update fehlgeschlagen');
      }
    } catch (err) {
      setError('Verbindungsfehler');
    } finally {
      setIsUpdating(false);
    }
  };

  const saveSettings = async () => {
    try {
      const token = localStorage.getItem('wpma_token');
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/updates/${siteId}/settings`, {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      setShowSettings(false);
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'medium': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'high': return 'text-red-400 bg-red-500/10 border-red-500/30';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  const getRiskLabel = (risk: string) => {
    switch (risk) {
      case 'low': return 'Niedriges Risiko';
      case 'medium': return 'Mittleres Risiko';
      case 'high': return 'Hohes Risiko';
      default: return 'Unbekannt';
    }
  };

  return (
    <div className={cn("bg-slate-900 border border-slate-800 rounded-xl overflow-hidden", className)}>
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-600/20 via-blue-600/20 to-indigo-600/20 border-b border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Auto-Updates</h3>
              <p className="text-xs text-slate-400">KI-gestützte Update-Verwaltung</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={checkForUpdates}
              disabled={isChecking}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
            >
              {isChecking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Prüfen
            </button>
          </div>
        </div>
      </div>
      
      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-slate-800 bg-slate-800/50">
          <h4 className="text-white font-medium mb-4">Auto-Update Einstellungen</h4>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-slate-300">Auto-Updates aktivieren</span>
            </label>
            
            <div className="pl-7 space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.updateCore}
                  onChange={(e) => setSettings({ ...settings, updateCore: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                  disabled={!settings.enabled}
                />
                <span className="text-slate-400">WordPress Core</span>
              </label>
              
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.updatePlugins}
                  onChange={(e) => setSettings({ ...settings, updatePlugins: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                  disabled={!settings.enabled}
                />
                <span className="text-slate-400">Plugins</span>
              </label>
              
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.updateThemes}
                  onChange={(e) => setSettings({ ...settings, updateThemes: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                  disabled={!settings.enabled}
                />
                <span className="text-slate-400">Themes</span>
              </label>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-slate-400">Zeitplan:</span>
              <select
                value={settings.schedule}
                onChange={(e) => setSettings({ ...settings, schedule: e.target.value as any })}
                className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                disabled={!settings.enabled}
              >
                <option value="daily">Täglich</option>
                <option value="weekly">Wöchentlich</option>
                <option value="monthly">Monatlich</option>
              </select>
            </div>
            
            <button
              onClick={saveSettings}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Speichern
            </button>
          </div>
        </div>
      )}
      
      {/* Content */}
      <div className="p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        
        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Lade Update-Status...</p>
          </div>
        ) : updates && updates.total > 0 ? (
          <div className="space-y-4">
            {/* Risk Analysis */}
            {analysis && (
              <div className={cn(
                "p-4 rounded-lg border",
                getRiskColor(analysis.risk_level)
              )}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4" />
                      <span className="font-medium">{getRiskLabel(analysis.risk_level)}</span>
                    </div>
                    <p className="text-sm opacity-80">{analysis.recommendation}</p>
                  </div>
                  
                  {analysis.can_auto_update && (
                    <button
                      onClick={() => performAutoUpdate()}
                      disabled={isUpdating}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                    >
                      {isUpdating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Auto-Update starten
                    </button>
                  )}
                </div>
                
                {analysis.requires_backup && (
                  <div className="mt-3 flex items-center gap-2 text-sm opacity-70">
                    <AlertTriangle className="w-4 h-4" />
                    Backup wird vor dem Update erstellt
                  </div>
                )}
              </div>
            )}
            
            {/* Update Summary */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                {updates.total} Update{updates.total !== 1 ? 's' : ''} verfügbar
              </span>
              {!analysis?.can_auto_update && (
                <button
                  onClick={() => performAutoUpdate(true)}
                  disabled={isUpdating}
                  className="text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  Update erzwingen
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Core Update */}
            {updates.core && (
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Globe className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">WordPress Core</p>
                    <p className="text-xs text-slate-400">
                      {updates.core.current} → {updates.core.new}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Plugin Updates */}
            {updates.plugins.length > 0 && (
              <div>
                <h4 className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Plugins ({updates.plugins.length})
                </h4>
                <div className="space-y-2">
                  {updates.plugins.map((plugin, i) => (
                    <div key={i} className="p-3 bg-slate-800/50 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm">{plugin.name}</p>
                        <p className="text-xs text-slate-400">
                          {plugin.current_version} → {plugin.new_version}
                        </p>
                      </div>
                      {(plugin.compatible_php === false || plugin.compatible_wp === false) && (
                        <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                          Kompatibilität prüfen
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Theme Updates */}
            {updates.themes.length > 0 && (
              <div>
                <h4 className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Themes ({updates.themes.length})
                </h4>
                <div className="space-y-2">
                  {updates.themes.map((theme, i) => (
                    <div key={i} className="p-3 bg-slate-800/50 rounded-lg">
                      <p className="text-white text-sm">{theme.name}</p>
                      <p className="text-xs text-slate-400">
                        {theme.current_version} → {theme.new_version}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h4 className="text-white font-medium mb-1">Alles aktuell!</h4>
            <p className="text-slate-400 text-sm">
              Keine Updates verfügbar. Ihre Site ist auf dem neuesten Stand.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

