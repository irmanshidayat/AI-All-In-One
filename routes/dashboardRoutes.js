const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const skripsiController = require('../controllers/skripsiController');
const isAuth = require('../middleware/isAuth');

// Apply isAuth middleware to all dashboard routes
router.use(isAuth);

// Dashboard route
router.get('/', dashboardController.getDashboard);

// Agent Voice Call routes
router.get('/voice-agent', dashboardController.getVoiceAgent);
router.post('/voice-agent/import', dashboardController.importContacts);
router.post('/voice-agent/configure', dashboardController.configureAgent);
router.post('/voice-agent/call', dashboardController.makeCall);
router.post('/voice-agent/batch-call', dashboardController.makeBatchCall);
router.get('/voice-agent/models', dashboardController.getAvailableModels);
router.get('/voice-agent/conversation/:callId', dashboardController.getCallConversation);
router.delete('/voice-agent/config/:configId', dashboardController.deleteAgentConfig);
router.get('/voice-agent/config/:configId', dashboardController.getAgentConfig);

// User management routes
router.get('/users', (req, res) => {
  res.render('dashboard/index', { 
    title: 'Pengguna',
    user: req.session.user,
    body: '<div class="dashboard-content"><h1>Manajemen Pengguna</h1><p>Halaman ini menampilkan daftar pengguna.</p></div>'
  });
});

// Conversations routes
router.get('/conversations', (req, res) => {
  res.render('dashboard/index', { 
    title: 'Percakapan',
    user: req.session.user,
    body: '<div class="dashboard-content"><h1>Percakapan</h1><p>Halaman ini menampilkan daftar percakapan.</p></div>'
  });
});

// Feedback routes
router.get('/feedback', (req, res) => {
  res.render('dashboard/index', { 
    title: 'Feedback',
    user: req.session.user,
    body: '<div class="dashboard-content"><h1>Feedback</h1><p>Halaman ini menampilkan daftar feedback.</p></div>'
  });
});

// Route untuk halaman analitik
router.get('/analytics', (req, res) => {
  res.render('dashboard/analytics', { 
    layout: 'layouts/main-layout',
    title: 'Analitik',
    path: '/dashboard/analytics',
    user: req.user 
  });
});

// Route untuk halaman agent voice call
router.get('/voice-agent', (req, res) => {
  res.render('dashboard/voice-agent', { 
    layout: 'layouts/main-layout',
    title: 'Agent Voice Call',
    path: '/dashboard/voice-agent',
    user: req.user 
  });
});

// Route untuk halaman riset jurnal
router.get('/research', (req, res) => {
  res.render('dashboard/research', { 
    layout: 'layouts/main-layout',
    title: 'Riset Jurnal',
    path: '/dashboard/research',
    user: req.user 
  });
});

// Skripsi routes
router.get('/skripsi', skripsiController.getSkripsiPage);
router.post('/skripsi/api/generate-title', skripsiController.generateTitle);
router.post('/skripsi/api/improve-title', skripsiController.improveTitle);
router.post('/skripsi/api/generate-chapter', skripsiController.generateChapter);
router.post('/skripsi/api/consult', skripsiController.consultWithAI);

// Skripsi history management routes
router.get('/skripsi/list', skripsiController.getSkripsiList);
router.get('/skripsi/api/history/:chapter', skripsiController.getChapterHistory);
router.get('/skripsi/api/history/:chapter/:section', skripsiController.getSectionHistory);
router.post('/skripsi/api/history/save', skripsiController.saveHistory);
router.get('/skripsi/api/:id', skripsiController.getSkripsiById);
router.put('/skripsi/api/:id', skripsiController.updateSkripsi);
router.delete('/skripsi/api/:id', skripsiController.deleteSkripsi);

// Route untuk halaman video streaming
router.get('/video-streaming', (req, res) => {
  res.render('dashboard/video-streaming', { 
    layout: 'layouts/main-layout',
    title: 'Agent Video Streaming',
    path: '/dashboard/video-streaming',
    user: req.user,
    API_HEYGEN_PRO: process.env.API_HEYGEN_PRO
  });
});

module.exports = router;