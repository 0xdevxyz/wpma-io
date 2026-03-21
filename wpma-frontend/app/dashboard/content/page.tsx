'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  PenLine, Globe, Zap, BarChart2, Plus, ChevronRight,
  FileText, CheckCircle, Clock, XCircle, Settings,
  Layers, RefreshCw, ArrowRight,
} from 'lucide-react';
import { contentApi } from '../../../lib/api';
import { useAuthStore } from '../../../lib/auth-store';
import Link from 'next/link';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  wordpress: { label: 'WordPress', color: 'text-blue-400 bg-blue-400/10' },
  static_html: { label: 'Static HTML', color: 'text-green-400 bg-green-400/10' },
  webflow: { label: 'Webflow', color: 'text-purple-400 bg-purple-400/10' },
  custom: { label: 'Custom', color: 'text-orange-400 bg-orange-400/10' },
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  published: <CheckCircle className="w-4 h-4 text-green-400" />,
  draft: <Clock className="w-4 h-4 text-yellow-400" />,
  failed: <XCircle className="w-4 h-4 text-red-400" />,
  publishing: <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />,
};

export default function ContentHubPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [showNewProject, setShowNewProject] = useState(false);

  const { data: statsData } = useQuery({
    queryKey: ['content-stats'],
    queryFn: () => contentApi.getStats(),
    refetchInterval: 30000,
  });

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['content-projects'],
    queryFn: () => contentApi.listProjects(),
  });

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['content-posts', { limit: 10 }],
    queryFn: () => contentApi.listPosts({ limit: 10 }),
  });

  const stats = statsData?.data;
  const projects = projectsData?.data || [];
  const posts = postsData?.data?.posts || [];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-violet-500/20 to-blue-500/20 rounded-lg border border-violet-500/20">
            <PenLine className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Content Publishing Hub</h1>
            <p className="text-sm text-gray-400">Claude AI · Pexels · Multi-Channel Publisher</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/content/create"
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Content erstellen
          </Link>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Aktive Projekte', value: stats?.active_projects ?? '—', icon: <Layers className="w-5 h-5 text-violet-400" />, bg: 'from-violet-500/10 to-transparent' },
            { label: 'Posts gesamt', value: stats?.total_posts ?? '—', icon: <FileText className="w-5 h-5 text-blue-400" />, bg: 'from-blue-500/10 to-transparent' },
            { label: 'Publiziert', value: stats?.published_posts ?? '—', icon: <CheckCircle className="w-5 h-5 text-green-400" />, bg: 'from-green-500/10 to-transparent' },
            { label: 'Deploys', value: stats?.successful_publishes ?? '—', icon: <Zap className="w-5 h-5 text-yellow-400" />, bg: 'from-yellow-500/10 to-transparent' },
          ].map((s) => (
            <div key={s.label} className={`bg-gradient-to-br ${s.bg} border border-white/5 rounded-xl p-4`}>
              <div className="flex items-center justify-between mb-2">
                {s.icon}
              </div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Projects */}
          <div className="lg:col-span-1 bg-white/[0.02] border border-white/5 rounded-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Projekte
              </h2>
              <button
                onClick={() => setShowNewProject(true)}
                className="p-1 hover:bg-white/5 rounded-md transition-colors"
                title="Projekt hinzufügen"
              >
                <Plus className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="divide-y divide-white/5">
              {projectsLoading && (
                <div className="p-4 text-center text-sm text-gray-500">Lädt...</div>
              )}
              {!projectsLoading && projects.length === 0 && (
                <div className="p-6 text-center">
                  <Globe className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Noch keine Projekte</p>
                  <button
                    onClick={() => setShowNewProject(true)}
                    className="mt-3 text-xs text-violet-400 hover:text-violet-300"
                  >
                    + Erstes Projekt anlegen
                  </button>
                </div>
              )}
              {projects.map((project: any) => {
                const typeInfo = TYPE_LABELS[project.type] || TYPE_LABELS.custom;
                return (
                  <div key={project.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{project.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            {project.published_count}/{project.post_count} pub.
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => router.push(`/dashboard/content/create?project=${project.id}`)}
                        className="shrink-0 p-1 hover:bg-white/5 rounded-md transition-colors"
                        title="Content erstellen"
                      >
                        <ArrowRight className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Posts */}
          <div className="lg:col-span-2 bg-white/[0.02] border border-white/5 rounded-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Letzte Posts
              </h2>
              <Link href="/dashboard/content/track" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                Alle <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-white/5">
              {postsLoading && (
                <div className="p-4 text-center text-sm text-gray-500">Lädt...</div>
              )}
              {!postsLoading && posts.length === 0 && (
                <div className="p-8 text-center">
                  <PenLine className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 mb-1">Noch keine Posts erstellt</p>
                  <p className="text-xs text-gray-500 mb-4">
                    Erstelle deinen ersten AI-generierten Content
                  </p>
                  <Link
                    href="/dashboard/content/create"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Content erstellen
                  </Link>
                </div>
              )}
              {posts.map((post: any) => (
                <div key={post.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {STATUS_ICONS[post.status] || STATUS_ICONS.draft}
                        <span className="text-sm font-medium truncate">{post.title}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">{post.project_name || '—'}</span>
                        {post.remote_url && (
                          <a
                            href={post.remote_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-violet-400 hover:underline flex items-center gap-1"
                          >
                            Live <ArrowRight className="w-3 h-3" />
                          </a>
                        )}
                        <span className="text-xs text-gray-600">
                          {new Date(post.created_at).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        href={`/dashboard/content/create?post=${post.id}`}
                        className="p-1.5 hover:bg-white/5 rounded-md text-gray-400 hover:text-white transition-colors"
                        title="Bearbeiten"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick-Actions */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              href: '/dashboard/content/create',
              icon: <PenLine className="w-5 h-5 text-violet-400" />,
              bg: 'from-violet-500/5',
              title: 'Content erstellen',
              desc: 'Claude generiert Text + Pexels-Bilder',
            },
            {
              href: '/dashboard/content/media',
              icon: <BarChart2 className="w-5 h-5 text-blue-400" />,
              bg: 'from-blue-500/5',
              title: 'Media Browser',
              desc: 'Pexels-Bilder suchen und verwalten',
            },
            {
              href: '/dashboard/content/track',
              icon: <CheckCircle className="w-5 h-5 text-green-400" />,
              bg: 'from-green-500/5',
              title: 'Publish-Verlauf',
              desc: 'Status aller Deploy-Jobs tracken',
            },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`bg-gradient-to-br ${action.bg} to-transparent border border-white/5 rounded-xl p-4 hover:border-white/10 hover:bg-white/[0.04] transition-all group`}
            >
              <div className="flex items-center justify-between mb-3">
                {action.icon}
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="text-sm font-medium">{action.title}</div>
              <div className="text-xs text-gray-500 mt-1">{action.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} />
      )}
    </div>
  );
}

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: '', type: 'wordpress', url: '' });
  const [config, setConfig] = useState({ wp_url: '', wp_user: '', wp_app_password: '', agent_url: '', webhook_url: '' });
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const projectConfig: Record<string, string> = {};
    if (form.type === 'wordpress') {
      projectConfig.wp_url = config.wp_url;
      projectConfig.wp_user = config.wp_user;
      projectConfig.wp_app_password = config.wp_app_password;
    } else if (form.type === 'static_html') {
      projectConfig.agent_url = config.agent_url;
    } else {
      projectConfig.webhook_url = config.webhook_url;
    }

    const result = await contentApi.createProject({ ...form, config: projectConfig });
    setLoading(false);

    if (result.success) {
      setToken(result.data.agent_token);
    }
  };

  if (token) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border border-white/10 rounded-xl p-6 max-w-md w-full">
          <h3 className="text-lg font-semibold mb-2 text-green-400">✓ Projekt erstellt!</h3>
          <p className="text-sm text-gray-400 mb-4">
            Speichere diesen Agent-Token sicher — er wird <strong className="text-white">nur einmal</strong> angezeigt:
          </p>
          <div className="bg-black/40 border border-white/10 rounded-lg p-3 font-mono text-xs break-all text-green-300 mb-4">
            {token}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(token)}
              className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
            >
              Kopieren
            </button>
            <button
              onClick={() => { setToken(null); onClose(); router.refresh(); }}
              className="flex-1 px-3 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm transition-colors"
            >
              Fertig
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-white/10 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Neues Projekt</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Name</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="z.B. panoart360 Blog"
              required
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Typ</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500/50"
            >
              <option value="wordpress">WordPress (REST API)</option>
              <option value="static_html">Static HTML (wpma-agent)</option>
              <option value="webflow">Webflow (Webhook)</option>
              <option value="custom">Custom (Webhook)</option>
            </select>
          </div>

          {form.type === 'wordpress' && (
            <>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">WordPress URL</label>
                <input
                  value={config.wp_url}
                  onChange={e => setConfig(c => ({ ...c, wp_url: e.target.value }))}
                  placeholder="https://example.com"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">WP Benutzername</label>
                <input
                  value={config.wp_user}
                  onChange={e => setConfig(c => ({ ...c, wp_user: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Application Password</label>
                <input
                  type="password"
                  value={config.wp_app_password}
                  onChange={e => setConfig(c => ({ ...c, wp_app_password: e.target.value }))}
                  placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500/50"
                />
                <p className="text-xs text-gray-600 mt-1">WP Admin → Benutzer → Profil → Application Passwords</p>
              </div>
            </>
          )}

          {form.type === 'static_html' && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Agent URL</label>
              <input
                value={config.agent_url}
                onChange={e => setConfig(c => ({ ...c, agent_url: e.target.value }))}
                placeholder="https://example.com/wpma-publisher.php"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500/50"
              />
              <p className="text-xs text-gray-600 mt-1">URL des wpma-publisher.php Agents auf dem Server</p>
            </div>
          )}

          {(form.type === 'webflow' || form.type === 'custom') && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Webhook URL</label>
              <input
                value={config.webhook_url}
                onChange={e => setConfig(c => ({ ...c, webhook_url: e.target.value }))}
                placeholder="https://hooks.example.com/wpma"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500/50"
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading || !form.name}
              className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Erstelle...' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
