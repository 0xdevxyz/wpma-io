'use client';

import { useState, useEffect } from 'react';
import { 
  Brain, 
  Sparkles, 
  AlertTriangle, 
  Shield, 
  Zap, 
  RefreshCw,
  MessageSquare,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowUpRight,
  Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIInsightsPanelProps {
  siteId: string;
  className?: string;
}

interface Analysis {
  critical: string[];
  important: string[];
  recommendations: string[];
  auto_actions: string[];
  summary: {
    score: number;
    priorities: string[];
  };
}

interface AIInsight {
  id: string;
  insight_type: string;
  title: string;
  description: string;
  data: any;
  created_at: string;
}

export default function AIInsightsPanel({ siteId, className }: AIInsightsPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [rawAnalysis, setRawAnalysis] = useState<string>('');
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'chat'>('overview');
  const [aiConfigured, setAiConfigured] = useState(true);

  // Chat State
  const [chatMessages, setChatMessages] = useState<{role: string; content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  useEffect(() => {
    fetchInsights();
    checkAIStatus();
  }, [siteId]);

  const checkAIStatus = async () => {
    try {
      const token = localStorage.getItem('wpma_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/ai/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setAiConfigured(data.data?.configured || false);
    } catch (err) {
      console.error('AI status check failed:', err);
    }
  };

  const fetchInsights = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('wpma_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/ai/${siteId}/insights`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success && data.insights) {
        setInsights(data.insights);
        
        // Suche nach der letzten vollständigen Analyse
        const fullAnalysis = data.insights.find((i: AIInsight) => i.insight_type === 'full_analysis');
        if (fullAnalysis?.data?.parsed) {
          setAnalysis(fullAnalysis.data.parsed);
          setRawAnalysis(fullAnalysis.data.raw || '');
        }
      }
    } catch (err) {
      console.error('Error fetching insights:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const runFullAnalysis = async () => {
    try {
      setIsAnalyzing(true);
      setError(null);
      
      const token = localStorage.getItem('wpma_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/ai/${siteId}/analyze`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setAnalysis(data.data.analysis);
        setRawAnalysis(data.data.raw || '');
        fetchInsights(); // Refresh insights list
      } else {
        setError(data.error || 'Analyse fehlgeschlagen');
      }
    } catch (err) {
      setError('Verbindungsfehler bei KI-Analyse');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsChatLoading(true);
    
    try {
      const token = localStorage.getItem('wpma_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/ai/${siteId}/chat`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMessage,
          history: chatMessages
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.data?.response) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.data.response }]);
      } else {
        setChatMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Entschuldigung, ich konnte die Anfrage nicht verarbeiten. Bitte versuchen Sie es erneut.' 
        }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Verbindungsfehler. Bitte prüfen Sie Ihre Internetverbindung.' 
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'from-emerald-500/20 to-emerald-500/5';
    if (score >= 60) return 'from-amber-500/20 to-amber-500/5';
    return 'from-red-500/20 to-red-500/5';
  };

  return (
    <div className={cn("bg-slate-900 border border-slate-800 rounded-xl overflow-hidden", className)}>
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600/20 via-indigo-600/20 to-cyan-600/20 border-b border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                KI-Analyse
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h3>
              <p className="text-xs text-slate-400">Powered by Claude & GPT-4</p>
            </div>
          </div>
          
          <button
            onClick={runFullAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analysiere...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Neue Analyse
              </>
            )}
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          {(['overview', 'details', 'chat'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                activeTab === tab 
                  ? "bg-white/10 text-white" 
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              {tab === 'overview' && 'Übersicht'}
              {tab === 'details' && 'Details'}
              {tab === 'chat' && (
                <span className="flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  KI-Chat
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        
        {!aiConfigured && (
          <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-400 font-medium">KI nicht vollständig konfiguriert</p>
                <p className="text-slate-400 text-sm mt-1">
                  Für erweiterte KI-Analysen konfigurieren Sie bitte einen API-Key (ANTHROPIC_API_KEY oder OPENROUTER_API_KEY).
                  Basis-Analysen funktionieren weiterhin.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Score Card */}
            {analysis?.summary && (
              <div className={cn(
                "p-6 rounded-xl bg-gradient-to-br",
                getScoreBg(analysis.summary.score || 75)
              )}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Gesundheits-Score</p>
                    <div className="flex items-end gap-2">
                      <span className={cn("text-5xl font-bold", getScoreColor(analysis.summary.score || 75))}>
                        {analysis.summary.score || 75}
                      </span>
                      <span className="text-slate-400 text-lg mb-2">/100</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-sm mb-2">Top Prioritäten</p>
                    <div className="space-y-1">
                      {(analysis.summary.priorities || []).slice(0, 3).map((p, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                          <ChevronRight className="w-3 h-3 text-violet-400" />
                          <span className="truncate max-w-[200px]">{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-red-400 font-medium">Kritisch</span>
                </div>
                <p className="text-2xl font-bold text-white">{analysis?.critical?.length || 0}</p>
              </div>
              
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-amber-400 font-medium">Wichtig</span>
                </div>
                <p className="text-2xl font-bold text-white">{analysis?.important?.length || 0}</p>
              </div>
              
              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs text-cyan-400 font-medium">Empfehlungen</span>
                </div>
                <p className="text-2xl font-bold text-white">{analysis?.recommendations?.length || 0}</p>
              </div>
              
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">Auto-Fix</span>
                </div>
                <p className="text-2xl font-bold text-white">{analysis?.auto_actions?.length || 0}</p>
              </div>
            </div>
            
            {/* Critical Issues */}
            {analysis?.critical && analysis.critical.length > 0 && (
              <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                <h4 className="text-red-400 font-medium mb-3 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Kritische Probleme
                </h4>
                <ul className="space-y-2">
                  {analysis.critical.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* No Analysis Yet */}
            {!analysis && !isLoading && !isAnalyzing && (
              <div className="text-center py-12">
                <Brain className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h4 className="text-slate-400 font-medium mb-2">Noch keine Analyse vorhanden</h4>
                <p className="text-slate-500 text-sm mb-4">
                  Starten Sie eine KI-Analyse, um detaillierte Empfehlungen zu erhalten.
                </p>
                <button
                  onClick={runFullAnalysis}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium rounded-lg hover:from-violet-500 hover:to-indigo-500 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  Erste Analyse starten
                </button>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'details' && (
          <div className="space-y-4">
            {/* Important Issues */}
            {analysis?.important && analysis.important.length > 0 && (
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <h4 className="text-amber-400 font-medium mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Wichtige Probleme
                </h4>
                <ul className="space-y-2">
                  {analysis.important.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Recommendations */}
            {analysis?.recommendations && analysis.recommendations.length > 0 && (
              <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
                <h4 className="text-cyan-400 font-medium mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Empfehlungen
                </h4>
                <ul className="space-y-2">
                  {analysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full mt-2 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Auto Actions */}
            {analysis?.auto_actions && analysis.auto_actions.length > 0 && (
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                <h4 className="text-emerald-400 font-medium mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Automatische Aktionen verfügbar
                </h4>
                <ul className="space-y-2">
                  {analysis.auto_actions.map((action, i) => (
                    <li key={i} className="flex items-start justify-between gap-2 text-sm">
                      <span className="flex items-start gap-2 text-slate-300">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-2 flex-shrink-0" />
                        {action}
                      </span>
                      <button className="text-emerald-400 hover:text-emerald-300 text-xs whitespace-nowrap flex items-center gap-1">
                        Ausführen <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Raw Analysis */}
            {rawAnalysis && (
              <details className="group">
                <summary className="cursor-pointer text-slate-400 hover:text-slate-300 text-sm flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
                  Vollständige Analyse anzeigen
                </summary>
                <div className="mt-3 p-4 bg-slate-800/50 rounded-lg overflow-auto max-h-96">
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap">{rawAnalysis}</pre>
                </div>
              </details>
            )}
          </div>
        )}
        
        {activeTab === 'chat' && (
          <div className="flex flex-col h-[400px]">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <Bot className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">
                    Stellen Sie eine Frage zu Ihrer WordPress-Site
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {[
                      'Wie kann ich die Performance verbessern?',
                      'Gibt es Sicherheitsprobleme?',
                      'Welche Plugins sollte ich updaten?'
                    ].map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => setChatInput(suggestion)}
                        className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-full transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-3",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] p-3 rounded-lg text-sm",
                      msg.role === 'user'
                        ? "bg-violet-600 text-white"
                        : "bg-slate-800 text-slate-200"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              
              {isChatLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-slate-800 p-3 rounded-lg">
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                  </div>
                </div>
              )}
            </div>
            
            {/* Chat Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Frage stellen..."
                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatInput.trim() || isChatLoading}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

