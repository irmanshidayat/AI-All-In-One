const bcrypt = require('bcryptjs');
const { getPool } = require('../config/database');

class User {
  static async findByUsername(username) {
    try {
      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
      return rows[0];
    } catch (error) {
      console.error('Error finding user by username:', error);
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      return rows[0];
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
      return rows[0];
    } catch (error) {
      console.error('Error finding user by id:', error);
      throw error;
    }
  }

  static async create(userData) {
    try {
      const { username, email, password, role = 'user' } = userData;
      
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      const pool = getPool();
      const [result] = await pool.query(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        [username, email, hashedPassword, role]
      );
      
      return { id: result.insertId, username, email, role };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  static async isValidPassword(user, password) {
    return await bcrypt.compare(password, user.password);
  }
}

module.exports = User;