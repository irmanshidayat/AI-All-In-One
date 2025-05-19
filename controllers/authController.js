const User = require('../models/User');

// Display login form
exports.getLogin = (req, res) => {
  res.render('auth/login', { 
    title: 'Login',
    error: req.session.error
  });
  delete req.session.error;
};

// Handle login form submission
exports.postLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user by username
    const user = await User.findByUsername(username);
    
    if (!user || !(await User.isValidPassword(user, password))) {
      req.session.error = 'Username atau password salah';
      return res.redirect('/auth/login');
    }
    
    // Set complete user session data
    req.session.isLoggedIn = true;
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.email = user.email;
    req.session.role = user.role;
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || 'user'
    };
    
    // Save session before redirect
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        req.flash('error', 'Failed to save session');
        return res.redirect('/auth/login');
      }
      
      // Log successful login
      console.log('User logged in successfully:', {
        id: user.id,
        username: user.username,
        role: user.role
      });
      
      res.redirect('/dashboard');
    });
    
  } catch (error) {
    console.error('Login error:', error);
    req.session.error = 'Terjadi kesalahan saat login';
    res.redirect('/auth/login');
  }
};

// Display register form
exports.getRegister = (req, res) => {
  res.render('auth/register', { 
    title: 'Register',
    error: req.session.error
  });
  delete req.session.error;
};

// Handle register form submission
exports.postRegister = async (req, res) => {
  try {
    const { username, email, password, confirmPassword, role = 'user' } = req.body;
    
    // Check if passwords match
    if (password !== confirmPassword) {
      req.session.error = 'Password tidak cocok';
      return res.redirect('/auth/register');
    }
    
    // Check if user already exists
    const existingUser = await User.findByUsername(username);
    const existingEmail = await User.findByEmail(email);
    
    if (existingUser || existingEmail) {
      req.session.error = 'Username atau email sudah digunakan';
      return res.redirect('/auth/register');
    }
    
    // Create new user
    await User.create({
      username,
      email,
      password,
      role
    });
    
    req.session.success = 'Registrasi berhasil, silakan login';
    res.redirect('/auth/login');
  } catch (error) {
    console.error(error);
    req.session.error = 'Terjadi kesalahan, silakan coba lagi';
    res.redirect('/auth/register');
  }
};

// Logout
exports.logout = (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
};