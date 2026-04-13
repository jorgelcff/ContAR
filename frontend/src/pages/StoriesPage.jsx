import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/ui/Header';
import { listStories, saveStory } from '../api/sceneApi';

export default function StoriesPage() {
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadStories = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listStories();
      setStories(data?.stories || []);
    } catch (err) {
      const apiError = err?.response?.data?.error;
      setError(apiError || err.message || 'Failed to load stories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStories();
  }, []);

  const createStory = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await saveStory({
        metadata: {
          title: title || 'Untitled Story',
          description: description || '',
          language: 'en',
        },
        scenes: [],
      });
      navigate(`/editor?storyId=${encodeURIComponent(result.storyId)}`);
    } catch (err) {
      const apiError = err?.response?.data?.error;
      setError(apiError || err.message || 'Failed to create story');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      <Header />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6">
        <section className="rounded-2xl border border-gray-700 bg-gray-800 p-4 md:p-5 flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Create Story</h2>
          <p className="text-sm text-gray-400">Start from story structure, then jump to the scene editor.</p>
          {error && <div className="rounded-md border border-red-700 bg-red-950/70 px-3 py-2 text-sm text-red-200">{error}</div>}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Story title"
            className="w-full rounded-lg bg-gray-900 border border-gray-700 text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Story description"
            className="w-full rounded-lg bg-gray-900 border border-gray-700 text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          />
          <button
            onClick={createStory}
            disabled={saving}
            className="w-full md:w-auto md:self-start px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {saving ? 'Creating...' : 'Create and open editor'}
          </button>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">My Stories</h2>
            <button
              onClick={loadStories}
              className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="text-sm text-gray-400">Loading stories...</div>
          ) : stories.length === 0 ? (
            <div className="text-sm text-gray-500">No stories yet.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {stories.map((story) => (
                <div key={story.storyId} className="rounded-xl border border-gray-700 bg-gray-800 p-4 flex flex-col gap-3">
                  <div>
                    <h3 className="font-medium">{story.metadata?.title || 'Untitled Story'}</h3>
                    <p className="text-xs text-gray-400 break-all">{story.storyId}</p>
                    {story.metadata?.description && (
                      <p className="text-sm text-gray-300 mt-2">{story.metadata.description}</p>
                    )}
                  </div>
                  <Link
                    to={`/editor?storyId=${encodeURIComponent(story.storyId)}`}
                    className="inline-flex self-start px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs"
                  >
                    Open in editor
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
