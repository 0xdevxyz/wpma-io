import React, { useState, useEffect } from 'react';
import { Download, Upload, Shield, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface EmailRecoveryProps {
  userId: number;
}

interface EmailData {
  id: number;
  context: string;
  to: string;
  from: string;
  subject: string;
  body: string;
  timestamp: string;
  created_at: string;
}

interface RecoveryStatus {
  active_exports: Array<{
    id: string;
    created_at: string;
    expires_at: string;
    downloaded: boolean;
  }>;
  email_stats: {
    total_emails: number;
    notification_emails: number;
    alert_emails: number;
    recovered_emails: number;
  };
}

const EmailRecovery: React.FC<EmailRecoveryProps> = ({ userId }) => {
  const [activeTab, setActiveTab] = useState('view');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [recoveryFile, setRecoveryFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [emails, setEmails] = useState<EmailData[]>([]);
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'view') {
      loadEmails();
    } else if (activeTab === 'status') {
      loadRecoveryStatus();
    }
  }, [activeTab]);

  const loadEmails = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/email-recovery/emails', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setEmails(data.data || []);
      } else {
        toast.error('Fehler beim Laden der Emails');
      }
    } catch (error) {
      toast.error('Fehler beim Laden der Emails');
    } finally {
      setLoading(false);
    }
  };

  const loadRecoveryStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/email-recovery/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRecoveryStatus(data.data);
      } else {
        toast.error('Fehler beim Laden des Recovery-Status');
      }
    } catch (error) {
      toast.error('Fehler beim Laden des Recovery-Status');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!exportPassword) {
      toast.error('Passwort erforderlich');
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch('/api/v1/email-recovery/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ password: exportPassword })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(`Email-Export erstellt! ${result.data.email_count} Emails exportiert.`);
        setExportPassword('');
        loadRecoveryStatus();
      } else {
        toast.error(`Export-Fehler: ${result.error}`);
      }
    } catch (error) {
      toast.error('Export fehlgeschlagen');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!recoveryFile || !importPassword) {
      toast.error('Recovery-Datei und Passwort erforderlich');
      return;
    }

    setIsImporting(true);
    try {
      const fileContent = await recoveryFile.text();
      const recoveryData = JSON.parse(fileContent);
      
      const response = await fetch('/api/v1/email-recovery/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          export_id: recoveryData.export_id,
          password: importPassword
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(`Import erfolgreich! ${result.data.imported_count} Emails wiederhergestellt.`);
        setImportPassword('');
        setRecoveryFile(null);
        loadEmails();
      } else {
        toast.error(`Import-Fehler: ${result.error}`);
      }
    } catch (error) {
      toast.error('Import fehlgeschlagen');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadRecoveryFile = async (exportId: string) => {
    try {
      const response = await fetch(`/api/v1/email-recovery/download/${exportId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wpma-email-recovery-${exportId}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success('Recovery-Datei heruntergeladen');
      } else {
        toast.error('Fehler beim Herunterladen der Recovery-Datei');
      }
    } catch (error) {
      toast.error('Fehler beim Herunterladen der Recovery-Datei');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE');
  };

  const getContextIcon = (context: string) => {
    switch (context) {
      case 'notification':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'alert':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'recovered':
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {['view', 'export', 'import', 'status'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'view' && 'Gespeicherte Emails'}
              {tab === 'export' && 'Email-Export'}
              {tab === 'import' && 'Email-Import'}
              {tab === 'status' && 'Recovery-Status'}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'view' && (
        <div className="space-y-4">
          <div className="flex items-center text-sm text-gray-600 mb-4">
            <Shield className="w-4 h-4 mr-2" />
            Alle Emails werden verschlüsselt gespeichert
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-600">Lade Emails...</p>
            </div>
          ) : emails.length > 0 ? (
            <div className="space-y-3">
              {emails.map((email) => (
                <div key={email.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      {getContextIcon(email.context)}
                      <span className="text-sm font-medium text-gray-900">
                        {email.subject}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDate(email.created_at)}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    <p><strong>Von:</strong> {email.from}</p>
                    <p><strong>An:</strong> {email.to}</p>
                    <p className="mt-2">{email.body.substring(0, 200)}...</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Keine gespeicherten Emails gefunden</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'export' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-blue-400 mr-2" />
              <div className="text-sm text-blue-800">
                <strong>Email-Export erstellen</strong>
                <p className="mt-1">Erstellen Sie eine verschlüsselte Sicherung Ihrer WPMA-Emails für den Notfall.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ihr Account-Passwort
              </label>
              <input
                type="password"
                value={exportPassword}
                onChange={(e) => setExportPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="Passwort zur Verifizierung"
              />
            </div>

            <button
              onClick={handleExport}
              disabled={isExporting || !exportPassword}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? 'Exportiere...' : 'Email-Export erstellen'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'import' && (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-yellow-400 mr-2" />
              <div className="text-sm text-yellow-800">
                <strong>Email-Recovery</strong>
                <p className="mt-1">Importieren Sie eine WPMA Email-Sicherung zurück in Ihr Konto.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recovery-Datei
              </label>
              <input
                type="file"
                accept=".json"
                onChange={(e) => setRecoveryFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Export-Passwort
              </label>
              <input
                type="password"
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="Passwort des ursprünglichen Exports"
              />
            </div>

            <button
              onClick={handleImport}
              disabled={!recoveryFile || !importPassword || isImporting}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isImporting ? 'Importiere...' : 'Emails wiederherstellen'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'status' && (
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-600">Lade Status...</p>
            </div>
          ) : recoveryStatus ? (
            <>
              {/* Email-Statistiken */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Email-Statistiken</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{recoveryStatus.email_stats.total_emails}</div>
                    <div className="text-sm text-gray-600">Gesamt</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{recoveryStatus.email_stats.notification_emails}</div>
                    <div className="text-sm text-gray-600">Benachrichtigungen</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{recoveryStatus.email_stats.alert_emails}</div>
                    <div className="text-sm text-gray-600">Alerts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{recoveryStatus.email_stats.recovered_emails}</div>
                    <div className="text-sm text-gray-600">Wiederhergestellt</div>
                  </div>
                </div>
              </div>

              {/* Aktive Exports */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Aktive Recovery-Exports</h3>
                {recoveryStatus.active_exports.length > 0 ? (
                  <div className="space-y-3">
                    {recoveryStatus.active_exports.map((exportItem) => (
                      <div key={exportItem.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {exportItem.downloaded ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <Clock className="w-4 h-4 text-yellow-500" />
                            )}
                            <span className="text-sm font-medium">
                              Export {exportItem.id.substring(0, 8)}...
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500">
                              Läuft ab: {formatDate(exportItem.expires_at)}
                            </span>
                            {!exportItem.downloaded && (
                              <button
                                onClick={() => downloadRecoveryFile(exportItem.id)}
                                className="text-xs text-blue-600 hover:text-blue-800"
                              >
                                Download
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Keine aktiven Recovery-Exports</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <XCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Fehler beim Laden des Recovery-Status</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmailRecovery; 