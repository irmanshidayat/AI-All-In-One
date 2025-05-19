// Dashboard controller for handling dashboard-related functionality
const User = require('../models/User');
const VoiceAgent = require('../models/VoiceAgentModels');
const { getPool, ensureConnection } = require('../config/database');
const axios = require('axios');
const xlsx = require('xlsx');
const multer = require('multer');
const path = require('path');
const twilio = require('twilio'); // Add Twilio package

// Set up multer storage for Excel imports
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, 'contacts-' + Date.now() + path.extname(file.originalname));
  }
});

// Multer upload configuration
exports.upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    // Accept only Excel files
    const filetypes = /xlsx|xls|csv/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      return cb(null, true);
    }
    cb(new Error('Hanya file Excel (.xlsx, .xls) atau CSV yang diizinkan'));
  }
}).single('contactsFile');

/**
 * Display the dashboard page
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.getDashboard = async (req, res) => {
  try {
    // Check if pool is initialized
    const pool = getPool();
    if (!pool) {
      throw new Error('Database connection not established');
    }
    
    let userObject = null;
    
    if (req.session && req.session.user && req.session.user.id) {
      const user = await User.findById(req.session.user.id);
      if (user) {
        userObject = {
          id: user.id,
          username: user.username,
          email: user.email
        };
      } else {
        // If user not found in database but exists in session
        userObject = {
          id: req.session.user.id,
          username: req.session.user.username,
          email: req.session.user.email
        };
      }
    }
    
    // If no user object could be created, redirect to login
    if (!userObject) {
      req.session.error = 'Sesi Anda telah berakhir, silakan login kembali';
      return res.redirect('/login');
    }
    
    res.render('dashboard/index', {
      title: 'Dashboard | Voice Call',
      user: userObject,
      path: '/dashboard', // Tambahkan path untuk menandai menu aktif
      body: '<div class="dashboard-content"><h1>Selamat Datang di Dashboard</h1><p>Ini adalah halaman dashboard Anda.</p></div>'
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('500', { 
      title: 'Server Error', 
      message: 'Terjadi kesalahan pada server: ' + error.message 
    });
  }
};

/**
 * Display the voice agent page
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.getVoiceAgent = async (req, res) => {
  try {
    const pool = getPool();
    if (!pool) {
      throw new Error('Database connection not established');
    }
    
    let userObject = null;
    
    if (req.session && req.session.user && req.session.user.id) {
      const user = await User.findById(req.session.user.id);
      if (user) {
        userObject = {
          id: user.id,
          username: user.username,
          email: user.email
        };
      } else {
        userObject = {
          id: req.session.user.id,
          username: req.session.user.username,
          email: req.session.user.email
        };
      }
    }
    
    if (!userObject) {
      req.session.error = 'Sesi Anda telah berakhir, silakan login kembali';
      return res.redirect('/login');
    }
    
    // Get contacts from database
    const contacts = await VoiceAgent.getAllContacts();
    
    // Get agent configurations
    const configs = await VoiceAgent.getAllConfigs(); // Ubah dari agentConfigs ke configs
    
    // Get call history
    const callHistory = await VoiceAgent.getCallHistory();
    
    // Get available models
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1';
    let models = [
      { id: 'openai/gpt-3.5-turbo', name: 'OpenAI GPT-3.5 Turbo', type: 'free' },
      { id: 'anthropic/claude-instant-v1', name: 'Anthropic Claude Instant', type: 'free' },
      { id: 'google/palm-2-chat-bison', name: 'Google PaLM 2 Chat', type: 'free' },
      { id: 'meta-llama/llama-2-13b-chat', name: 'Meta Llama 2 13B Chat', type: 'free' },
      { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B Instruct', type: 'free' }
    ];
    
    try {
      const response = await axios.get(`${OPENROUTER_API_URL}/models`, {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && response.data.data) {
        models = response.data.data
          .filter(model => model.pricing.prompt === 0 && model.pricing.completion === 0)
          .map(model => ({
            id: model.id,
            name: model.name || model.id,
            type: 'free'
          }));
      }
    } catch (error) {
      console.error('Error fetching models from OpenRouter:', error.message);
      // Use default models in case of error
    }
    
    // Get flash messages from session
    const success = req.session.success;
    const error = req.session.error;
    
    // Clear messages after retrieving them
    delete req.session.success;
    delete req.session.error;
    
    // Render the voice agent page using the index.ejs template with voice-agent content
    res.render('dashboard/voice-agent', {
      title: 'Agent Voice Call',
      user: userObject,
      path: '/dashboard/voice-agent', // Tambahkan path untuk menandai menu aktif
      contacts,
      configs, // Ubah dari agentConfigs ke configs agar sesuai dengan template
      callHistory,
      models,
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
      twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
      openrouterApiKey: OPENROUTER_API_KEY,
      openrouterApiUrl: OPENROUTER_API_URL,
      defaultModel: process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo',
      success,
      error
    });
  } catch (error) {
    console.error('Voice Agent error:', error);
    res.status(500).render('500', { 
      title: 'Server Error', 
      message: 'Terjadi kesalahan pada server: ' + error.message 
    });
  }
};

/**
 * Import contacts from Excel file
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.importContacts = async (req, res) => {
  try {
    this.upload(req, res, async function(err) {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Tidak ada file yang diunggah' });
      }
      
      const filePath = req.file.path;
      
      try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);
        
        if (data.length === 0) {
          return res.status(400).json({ success: false, message: 'File Excel kosong' });
        }
        
        // Validate required fields
        const requiredFields = ['name', 'phone'];
        const missingFields = requiredFields.filter(field => !Object.keys(data[0]).includes(field));
        
        if (missingFields.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Kolom ${missingFields.join(', ')} tidak ditemukan dalam file Excel`
          });
        }
        
        // Format phone numbers
        const formattedContacts = data.map(row => ({
          name: row.name.trim(),
          phone: formatPhoneNumber(row.phone.toString().trim())
        }));
        
        // Get existing phone numbers from database to check for duplicates
        const pool = getPool();
        if (!pool) throw new Error('Database connection not established');
        
        const [existingContacts] = await pool.query('SELECT phone FROM contacts');
        const existingPhones = new Set(existingContacts.map(contact => contact.phone));
        
        // Filter out duplicates
        const newContacts = formattedContacts.filter(contact => !existingPhones.has(contact.phone));
        const duplicateCount = formattedContacts.length - newContacts.length;
        
        if (newContacts.length === 0) {
          // All contacts are duplicates
          req.session.success = `Semua kontak (${duplicateCount}) sudah ada dalam database`;
          return res.redirect('/dashboard/voice-agent');
        }
        
        // Save only non-duplicate contacts to database
        await VoiceAgent.saveContacts(newContacts);
        
        let successMessage;
        if (duplicateCount > 0) {
          successMessage = `${newContacts.length} kontak berhasil diimpor (${duplicateCount} kontak duplikat dilewati)`;
        } else {
          successMessage = `${newContacts.length} kontak berhasil diimpor`;
        }
        
        // Set success message in session and redirect to voice-agent page
        req.session.success = successMessage;
        return res.redirect('/dashboard/voice-agent');
      } catch (error) {
        console.error('Error processing Excel file:', error);
        
        // Handle duplicate entry error specifically
        if (error.message && error.message.includes('Duplicate entry')) {
          req.session.error = 'Beberapa kontak memiliki nomor telepon yang sama dengan data yang sudah ada';
          return res.redirect('/auth/login');
        }
        
        res.status(500).json({
          success: false,
          message: 'Error memproses file Excel: ' + error.message
        });
      }
    });
  } catch (error) {
    console.error('Import contacts error:', error);
    req.session.error = 'Terjadi kesalahan saat mengimpor kontak';
    return res.redirect('/auth/login');
  }
};

/**
 * Format phone number to E.164 format
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 */
function formatPhoneNumber(phone) {
  // Remove non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Add Indonesia country code if needed
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (!cleaned.startsWith('62') && !cleaned.startsWith('+62')) {
    cleaned = '62' + cleaned;
  }
  
  // Ensure it starts with +
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
}

