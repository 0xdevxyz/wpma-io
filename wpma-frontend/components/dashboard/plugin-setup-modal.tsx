'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, CheckCircle, Wifi, ArrowRight, RefreshCw, Package } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'react-hot-toast';
import { sitesApi, syncApi } from '../../lib/api';

interface PluginSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteData: {
    id: number;
    domain: string;
    siteName: string;
    setupToken: string;
    siteUrl: string;
  } | null;
  onConnected?: () => void;
}

export const PluginSetupModal: React.FC<PluginSetupModalProps> = ({ isOpen, onClose, siteData, onConnected }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const router = useRouter();

  if (!siteData) return null;

  const downloadUrl = sitesApi.getPluginDownloadUrl(siteData.setupToken);

  const handleDownload = () => {
    window.open(downloadUrl, '_blank');
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const r = await syncApi.verifyPlugin(String(siteData.id));
      const status = r?.data?.pluginStatus;
      if (status === 'connected') {
        setIsConnected(true);
        toast.success('Plugin verbunden!');
        onConnected?.();
      } else if (status === 'installed_not_configured') {
        toast.error('Plugin aktiv, aber API-Key fehlt — bitte neue ZIP herunterladen & Plugin neu installieren.');
      } else {
        toast.error('Plugin nicht gefunden. Bitte installieren & aktivieren, dann erneut prüfen.');
      }
    } catch {
      toast.error('Verbindungsprüfung fehlgeschlagen');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleGoToSite = () => {
    onClose();
    router.push(`/sites/${siteData.id}`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-[#13131f] rounded-2xl shadow-2xl w-full max-w-lg">

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Plugin verbinden</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{siteData.domain}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Connected state */}
              {isConnected ? (
                <div className="px-6 py-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Verbunden!</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{siteData.domain} wird jetzt von WPMA überwacht.</p>
                  <Button onClick={handleGoToSite} className="w-full">
                    Zum Site-Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              ) : (
                <div className="px-6 py-6 space-y-5">

                  {/* Step 1 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white mb-2">Plugin herunterladen</p>
                      <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        wpma-agent.zip herunterladen
                      </button>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400 text-xs font-bold flex items-center justify-center">2</div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white mb-1">In WordPress installieren & aktivieren</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        WordPress Admin → Plugins → Neu hinzufügen → Plugin hochladen → Aktivieren
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400 text-xs font-bold flex items-center justify-center">3</div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white mb-3">Verbindung herstellen</p>
                      <button
                        onClick={handleVerify}
                        disabled={isVerifying}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium transition-colors w-full justify-center"
                      >
                        {isVerifying ? (
                          <><RefreshCw className="w-4 h-4 animate-spin" /> Prüfe Verbindung…</>
                        ) : (
                          <><Wifi className="w-4 h-4" /> Jetzt verbinden</>
                        )}
                      </button>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                        Nach Aktivierung des Plugins auf diesen Button klicken
                      </p>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
