'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'react-hot-toast';
import { sitesApi } from '../../lib/api';

interface CreateSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (siteData?: any) => void;
}

interface CreateSiteForm {
  url: string;
}

interface SiteMetadata {
  domain: string;
  siteName: string;
  siteUrl: string;
}

export const CreateSiteModal: React.FC<CreateSiteModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [metadata, setMetadata] = useState<SiteMetadata | null>(null);
  const [metadataError, setMetadataError] = useState<string>('');
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<CreateSiteForm>();

  const urlValue = watch('url');

  const handleFetchMetadata = async () => {
    if (!urlValue) {
      toast.error('Bitte geben Sie eine URL ein');
      return;
    }

    setIsFetchingMetadata(true);
    setMetadataError('');
    setMetadata(null);

    try {
      const response = await sitesApi.fetchSiteMetadata(urlValue);
      
      if (response.success) {
        setMetadata(response.data);
        toast.success('Website-Daten erfolgreich geladen!');
      } else {
        setMetadataError(response.error || 'Konnte Website nicht erreichen');
        toast.error(response.error || 'Fehler beim Laden der Website');
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'Fehler beim Laden der Website';
      setMetadataError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const onSubmit = async (data: CreateSiteForm) => {
    if (typeof window === 'undefined') return;
    
    if (!metadata) {
      toast.error('Bitte laden Sie zuerst die Website-Daten');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await sitesApi.createSite({
        domain: metadata.domain,
        site_name: metadata.siteName,
        site_url: metadata.siteUrl
      });

      if (response.success) {
        toast.success('Site erfolgreich erstellt!');
        reset();
        setMetadata(null);
        onSuccess(response.data);
        onClose();
      } else {
        toast.error(response.error || 'Fehler beim Erstellen der Site');
      }
    } catch (error) {
      toast.error('Fehler beim Erstellen der Site');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !isFetchingMetadata) {
      reset();
      setMetadata(null);
      setMetadataError('');
      onClose();
    }
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
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-white/20 backdrop-blur-lg rounded-lg p-2">
                      <Globe className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Neue Site hinzufügen</h2>
                      <p className="text-blue-100 text-sm">Geben Sie einfach die URL ein</p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={isSubmitting || isFetchingMetadata}
                    className="text-white/80 hover:text-white transition-colors disabled:opacity-50"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                {/* URL Input */}
                <div>
                  <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                    Website-URL
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        id="url"
                        type="text"
                        placeholder="https://example.com"
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
                          errors.url ? 'border-red-500' : 'border-gray-300'
                        }`}
                        {...register('url', {
                          required: 'URL ist erforderlich',
                          pattern: {
                            value: /^https?:\/\/.+/,
                            message: 'Bitte geben Sie eine gültige URL ein (inkl. http:// oder https://)'
                          }
                        })}
                        disabled={isSubmitting || isFetchingMetadata}
                      />
                      {errors.url && (
                        <p className="mt-1 text-sm text-red-600">{errors.url.message}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={handleFetchMetadata}
                      disabled={isFetchingMetadata || !urlValue || isSubmitting}
                      className="px-6"
                    >
                      {isFetchingMetadata ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Laden'
                      )}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Wir lesen automatisch die Domain und den Seitentitel aus
                  </p>
                </div>

                {/* Metadata Display */}
                {isFetchingMetadata && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">Website wird geladen...</p>
                        <p className="text-xs text-blue-700">Bitte warten Sie einen Moment</p>
                      </div>
                    </div>
                  </div>
                )}

                {metadata && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-green-900 mb-3">Website erfolgreich geladen!</p>
                        <div className="space-y-2">
                          <div className="bg-white rounded-lg p-3">
                            <p className="text-xs font-medium text-gray-600 mb-1">Domain:</p>
                            <p className="text-sm font-semibold text-gray-900">{metadata.domain}</p>
                          </div>
                          <div className="bg-white rounded-lg p-3">
                            <p className="text-xs font-medium text-gray-600 mb-1">Seitentitel:</p>
                            <p className="text-sm font-semibold text-gray-900">{metadata.siteName}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {metadataError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-900">Fehler beim Laden</p>
                        <p className="text-xs text-red-700 mt-1">{metadataError}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">
                    ℹ️ Nächste Schritte nach Erstellung
                  </h4>
                  <ol className="text-sm text-blue-800 space-y-1">
                    <li>1. WPMA Plugin herunterladen</li>
                    <li>2. In WordPress installieren und aktivieren</li>
                    <li>3. Setup-Token eingeben → Automatische Verbindung!</li>
                  </ol>
                </div>

                {/* Actions */}
                <div className="flex space-x-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleClose}
                    disabled={isSubmitting || isFetchingMetadata}
                    className="flex-1"
                  >
                    Abbrechen
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || isFetchingMetadata || !metadata}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Wird erstellt...
                      </>
                    ) : (
                      'Site hinzufügen'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
