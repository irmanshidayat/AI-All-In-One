const mysql = require('mysql2/promise');

// MySQL connection configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'voice_call',
  port: process.env.DB_PORT || 3308,
  waitForConnections: true,
  connectionLimit: 20, // Meningkatkan batas koneksi dari 10 ke 20
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 10 detik
  connectTimeout: 60000, // 60 detik
  acquireTimeout: 60000, // 60 detik
  timeout: 60000, // 60 detik
  idleTimeout: 60000, // 60 detik - waktu idle sebelum koneksi ditutup
  // Properti tambahan untuk menjaga koneksi tetap aktif
  multipleStatements: true, // Memungkinkan beberapa pernyataan SQL dalam satu query
  dateStrings: true // Mengembalikan tanggal sebagai string
};

// Create a connection pool
let pool = null;
let connectionAttempts = 0;
const MAX_ATTEMPTS = 5;

/**
 * Connect to MySQL database with retry mechanism
 * @returns {Promise<Object>} A MySQL connection pool
 */
const connectDB = async () => {
  try {
    console.log('Attempting to connect to MySQL with config:', {
      host: DB_CONFIG.host,
      user: DB_CONFIG.user,
      database: DB_CONFIG.database,
      port: DB_CONFIG.port,
      connectionLimit: DB_CONFIG.connectionLimit
    });
    
    // Create the connection pool
    pool = mysql.createPool(DB_CONFIG);
    
    // Menangani event dari pool
    pool.on('connection', () => {
      console.log('New database connection established');
    });

    pool.on('enqueue', () => {
      console.log('Waiting for available connection slot');
    });

    pool.on('release', (connection) => {
      console.log('Connection %d released', connection.threadId);
    });
    
    // Test the connection
    const connection = await pool.getConnection();
    console.log('Successfully connected to MySQL database with threadId:', connection.threadId);
    
    // Ping database untuk memastikan koneksi aktif
    await connection.ping();
    console.log('Database ping successful');
    
    connection.release();
    
    // Reset connection attempts on success
    connectionAttempts = 0;
    
    // Set up interval untuk melakukan ping database secara berkala (setiap 30 detik)
    setInterval(async () => {
      try {
        const conn = await pool.getConnection();
        await conn.ping();
        conn.release();
        console.log('Keep-alive ping successful');
      } catch (err) {
        console.error('Keep-alive ping failed:', err);
        // Jika ping gagal, coba reconnect
        pool = null;
        connectDB().catch(console.error);
      }
    }, 30000);
    
    return pool;
  } catch (err) {
    connectionAttempts++;
    console.error(`MySQL connection error (attempt ${connectionAttempts}/${MAX_ATTEMPTS}):`, err);
    
    if (connectionAttempts < MAX_ATTEMPTS) {
      // Wait before retrying (exponential backoff)
      const waitTime = Math.min(1000 * Math.pow(2, connectionAttempts), 10000);
      console.log(`Retrying connection in ${waitTime/1000} seconds...`);
      
      return new Promise((resolve, reject) => {
        setTimeout(async () => {
          try {
            const result = await connectDB();
            resolve(result);
          } catch (retryErr) {
            reject(retryErr);
          }
        }, waitTime);
      });
    }
    
    throw new Error(`Failed to connect to database after ${MAX_ATTEMPTS} attempts: ${err.message}`);
  }
};

/**
 * Get the database connection pool
 * @returns {Object|null} The MySQL connection pool or null if not connected
 */
const getPool = () => {
  // If pool is null, try to reconnect
  if (!pool) {
    console.log('Database connection not established, attempting to connect...');
    
    // Don't return the promise, just trigger the reconnection attempt
    connectDB().catch(err => {
      console.error('Failed to reconnect to database:', err.message);
    });
  }
  
  return pool;
};

/**
 * Check if database connection is valid and reconnect if needed
 * @returns {Promise<boolean>} True if connected, false otherwise
 */
const ensureConnection = async () => {
  try {
    if (!pool) {
      await connectDB();
      return !!pool;
    }
    
    try {
      // Test if connection is still valid
      const connection = await pool.getConnection();
      
      // Ping untuk memastikan koneksi benar-benar aktif
      await connection.ping();
      
      connection.release();
      return true;
    } catch (connectionError) {
      console.error('Connection test failed, attempting reconnect:', connectionError);
      
      // Jika tes gagal, reset pool dan coba lagi
      pool = null;
      await connectDB();
      return !!pool;
    }
  } catch (error) {
    console.error('Error checking database connection:', error);
    
    // Try to reconnect
    try {
      pool = null;
      await connectDB();
      return !!pool;
    } catch (reconnectError) {
      console.error('Failed to reconnect to database:', reconnectError);
      return false;
    }
  }
};

// Export the connection functions
module.exports = {
  connectDB,
  getPool,
  ensureConnection
};