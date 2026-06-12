import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/ui/Header';
import Icon from '../components/ui/Icon';
import StoryQrModal from '../components/ui/StoryQrModal';
import { listStories, saveStory, deleteStory } from '../api/sceneApi';
import { useTranslation } from 'react-i18next';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1)  return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30)   return `há ${d} dia${d > 1 ? 's' : ''}`;
  const m = Math.floor(d / 30);
  return `há ${m} ${m > 1 ? 'meses' : 'mês'}`;
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-800 p-5 flex flex-col gap-3 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-gray-700" />
          <div className="h-3 w-1/2 rounded bg-gray-700/60" />
        </div>
        <div className="h-5 w-14 rounded-full bg-gray-700/60" />
      </div>
      <div className="h-3 w-full rounded bg-gray-700/40" />
      <div className="flex gap-2 mt-1">
        <div className="h-8 w-16 rounded-lg bg-gray-700/60" />
        <div className="h-8 w-12 rounded-lg bg-gray-700/60" />
        <div className="h-8 w-8 rounded-lg bg-gray-700/40" />
      </div>
    </div>
  );
}

function StoryCard({ story, onDelete, deleting }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const shareUrl = `${window.location.origin}/story/${encodeURIComponent(story.storyId)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="group rounded-2xl border border-gray-700 bg-gray-800 p-5 flex flex-col gap-4 hover:border-gray-600 transition-colors">
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate" title={story.metadata?.title}>
            {story.metadata?.title || t('storiesEmptyTitle')}
          </h3>
          {story.metadata?.description && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
              {story.metadata.description}
            </p>
          )}
        </div>
        {/* Scene count badge */}
        <div className="shrink-0 flex items-center gap-1 rounded-full bg-gray-700/60 px-2.5 py-1 text-[11px] text-gray-300">
          <Icon name="scene" className="w-3.5 h-3.5" />
          <span>{t('storiesCardScenes', { count: story.sceneCount ?? 0 })}</span>
        </div>
      </div>

      {/* Date */}
      <p className="text-[11px] text-gray-500">
        {t('storiesCardEdited', { time: timeAgo(story.updatedAt) })}
      </p>

      {/* Share link */}
      <div className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900/60 px-3 py-2">
        <span className="text-[10px] text-gray-500 truncate flex-1 font-mono">{shareUrl}</span>
        <button
          onClick={() => setShowQr(true)}
          title={t('qrButton')}
          className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors flex items-center gap-1"
        >
          <Icon name="qrcode" className="w-3.5 h-3.5" /> {t('qrButton')}
        </button>
        <button
          onClick={handleCopy}
          className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
            copied
              ? 'bg-emerald-700/60 text-emerald-300'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }`}
        >
          {copied ? t('storiesCardCopied') : t('storiesCardCopy')}
        </button>
      </div>

      {showQr && (
        <StoryQrModal
          url={shareUrl}
          title={story.metadata?.title}
          onClose={() => setShowQr(false)}
        />
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Link
          to={`/editor?storyId=${encodeURIComponent(story.storyId)}`}
          className="flex-1 text-center py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium transition-colors"
        >
          {t('storiesCardEdit')}
        </Link>
        <Link
          to={`/story/${encodeURIComponent(story.storyId)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-xs transition-colors"
        >
          {t('storiesCardView')}
        </Link>
        <button
          onClick={() => onDelete(story.storyId, story.metadata?.title)}
          disabled={deleting === story.storyId}
          title={t('delete')}
          className="px-3 py-2 rounded-xl bg-red-900/40 hover:bg-red-900/70 disabled:opacity-40 text-red-300 text-xs transition-colors"
        >
          {deleting === story.storyId ? '…' : <Icon name="trash" className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default function StoriesPage() {
  const { t } = useTranslation();
  const navigate  = useNavigate();
  const titleRef  = useRef(null);

  const [stories, setStories]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [deleting, setDeleting] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle]     = useState('');
  const [newDesc, setNewDesc]       = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listStories();
      setStories(data?.stories || []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || t('storiesErrorLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Focus title input when form opens
  useEffect(() => {
    if (showCreate) setTimeout(() => titleRef.current?.focus(), 50);
  }, [showCreate]);

  const handleCreate = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await saveStory({
        metadata: {
          title:       newTitle.trim() || t('storiesCreateSectionTitle'),
          description: newDesc.trim()  || '',
          language:    'pt',
        },
        scenes: [],
      });
      navigate(`/editor?storyId=${encodeURIComponent(result.storyId)}`);
    } catch (err) {
      setError(err?.response?.data?.error || t('storiesErrorCreate'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (storyId, title) => {
    if (!window.confirm(t('storiesDeleteConfirm', { title: title || '' }))) return;
    setDeleting(storyId);
    try {
      await deleteStory(storyId);
      setStories((prev) => prev.filter((s) => s.storyId !== storyId));
    } catch (err) {
      setError(err?.response?.data?.error || t('storiesErrorDelete'));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex flex-col h-dvh bg-gray-900 text-white overflow-hidden">
      <Header />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-6">

          {/* Page header */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">{t('storiesPageTitle')}</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {loading ? '...' : t('storiesCount', { count: stories.length })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/scenes"
                className="px-3 py-2 rounded-xl border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white text-xs transition-colors hidden sm:inline-flex"
              >
                {t('storiesMyScenes')}
              </Link>
              <button
                onClick={() => { setShowCreate((v) => !v); setNewTitle(''); setNewDesc(''); }}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
              >
                {showCreate ? t('storiesCancelBtn') : t('storiesNewBtn')}
              </button>
            </div>
          </div>

          {/* Create form */}
          {showCreate && (
            <form
              onSubmit={handleCreate}
              className="rounded-2xl border border-emerald-700/40 bg-emerald-950/20 p-5 flex flex-col gap-3"
            >
              <p className="text-sm font-semibold text-emerald-300">{t('storiesCreateSectionTitle')}</p>
              <input
                ref={titleRef}
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t('storiesCreateTitlePlaceholder')}
                className="w-full rounded-xl bg-gray-900 border border-gray-700 text-white text-sm px-3 py-2.5 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
              <textarea
                rows={2}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder={t('storiesCreateDescPlaceholder')}
                className="w-full rounded-xl bg-gray-900 border border-gray-700 text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-emerald-500 resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {saving ? t('storiesCreateSubmitting') : t('storiesCreateSubmit')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-xl border border-gray-700 hover:bg-gray-800 text-gray-400 text-sm transition-colors"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-700/60 bg-red-950/70 px-4 py-3 text-sm text-red-200 flex items-center justify-between gap-2">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-red-400 hover:text-red-200 text-lg leading-none">×</button>
            </div>
          )}

          {/* Stories list */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : stories.length === 0 ? (
            <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-12 flex flex-col items-center gap-5 text-center">
              <Icon name="story" className="w-14 h-14 text-cyan-400" />
              <div>
                <p className="font-semibold text-gray-200 text-lg">{t('storiesEmptyTitle')}</p>
                <p className="text-sm text-gray-500 mt-1.5 max-w-sm">
                  {t('storiesEmptyDesc')}
                </p>
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
              >
                {t('storiesEmptyBtn')}
              </button>
              <p className="text-xs text-gray-600">
                Ou comece criando cenas em{' '}
                <Link to="/scenes" className="text-cyan-500 hover:text-cyan-400 underline underline-offset-2">
                  {t('storiesEmptySceneLink')}
                </Link>
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {stories.map((story) => (
                <StoryCard
                  key={story.storyId}
                  story={story}
                  onDelete={handleDelete}
                  deleting={deleting}
                />
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
