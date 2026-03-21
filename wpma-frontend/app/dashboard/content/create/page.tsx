'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wand2, Image, Send, Save, ArrowLeft, Plus, X, Loader2,
  Globe, CheckCircle, Eye, EyeOff, Tag,
} from 'lucide-react';
import { contentApi } from '../../../../lib/api';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

type Step = 'compose' | 'media' | 'publish';

function CreatePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const preselectedProjectId = searchParams.get('project');
  const existingPostId = searchParams.get('post');

  const [step, setStep] = useState<Step>('compose');
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Compose form
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState('');
  const [language, setLanguage] = useState('de');
  const [tone, setTone] = useState('professional');
  const [length, setLength] = useState('medium');
  const [additionalInstructions, setAdditionalInstructions] = useState('');

  // Generated content
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [postId, setPostId] = useState<number | null>(existingPostId ? parseInt(existingPostId) : null);
  const [showPreview, setShowPreview] = useState(false);

  // Media
  const [selectedMedia, setSelectedMedia] = useState<any[]>([]);

  // Publish
  const [selectedProjectId, setSelectedProjectId] = useState<string>(preselectedProjectId || '');

  const { data: projectsData } = useQuery({
    queryKey: ['content-projects'],
    queryFn: () => contentApi.listProjects(),
  });
  const projects = projectsData?.data || [];

  // Load existing post if editing
  useEffect(() => {
    if (existingPostId) {
      contentApi.getPost(parseInt(existingPostId)).then(res => {
        if (res.success && res.data) {
          const p = res.data;
          setTitle(p.title || '');
          setContent(p.content || '');
          setExcerpt(p.excerpt || '');
          setKeywords(p.keywords || []);
          setSelectedMedia(p.media || []);
          if (p.project_id) setSelectedProjectId(String(p.project_id));
        }
      });
    }
  }, [existingPostId]);

  const addKeyword = () => {
    const kw = kwInput.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) {
      setKeywords(prev => [...prev, kw]);
    }
    setKwInput('');
  };

  const handleGenerate = async () => {
    if (!topic.trim()) { toast.error('Thema eingeben'); return; }
    setGenerating(true);

    const result = await contentApi.generateContent({
      topic,
      keywords,
      language,
      tone,
      length,
      additional_instructions: additionalInstructions,
      save: false,
    });

    setGenerating(false);

    if (result.success) {
      setTitle(result.data.title || '');
      setContent(result.data.content || '');
      setExcerpt(result.data.excerpt || '');
      toast.success('Content generiert!');
    } else {
      toast.error(result.error || 'Generierung fehlgeschlagen');
    }
  };

  const handleSaveDraft = async () => {
    if (!title || !content) { toast.error('Titel und Content erforderlich'); return; }
    if (!selectedProjectId) { toast.error('Projekt auswählen'); return; }

    if (postId) {
      const res = await contentApi.updatePost(postId, { title, content, excerpt, keywords });
      if (res.success) { toast.success('Gespeichert'); qc.invalidateQueries({ queryKey: ['content-posts'] }); }
      else toast.error(res.error || 'Fehler');
    } else {
      const res = await contentApi.createPost({
        project_id: parseInt(selectedProjectId),
        title, content, excerpt, keywords, language,
      });
      if (res.success) {
        setPostId(res.data.id);
        toast.success('Draft gespeichert');
        qc.invalidateQueries({ queryKey: ['content-posts'] });
      } else {
        toast.error(res.error || 'Fehler');
      }
    }
  };

  const handleAttachMedia = async () => {
    if (!postId) {
      toast.error('Draft zuerst speichern');
      return;
    }
    const featured = selectedMedia.map((m, i) => ({ ...m, is_featured: i === 0 }));
    const res = await contentApi.attachMedia(postId, featured);
    if (res.success) toast.success('Bilder gespeichert');
    else toast.error(res.error || 'Fehler');
  };

  const handlePublish = async () => {
    if (!postId || !selectedProjectId) {
      toast.error('Zuerst Draft speichern und Projekt auswählen');
      return;
    }
    setPublishing(true);
    const res = await contentApi.publishPost(postId, parseInt(selectedProjectId));
    setPublishing(false);

    if (res.success) {
      toast.success('Erfolgreich publiziert!');
      qc.invalidateQueries({ queryKey: ['content-posts'] });
      qc.invalidateQueries({ queryKey: ['content-stats'] });
      router.push('/dashboard/content/track');
    } else {
      toast.error(res.error || 'Publish fehlgeschlagen');
    }
  };

  const STEPS: { id: Step; label: string; icon: React.ReactNode }[] = [
    { id: 'compose', label: 'Compose', icon: <Wand2 className="w-4 h-4" /> },
    { id: 'media', label: 'Media', icon: <Image className="w-4 h-4" /> },
    { id: 'publish', label: 'Publish', icon: <Send className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/content" className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </Link>
          <h1 className="text-base font-semibold">Content erstellen</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveDraft}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            Draft speichern
          </button>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="border-b border-white/5 px-6 py-3">
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(s.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                step === s.id
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* ---- STEP: COMPOSE ---- */}
        {step === 'compose' && (
          <div className="grid lg:grid-cols-2 gap-6 max-w-6xl">
            {/* AI Generator */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-violet-400" />
                KI-Generator
              </h2>

              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Thema / Titel *</label>
                  <input
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                    placeholder="z.B. 360-Grad-Fotografie für Immobilien"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500/50 placeholder:text-gray-600"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Keywords</label>
                  <div className="flex gap-2">
                    <input
                      value={kwInput}
                      onChange={e => setKwInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                      placeholder="Keyword eingeben + Enter"
                      className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500/50 placeholder:text-gray-600"
                    />
                    <button onClick={addKeyword} className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {keywords.map(kw => (
                        <span
                          key={kw}
                          className="flex items-center gap-1 px-2 py-0.5 bg-violet-500/15 text-violet-300 text-xs rounded-full"
                        >
                          <Tag className="w-3 h-3" />
                          {kw}
                          <button onClick={() => setKeywords(prev => prev.filter(k => k !== kw))}>
                            <X className="w-3 h-3 hover:text-white" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Sprache</label>
                    <select
                      value={language}
                      onChange={e => setLanguage(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-sm outline-none focus:border-violet-500/50"
                    >
                      <option value="de">Deutsch</option>
                      <option value="en">English</option>
                      <option value="fr">Français</option>
                      <option value="es">Español</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Ton</label>
                    <select
                      value={tone}
                      onChange={e => setTone(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-sm outline-none focus:border-violet-500/50"
                    >
                      <option value="professional">Professionell</option>
                      <option value="casual">Locker</option>
                      <option value="expert">Fachlich</option>
                      <option value="friendly">Freundlich</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Länge</label>
                    <select
                      value={length}
                      onChange={e => setLength(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-sm outline-none focus:border-violet-500/50"
                    >
                      <option value="short">Kurz (~300)</option>
                      <option value="medium">Mittel (~600)</option>
                      <option value="long">Lang (~1200)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Zusätzliche Hinweise</label>
                  <textarea
                    value={additionalInstructions}
                    onChange={e => setAdditionalInstructions(e.target.value)}
                    placeholder="z.B. Fokus auf technische Aspekte, erwähne unsere Software..."
                    rows={2}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500/50 placeholder:text-gray-600 resize-none"
                  />
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={generating || !topic.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                >
                  {generating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generiert...</>
                  ) : (
                    <><Wand2 className="w-4 h-4" /> Mit Claude generieren</>
                  )}
                </button>
              </div>

              {/* Project selector */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Zielprojekt
                </label>
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500/50"
                >
                  <option value="">— Projekt wählen —</option>
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Editor + Preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-300">Editor</h2>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showPreview ? 'Editor' : 'Vorschau'}
                </button>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3">
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Titel"
                  className="w-full bg-transparent text-lg font-semibold outline-none placeholder:text-gray-600 border-b border-white/5 pb-2"
                />
                <input
                  value={excerpt}
                  onChange={e => setExcerpt(e.target.value)}
                  placeholder="Kurzbeschreibung / Excerpt..."
                  className="w-full bg-transparent text-sm text-gray-400 outline-none placeholder:text-gray-600"
                />
                {showPreview ? (
                  <div
                    className="prose prose-invert prose-sm max-w-none text-gray-300 text-sm leading-relaxed min-h-[300px]"
                    dangerouslySetInnerHTML={{
                      __html: content
                        .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-white mt-4 mb-2">$1</h3>')
                        .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-white mt-5 mb-2">$1</h2>')
                        .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-white mt-6 mb-3">$1</h1>')
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n\n/g, '<br/><br/>'),
                    }}
                  />
                ) : (
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Content hier eingeben oder mit KI generieren..."
                    className="w-full bg-transparent text-sm text-gray-300 outline-none placeholder:text-gray-600 resize-none min-h-[300px] leading-relaxed"
                    rows={16}
                  />
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep('media')}
                  disabled={!title || !content}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 rounded-lg text-sm transition-colors"
                >
                  <Image className="w-4 h-4" />
                  Bilder hinzufügen
                </button>
                <button
                  onClick={() => setStep('publish')}
                  disabled={!title || !content || !selectedProjectId}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Publizieren
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---- STEP: MEDIA ---- */}
        {step === 'media' && (
          <MediaStep
            selectedMedia={selectedMedia}
            onSelect={setSelectedMedia}
            onNext={() => setStep('publish')}
            defaultQuery={keywords[0] || topic}
          />
        )}

        {/* ---- STEP: PUBLISH ---- */}
        {step === 'publish' && (
          <div className="max-w-xl space-y-6">
            <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Send className="w-4 h-4 text-violet-400" />
              Publish
            </h2>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 space-y-4">
              <div className="border-b border-white/5 pb-4">
                <div className="text-xs text-gray-400 mb-1">Post</div>
                <div className="font-medium">{title || '(kein Titel)'}</div>
                <div className="text-sm text-gray-500 mt-1">{excerpt || content.slice(0, 100)}...</div>
              </div>

              {selectedMedia.length > 0 && (
                <div className="border-b border-white/5 pb-4">
                  <div className="text-xs text-gray-400 mb-2">Media ({selectedMedia.length})</div>
                  <div className="flex gap-2 flex-wrap">
                    {selectedMedia.map((m: any, i: number) => (
                      <div key={m.pexels_id} className="relative">
                        <img src={m.thumbnail_url} alt={m.alt_text} className="w-16 h-16 object-cover rounded-lg" />
                        {i === 0 && (
                          <span className="absolute -top-1 -right-1 text-[9px] bg-violet-600 px-1 rounded text-white">★</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs text-gray-400 mb-2">Zielprojekt</div>
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500/50"
                >
                  <option value="">— Projekt wählen —</option>
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveDraft}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
              >
                <Save className="w-4 h-4" />
                Als Draft speichern
              </button>
              <button
                onClick={async () => { await handleSaveDraft(); if (selectedMedia.length > 0) await handleAttachMedia(); await handlePublish(); }}
                disabled={publishing || !selectedProjectId || !title || !content}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
              >
                {publishing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Publiziert...</>
                ) : (
                  <><Send className="w-4 h-4" /> Jetzt publizieren</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MediaStep({
  selectedMedia, onSelect, onNext, defaultQuery,
}: {
  selectedMedia: any[];
  onSelect: (m: any[]) => void;
  onNext: () => void;
  defaultQuery: string;
}) {
  const [query, setQuery] = useState(defaultQuery || '');
  const [page, setPage] = useState(1);
  const [searching, setSearching] = useState(false);
  const [photos, setPhotos] = useState<any[]>([]);
  const [totalResults, setTotalResults] = useState(0);

  const search = async (q = query, p = 1) => {
    if (!q.trim()) return;
    setSearching(true);
    const res = await contentApi.searchMedia(q, { page: p, per_page: 15 });
    setSearching(false);
    if (res.success) {
      setPhotos(p === 1 ? res.data.photos : [...photos, ...res.data.photos]);
      setTotalResults(res.data.total_results || 0);
      setPage(p);
    }
  };

  useEffect(() => {
    if (defaultQuery) search(defaultQuery, 1);
  }, []);

  const toggle = (photo: any) => {
    const exists = selectedMedia.find(m => m.pexels_id === photo.pexels_id);
    if (exists) {
      onSelect(selectedMedia.filter(m => m.pexels_id !== photo.pexels_id));
    } else if (selectedMedia.length < 10) {
      onSelect([...selectedMedia, photo]);
    }
  };

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Image className="w-4 h-4 text-blue-400" />
          Pexels Media — {selectedMedia.length} ausgewählt
        </h2>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition-colors"
        >
          Weiter zu Publish →
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search(query, 1)}
          placeholder="Pexels durchsuchen..."
          className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500/50 placeholder:text-gray-600"
        />
        <button
          onClick={() => search(query, 1)}
          disabled={searching}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm transition-colors"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Suchen'}
        </button>
      </div>

      {selectedMedia.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {selectedMedia.map((m: any, i: number) => (
            <div key={m.pexels_id} className="relative">
              <img src={m.thumbnail_url} alt={m.alt_text} className="w-20 h-20 object-cover rounded-lg border-2 border-blue-500" />
              {i === 0 && <span className="absolute -top-1 -right-1 text-[9px] bg-violet-600 px-1.5 py-0.5 rounded text-white font-medium">Featured</span>}
              <button
                onClick={() => toggle(m)}
                className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {photos.map((photo: any) => {
          const isSelected = selectedMedia.some(m => m.pexels_id === photo.pexels_id);
          return (
            <button
              key={photo.pexels_id}
              onClick={() => toggle(photo)}
              className={`relative group aspect-square overflow-hidden rounded-xl border-2 transition-all ${
                isSelected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-transparent hover:border-white/20'
              }`}
            >
              <img src={photo.thumbnail_url} alt={photo.alt_text} className="w-full h-full object-cover" />
              {isSelected && (
                <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-blue-400" />
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[10px] text-white truncate">{photo.photographer}</p>
              </div>
            </button>
          );
        })}
      </div>

      {photos.length > 0 && photos.length < totalResults && (
        <button
          onClick={() => search(query, page + 1)}
          disabled={searching}
          className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-400 transition-colors"
        >
          {searching ? 'Lädt...' : `Mehr laden (${totalResults - photos.length} weitere)`}
        </button>
      )}

      {photos.length === 0 && !searching && (
        <div className="text-center py-12 text-gray-500">
          <Image className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Suchbegriff eingeben um Pexels-Fotos zu finden</p>
        </div>
      )}
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Lädt...</div>}>
      <CreatePageInner />
    </Suspense>
  );
}
