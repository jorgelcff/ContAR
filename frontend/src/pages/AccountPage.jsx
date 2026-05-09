import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/ui/Header';
import { useAuth } from '../auth/AuthContext';
import { updateAccount, changePassword } from '../api/sceneApi';

export default function AccountPage() {
  const { user, refreshUser } = useAuth();

  const [name, setName]           = useState(user?.name || '');
  const [nameMsg, setNameMsg]     = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [pwMsg, setPwMsg]           = useState('');
  const [pwError, setPwError]       = useState('');
  const [pwSaving, setPwSaving]     = useState(false);

  const saveName = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setNameSaving(true);
    setNameMsg('');
    try {
      await updateAccount({ name: name.trim() });
      await refreshUser();
      setNameMsg('Nome atualizado!');
      setTimeout(() => setNameMsg(''), 3000);
    } catch (err) {
      setNameMsg(err?.response?.data?.error || 'Erro ao atualizar nome');
    } finally {
      setNameSaving(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwMsg('');
    if (newPw !== confirmPw) { setPwError('As senhas não coincidem.'); return; }
    if (newPw.length < 6)    { setPwError('A nova senha deve ter ao menos 6 caracteres.'); return; }
    setPwSaving(true);
    try {
      await changePassword(currentPw, newPw);
      setPwMsg('Senha alterada com sucesso!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => setPwMsg(''), 4000);
    } catch (err) {
      setPwError(err?.response?.data?.error || 'Erro ao alterar senha');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      <Header />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6 max-w-lg w-full mx-auto">

        <div>
          <h1 className="text-xl font-bold">Minha Conta</h1>
          <p className="text-sm text-gray-400 mt-0.5">{user?.email}</p>
        </div>

        {/* Nome */}
        <section className="rounded-2xl border border-gray-700 bg-gray-800 p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Perfil</h2>
          <form onSubmit={saveName} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Nome</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg bg-gray-900 border border-gray-700 text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={nameSaving}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                {nameSaving ? 'Salvando...' : 'Salvar nome'}
              </button>
              {nameMsg && <span className="text-sm text-emerald-400">{nameMsg}</span>}
            </div>
          </form>
        </section>

        {/* Senha */}
        <section className="rounded-2xl border border-gray-700 bg-gray-800 p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Alterar Senha</h2>
          {pwError && (
            <div className="rounded-md border border-red-700/60 bg-red-950/70 px-3 py-2 text-sm text-red-200">
              {pwError}
            </div>
          )}
          {pwMsg && (
            <div className="rounded-md border border-emerald-700/60 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-300">
              {pwMsg}
            </div>
          )}
          <form onSubmit={savePassword} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Senha atual</label>
              <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password" required
                className="w-full rounded-lg bg-gray-900 border border-gray-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Nova senha</label>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password" required minLength={6}
                className="w-full rounded-lg bg-gray-900 border border-gray-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Confirmar nova senha</label>
              <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password" required
                className="w-full rounded-lg bg-gray-900 border border-gray-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button type="submit" disabled={pwSaving}
              className="self-start px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {pwSaving ? 'Salvando...' : 'Alterar senha'}
            </button>
          </form>
        </section>

        <div className="border-t border-gray-800 pt-4 flex gap-4">
          <Link to="/scenes"  className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">← Minhas Cenas</Link>
          <Link to="/stories" className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">← Minhas Histórias</Link>
        </div>
      </div>
    </div>
  );
}
