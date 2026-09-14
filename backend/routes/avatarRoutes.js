const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const {
  linkAvaturnUser,
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
} = require('../controllers/avatarController');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

// Every one of these proxies the Avaturn API using the server's own
// AVATURN_API_TOKEN, so without requireAuth they were an open proxy onto a paid
// third-party account: anyone who could reach the backend could spend its quota
// and, through the delete routes, destroy avatars and users belonging to it.
// Only user-link was guarded. The three the app actually calls (user-link,
// session, list) are all reached from the editor, which already requires a
// session; the rest have no caller at all and were pure exposed surface.
router.put('/user-link', limiter, requireAuth, linkAvaturnUser);
router.post('/user/new', limiter, requireAuth, createAvaturnUser);
router.delete('/user/:userId', limiter, requireAuth, deleteAvaturnUser);
router.post('/session', limiter, requireAuth, createAvaturnSession);
router.get('/list', limiter, requireAuth, listAvaturnAvatars);
router.post('/new', limiter, requireAuth, createAvatarByApi);
router.get('/:avatarId/customization', limiter, requireAuth, getAvatarCustomization);
router.put('/:avatarId/customization', limiter, requireAuth, setAvatarCustomization);
router.delete('/users/:userId/avatars/:avatarId', limiter, requireAuth, deleteUserAvatar);
router.post('/render', limiter, requireAuth, createRenderTask);
router.post('/export', limiter, requireAuth, createExportTask);

module.exports = router;
