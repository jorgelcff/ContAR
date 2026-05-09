import axios from 'axios';

const configuredApiBase = String(import.meta.env.VITE_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');
const apiBaseUrl = configuredApiBase || '/api';

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

/** Store an avatar URL reference. Returns { avatarId }. */
export async function saveAvatar(modelUrl) {
  const { data } = await api.post('/avatar', { modelUrl });
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
  formData.append('file', blob, 'tts-output.mp3');
  const { data } = await api.post('/media/audio', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
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
