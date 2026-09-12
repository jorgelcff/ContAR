import axios from 'axios';

// VITE_API_BASE_URL is the backend's origin (e.g. https://host.example.com),
// not its full API root — every backend route lives under /api (see
// backend/app.js), so that's appended here rather than trusted to already be
// part of the configured value. Getting this wrong silently 404s every
// request ("Cannot POST /auth/login" instead of /api/auth/login).
const configuredApiBase = String(import.meta.env.VITE_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');
const apiBaseUrl = configuredApiBase ? `${configuredApiBase}/api` : '/api';

const api = axios.create({ baseURL: apiBaseUrl });
export const AUTH_TOKEN_KEY = 'auth:token';
export const AVATURN_LAST_SESSION_URL_KEY = 'avaturn:lastSessionUrl';
export const AVATURN_LAST_SESSION_TOKEN_KEY = 'avaturn:lastSessionToken';

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || '';
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getStoredAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

export function logoutUser() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function registerUser(name, email, password) {
  const { data } = await api.post('/auth/register', { name, email, password });
  if (data?.token) {
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
  }
  return data;
}

export async function loginUser(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  if (data?.token) {
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
  }
  return data;
}

export async function getCurrentUser() {
  const { data } = await api.get('/auth/me');
  return data;
}

/** Save or update a scene. Returns { sceneId }. */
export async function saveScene(payload) {
  const { data } = await api.post('/scene', payload);
  return data;
}

/** Save or update a story. Returns { storyId, sceneCount }. */
export async function saveStory(payload) {
  const { data } = await api.post('/story', payload);
  return data;
}

/** Publish or unpublish a story — only this makes it reachable via its
 * public share link; saving content never changes it. Returns { storyId, isPublic }. */
export async function publishStory(storyId, isPublic) {
  const { data } = await api.put(`/story/${encodeURIComponent(storyId)}/publish`, { isPublic });
  return data;
}

/** Load a scene by ID. */
export async function getScene(id) {
  const { data } = await api.get(`/scene/${id}`);
  return data;
}

/** Load a story by ID. */
export async function getStory(id) {
  const { data } = await api.get(`/story/${id}`);
  return data;
}

/** Load a public story by ID (share link). */
export async function getPublicStory(id) {
  const { data } = await api.get(`/story/public/${id}`);
  return data;
}

/** List latest stories. */
export async function listStories() {
  const { data } = await api.get('/story');
  return data;
}

/** Link this account to its Avaturn SDK user id, so "load my avatars" works
 * from any device/browser instead of only the one that created them. */
export async function linkAvaturnUserId(avaturnUserId) {
  const { data } = await api.put('/avatar/user-link', { avaturnUserId });
  return data;
}

/** Create a short-lived Avaturn session URL. */
export async function createAvaturnSession(payload) {
  const { data } = await api.post('/avatar/session', payload || {});
  return data;
}

/** Read last session URL stored by frontend. */
export function getStoredAvaturnSessionUrl() {
  return localStorage.getItem(AVATURN_LAST_SESSION_URL_KEY) || '';
}

/** Read last session token-like value stored by frontend (if present in URL). */
export function getStoredAvaturnSessionToken() {
  return localStorage.getItem(AVATURN_LAST_SESSION_TOKEN_KEY) || '';
}

/** List avatars from an Avaturn user ID. */
export async function listAvaturnAvatars(avaturnUserId) {
  const query = avaturnUserId ? `?avaturnUserId=${encodeURIComponent(avaturnUserId)}` : '';
  const { data } = await api.get(`/avatar/list${query}`);
  return data;
}

export async function uploadAudio(blob) {
  const formData = new FormData();
  const ext = { 'audio/webm': 'webm', 'audio/wav': 'wav', 'audio/ogg': 'ogg' }[blob.type] || 'mp3';
  formData.append('file', blob, `narration.${ext}`);
  const { data } = await api.post('/media/audio', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
}

/** Remove a previously-uploaded narration audio file from Cloudinary. */
export async function deleteAudio(url) {
  await api.delete('/media/audio', { data: { url } });
}

export async function uploadModel(file) {
  const formData = new FormData();
  formData.append('file', file, file.name);
  const { data } = await api.post('/media/model', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
}

export async function listScenes() {
  const { data } = await api.get('/scene');
  return data;
}

export async function verifyEmail(token) {
  const { data } = await api.post('/auth/verify-email', { token });
  return data;
}

export async function resendVerification() {
  const { data } = await api.post('/auth/resend-verification');
  return data;
}

export async function deleteScene(sceneId) {
  const { data } = await api.delete(`/scene/${encodeURIComponent(sceneId)}`);
  return data;
}

export async function deleteStory(storyId) {
  const { data } = await api.delete(`/story/${encodeURIComponent(storyId)}`);
  return data;
}

export async function updateAccount(payload) {
  const { data } = await api.put('/auth/account', payload);
  return data;
}

export async function changePassword(currentPassword, newPassword) {
  const { data } = await api.put('/auth/change-password', { currentPassword, newPassword });
  return data;
}

export async function forgotPassword(email) {
  const { data } = await api.post('/auth/forgot-password', { email });
  return data;
}

export async function resetPassword(token, password) {
  const { data } = await api.post('/auth/reset-password', { token, password });
  return data;
}

export async function generateTTS(text, voiceId) {
  const { data } = await api.post('/tts/generate', { text, voiceId });
  return data; // { audioBase64, alignment }
}

/**
 * Ask the backend to map raw avatar bone names to standard humanoid names via OpenAI.
 * Returns a Record<standardName, avatarBoneName> or throws on failure.
 */
export async function mapBones(boneNames) {
  const { data } = await api.post('/bones/map', { bones: boneNames });
  return data.mapping || {};
}
