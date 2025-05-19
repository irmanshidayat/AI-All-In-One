const express = require('express');
const router = express.Router();
const VoiceController = require('../controllers/voiceController');
const twilioVoiceService = require('../services/twilioVoiceService');

// Main voice call endpoint - generates TwiML for initial greeting
router.post('/call', (req, res) => VoiceController.handleVoiceCall(req, res));

// Voice response endpoint - handles user input and generates AI response
router.post('/respond', (req, res) => VoiceController.handleVoiceResponse(req, res));

// Check if call should continue - asks user if they need anything else
router.post('/check-continue', (req, res) => VoiceController.handleCheckContinue(req, res));

// Status callback for Twilio call events
router.post('/status-callback', (req, res) => VoiceController.handleStatusCallback(req, res));

// Fallback endpoint untuk panggilan bermasalah
router.post('/fallback', (req, res) => VoiceController.handleFallback(req, res));

// Rute untuk TTS
router.post('/tts', (req, res) => VoiceController.handleTts(req, res));

// Rute untuk mendapatkan daftar voice TTS
router.get('/tts-voices', (req, res) => VoiceController.getTTSVoices(req, res));

// Rute untuk memeriksa status panggilan
router.get('/call-status', (req, res) => VoiceController.handleCallStatus(req, res));

// Rute baru untuk musik tunggu saat panggilan
router.get('/wait', (req, res) => VoiceController.handleWaitMusic(req, res));

// Webhook untuk panggilan masuk
router.post('/incoming', (req, res) => {
  twilioVoiceService.handleIncomingCall(req, res);
});

// Rute untuk menu
router.post('/menu', (req, res) => {
  const twiml = twilioVoiceService.createMenuResponse();
  res.type('text/xml');
  res.send(twiml.toString());
});

// Rute untuk menangani pilihan menu
router.post('/handle-menu', (req, res) => {
  const digits = req.body.Digits;
  const twiml = twilioVoiceService.handleMenuSelection(digits);
  res.type('text/xml');
  res.send(twiml.toString());
});

module.exports = router;