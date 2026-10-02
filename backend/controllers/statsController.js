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

/**
 * One row per account with what it did. Shared with scripts/list-users.js so
 * the dashboard and the terminal can never disagree about who is in there.
 * Grouped counts rather than a query per user: a few hundred accounts would
 * otherwise be a few hundred round trips.
 */
async function buildUserRows() {
  const [users, sceneRows, storyRows, publicRows] = await Promise.all([
    User.find({}, { email: 1, name: 1, emailVerified: 1, createdAt: 1 }).sort({ createdAt: -1 }).lean(),
    Scene.aggregate([{ $group: { _id: '$ownerId', n: { $sum: 1 }, last: { $max: '$updatedAt' } } }]),
    Story.aggregate([{ $group: { _id: '$ownerId', n: { $sum: 1 }, last: { $max: '$updatedAt' } } }]),
    Story.aggregate([
      { $match: { isPublic: true } },
      { $group: { _id: '$ownerId', n: { $sum: 1 }, views: { $sum: '$views' } } },
    ]),
  ]);
  const byOwner = (rows) => new Map(rows.map((r) => [String(r._id), r]));
  const scenes = byOwner(sceneRows);
  const stories = byOwner(storyRows);
  const published = byOwner(publicRows);

  return users.map((u) => {
    const id = String(u._id);
    // Last time they saved anything — the only activity the data records.
    // There is no login timestamp, so an account that only browses reads as
    // inactive since sign-up.
    const last = [scenes.get(id)?.last, stories.get(id)?.last]
      .filter(Boolean)
      .reduce((a, b) => (new Date(b) > new Date(a) ? b : a), null);
    return {
      email: u.email,
      name: u.name || '',
      verified: Boolean(u.emailVerified),
      createdAt: u.createdAt,
      lastActiveAt: last,
      scenes: scenes.get(id)?.n || 0,
      stories: stories.get(id)?.n || 0,
      published: published.get(id)?.n || 0,
      views: published.get(id)?.views || 0,
    };
  });
}

// GET /api/stats/users — who signed up, newest first, and how far each got.
// Real people's addresses, so it sits behind the same allow-list as the numbers
// and is only fetched when the panel asks for it.
async function listUsers(req, res) {
  try {
    if (!isAdmin(req.user?.email)) {
      return res.status(403).json({ error: 'Not available for this account' });
    }
    res.set('Cache-Control', 'no-store');
    res.json({ users: await buildUserRows() });
  } catch (err) {
    console.error('listUsers error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
}

module.exports = { getStats, listUsers, buildUserRows };
