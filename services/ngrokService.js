const axios = require('axios');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class NgrokService extends EventEmitter {
  constructor() {
    super();
    this.ngrokUrl = null;
    this.ngrokApiUrl = 'http://127.0.0.1:4040/api/tunnels';
    this.cacheFile = path.join(__dirname, '../', 'ngrok-cache.json');
    this.retryAttempts = 0;
    this.maxRetries = 5;
    
    // Start periodic URL check
    this.startUrlCheck();
  }

  /**
   * Memulai pengecekan URL secara berkala
   */
  startUrlCheck() {
    setInterval(async () => {
      try {
        const newUrl = await this.fetchNgrokUrl();
        if (newUrl && newUrl !== this.ngrokUrl) {
          this.ngrokUrl = newUrl;
          this.saveToCache(newUrl);
          // Emit event ketika URL berubah
          this.emit('url-updated', newUrl);
        }
      } catch (error) {
        console.warn('[Ngrok] Error checking URL:', error.message);
      }
    }, 50000); // Check every 5 seconds
  }

  /**
   * Mendapatkan URL publik ngrok yang aktif
   * @returns {Promise<string>} URL ngrok aktif
   */
  async getPublicUrl() {
    // Jika URL sudah ada, kembalikan langsung
    if (this.ngrokUrl) {
      return this.ngrokUrl;
    }
    
    // Coba ambil dari cache file jika belum ada
    try {
      if (fs.existsSync(this.cacheFile)) {
        const cacheData = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
        if (cacheData.url && cacheData.timestamp && 
            (Date.now() - cacheData.timestamp) < 3600000) { // Cache valid selama 1 jam
          console.log(`[Ngrok] Menggunakan URL dari cache: ${cacheData.url}`);
          this.ngrokUrl = cacheData.url;
          return this.ngrokUrl;
        }
      }
    } catch (err) {
      console.warn('[Ngrok] Gagal membaca cache file:', err.message);
    }
    
    // Jika tidak ada di cache, ambil dari API ngrok
    return this.fetchNgrokUrl();
  }

  /**
   * Mengambil URL ngrok dari API lokal ngrok
   * @returns {Promise<string>} URL ngrok aktif
   */
  async fetchNgrokUrl() {
    try {
      const response = await axios.get(this.ngrokApiUrl);
      
      if (response.data && response.data.tunnels && response.data.tunnels.length) {
        // Cari tunnel HTTPS
        const httpsTunnel = response.data.tunnels.find(tunnel => 
          tunnel.proto === 'https' && tunnel.public_url
        );
        
        if (httpsTunnel) {
          const newUrl = httpsTunnel.public_url;
          if (newUrl !== this.ngrokUrl) {
            this.emit('url-updated', newUrl);
          }
          this.ngrokUrl = newUrl;
          console.log(`[Ngrok] URL aktif terdeteksi: ${this.ngrokUrl}`);
          
          // Simpan ke cache file
          this.saveToCache(this.ngrokUrl);
          
          return this.ngrokUrl;
        } else if (response.data.tunnels.length > 0) {
          // Jika tidak ada HTTPS, gunakan apa saja yang tersedia
          this.ngrokUrl = response.data.tunnels[0].public_url;
          console.log(`[Ngrok] URL aktif terdeteksi (non-HTTPS): ${this.ngrokUrl}`);
          
          // Simpan ke cache file
          this.saveToCache(this.ngrokUrl);
          
          return this.ngrokUrl;
        }
      }
      
      throw new Error('Tidak ada ngrok tunnel yang aktif');
    } catch (error) {
      if (this.retryAttempts < this.maxRetries) {
        this.retryAttempts++;
        console.warn(`[Ngrok] Gagal mendapatkan URL ngrok (percobaan ${this.retryAttempts}): ${error.message}`);
        console.warn('[Ngrok] Mencoba lagi dalam 5 detik...');
        
        // Tunggu 5 detik sebelum mencoba lagi
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.fetchNgrokUrl();
      }
      
      this.retryAttempts = 0;
      console.error('[Ngrok] Semua percobaan untuk mendapatkan URL ngrok gagal:', error.message);
      console.error('[Ngrok] Pastikan ngrok berjalan dengan perintah: ngrok http 3000');
      
      // Jika gagal, kembalikan URL default sehingga aplikasi tetap bisa jalan
      return process.env.BASE_URL || 'http://localhost:3000';
    }
  }

  /**
   * Menyimpan URL ngrok ke file cache
   * @param {string} url URL ngrok untuk disimpan
   */
  saveToCache(url) {
    try {
      const cacheData = {
        url: url,
        timestamp: Date.now()
      };
      
      fs.writeFileSync(this.cacheFile, JSON.stringify(cacheData), 'utf8');
      console.log(`[Ngrok] URL tersimpan di cache: ${url}`);
    } catch (err) {
      console.warn('[Ngrok] Gagal menyimpan URL ke cache:', err.message);
    }
  }

  /**
   * Menghapus URL dari cache
   */
  clearCache() {
    this.ngrokUrl = null;
    
    try {
      if (fs.existsSync(this.cacheFile)) {
        fs.unlinkSync(this.cacheFile);
        console.log('[Ngrok] Cache dihapus');
      }
    } catch (err) {
      console.warn('[Ngrok] Gagal menghapus cache:', err.message);
    }
  }

  /**
   * Membuat URL lengkap dengan base URL ngrok
   * @param {string} path Path yang ingin dibuat URL-nya
   * @returns {Promise<string>} URL lengkap dengan base ngrok
   */
  async buildUrl(path) {
    const baseUrl = await this.getPublicUrl();
    return `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  }
}

module.exports = new NgrokService();