const { v4: uuidv4 } = require('uuid');
const Avatar = require('../models/Avatar');

function getAvaturnApiBaseCandidates() {
  const raw = (process.env.AVATURN_API_BASE_URL || '').trim();
  const defaultApiBase = (
    process.env.AVATURN_API_DEFAULT_BASE_URL || 'https://api.avaturn.me/api/v1'
  )
    .trim()
    .replace(/\/+$/, '');
  const defaultLegacyBase = (
    process.env.AVATURN_API_LEGACY_BASE_URL || 'https://api.avaturn.me/v1'
  )
    .trim()
    .replace(/\/+$/, '');
  if (!raw) return [defaultApiBase, defaultLegacyBase];

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const normalized = withProtocol.replace(/\/+$/, '');

  if (/\/api\/v\d+$/i.test(normalized)) {
    const exactCandidates = [normalized, defaultApiBase, defaultLegacyBase];
    return [...new Set(exactCandidates)];
  }

  if (/\/v\d+$/i.test(normalized)) {
    const bridged = normalized.replace(/\/v(\d+)$/i, '/api/v$1');
    const exactCandidates = [bridged, normalized, defaultApiBase, defaultLegacyBase];
    return [...new Set(exactCandidates)];
  }

  const candidates = [];
  if (/\.avaturn\.dev$/i.test(normalized)) {
    candidates.push(`${normalized}/api/v1`);
  }
  if (/api\.avaturn\.me$/i.test(normalized)) {
    candidates.push(`${normalized}/api/v1`);
  }
  candidates.push(`${normalized}/v1`);
  candidates.push(`${normalized}/api/v1`);
  candidates.push(normalized);
  candidates.push(defaultApiBase);
  candidates.push(defaultLegacyBase);

  return [...new Set(candidates)];
}

async function avaturnRequest(path, options = {}) {
  const token = process.env.AVATURN_API_TOKEN;
  if (!token) {
    throw new Error('AVATURN_API_TOKEN is missing in backend environment');
  }

  const { method = 'POST', payload } = options;
  const bases = getAvaturnApiBaseCandidates();

  let lastError = null;

  for (const base of bases) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      return data;
    }

    const message = data?.error || data?.message || `Avaturn API error (${response.status})`;
    lastError = new Error(`${message} [base=${base}]`);

    // Authorization and input errors should not continue fallback attempts.
    if ([400, 401, 403, 422].includes(response.status)) {
      throw lastError;
    }
  }

  throw lastError || new Error('Failed to reach Avaturn API');
}

function pickSessionUrl(data) {
  return data?.url || data?.sessionUrl || data?.session_url || data?.link || '';
}

function pickUserId(data) {
  return data?.userId || data?.user_id || data?.id || '';
}

function pickAvatarList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.avatars)) return data.avatars;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data?.avatars)) return data.data.avatars;
  return [];
}

function normalizeSessionType(sessionType) {
  const raw = String(sessionType || 'create_or_edit_existing').trim().toLowerCase();
  if (!raw) return 'create_or_edit_existing';

  const map = {
    create: 'create',
    edit_existing: 'edit_existing',
    'edit-existing': 'edit_existing',
    create_or_edit_existing: 'create_or_edit_existing',
    'create-or-edit-existing': 'create_or_edit_existing',
  };

  return map[raw] || 'create_or_edit_existing';
}

// POST /api/avatar — store an avatar URL
async function saveAvatar(req, res) {
  try {
    const { modelUrl } = req.body;
    if (!modelUrl) return res.status(400).json({ error: 'modelUrl is required' });

    const avatarId = uuidv4();
    const avatar = await Avatar.create({ avatarId, modelUrl });
    res.status(201).json({ avatarId: avatar.avatarId });
  } catch (err) {
    console.error('saveAvatar error:', err);
    res.status(500).json({ error: 'Failed to save avatar' });
  }
}

// POST /api/avatar/session - create Avaturn user/session URL for SDK
async function createAvaturnSession(req, res) {
  try {
    const {
      avaturnUserId,
      avatarId,
      sessionType = 'create_or_edit_existing',
    } = req.body || {};

    let userId = avaturnUserId || process.env.AVATURN_USER_ID || '';

    if (!userId) {
      const createdUser = await avaturnRequest('/users/new', { payload: {} });
      userId = pickUserId(createdUser);
      if (!userId) {
        throw new Error('Failed to create Avaturn user: missing user id in response');
      }
    }

    const sessionPayload = {
      user_id: userId,
      session_type: normalizeSessionType(sessionType),
    };

    if (avatarId) {
      sessionPayload.avatar_id = avatarId;
      if (sessionType === 'create_or_edit_existing') {
        sessionPayload.session_type = 'edit_existing';
      }
    }

    const createdSession = await avaturnRequest('/sessions/new', { payload: sessionPayload });
    const sessionUrl = pickSessionUrl(createdSession);
    if (!sessionUrl) {
      throw new Error('Failed to create Avaturn session: missing session URL in response');
    }

    return res.status(200).json({
      sessionUrl,
      avaturnUserId: userId,
    });
  } catch (err) {
    console.error('createAvaturnSession error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create Avaturn session' });
  }
}

