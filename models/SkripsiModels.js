const { getPool } = require('../config/database');

class Skripsi {
  // Create new skripsi content
  static async create(userId, title, chapter, section, content) { // Removed 'sequence = 0' from parameters
    try {
      const pool = getPool();
      if (!pool) {
        console.error('Database pool is not available in Skripsi.create.');
        throw new Error('Database connection error. Pool is not available.');
      }
      // Adjusted query to match the provided table structure
      const query = `
        INSERT INTO skripsi 
        (user_id, title, chapter, section, content) 
        VALUES (?, ?, ?, ?, ?)
      `;
      // Adjusted parameters passed to pool.query
      const [result] = await pool.query(query, [userId, title, chapter, section, content]);
      return result.insertId;
    } catch (error) {
      console.error('Error creating skripsi entry in Skripsi.create:', error);
      if (error.sqlMessage) {
        console.error('SQL Error in Skripsi.create:', error.sqlMessage);
      }
      throw error; 
    }
  }

  // Get all skripsi content for a user
  static async getByUserId(userId) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database pool is not available');
      const query = `
        SELECT * FROM skripsi 
        WHERE user_id = ? 
        ORDER BY chapter, sequence, created_at DESC
      `;
      const [rows] = await pool.query(query, [userId]);
      return rows;
    } catch (error) {
      console.error('Error getting skripsi by user ID:', error);
      throw error;
    }
  }

  // Get specific skripsi content by ID
  static async getById(id) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database pool is not available');
      const [rows] = await pool.query(
        'SELECT * FROM skripsi WHERE id = ?',
        [id]
      );
      return rows[0];
    } catch (error) {
      console.error('Error getting skripsi by ID:', error);
      throw error;
    }
  }

  // Update existing skripsi content
  static async update(id, { title, chapter, section, content, sequence, status }) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database pool is not available');
      const now = new Date();
      const [result] = await pool.query(
        'UPDATE skripsi SET title = ?, chapter = ?, section = ?, content = ?, sequence = ?, status = ?, updated_at = ? WHERE id = ?',
        [title, chapter, section, content, sequence, status, now, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating skripsi:', error);
      throw error;
    }
  }

  // Delete skripsi content
  static async delete(id) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database pool is not available');
      const [result] = await pool.query(
        'DELETE FROM skripsi WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting skripsi:', error);
      throw error;
    }
  }

  // Get sections for a specific chapter
  static async getChapterSections(userId, chapter) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database pool is not available');
      const query = `
        SELECT * FROM skripsi 
        WHERE user_id = ? 
        AND chapter = ?
        ORDER BY sequence ASC, created_at DESC
      `;
      const [rows] = await pool.query(query, [userId, chapter]);
      return rows;
    } catch (error) {
      console.error('Error getting chapter sections:', error);
      throw error;
    }
  }

  // Get full chapter history
  static async getChapterHistory(userId, chapter) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database pool is not available');
      const query = `
        SELECT * FROM skripsi 
        WHERE user_id = ? 
        AND chapter = ?
        ORDER BY section, sequence, created_at DESC
      `;
      const [rows] = await pool.query(query, [userId, chapter]);
      return rows;
    } catch (error) {
      console.error('Error getting chapter history:', error);
      throw error;
    }
  }

  // Get section history
  static async getSectionHistory(userId, chapter, section) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database pool is not available');
      const query = `
        SELECT * FROM skripsi 
        WHERE user_id = ? 
        AND chapter = ? 
        AND section = ?
        ORDER BY created_at DESC
      `;
      const [rows] = await pool.query(query, [userId, chapter, section]);
      return rows;
    } catch (error) {
      console.error('Error getting section history:', error);
      throw error;
    }
  }

  // Get chapter sequence mapping
  static getChapterSequenceMap() {
    return {
      bab1: {
        'latar-belakang': 1,
        'rumusan-masalah': 2,
        'tujuan-penelitian': 3,
        'manfaat-penelitian': 4
      },
      bab2: {
        'landasan-teori': 1,
        'tinjauan-pustaka': 2,
        'penelitian-terdahulu': 3,
        'kerangka-pemikiran': 4,
        'hipotesis': 5
      },
      bab3: {
        'jenis-penelitian': 1,
        'populasi-sampel': 2,
        'teknik-pengumpulan': 3,
        'teknik-analisis': 4,
        'variabel-penelitian': 5
      },
      bab4: {
        'hasil-penelitian': 1,
        'analisis-data': 2,
        'pembahasan': 3,
        'interpretasi': 4
      },
      bab5: {
        'kesimpulan': 1,
        'saran': 2,
        'rekomendasi': 3,
        'keterbatasan': 4
      }
    };
  }
}

module.exports = Skripsi;