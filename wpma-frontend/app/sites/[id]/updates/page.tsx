'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { RefreshCw, Shield, CheckCircle, AlertTriangle } from 'lucide-react';

export default function UpdatesPage() {
  const params = useParams();
  const siteId = params.id;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Updates & Auto-Rollback</h1>
          <p className="text-gray-600">
            Sicheres Update-Management mit automatischem Rollback bei Problemen
          </p>
        </div>

        <div className="grid gap-6">
          <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-6">
                <div className="bg-green-100 p-4 rounded-xl">
                  <Shield className="w-12 h-12 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Auto-Rollback aktiviert
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Bei Problemen nach Updates wird Ihre Site automatisch auf die letzte funktionierende Version zurückgesetzt.
                  </p>
                  <div className="flex gap-4">
                    <div className="bg-white px-4 py-2 rounded-lg border border-green-200">
                      <div className="text-xs text-gray-500">Letzte Prüfung</div>
                      <div className="font-semibold text-gray-900">Vor 5 Minuten</div>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-lg border border-green-200">
                      <div className="text-xs text-gray-500">Status</div>
                      <div className="font-semibold text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Aktiv
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Verfügbare Updates</span>
                <Button variant="secondary" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Nach Updates suchen
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <p className="font-medium">Alles auf dem neuesten Stand!</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
