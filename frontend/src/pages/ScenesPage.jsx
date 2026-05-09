import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/ui/Header';
import { listScenes } from '../api/sceneApi';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d > 1 ? 's' : ''}`;
}

export default function ScenesPage() {
  const navigate = useNavigate();
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listScenes();
      setScenes(data?.scenes || []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Erro ao carregar cenas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      <Header />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6 max-w-4xl w-full mx-auto">

        {/* Header row */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Minhas Cenas</h1>
            <p className="text-sm text-gray-400 mt-0.5">Cenas salvas na sua conta. Clique em uma para continuar editando.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={load}
              className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs transition-colors"
            >
              Atualizar
            </button>
            <button
              onClick={() => navigate('/editor')}
              className="px-4 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-semibold transition-colors"
            >
              + Nova Cena
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-700/60 bg-red-950/70 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            Carregando cenas...
          </div>
        ) : scenes.length === 0 ? (
          <div className="rounded-2xl border border-gray-700 bg-gray-800/60 p-10 text-center flex flex-col items-center gap-4">
            <span className="text-5xl">🎬</span>
            <p className="text-gray-300 font-medium">Nenhuma cena ainda</p>
            <p className="text-sm text-gray-500">Crie sua primeira cena no editor e ela aparecerá aqui.</p>
            <button
              onClick={() => navigate('/editor')}
              className="mt-2 px-5 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-semibold transition-colors"
            >
              Criar primeira cena
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {scenes.map((scene) => (
              <div
                key={scene.sceneId}
                className="group rounded-2xl border border-gray-700 bg-gray-800 p-4 flex flex-col gap-3 hover:border-cyan-700/60 transition-colors"
              >
                {/* Avatar thumbnail placeholder */}
                <div className="h-28 rounded-xl bg-gray-900/80 flex items-center justify-center overflow-hidden border border-gray-700/50">
                  {scene.avatarUrl ? (
                    <span className="text-4xl">👤</span>
                  ) : (
                    <span className="text-3xl opacity-30">🎬</span>
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-sm truncate" title={scene.metadata?.title}>
                    {scene.metadata?.title || 'Sem título'}
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Editada {timeAgo(scene.updatedAt)}
                  </p>
                  {scene.posePreset && scene.posePreset !== 'idle' && (
                    <p className="text-[11px] text-cyan-500/70 mt-0.5">Pose: {scene.posePreset}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Link
                    to={`/editor?sceneId=${encodeURIComponent(scene.sceneId)}`}
                    className="flex-1 text-center py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium transition-colors"
                  >
                    Editar
                  </Link>
                  <Link
                    to={`/scene/${encodeURIComponent(scene.sceneId)}`}
                    className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-gray-800 pt-4">
          <Link to="/stories" className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
            → Ver Minhas Histórias
          </Link>
        </div>
      </div>
    </div>
  );
}
