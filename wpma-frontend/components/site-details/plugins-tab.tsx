'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, RefreshCw, Trash2, Power, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { pluginsApi } from '../../lib/api';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
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

interface PluginsTabProps {
  siteId: string;
}

export function PluginsTab({ siteId }: PluginsTabProps) {
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const { data: plugins, isLoading, refetch } = useQuery({
    queryKey: ['plugins', siteId],
    queryFn: async () => {
      const response = await pluginsApi.getPlugins(siteId);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Fehler beim Laden der Plugins');
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">Lade Plugins...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Package className="w-5 h-5" />
              <span>Plugins ({plugins?.length || 0})</span>
            </div>
            <Button size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Aktualisieren
            </Button>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Plugins List */}
      {plugins && plugins.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {plugins.map((plugin: Plugin) => (
            <Card key={plugin.slug} className={plugin.active ? 'border-green-200' : ''}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold">{plugin.name}</h3>
                      {plugin.active && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center space-x-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>Aktiv</span>
                        </span>
                      )}
                      {plugin.updateAvailable && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Update verfügbar</span>
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{plugin.description}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>Version: {plugin.version}</span>
                      {plugin.updateAvailable && (
                        <span className="text-yellow-600">→ {plugin.latestVersion}</span>
                      )}
                      <span>•</span>
                      <span>von {plugin.author}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant={plugin.active ? 'secondary' : 'default'}
                      onClick={() => handleTogglePlugin(plugin)}
                      disabled={actionInProgress === plugin.slug}
                    >
                      <Power className="w-4 h-4 mr-2" />
                      {plugin.active ? 'Deaktivieren' : 'Aktivieren'}
                    </Button>
                    {plugin.updateAvailable && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleUpdatePlugin(plugin)}
                        disabled={actionInProgress === plugin.slug}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Update
                      </Button>
                    )}
                    <Button
                      size="sm"
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
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Keine Plugins</h3>
            <p className="text-gray-600">Es wurden keine Plugins gefunden.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
