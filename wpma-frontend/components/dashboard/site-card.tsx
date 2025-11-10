import React from 'react';
import { motion } from 'framer-motion';
import { 
  Globe, 
  Shield, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  MoreVertical,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

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

interface SiteCardProps {
  site: Site;
  onViewDetails: (siteId: number) => void;
  onRunHealthCheck: (siteId: number) => void;
  onDelete?: (siteId: number) => void;
}

export const SiteCard: React.FC<SiteCardProps> = ({
  site,
  onViewDetails,
  onRunHealthCheck,
  onDelete
}) => {
  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (score >= 70) return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    return <AlertTriangle className="w-5 h-5 text-red-600" />;
  };

  const getHealthStatus = (score: number) => {
    if (score >= 90) return 'Gesund';
    if (score >= 70) return 'Warnung';
    return 'Kritisch';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Globe className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">{site.siteName}</CardTitle>
                <p className="text-sm text-gray-500">{site.domain}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {/* Health Score */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getHealthIcon(site.healthScore)}
                <span className="text-sm font-medium">Gesundheits-Score</span>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold ${getHealthColor(site.healthScore)}`}>
                  {site.healthScore}%
                </div>
                <div className="text-xs text-gray-500">
                  {getHealthStatus(site.healthScore)}
                </div>
              </div>
            </div>

            {/* Site Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">WordPress:</span>
                <div className="font-medium">{site.wordpressVersion || 'Unbekannt'}</div>
              </div>
              <div>
                <span className="text-gray-500">PHP:</span>
                <div className="font-medium">{site.phpVersion || 'Unbekannt'}</div>
              </div>
            </div>

            {/* Last Check */}
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>
                Letzte Überprüfung: {site.lastCheck ? 
                  formatDistanceToNow(new Date(site.lastCheck), { 
                    addSuffix: true, 
                    locale: de 
                  }) : 
                  'Noch nie'
                }
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button 
                variant="primary" 
                size="sm" 
                onClick={() => onViewDetails(site.id)}
                className="flex-1 min-w-[120px]"
              >
                Details anzeigen
              </Button>
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => onRunHealthCheck(site.id)}
                title="Health Check durchführen"
              >
                <Zap className="w-4 h-4 mr-1" />
                Check
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => window.open(site.siteUrl, '_blank')}
                title="Site in neuem Tab öffnen"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
              {onDelete && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onDelete(site.id)}
                  title="Site löschen"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}; 