// POST /api/avatar/user/new - create an anonymous Avaturn user
async function createAvaturnUser(_req, res) {
  try {
    const createdUser = await avaturnRequest('/users/new', { payload: {} });
    const userId = pickUserId(createdUser);
    return res.status(200).json({
      avaturnUserId: userId,
      raw: createdUser,
    });
  } catch (err) {
    console.error('createAvaturnUser error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create Avaturn user' });
  }
}

// DELETE /api/avatar/user/:userId - delete Avaturn user
async function deleteAvaturnUser(req, res) {
  try {
    const userId = String(req.params?.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const result = await avaturnRequest(`/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    return res.status(200).json({ ok: true, raw: result });
  } catch (err) {
    console.error('deleteAvaturnUser error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete Avaturn user' });
  }
}

// GET /api/avatar/list?avaturnUserId=... - list avatars from Avaturn API user
async function listAvaturnAvatars(req, res) {
  try {
    const avaturnUserId = (req.query?.avaturnUserId || process.env.AVATURN_USER_ID || '').trim();
    if (!avaturnUserId) {
      return res.status(400).json({ error: 'avaturnUserId is required' });
    }

    const result = await avaturnRequest(`/users/${encodeURIComponent(avaturnUserId)}/avatars`, {
      method: 'GET',
    });

    return res.status(200).json({
      avaturnUserId,
      avatars: pickAvatarList(result),
    });
  } catch (err) {
    console.error('listAvaturnAvatars error:', err);
    return res.status(500).json({ error: err.message || 'Failed to list Avaturn avatars' });
  }
}

// POST /api/avatar/new - create avatar by API and get upload URL
async function createAvatarByApi(req, res) {
  try {
    const payload = req.body || {};
    const result = await avaturnRequest('/avatars/new', { payload });
    return res.status(200).json(result);
  } catch (err) {
    console.error('createAvatarByApi error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create avatar via API' });
  }
}

// GET /api/avatar/:avatarId/customization
async function getAvatarCustomization(req, res) {
  try {
    const avatarId = String(req.params?.avatarId || '').trim();
    if (!avatarId) {
      return res.status(400).json({ error: 'avatarId is required' });
    }

    const result = await avaturnRequest(`/avatars/${encodeURIComponent(avatarId)}/customization`, {
      method: 'GET',
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('getAvatarCustomization error:', err);
    return res.status(500).json({ error: err.message || 'Failed to get avatar customization' });
  }
}

// PUT /api/avatar/:avatarId/customization
async function setAvatarCustomization(req, res) {
  try {
    const avatarId = String(req.params?.avatarId || '').trim();
    if (!avatarId) {
      return res.status(400).json({ error: 'avatarId is required' });
    }

    const payload = req.body || {};
    const result = await avaturnRequest(`/avatars/${encodeURIComponent(avatarId)}/customization`, {
      method: 'PUT',
      payload,
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('setAvatarCustomization error:', err);
    return res.status(500).json({ error: err.message || 'Failed to set avatar customization' });
  }
}

// DELETE /api/avatar/users/:userId/avatars/:avatarId
async function deleteUserAvatar(req, res) {
  try {
    const userId = String(req.params?.userId || '').trim();
    const avatarId = String(req.params?.avatarId || '').trim();
    if (!userId || !avatarId) {
      return res.status(400).json({ error: 'userId and avatarId are required' });
    }

    const result = await avaturnRequest(
      `/users/${encodeURIComponent(userId)}/avatars/${encodeURIComponent(avatarId)}`,
      { method: 'DELETE' }
    );
    return res.status(200).json({ ok: true, raw: result });
  } catch (err) {
    console.error('deleteUserAvatar error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete avatar' });
  }
}

// POST /api/avatar/render - create render task
async function createRenderTask(req, res) {
  try {
    const payload = req.body || {};
    const result = await avaturnRequest('/renders/new', { payload });
    return res.status(200).json(result);
  } catch (err) {
    console.error('createRenderTask error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create render task' });
  }
}

// POST /api/avatar/export - create export task
async function createExportTask(req, res) {
  try {
    const payload = req.body || {};
    const result = await avaturnRequest('/exports/new', { payload });
    return res.status(200).json(result);
  } catch (err) {
    console.error('createExportTask error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create export task' });
  }
}

module.exports = {
  saveAvatar,
  createAvaturnSession,
  createAvaturnUser,
  deleteAvaturnUser,
  listAvaturnAvatars,
  createAvatarByApi,
  getAvatarCustomization,
  setAvatarCustomization,
  deleteUserAvatar,
  createRenderTask,
  createExportTask,
};
