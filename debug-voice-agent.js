// Patch untuk endpoint voice-agent/call
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { connectDB } = require('./config/database');
const VoiceAgent = require('./models/VoiceAgent');

// Buat aplikasi Express untuk debug
const app = express();
app.use(bodyParser.json());

// Fungsi untuk logging requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Body:', req.body);
  next();
});

// Implementasi endpoint /call yang sama dengan di dashboard controller
app.post('/call', async (req, res) => {
  try {
    console.log('DEBUG - Call endpoint dipanggil dengan body:', req.body);
    
    const { contactId, configId } = req.body;
    
    // Validasi required fields
    if (!contactId || !configId) {
      console.log('DEBUG - Data tidak lengkap - contactId atau configId tidak ada');
      return res.status(400).json({
        success: false,
        message: 'Contact ID dan Config ID diperlukan'
      });
    }
    
    // Ensure database connection is established
    console.log('DEBUG - Memeriksa koneksi database...');
    
    // Langsung gunakan getPool() dari VoiceAgent untuk konsistensi
    const pool = require('./config/database').getPool();
    if (!pool) {
      console.log('DEBUG - Pool database tidak tersedia');
      return res.status(500).json({
        success: false,
        message: 'Koneksi database tidak tersedia. Silakan coba lagi nanti.'
      });
    }
    
    // Get contact from database
    console.log(`DEBUG - Mengambil data contact (ID: ${contactId})`);
    let contact = null;
    try {
      contact = await VoiceAgent.findContactById(contactId);
      console.log('DEBUG - Contact data:', contact);
    } catch (err) {
      console.error('DEBUG - ERROR saat mengambil data contact:', err);
      return res.status(500).json({
        success: false,
        message: 'Error mengambil data kontak: ' + err.message
      });
    }
    
    // Get config from database
    console.log(`DEBUG - Mengambil data config (ID: ${configId})`);
    let config = null;
    try {
      config = await VoiceAgent.findConfigById(configId);
      console.log('DEBUG - Config data:', config);
    } catch (err) {
      console.error('DEBUG - ERROR saat mengambil data config:', err);
      return res.status(500).json({
        success: false,
        message: 'Error mengambil data konfigurasi: ' + err.message
      });
    }
    
    if (!contact) {
      console.log(`DEBUG - ERROR: Kontak tidak ditemukan untuk ID ${contactId}`);
      return res.status(404).json({
        success: false,
        message: 'Kontak tidak ditemukan'
      });
    }
    
    if (!config) {
      console.log(`DEBUG - ERROR: Konfigurasi tidak ditemukan untuk ID ${configId}`);
      return res.status(404).json({
        success: false,
        message: 'Konfigurasi agent tidak ditemukan'
      });
    }
    
    // Simulasi panggilan tanpa menggunakan Twilio
    console.log('DEBUG - Menyimpan data panggilan simulasi ke database');
    let call = null;
    try {
      call = await VoiceAgent.saveCall({
        contact_id: contactId,
        config_id: configId,
        twilio_sid: 'DEBUG-' + Date.now(),
        status: 'initiated',
        duration: 0
      });
      console.log('DEBUG - Call data berhasil disimpan:', call);
    } catch (err) {
      console.error('DEBUG - ERROR saat menyimpan data panggilan:', err);
      return res.status(500).json({
        success: false,
        message: 'Error menyimpan data panggilan: ' + err.message
      });
    }
    
    // Format greeting message with contact name
    const greeting = config.greeting_template.replace('[nama]', contact.name);
    
    // Save initial greeting message
    console.log('DEBUG - Menyimpan pesan greeting ke database');
    try {
      await VoiceAgent.saveConversation({
        call_id: call.id,
        sender_type: 'agent',
        message_text: greeting,
        created_at: new Date()
      });
      console.log('DEBUG - Pesan greeting berhasil disimpan');
    } catch (err) {
      console.error('DEBUG - ERROR saat menyimpan pesan greeting:', err);
      // Continue even if saving the greeting fails
    }
    
    return res.json({
      success: true,
      message: 'Panggilan berhasil dimulai (simulasi)',
      call: {
        id: call.id,
        contact: contact,
        config: config,
        greeting: greeting
      }
    });
    
  } catch (error) {
    console.error('DEBUG - ERROR di endpoint call:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan saat memulai panggilan: ' + error.message 
    });
  }
});

// Jalankan server debug
async function startServer() {
  try {
    // Connect to database
    await connectDB();
    
    // Start server
    const PORT = 3001;
    app.listen(PORT, () => {
      console.log(`=== DEBUG SERVER ===`);
      console.log(`Server berjalan di http://localhost:${PORT}`);
      console.log(`Gunakan endpoint http://localhost:${PORT}/call untuk menguji`);
      console.log(`Contoh payload: { "contactId": 6, "configId": 1 }`);
    });
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

startServer();