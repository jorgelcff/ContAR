const User = require('../models/User');
const Scene = require('../models/Scene');
const Story = require('../models/Story');

/**
 * Who is allowed to see the reach numbers. Comma-separated addresses in
 * ADMIN_EMAILS; with none set nobody qualifies, so an unconfigured deployment
 * exposes nothing rather than everything.
 */
function isAdmin(email) {
  const allowed = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.length > 0 && allowed.includes(String(email || '').toLowerCase());
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 30;

/** YYYY-MM-DD in UTC, so a day means the same thing to server and browser. */
function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * One row per day for the whole window, including the days nobody signed up.
 * Without the zero-fill a quiet week would collapse into the neighbouring bars
 * and the chart would read as steady traffic.
 */
function zeroFilledDays(counts, days, endOfToday) {
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = dayKey(new Date(endOfToday.getTime() - i * DAY_MS));
    out.push({ date: key, count: counts.get(key) || 0 });
  }
  return out;
}

// GET /api/stats — how many people have signed up, and how many got far enough
// to make something. Both numbers matter: registrations alone count anyone who
// opened the page and bounced. The per-stage counts say where people stop, and
// the daily series says when they arrived — at an event, that is the shape of
// the talk you just gave.
async function getStats(req, res) {
  try {
    if (!isAdmin(req.user?.email)) {
      return res.status(403).json({ error: 'Not available for this account' });
    }

    const now = new Date();
    const since7 = new Date(now.getTime() - 7 * DAY_MS);
    const trendStart = new Date(now.getTime() - (TREND_DAYS - 1) * DAY_MS);
    trendStart.setUTCHours(0, 0, 0, 0);

    const [
      users, newUsers, verifiedUsers, scenes, stories, published, viewRows,
      creatorIds, publisherIds, signupRows, newest,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: since7 } }),
      User.countDocuments({ emailVerified: true }),
      Scene.countDocuments({}),
      Story.countDocuments({}),
      Story.countDocuments({ isPublic: true }),
      // Sign-ups miss the audience a shared link is for entirely — people who
      // watch and leave without ever making an account.
      Story.aggregate([{ $group: { _id: null, total: { $sum: '$views' }, finished: { $sum: '$completions' } } }]),
      Scene.distinct('ownerId', { ownerId: { $nin: ['', null] } }),
      Story.distinct('ownerId', { isPublic: true, ownerId: { $nin: ['', null] } }),
      User.aggregate([
        { $match: { createdAt: { $gte: trendStart } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
            count: { $sum: 1 },
          },
        },
      ]),
      User.findOne({}, { createdAt: 1 }).sort({ createdAt: -1 }),
    ]);

    const counts = new Map(signupRows.map((r) => [r._id, r.count]));

    res.json({
      users,
      newUsersLast7Days: newUsers,
      verifiedUsers,
      usersWhoCreated: creatorIds.length,
      usersWhoPublished: publisherIds.length,
      scenes,
      stories,
      publishedStories: published,
      storyViews: viewRows?.[0]?.total || 0,
      storyCompletions: viewRows?.[0]?.finished || 0,
      lastSignupAt: newest?.createdAt || null,
      signupsByDay: zeroFilledDays(counts, TREND_DAYS, now),
    });
  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
}

module.exports = { getStats };
