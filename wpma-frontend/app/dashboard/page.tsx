'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Globe, 
  Shield, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Plus,
  Search,
  Filter,
  RefreshCw,
  TrendingUp,
  Activity
} from 'lucide-react';
import { sitesApi } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import { SiteCard } from '../../components/dashboard/site-card';
import { StatsCard } from '../../components/dashboard/stats-card';
import { CreateSiteModal } from '../../components/dashboard/create-site-modal';
import { PluginSetupModal } from '../../components/dashboard/plugin-setup-modal';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { toast } from 'react-hot-toast';

interface Site {
  id: number;
  domain: string;
  siteUrl: string;
  siteName: string;
  healthScore: number;
  status: string;
  lastCheck: string;
  wordpressVersion: string;
  phpVersion: string;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sites, setSites] = useState<Site[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPluginSetupModalOpen, setIsPluginSetupModalOpen] = useState(false);
  const [newSiteData, setNewSiteData] = useState<any>(null);

  const { data: sitesData, isLoading, error, refetch } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const response = await sitesApi.getSites();
      if (response.success) {
        return response.data || [];
      }
      throw new Error(response.error || 'Fehler beim Laden der Sites');
    },
    refetchInterval: 30000, // Alle 30 Sekunden aktualisieren
  });

  useEffect(() => {
    if (sitesData) {
      setSites(sitesData);
    }
  }, [sitesData]);

  // Sites filtern
  const filteredSites = sites.filter(site => {
    const matchesSearch = site.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         site.siteName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'healthy' && site.healthScore >= 90) ||
                         (statusFilter === 'warning' && site.healthScore >= 70 && site.healthScore < 90) ||
                         (statusFilter === 'critical' && site.healthScore < 70);
    
    return matchesSearch && matchesStatus;
  });

  // Statistiken berechnen
  const stats = React.useMemo(() => {
    const totalSites = sites.length;
    const avgHealthScore = sites.reduce((sum, site) => sum + site.healthScore, 0) / totalSites || 0;
    const healthySites = sites.filter(site => site.healthScore >= 90).length;
    const issuesCount = sites.filter(site => site.healthScore < 70).length;

    return {
      totalSites,
      avgHealthScore: Math.round(avgHealthScore),
      healthySites,
      issuesCount,
    };
  }, [sites]);

  const handleViewDetails = (siteId: number) => {
    router.push(`/sites/${siteId}`);
  };

  const handleRunHealthCheck = async (siteId: number) => {
    try {
      toast.loading('Health Check wird durchgeführt...');
      await sitesApi.runHealthCheck(siteId.toString());
      toast.dismiss();
      toast.success('Health Check gestartet');
      // Warte kurz und aktualisiere dann
      setTimeout(() => refetch(), 2000);
    } catch (error: any) {
      toast.dismiss();
      toast.error(error?.message || 'Health Check fehlgeschlagen');
      console.error('Health Check error:', error);
    }
  };

  const handleDeleteSite = async (siteId: number) => {
    if (!confirm('Möchten Sie diese Site wirklich löschen?')) {
      return;
    }
    
    try {
      toast.loading('Site wird gelöscht...');
      const response = await sitesApi.deleteSite(siteId.toString());
      toast.dismiss();
      
      if (response.success) {
        toast.success('Site erfolgreich gelöscht');
        refetch();
      } else {
        toast.error(response.error || 'Fehler beim Löschen der Site');
      }
    } catch (error: any) {
      toast.dismiss();
      toast.error(error?.message || 'Fehler beim Löschen der Site');
      console.error('Delete site error:', error);
    }
  };

  const handleRefresh = () => {
    refetch();
    toast.success('Dashboard aktualisiert');
  };

  const handleCreateSite = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateSuccess = (siteData?: any) => {
    if (siteData) {
      setNewSiteData(siteData);
      setIsPluginSetupModalOpen(true);
    }
    refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Lade Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Fehler beim Laden</h3>
            <p className="text-gray-600 mb-4">Die Sites konnten nicht geladen werden.</p>
            <Button onClick={() => refetch()}>Erneut versuchen</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Willkommen zurück, {user?.firstName}! Hier ist eine Übersicht Ihrer WordPress-Sites.
              </p>
            </div>
            <div className="flex space-x-3">
              <Button variant="secondary" onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Aktualisieren
              </Button>
              <Button onClick={handleCreateSite}>
                <Plus className="w-4 h-4 mr-2" />
                Site hinzufügen
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Gesamte Sites"
            value={stats.totalSites}
            icon={Globe}
            color="blue"
          />
          <StatsCard
            title="Durchschnittlicher Health Score"
            value={`${stats.avgHealthScore}%`}
            icon={TrendingUp}
            color="green"
          />
          <StatsCard
            title="Gesunde Sites"
            value={stats.healthySites}
            icon={CheckCircle}
            color="green"
          />
          <StatsCard
            title="Probleme"
            value={stats.issuesCount}
            icon={AlertTriangle}
            color="red"
          />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Sites durchsuchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                variant={statusFilter === 'all' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                Alle Sites
              </Button>
              <Button
                variant={statusFilter === 'healthy' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setStatusFilter('healthy')}
              >
                Gesund
              </Button>
              <Button
                variant={statusFilter === 'warning' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setStatusFilter('warning')}
              >
                Warnung
              </Button>
              <Button
                variant={statusFilter === 'critical' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setStatusFilter('critical')}
              >
                Kritisch
              </Button>
            </div>
          </div>
        </div>

        {/* Sites Grid */}
        {filteredSites.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSites.map((site) => (
              <SiteCard
                key={site.id}
                site={site}
                onViewDetails={handleViewDetails}
                onRunHealthCheck={handleRunHealthCheck}
                onDelete={handleDeleteSite}
              />
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm || statusFilter !== 'all' ? 'Keine Sites gefunden' : 'Noch keine Sites'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Versuchen Sie, Ihre Suchkriterien anzupassen'
                  : 'Fügen Sie Ihre erste WordPress-Site hinzu, um zu beginnen'
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Button onClick={handleCreateSite}>
                  <Plus className="w-4 h-4 mr-2" />
                  Ihre erste Site hinzufügen
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Site Modal */}
      <CreateSiteModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Plugin Setup Modal */}
      <PluginSetupModal
        isOpen={isPluginSetupModalOpen}
        onClose={() => {
          setIsPluginSetupModalOpen(false);
          setNewSiteData(null);
        }}
        siteData={newSiteData}
      />
    </div>
  );
} 