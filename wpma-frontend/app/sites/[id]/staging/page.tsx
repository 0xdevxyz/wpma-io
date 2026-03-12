'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Zap, Copy, PlayCircle, Trash2, RefreshCw } from 'lucide-react';

export default function StagingPage() {
  const params = useParams();
  const siteId = params.id;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Staging-Umgebung</h1>
          <p className="text-gray-600">
            Erstellen und verwalten Sie Test-Umgebungen für sichere Updates
          </p>
        </div>

        <div className="grid gap-6">
          <Card className="border-2 border-dashed border-purple-300 bg-purple-50">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                  <Zap className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Staging in 5 Minuten erstellen
                </h3>
                <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                  Erstellen Sie eine exakte Kopie Ihrer Live-Site zum sicheren Testen von Updates, 
                  Plugins und Design-Änderungen.
                </p>
                <div className="flex gap-4 justify-center">
                  <Button size="lg" className="bg-purple-600 hover:bg-purple-700">
                    <Copy className="w-5 h-5 mr-2" />
                    Neue Staging-Umgebung erstellen
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Copy className="w-5 h-5 text-purple-600" />
                  Schnelles Klonen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Erstellen Sie in wenigen Minuten eine vollständige Kopie Ihrer Live-Site
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PlayCircle className="w-5 h-5 text-green-600" />
                  Live Pushen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Übertragen Sie getestete Änderungen mit einem Klick auf Ihre Live-Site
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <RefreshCw className="w-5 h-5 text-blue-600" />
                  Automatische Sync
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Halten Sie Staging und Live automatisch synchronisiert
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
