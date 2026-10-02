import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getUserList } from '../../api/sceneApi';
import { USER_FILTERS, filterUsers, filterCounts, relativeDay, usersToCsv } from '../../utils/userList';
import Icon from './Icon';

/**
 * Who signed up, for the account that deployed this. The reach panel says how
 * many; this says who, and how far each got.
 *
 * Collapsed and fetched only when opened: these are real people's addresses,
 * and the account page is also where the admin changes their own password —
 * often on a laptop someone else can see.
 */
export default function UserListPanel() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getUserList();
      setRows(Array.isArray(data?.users) ? data.users : []);
    } catch (err) {
      setError(err?.response?.data?.error || t('usersLoadError'));
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && rows === null) load();
  };

  const counts = useMemo(() => filterCounts(rows || []), [rows]);
  const shown = useMemo(() => filterUsers(rows || [], { query, filter }), [rows, query, filter]);

  const exportCsv = () => {
    // BOM so Excel reads the accents in names as UTF-8.
    const blob = new Blob(['﻿', usersToCsv(shown)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contar-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-2xl border border-gray-700 bg-gray-800 p-5 flex flex-col gap-4">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex items-center justify-between gap-3 text-left"
      >
        <h2 className="text-sm font-semibold text-cyan-300 uppercase tracking-wide">
          {t('usersTitle')}
          {rows && <span className="ml-2 text-gray-400 normal-case tracking-normal">({rows.length})</span>}
        </h2>
        <span className="text-xs text-gray-400">{open ? t('usersHide') : t('usersShow')}</span>
      </button>

      {open && (
        <>
          {loading && <p className="text-xs text-gray-400" role="status">{t('usersLoading')}</p>}
          {error && (
            <p className="text-xs text-red-300" role="alert">
              {error}{' '}
              <button type="button" onClick={load} className="underline">{t('usersRetry')}</button>
            </p>
          )}

          {rows && (
            <>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('usersSearch')}
                aria-label={t('usersSearch')}
                className="w-full rounded-lg bg-gray-900 border border-gray-700 text-white text-sm px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />

              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('usersFilterLabel')}>
                {USER_FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    aria-pressed={filter === f}
                    className={`rounded-full px-3 py-1 text-xs transition-colors ${
                      filter === f ? 'bg-cyan-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {t(`usersFilter_${f}`)} <span className="tabular-nums opacity-80">{counts[f]}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-gray-500">{t('usersShowing', { count: shown.length })}</span>
                <div className="flex gap-2">
                  <button type="button" onClick={load} className="text-xs text-gray-300 hover:text-white underline-offset-4 hover:underline">
                    {t('usersRefresh')}
                  </button>
                  <button
                    type="button"
                    onClick={exportCsv}
                    disabled={!shown.length}
                    className="flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200 disabled:opacity-40"
                  >
                    <Icon name="download" className="h-3.5 w-3.5" /> CSV
                  </button>
                </div>
              </div>

              <ul className="flex flex-col divide-y divide-gray-700 max-h-[60vh] overflow-y-auto -mx-1 px-1">
                {shown.map((u) => (
                  <li key={u.email} className="py-2.5 flex flex-col gap-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-white truncate">{u.name || '—'}</span>
                      <span className="shrink-0 text-[11px] text-gray-500">
                        {t('usersJoined', { when: relativeDay(u.createdAt, i18n.language) })}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 break-all">{u.email}</span>
                    <span className="text-[11px] text-gray-400 tabular-nums">
                      {t('statsScenes', { count: u.scenes })} · {t('statsStories', { count: u.stories })}
                      {u.published > 0 && <> · {t('statsPublished', { count: u.published })} · {t('usersViews', { count: u.views })}</>}
                      {u.lastActiveAt && <> · {t('usersActive', { when: relativeDay(u.lastActiveAt, i18n.language) })}</>}
                    </span>
                  </li>
                ))}
                {!shown.length && <li className="py-3 text-xs text-gray-500">{t('usersEmpty')}</li>}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
