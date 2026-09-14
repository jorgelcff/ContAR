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

// GET /api/stats — how many people have signed up, and how many got far enough
// to make something. Both numbers matter: registrations alone count anyone who
// opened the page and bounced.
async function getStats(req, res) {
  try {
    if (!isAdmin(req.user?.email)) {
      return res.status(403).json({ error: 'Not available for this account' });
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [users, newUsers, scenes, stories, published, creatorIds] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: since } }),
      Scene.countDocuments({}),
      Story.countDocuments({}),
      Story.countDocuments({ isPublic: true }),
      Scene.distinct('ownerId', { ownerId: { $ne: '' } }),
    ]);

    res.json({
      users,
      newUsersLast7Days: newUsers,
      usersWhoCreated: creatorIds.length,
      scenes,
      stories,
      publishedStories: published,
    });
  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
}

module.exports = { getStats };
