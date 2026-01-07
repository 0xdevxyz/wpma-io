'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowPathIcon, 
  CloudArrowUpIcon, 
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon,
  StopIcon,
  ChevronDownIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

interface Site {
  id: number;
  domain: string;
  pluginUpdates?: number;
  themeUpdates?: number;
  coreUpdate?: boolean;
}

interface BulkJob {
  id: string;
  type: string;
  status: string;
  totalSites: number;
  completedSites: number;
  failedSites: number;
  startedAt: string;
  completedAt?: string;
}

interface BulkActionsPanelProps {
  sites: Site[];
  token: string;
  apiUrl: string;
}

export default function BulkActionsPanel({ sites, token, apiUrl }: BulkActionsPanelProps) {
  const [selectedSites, setSelectedSites] = useState<number[]>([]);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [jobs, setJobs] = useState<BulkJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [updatesSummary, setUpdatesSummary] = useState<any>(null);
  const [showOptions, setShowOptions] = useState(false);
  
  // Update Options
  const [updateOptions, setUpdateOptions] = useState({
    updatePlugins: true,
    updateThemes: true,
    updateCore: false,
    createBackup: true,
    forceUpdate: false
  });

  // Fetch Updates Summary
  useEffect(() => {
    fetchUpdatesSummary();
    fetchJobs();
  }, []);

  const fetchUpdatesSummary = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/v1/bulk/updates/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setUpdatesSummary(data.data);
      }
    } catch (error) {
      console.error('Error fetching updates summary:', error);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/v1/bulk/jobs?limit=5`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setJobs(data.data);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const toggleSiteSelection = (siteId: number) => {
    setSelectedSites(prev => 
      prev.includes(siteId) 
        ? prev.filter(id => id !== siteId)
        : [...prev, siteId]
    );
  };

  const selectAll = () => {
    setSelectedSites(sites.map(s => s.id));
  };

  const deselectAll = () => {
    setSelectedSites([]);
  };

  const runBulkUpdate = async () => {
    if (selectedSites.length === 0) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/bulk/updates`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          siteIds: selectedSites,
          ...updateOptions
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setActiveAction('update');
        fetchJobs();
      }
    } catch (error) {
      console.error('Bulk update error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runBulkBackup = async () => {
    if (selectedSites.length === 0) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/bulk/backups`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          siteIds: selectedSites,
          backupType: 'full',
          provider: 'idrive_e2'
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setActiveAction('backup');
        fetchJobs();
      }
    } catch (error) {
      console.error('Bulk backup error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runBulkSecurityScan = async () => {
    if (selectedSites.length === 0) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/bulk/security/scan`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ siteIds: selectedSites })
      });
      
      const data = await res.json();
      if (data.success) {
        setActiveAction('security');
        fetchJobs();
      }
    } catch (error) {
      console.error('Bulk security scan error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      await fetch(`${apiUrl}/api/v1/bulk/jobs/${jobId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchJobs();
    } catch (error) {
      console.error('Cancel job error:', error);
    }
  };

  const getJobTypeLabel = (type: string) => {
    switch (type) {
      case 'bulk_update': return 'Bulk Update';
      case 'bulk_backup': return 'Bulk Backup';
      case 'bulk_security_scan': return 'Security Scan';
      case 'bulk_install_plugin': return 'Plugin Installation';
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">Läuft</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Abgeschlossen</span>;
      case 'completed_with_errors':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">Mit Fehlern</span>;
      case 'cancelled':
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">Abgebrochen</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">{status}</span>;
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <ArrowPathIcon className="w-6 h-6 text-indigo-400" />
          Bulk Actions
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Führe Aktionen auf mehreren Sites gleichzeitig aus
        </p>
      </div>

      {/* Updates Summary */}
      {updatesSummary && (
        <div className="px-6 py-4 bg-slate-800/30 border-b border-slate-700">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{updatesSummary.summary.totalSites}</div>
              <div className="text-xs text-slate-400">Sites gesamt</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-400">{updatesSummary.summary.sitesWithUpdates}</div>
              <div className="text-xs text-slate-400">Mit Updates</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-indigo-400">{updatesSummary.summary.totalPluginUpdates}</div>
              <div className="text-xs text-slate-400">Plugin Updates</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">{updatesSummary.summary.totalThemeUpdates}</div>
              <div className="text-xs text-slate-400">Theme Updates</div>
            </div>
          </div>
        </div>
      )}

      {/* Site Selection */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              {selectedSites.length} von {sites.length} Sites ausgewählt
            </span>
            <button 
              onClick={selectAll}
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              Alle auswählen
            </button>
            <button 
              onClick={deselectAll}
              className="text-sm text-slate-400 hover:text-slate-300"
            >
              Auswahl aufheben
            </button>
          </div>
        </div>

        {/* Sites Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6 max-h-64 overflow-y-auto">
          {sites.map(site => (
            <motion.button
              key={site.id}
              onClick={() => toggleSiteSelection(site.id)}
              className={`p-3 rounded-lg border text-left transition-all ${
                selectedSites.includes(site.id)
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-start justify-between">
                <div className="truncate">
                  <div className="text-sm font-medium text-white truncate">{site.domain}</div>
                  {(site.pluginUpdates || site.themeUpdates || site.coreUpdate) && (
                    <div className="flex items-center gap-1 mt-1">
                      {site.pluginUpdates && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
                          {site.pluginUpdates} Plugins
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                  selectedSites.includes(site.id)
                    ? 'border-indigo-500 bg-indigo-500'
                    : 'border-slate-500'
                }`}>
                  {selectedSites.includes(site.id) && (
                    <CheckCircleIcon className="w-3 h-3 text-white" />
                  )}
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <button
              onClick={() => setShowOptions(!showOptions)}
              disabled={selectedSites.length === 0 || isLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 
                       disabled:bg-slate-600 disabled:cursor-not-allowed
                       text-white rounded-lg transition-colors"
            >
              <ArrowPathIcon className="w-5 h-5" />
              Updates durchführen
              <ChevronDownIcon className={`w-4 h-4 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
            </button>

            {/* Update Options Dropdown */}
            <AnimatePresence>
              {showOptions && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute left-0 top-full mt-2 w-72 bg-slate-800 border border-slate-700 
                           rounded-lg shadow-xl z-20 p-4"
                >
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={updateOptions.updatePlugins}
                        onChange={e => setUpdateOptions({...updateOptions, updatePlugins: e.target.checked})}
                        className="rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-300">Plugins aktualisieren</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={updateOptions.updateThemes}
                        onChange={e => setUpdateOptions({...updateOptions, updateThemes: e.target.checked})}
                        className="rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-300">Themes aktualisieren</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={updateOptions.updateCore}
                        onChange={e => setUpdateOptions({...updateOptions, updateCore: e.target.checked})}
                        className="rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-300">WordPress Core aktualisieren</span>
                    </label>
                    <hr className="border-slate-700" />
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={updateOptions.createBackup}
                        onChange={e => setUpdateOptions({...updateOptions, createBackup: e.target.checked})}
                        className="rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-300">Backup vor Update erstellen</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={updateOptions.forceUpdate}
                        onChange={e => setUpdateOptions({...updateOptions, forceUpdate: e.target.checked})}
                        className="rounded border-slate-600 bg-slate-700 text-yellow-500 focus:ring-yellow-500"
                      />
                      <span className="text-sm text-yellow-400">Update erzwingen (KI ignorieren)</span>
                    </label>
                    <button
                      onClick={() => {
                        setShowOptions(false);
                        runBulkUpdate();
                      }}
                      className="w-full mt-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg 
                               transition-colors flex items-center justify-center gap-2"
                    >
                      <PlayIcon className="w-4 h-4" />
                      Starten
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={runBulkBackup}
            disabled={selectedSites.length === 0 || isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 
                     disabled:bg-slate-600 disabled:cursor-not-allowed
                     text-white rounded-lg transition-colors"
          >
            <CloudArrowUpIcon className="w-5 h-5" />
            Backups erstellen
          </button>

          <button
            onClick={runBulkSecurityScan}
            disabled={selectedSites.length === 0 || isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 
                     disabled:bg-slate-600 disabled:cursor-not-allowed
                     text-white rounded-lg transition-colors"
          >
            <ShieldCheckIcon className="w-5 h-5" />
            Security Scan
          </button>
        </div>
      </div>

      {/* Running/Recent Jobs */}
      {jobs.length > 0 && (
        <div className="border-t border-slate-700 p-6">
          <h3 className="text-sm font-medium text-slate-300 mb-4">Aktuelle & Letzte Jobs</h3>
          <div className="space-y-3">
            {jobs.map(job => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {job.status === 'running' ? (
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <ArrowPathIcon className="w-4 h-4 text-blue-400 animate-spin" />
                    </div>
                  ) : job.status === 'completed' ? (
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircleIcon className="w-4 h-4 text-green-400" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-500/20 flex items-center justify-center">
                      <XCircleIcon className="w-4 h-4 text-slate-400" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium text-white">{getJobTypeLabel(job.type)}</div>
                    <div className="text-xs text-slate-400">
                      {job.completedSites}/{job.totalSites} Sites
                      {job.failedSites > 0 && (
                        <span className="text-red-400 ml-2">({job.failedSites} fehlgeschlagen)</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(job.status)}
                  {job.status === 'running' && (
                    <button
                      onClick={() => cancelJob(job.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                      title="Abbrechen"
                    >
                      <StopIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

