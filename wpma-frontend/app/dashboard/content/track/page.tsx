'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle, XCircle, Clock, RefreshCw, ArrowLeft,
  ExternalLink, ChevronDown, ChevronUp, Filter,
} from 'lucide-react';
import { contentApi } from '../../../../lib/api';
import Link from 'next/link';

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  published: { label: 'Publiziert', icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-400' },
  draft: { label: 'Draft', icon: <Clock className="w-4 h-4" />, color: 'text-yellow-400' },
  failed: { label: 'Fehlgeschlagen', icon: <XCircle className="w-4 h-4" />, color: 'text-red-400' },
  publishing: { label: 'Wird publiziert', icon: <RefreshCw className="w-4 h-4 animate-spin" />, color: 'text-blue-400' },
};

export default function TrackPage() {
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedPost, setExpandedPost] = useState<number | null>(null);

  const { data: postsData, isLoading } = useQuery({
    queryKey: ['content-posts-track', filterStatus],
    queryFn: () => contentApi.listPosts({ status: filterStatus || undefined, limit: 50 }),
    refetchInterval: 15000,
  });

  const { data: jobsData } = useQuery({
    queryKey: ['publish-jobs'],
    queryFn: () => contentApi.listJobs({ limit: 100 }),
    refetchInterval: 15000,
  });

  const posts = postsData?.data?.posts || [];
  const jobs = jobsData?.data || [];

  const getJobsForPost = (postId: number) =>
    jobs.filter((j: any) => j.post_id === postId);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/content" className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </Link>
          <h1 className="text-base font-semibold">Publish-Verlauf</h1>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none"
          >
            <option value="">Alle Status</option>
            <option value="published">Publiziert</option>
            <option value="draft">Draft</option>
            <option value="failed">Fehlgeschlagen</option>
          </select>
        </div>
      </div>

      <div className="p-6">
        {isLoading && (
          <div className="text-center py-12 text-gray-500 text-sm">Lädt...</div>
        )}

        {!isLoading && posts.length === 0 && (
          <div className="text-center py-16">
            <Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Keine Posts gefunden</p>
            <Link href="/dashboard/content/create" className="mt-3 inline-block text-sm text-violet-400 hover:text-violet-300">
              → Ersten Content erstellen
            </Link>
          </div>
        )}

        <div className="space-y-3 max-w-4xl">
          {posts.map((post: any) => {
            const statusCfg = STATUS_CONFIG[post.status] || STATUS_CONFIG.draft;
            const postJobs = getJobsForPost(post.id);
            const isExpanded = expandedPost === post.id;

            return (
              <div key={post.id} className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className={`mt-0.5 ${statusCfg.color}`}>{statusCfg.icon}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{post.title}</div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className={`text-xs font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                          {post.project_name && (
                            <span className="text-xs text-gray-500">{post.project_name}</span>
                          )}
                          {post.published_at && (
                            <span className="text-xs text-gray-500">
                              {new Date(post.published_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          )}
                          {post.remote_url && (
                            <a
                              href={post.remote_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                            >
                              Live <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {post.featured_image && (
                        <img src={post.featured_image} alt="" className="w-10 h-10 object-cover rounded-lg" />
                      )}
                      {postJobs.length > 0 && (
                        <button
                          onClick={() => setExpandedPost(isExpanded ? null : post.id)}
                          className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-gray-400"
                          title="Deploy-Jobs anzeigen"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                      <Link
                        href={`/dashboard/content/create?post=${post.id}`}
                        className="text-xs px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        Bearbeiten
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Deploy-Jobs */}
                {isExpanded && postJobs.length > 0 && (
                  <div className="border-t border-white/5 divide-y divide-white/5">
                    {postJobs.map((job: any) => (
                      <div key={job.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={
                            job.status === 'success' ? 'text-green-400' :
                            job.status === 'failed' ? 'text-red-400' :
                            job.status === 'running' ? 'text-blue-400' : 'text-gray-400'
                          }>
                            {job.status === 'success' ? '✓' : job.status === 'failed' ? '✕' : '◌'}
                          </span>
                          <span className="text-gray-400">{job.project_name}</span>
                          <span className="text-gray-600">({job.adapter_type})</span>
                          {job.error_message && (
                            <span className="text-red-400 max-w-xs truncate" title={job.error_message}>
                              {job.error_message}
                            </span>
                          )}
                        </div>
                        <span className="text-gray-600">
                          {new Date(job.created_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
