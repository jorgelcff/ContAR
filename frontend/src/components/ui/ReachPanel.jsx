import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Reach, for whoever deployed this. It used to be two headline numbers and a
 * row of four small ones, which said how many people arrived but nothing about
 * what they did once here — the question a deployment at an event is actually
 * asking. Two things were added:
 *
 *  - a drop-off funnel, because "40 signed up" and "6 built something" are very
 *    different results and the first number alone flatters;
 *  - a daily signup series, because at an event arrivals come in one spike and
 *    a running total hides it.
 *
 * Both plot a single measure, so both use one hue (--chart-accent, validated
 * against the light and dark card surfaces) and neither carries a legend.
 */

/** 'YYYY-MM-DD' → a short local label, read as UTC so the day cannot shift. */
function dayLabel(iso, language) {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString(language, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function Funnel({ stages, total }) {
  return (
    <div className="flex flex-col gap-2.5">
      {stages.map((stage) => {
        const pct = total > 0 ? (stage.value / total) * 100 : 0;
        return (
          <div key={stage.label} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-gray-300">{stage.label}</span>
              <span className="text-xs tabular-nums text-gray-400">
                <span className="font-semibold text-white">{stage.value}</span>
                {total > 0 && <span className="ml-1.5">{Math.round(pct)}%</span>}
              </span>
            </div>
            {/* The track is the full population; the fill is this stage. A bar
                can never be longer than the one above it, which is asserted
                server-side too. */}
            <div className="h-2 w-full rounded-full bg-gray-700/70">
              <div
                className="h-2 rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(pct, stage.value > 0 ? 2 : 0)}%`, backgroundColor: 'var(--chart-accent)' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SignupTrend({ days, language }) {
  const [hover, setHover] = useState(-1);
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const peak = days.reduce((best, d) => (d.count > best.count ? d : best), days[0]);
  const { t } = useTranslation();

  const active = hover >= 0 ? days[hover] : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs text-gray-300">{t('statsTrendTitle')}</h3>
        {/* One direct label, on the peak — not a number on every bar. */}
        <span className="text-[11px] tabular-nums text-gray-500">
          {active
            ? `${active.count} · ${dayLabel(active.date, language)}`
            : t('statsTrendPeak', { count: peak.count, day: dayLabel(peak.date, language) })}
        </span>
      </div>

      <div
        className="flex h-16 items-end gap-[2px]"
        role="img"
        aria-label={t('statsTrendAria', { total, count: peak.count, day: dayLabel(peak.date, language) })}
        onMouseLeave={() => setHover(-1)}
      >
        {days.map((day, i) => (
          <div
            key={day.date}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            // The hit target is the full column height, not the bar — a 1px
            // bar on a quiet day would otherwise be unhoverable.
            className="flex h-full flex-1 cursor-default items-end"
            title={`${day.count} · ${dayLabel(day.date, language)}`}
          >
            <div
              className="w-full rounded-t-[4px] transition-opacity"
              style={{
                height: day.count > 0 ? `${Math.max((day.count / max) * 100, 8)}%` : '2px',
                backgroundColor: day.count > 0 ? 'var(--chart-accent)' : undefined,
                opacity: hover >= 0 && hover !== i ? 0.45 : 1,
              }}
            >
              {day.count === 0 && <div className="h-[2px] w-full rounded-full bg-gray-700" />}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between text-[10px] text-gray-500">
        <span>{dayLabel(days[0].date, language)}</span>
        <span>{dayLabel(days[days.length - 1].date, language)}</span>
      </div>
    </div>
  );
}

export default function ReachPanel({ stats }) {
  const { t, i18n } = useTranslation();
  if (!stats) return null;

  const days = Array.isArray(stats.signupsByDay) ? stats.signupsByDay : [];
  const stages = [
    { label: t('statsStageSignedUp'), value: stats.users || 0 },
    { label: t('statsStageVerified'), value: stats.verifiedUsers ?? 0 },
    { label: t('statsStageCreated'), value: stats.usersWhoCreated || 0 },
    { label: t('statsStagePublished'), value: stats.usersWhoPublished ?? 0 },
  ];

  return (
    <section className="rounded-2xl border border-gray-700 bg-gray-800 p-5 flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-cyan-300 uppercase tracking-wide">{t('statsTitle')}</h2>
        <span className="text-[11px] text-gray-500">{t('statsNewThisWeek', { count: stats.newUsersLast7Days || 0 })}</span>
      </div>

      {/* Two headlines, because sign-ups were only ever half the reach: the
          audience a shared link is for watches and leaves without ever making
          an account, and until now none of them were counted at all. */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-4xl font-bold leading-none text-white tabular-nums">{stats.storyViews ?? 0}</p>
          <p className="mt-1 text-xs text-gray-400">{t('statsStoryViews')}</p>
        </div>
        <div>
          <p className="text-4xl font-bold leading-none text-white tabular-nums">{stats.users}</p>
          <p className="mt-1 text-xs text-gray-400">{t('statsUsers')}</p>
        </div>
      </div>

      {days.length > 0 && <SignupTrend days={days} language={i18n.language} />}

      <div className="flex flex-col gap-2.5 border-t border-gray-700 pt-4">
        <h3 className="text-xs text-gray-300">{t('statsFunnelTitle')}</h3>
        <Funnel stages={stages} total={stats.users || 0} />
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-gray-700 pt-3 text-xs text-gray-400">
        <span>{t('statsScenes', { count: stats.scenes })}</span>
        <span>{t('statsStories', { count: stats.stories })}</span>
        <span>{t('statsPublished', { count: stats.publishedStories })}</span>
        <span>{t('statsCompletions')}: {stats.storyCompletions ?? 0}</span>
      </div>
    </section>
  );
}
