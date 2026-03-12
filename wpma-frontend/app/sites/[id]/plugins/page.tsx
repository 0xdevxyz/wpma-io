'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Package, RefreshCw, Trash2, Power, Download, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { pluginsApi } from '../../../../lib/api';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { toast } from 'react-hot-toast';

interface Plugin {
  slug: string;
  name: string;
  version: string;
  latestVersion: string;
  active: boolean;
  autoUpdate: boolean;
  description: string;
  author: string;
  updateAvailable: boolean;
}

export default function PluginsPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.id as string;
  const [actionInProgress, setActionInProgress] = React.useState<string | null>(null);

  const { data: plugins, isLoading, refetch } = useQuery({
    queryKey: ['plugins', siteId],
    queryFn: async () => {
      const response = await pluginsApi.getPlugins(siteId);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'WordPress-Site nicht erreichbar oder WPMA-Plugin nicht installiert');
    },
    enabled: !!siteId
  });

  const handleTogglePlugin = async (plugin: Plugin) => {
    setActionInProgress(plugin.slug);
    try {
      await pluginsApi.togglePlugin(siteId, plugin.slug, !plugin.active);
      toast.success(`Plugin ${plugin.name} ${!plugin.active ? 'aktiviert' : 'deaktiviert'}`);
      refetch();
    } catch (error: any) {
      toast.error(error?.message || 'Aktion fehlgeschlagen');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleUpdatePlugin = async (plugin: Plugin) => {
    setActionInProgress(plugin.slug);
    try {
      await pluginsApi.updatePlugin(siteId, plugin.slug);
      toast.success(`Plugin ${plugin.name} erfolgreich aktualisiert`);
      refetch();
    } catch (error: any) {
      toast.error(error?.message || 'Update fehlgeschlagen');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeletePlugin = async (plugin: Plugin) => {
    if (!confirm(`Möchten Sie das Plugin "${plugin.name}" wirklich löschen?`)) {
      return;
    }

    setActionInProgress(plugin.slug);
    try {
      await pluginsApi.deletePlugin(siteId, plugin.slug);
      toast.success(`Plugin ${plugin.name} erfolgreich gelöscht`);
      refetch();
    } catch (error: any) {
      toast.error(error?.message || 'Löschen fehlgeschlagen');
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Plugin Management</h1>
              <p className="text-gray-600 mt-1">Verwalte alle WordPress-Plugins</p>
            </div>
            <Button onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Aktualisieren
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Lade Plugins...</p>
            </CardContent>
          </Card>
        )}

        {/* Plugins List */}
        {!isLoading && plugins && plugins.length > 0 && (
          <div className="space-y-4">
            {plugins.map((plugin: Plugin) => (
              <Card key={plugin.slug} className={plugin.active ? 'border-l-4 border-l-green-500' : ''}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <Package className="w-6 h-6 text-gray-600" />
                        <h3 className="text-xl font-semibold">{plugin.name}</h3>
                        {plugin.active && (
                          <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full flex items-center space-x-1">
                            <CheckCircle className="w-4 h-4" />
                            <span>Aktiv</span>
                          </span>
                        )}
                        {plugin.updateAvailable && (
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full flex items-center space-x-1">
                            <AlertCircle className="w-4 h-4" />
                            <span>Update verfügbar</span>
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 mb-3">{plugin.description}</p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="font-medium">Version: {plugin.version}</span>
                        {plugin.updateAvailable && (
                          <span className="text-yellow-600 font-medium">→ {plugin.latestVersion}</span>
                        )}
                        <span>•</span>
                        <span>von {plugin.author}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        size="default"
                        variant={plugin.active ? 'secondary' : 'default'}
                        onClick={() => handleTogglePlugin(plugin)}
                        disabled={actionInProgress === plugin.slug}
                      >
                        <Power className="w-4 h-4 mr-2" />
                        {plugin.active ? 'Deaktivieren' : 'Aktivieren'}
                      </Button>
                      {plugin.updateAvailable && (
                        <Button
                          size="default"
                          onClick={() => handleUpdatePlugin(plugin)}
                          disabled={actionInProgress === plugin.slug}
                          className="bg-yellow-600 hover:bg-yellow-700"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Update
                        </Button>
                      )}
                      <Button
                        size="default"
                        variant="ghost"
                        onClick={() => handleDeletePlugin(plugin)}
                        disabled={actionInProgress === plugin.slug || plugin.active}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!plugins || plugins.length === 0) && (
          <Card>
            <CardContent className="text-center py-16">
              <Package className="w-20 h-20 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Keine Plugins gefunden</h3>
              <p className="text-gray-600">Es wurden keine Plugins auf dieser Site gefunden.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
