const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Login routes
router.get('/auth/login', authController.getLogin);
router.post('/auth/login', authController.postLogin);

// Register routes
router.get('/auth/register', authController.getRegister);
router.post('/auth/register', authController.postRegister);

// Logout route
router.get('/auth/logout', authController.logout);

// Redirect root to login
router.get('/', (req, res) => {
  res.redirect('/auth/login');
});

module.exports = router;