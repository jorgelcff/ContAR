import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

/** Save or update a scene. Returns { sceneId }. */
export async function saveScene(payload) {
  const { data } = await api.post('/scene', payload);
  return data;
}

/** Load a scene by ID. */
export async function getScene(id) {
  const { data } = await api.get(`/scene/${id}`);
  return data;
}

/** Store an avatar URL reference. Returns { avatarId }. */
export async function saveAvatar(modelUrl) {
  const { data } = await api.post('/avatar', { modelUrl });
  return data;
}
