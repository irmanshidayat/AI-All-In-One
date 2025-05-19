const authenticate = (req, res, next) => {
  // Periksa apakah pengguna sudah login
  if (!req.session || !req.session.user) {
    return res.status(401).redirect('/auth/login');
  }
  
  // Tambahkan informasi pengguna ke objek request
  req.user = req.session.user;
  next();
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    // Pastikan pengguna sudah login
    if (!req.session || !req.session.user) {
      return res.status(401).redirect('/auth/login');
    }

    // Periksa apakah peran pengguna sesuai
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('error', { 
        title: 'Akses Ditolak', 
        message: 'Anda tidak memiliki izin untuk mengakses halaman ini' 
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  restrictTo
}; 