/**
 * Configure agent settings
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.configureAgent = async (req, res) => {
  try {
    const { configName, agentRole, greetingTemplate, aiModel, knowledgeBase } = req.body;
    
    // Validate required fields
    if (!configName || !agentRole || !greetingTemplate || !aiModel) {
      return res.status(400).json({
        success: false,
        message: 'Semua field wajib diisi'
      });
    }
    
    // Save configuration to database
    const config = await VoiceAgent.saveConfig({
      name: configName,
      role: agentRole,
      greetingTemplate: greetingTemplate, // This matches the property name in saveConfig method
      ai_model: aiModel,
      knowledge_base: knowledgeBase || null
    });
    
    res.json({
      success: true,
      message: 'Konfigurasi agent berhasil disimpan',
      config
    });
  } catch (error) {
    console.error('Configure agent error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Make a single call
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.makeCall = async (req, res) => {
  try {
    const { contactId, configId } = req.body;
    
    if (!contactId || !configId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID kontak dan ID konfigurasi diperlukan' 
      });
    }
    
    // Get contact information
    const contact = await VoiceAgent.findContactById(contactId);
    if (!contact) {
      return res.status(404).json({ 
        success: false, 
        message: 'Kontak tidak ditemukan' 
      });
    }
    
    // Get config information
    const config = await VoiceAgent.findConfigById(configId);
    if (!config) {
      return res.status(404).json({ 
        success: false, 
        message: 'Konfigurasi tidak ditemukan' 
      });
    }
    
    // Format phone number to E.164
    const phoneNumber = formatPhoneNumber(contact.phone);
    
    // Create VoiceAgent instance
    const voiceAgent = new VoiceAgent();
    
    // Make the call
    const callResult = await voiceAgent.makeCall(phoneNumber, {
      configId: configId,
      contactId: contactId
    });
    
    if (callResult.success) {
      // Save call record to database
      await VoiceAgent.saveCall({
        contact_id: contactId,
        config_id: configId,
        twilio_sid: callResult.callId,
        status: callResult.status,
        duration: 0 // Initial duration is 0
      });
      
      // If config has a greeting template, use it
      let greeting = 'Halo, kami dari Asosiasi AI Indonesia. Apa kabar Anda hari ini?';
      
      if (config && config.greeting_template) {
        greeting = config.greeting_template;
        
        // Replace placeholders with actual values
        if (contact && contact.name) {
          // Fix: Replace [nama] placeholder with contact name instead of {name}
          greeting = greeting.replace('[nama]', contact.name);
        }
      }
      
      return res.json({ 
        success: true, 
        message: 'Panggilan berhasil dimulai',
        call: {
          id: callResult.callId,
          status: callResult.status,
          contact: {
            id: contact.id,
            name: contact.name,
            phone: contact.phone
          },
          greeting: greeting
        }
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        message: `Gagal melakukan panggilan: ${callResult.error}` 
      });
    }
    
  } catch (error) {
    console.error('Error making call:', error);
    res.status(500).json({ 
      success: false, 
      message: `Terjadi kesalahan: ${error.message}`
    });
  }
};

/**
 * Make batch calls
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.makeBatchCall = async (req, res) => {
  try {
    const { contactIds, configId } = req.body;
    
    // Validate required fields
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0 || !configId) {
      return res.status(400).json({
        success: false,
        message: 'Contact IDs dan Config ID diperlukan'
      });
    }
    
    // Ensure database connection is established
    const { ensureConnection } = require('../config/database');
    const isConnected = await ensureConnection();
    
    if (!isConnected) {
      return res.status(500).json({
        success: false,
        message: 'Koneksi database tidak tersedia. Silakan coba lagi nanti.'
      });
    }
    
    // Check if config exists
    const config = await VoiceAgent.findConfigById(configId);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Konfigurasi agent tidak ditemukan'
      });
    }
    
    // Get all contacts
    const contactPromises = contactIds.map(id => VoiceAgent.findContactById(id));
    const contacts = await Promise.all(contactPromises);
    
    // Filter out any null contacts
    const validContacts = contacts.filter(contact => contact !== null);
    
    if (validContacts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tidak ada kontak valid yang ditemukan'
      });
    }
    
    // Inisialisasi VoiceAgent
    const voiceAgent = new VoiceAgent();
    
    // Buat panggilan untuk setiap kontak
    const callPromises = validContacts.map(async (contact) => {
      try {
        // Buat panggilan untuk setiap kontak
        const callResult = await voiceAgent.makeCall(contact.phone, {
          configId: configId,
          contactId: contact.id
        });
        
        // Process greeting template for this contact
        let greeting = 'Halo, kami dari Asosiasi AI Indonesia. Apa kabar Anda hari ini?';
        
        if (config && config.greeting_template) {
          greeting = config.greeting_template;
          
          // Replace [nama] with contact name
          if (contact && contact.name) {
            greeting = greeting.replace('[nama]', contact.name);
          }
        }
        
        // Simpan detail panggilan ke database
        if (callResult.success) {
          await VoiceAgent.saveCallRecord({
            call_sid: callResult.callId,
            contact_id: contact.id,
            config_id: configId,
            status: callResult.status
          });
        }
        
        return {
          id: callResult.callId,
          contact: contact,
          success: callResult.success,
          status: callResult.status,
          greeting: greeting
        };
      } catch (callError) {
        console.error(`Gagal membuat panggilan untuk kontak ${contact.id}:`, callError);
        return {
          id: null,
          contact: contact,
          success: false,
          status: 'failed',
          error: callError.message
        };
      }
    });
    
    // Tunggu semua panggilan selesai
    const calls = await Promise.all(callPromises);
    
    // Filter panggilan yang berhasil
    const successfulCalls = calls.filter(call => call.success);
    
    // Kirim respons
    if (successfulCalls.length > 0) {
      return res.status(200).json({
        success: true,
        message: `Berhasil membuat ${successfulCalls.length} dari ${calls.length} panggilan`,
        calls: successfulCalls
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Gagal membuat panggilan untuk semua kontak',
        calls: calls
      });
    }
  } catch (error) {
    console.error('Kesalahan saat membuat panggilan batch:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat membuat panggilan batch',
      error: error.message
    });
  }
};

/**
 * Get available AI models from OpenRouter API
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.getAvailableModels = async (req, res) => {
  try {
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1';
    
    try {
      const response = await axios.get(`${OPENROUTER_API_URL}/models`, {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && response.data.data) {
        const freeModels = response.data.data
          .filter(model => model.pricing.prompt === 0 && model.pricing.completion === 0)
          .map(model => ({
            id: model.id,
            name: model.name || model.id,
            type: 'free'
          }));
        
        res.json({
          success: true,
          models: freeModels
        });
      } else {
        throw new Error('Invalid response from OpenRouter API');
      }
    } catch (error) {
      console.error('Error fetching models from OpenRouter:', error.message);
      
      // Return default models in case of error
      const defaultModels = [
        { id: 'openai/gpt-3.5-turbo', name: 'OpenAI GPT-3.5 Turbo', type: 'free' },
        { id: 'anthropic/claude-instant-v1', name: 'Anthropic Claude Instant', type: 'free' },
        { id: 'google/palm-2-chat-bison', name: 'Google PaLM 2 Chat', type: 'free' },
        { id: 'meta-llama/llama-2-13b-chat', name: 'Meta Llama 2 13B Chat', type: 'free' },
        { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B Instruct', type: 'free' }
      ];
      
      res.json({
        success: true,
        models: defaultModels,
        error: 'Tidak dapat mengambil model dari OpenRouter API: ' + error.message
      });
    }
  } catch (error) {
    console.error('Get available models error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get call conversation
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.getCallConversation = async (req, res) => {
  try {
    const callId = req.params.callId;
    
    if (!callId) {
      return res.status(400).json({
        success: false,
        message: 'Call ID diperlukan'
      });
    }
    
    const conversation = await VoiceAgent.getConversationByCallId(callId);
    
    res.json({
      success: true,
      conversation
    });
  } catch (error) {
    console.error('Get call conversation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete agent configuration
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.deleteAgentConfig = async (req, res) => {
  try {
    const configId = req.params.configId;
    
    if (!configId) {
      return res.status(400).json({
        success: false,
        message: 'ID konfigurasi diperlukan'
      });
    }
    
    const result = await VoiceAgent.deleteConfig(configId);
    
    if (result) {
      res.json({
        success: true,
        message: 'Konfigurasi berhasil dihapus'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Konfigurasi tidak ditemukan'
      });
    }
  } catch (error) {
    console.error('Delete agent config error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get agent configuration by ID
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.getAgentConfig = async (req, res) => {
  try {
    const configId = req.params.configId;
    
    if (!configId) {
      return res.status(400).json({
        success: false,
        message: 'ID konfigurasi diperlukan'
      });
    }
    
    const config = await VoiceAgent.findConfigById(configId);
    
    if (config) {
      res.json({
        success: true,
        config
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Konfigurasi tidak ditemukan'
      });
    }
  } catch (error) {
    console.error('Get agent config error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

