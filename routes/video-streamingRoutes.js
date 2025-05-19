const express = require('express');
const router = express.Router();
const videoStreamingController = require('../controllers/videoStreamingController');
const isAuth = require('../middleware/isAuth');
const VideoStreaming = require('../models/VideoStreamingModels');

// Apply isAuth middleware to all video streaming routes
router.use(isAuth);

// Main video streaming page
router.get('/', videoStreamingController.getVideoStreaming);

// API Routes - Explicitly add isAuth to each route for clarity
router.get('/avatars', isAuth, videoStreamingController.getAvatarList);
router.get('/voices', isAuth, videoStreamingController.getVoiceList);
router.get('/voices/locales', isAuth, videoStreamingController.getVoiceLocales);
router.get('/brand-voices', isAuth, videoStreamingController.getBrandVoices);
router.get('/token', isAuth, videoStreamingController.getSessionToken);
router.post('/session', isAuth, videoStreamingController.createSession);
router.post('/start', isAuth, videoStreamingController.startStreaming);
router.post('/text', isAuth, videoStreamingController.sendText);
router.post('/stop', isAuth, videoStreamingController.stopStreaming);

module.exports = router;