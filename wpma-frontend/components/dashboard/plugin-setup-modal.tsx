'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, CheckCircle, Globe, Package, Zap, ExternalLink, Copy, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'react-hot-toast';

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
}

export const PluginSetupModal: React.FC<PluginSetupModalProps> = ({ isOpen, onClose, siteData }) => {
  const [copied, setCopied] = useState(false);

  if (!siteData) return null;

  const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/sites/plugin/download/${siteData.setupToken}`;

  const handleDownload = () => {
    window.open(downloadUrl, '_blank');
    toast.success('Plugin-Download gestartet');
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(siteData.setupToken);
    setCopied(true);
    toast.success('Token kopiert!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-gradient-to-r from-green-500 to-blue-600 px-6 py-6 rounded-t-2xl">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                      <CheckCircle className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Site erfolgreich erstellt!</h2>
                      <p className="text-green-50 mt-1">{siteData.siteName}</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-white/80 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-6 space-y-6">
                {/* Site Info */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center space-x-3 mb-2">
                    <Globe className="w-5 h-5 text-gray-600" />
                    <span className="font-semibold text-gray-900">Ihre Site:</span>
                  </div>
                  <div className="ml-8 space-y-1">
                    <p className="text-gray-700">
                      <span className="font-medium">Domain:</span> {siteData.domain}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-medium">URL:</span>{' '}
                      <a href={siteData.siteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center">
                        {siteData.siteUrl}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </p>
                  </div>
                </div>

                {/* Setup Instructions */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <Package className="w-5 h-5 mr-2 text-blue-600" />
                    Plugin-Installation
                  </h3>

                  <div className="space-y-4">
                    {/* Step 1: Download */}
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                        1
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-2">Plugin herunterladen</h4>
                        <p className="text-gray-600 text-sm mb-3">
                          Laden Sie das WPMA Agent Plugin herunter. Es verbindet sich automatisch mit Ihrer Site.
                        </p>
                        <Button onClick={handleDownload} className="w-full sm:w-auto">
                          <Download className="w-4 h-4 mr-2" />
                          Plugin herunterladen
                        </Button>
                      </div>
                    </div>

                    {/* Step 2: Install */}
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                        2
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-2">In WordPress installieren</h4>
                        <div className="text-gray-600 text-sm space-y-2">
                          <p>Gehen Sie in Ihrem WordPress-Admin-Bereich zu:</p>
                          <div className="bg-gray-50 p-3 rounded border border-gray-200 font-mono text-xs">
                            Plugins → Installieren → Plugin hochladen
                          </div>
                          <p>Wählen Sie die heruntergeladene ZIP-Datei aus und klicken Sie auf "Jetzt installieren".</p>
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Activate */}
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                        3
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-2">Plugin aktivieren</h4>
                        <p className="text-gray-600 text-sm mb-2">
                          Klicken Sie auf "Plugin aktivieren".
                        </p>
                      </div>
                    </div>

                    {/* Step 4: Setup Token */}
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                        4
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-2">Setup-Token eingeben</h4>
                        <p className="text-gray-600 text-sm mb-3">
                          Nach der Aktivierung öffnet sich automatisch der Setup-Wizard. Kopieren Sie diesen Token und fügen Sie ihn dort ein:
                        </p>
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                          <label className="block text-xs font-semibold text-blue-900 mb-2 uppercase">
                            Ihr Setup-Token:
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              readOnly
                              value={siteData.setupToken}
                              className="flex-1 px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm font-mono select-all"
                              onClick={(e) => e.currentTarget.select()}
                            />
                            <Button
                              variant="secondary"
                              onClick={handleCopyToken}
                              className="flex-shrink-0"
                            >
                              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                          <p className="mt-2 text-xs text-blue-800">
                            ⏱️ Dieser Token ist 1 Stunde gültig
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Important Note */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-amber-900 mb-2 flex items-center">
                    💡 Wichtige Hinweise
                  </h4>
                  <ul className="text-sm text-amber-800 space-y-1">
                    <li>• Nach der Plugin-Aktivierung öffnet sich automatisch der Setup-Wizard</li>
                    <li>• Fügen Sie dort einfach den oben angezeigten Token ein</li>
                    <li>• Der Token ist 1 Stunde gültig</li>
                    <li>• Bei Ablauf können Sie im Dashboard einen neuen Token generieren</li>
                  </ul>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button variant="secondary" onClick={onClose} className="flex-1">
                    Später installieren
                  </Button>
                  <Button onClick={handleDownload} className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    Plugin herunterladen
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

