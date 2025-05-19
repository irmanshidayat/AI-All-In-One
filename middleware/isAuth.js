/**
 * Authentication middleware - Bypassed for development
 */
module.exports = (req, res, next) => {
  // Always set a default user for development
  req.session.isLoggedIn = true;
  req.session.userId = 1;
  req.session.username = 'developer';
  req.session.email = 'dev@example.com';
  req.session.role = 'admin';
  req.session.user = {
    id: 1,
    username: 'developer',
    email: 'dev@example.com',
    role: 'admin'
  };

  // Add user info to request object
  req.user = {
    id: req.session.userId,
    username: req.session.username,
    email: req.session.email,
    role: req.session.role
  };

  next();
};