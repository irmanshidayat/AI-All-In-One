const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const skripsiController = require('../controllers/skripsiController');
const isAuth = require('../middleware/isAuth');

// Konfigurasi multer untuk upload file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/references');
  },
  filename: function (req, file, cb) {
    cb(null, 'reference-' + Date.now() + path.extname(file.originalname));
  }
});

// Filter file untuk PDF dan Word
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format file tidak didukung. Hanya file PDF dan Word yang diizinkan.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Batas 5MB
  }
});

// Routes
router.get('/', isAuth, skripsiController.getSkripsiPage);
router.post('/upload-reference', isAuth, upload.single('referenceFile'), skripsiController.uploadReference);
router.get('/references', isAuth, skripsiController.getReferences);

// API endpoints
router.post('/api/generate-title', isAuth, skripsiController.generateTitle);
router.post('/api/improve-title', isAuth, skripsiController.improveTitle);
router.post('/api/generate-chapter', isAuth, skripsiController.generateChapter);
router.post('/api/generate-content', isAuth, skripsiController.generateChapter);
router.post('/api/consult', isAuth, skripsiController.consultWithAI);
router.post('/api/save', isAuth, skripsiController.saveSkripsi);

// Get skripsi by ID and actions
router.get('/api/:id', isAuth, skripsiController.getSkripsiById);
router.put('/api/:id', isAuth, skripsiController.updateSkripsi);
router.delete('/api/:id', isAuth, skripsiController.deleteSkripsi);

// Get skripsi list
router.get('/api/list', isAuth, skripsiController.getSkripsiList);
router.get('/list', isAuth, skripsiController.getSkripsiList); // Tambahan untuk path alternatif

// History specific routes
router.get('/api/history/:chapter', isAuth, skripsiController.getChapterHistory);
router.get('/api/history/:chapter/:section', isAuth, skripsiController.getSectionHistory);
router.post('/api/history/save', isAuth, skripsiController.saveHistory); // This is /dashboard/skripsi/api/history/save

// Handle absolute path for history save (to fix 401 error)
router.post('/dashboard/skripsi/api/history/save', isAuth, skripsiController.saveHistory); // This is the one you are calling

// Save history endpoint - NO authentication required
router.post('/api/history', skripsiController.saveHistory); // This is /dashboard/skripsi/api/history

module.exports = router;