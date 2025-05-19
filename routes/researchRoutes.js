const express = require('express');
const router = express.Router();
const researchController = require('../controllers/researchController');
// Fix the middleware import - it's exported as a direct function, not an object
const isAuth = require('../middleware/isAuth');

// Route untuk halaman utama riset jurnal
router.get('/', isAuth, researchController.getResearchPage);

// Route untuk mencari jurnal
router.get('/search', isAuth, researchController.searchResearch);

// Route untuk mencari jurnal berdasarkan subject (CORE API)
router.get('/subject/search', isAuth, researchController.searchJournalsBySubject);

// Route untuk mencari jurnal berdasarkan DOI (CORE API)
router.get('/doi/search', isAuth, researchController.searchWorksByDOI);

// Route untuk mencari jurnal berdasarkan judul (CORE API)
router.get('/title/search', isAuth, researchController.searchWorksByTitle);

// Route untuk mencari jurnal berdasarkan penulis (CORE API)
router.get('/author/search', isAuth, researchController.searchWorksByAuthor);

// Route untuk mencari jurnal berdasarkan teks dalam konten (CORE API)
router.get('/fulltext/search', isAuth, researchController.searchWorksByFullText);

// Route untuk mencari jurnal outputs (CORE API outputs endpoint)
router.get('/outputs/search', isAuth, researchController.searchOutputs);

// Route untuk mencari jurnal outputs berdasarkan ID (CORE API outputs endpoint)
router.get('/outputs/id/search', isAuth, researchController.searchOutputById);

// Route untuk mencari jurnal outputs berdasarkan judul (CORE API outputs endpoint)
router.get('/outputs/title/search', isAuth, researchController.searchOutputsByTitle);

// Route untuk mencari jurnal outputs berdasarkan fulltext (CORE API outputs endpoint)
router.get('/outputs/fulltext/search', isAuth, researchController.searchOutputsByFullText);

// Route untuk mencari jurnal outputs berdasarkan penulis (CORE API outputs endpoint)
router.get('/outputs/author/search', isAuth, researchController.searchOutputsByAuthor);

// Route untuk mendapatkan jurnal yang disimpan
router.get('/saved/list', isAuth, researchController.getSavedResearch);

// Route untuk mencari jurnal berdasarkan kategori
router.get('/category/filter', isAuth, researchController.getResearchByCategory);

// Route untuk mendapatkan detail jurnal
router.get('/:id', isAuth, researchController.getResearchDetail);

// Route untuk mendapatkan konten lengkap jurnal
router.get('/:id/full-content', isAuth, researchController.getResearchFullContent);

// Route untuk menganalisis jurnal dengan AI
router.post('/:id/analyze', isAuth, researchController.analyzeResearchWithAI);

// Route untuk menyimpan jurnal sebagai favorit
router.post('/:id/save', isAuth, researchController.saveResearch);

module.exports = router;