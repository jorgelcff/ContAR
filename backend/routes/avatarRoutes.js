const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
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
} = require('../controllers/avatarController');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', limiter, saveAvatar);
router.post('/user/new', limiter, createAvaturnUser);
router.delete('/user/:userId', limiter, deleteAvaturnUser);
router.post('/session', limiter, createAvaturnSession);
router.get('/list', limiter, listAvaturnAvatars);
router.post('/new', limiter, createAvatarByApi);
router.get('/:avatarId/customization', limiter, getAvatarCustomization);
router.put('/:avatarId/customization', limiter, setAvatarCustomization);
router.delete('/users/:userId/avatars/:avatarId', limiter, deleteUserAvatar);
router.post('/render', limiter, createRenderTask);
router.post('/export', limiter, createExportTask);

module.exports = router;
