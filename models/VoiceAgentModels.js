// filepath: models/VoiceAgent.js
const { getPool } = require('../config/database');
const twilio = require('twilio');
const config = require('../config/database');

class VoiceAgent {
  constructor() {
    // Initialize Twilio client with environment variables
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    
    // Initialize ElevenLabs configuration
    this.elevenLabsApiKey = process.env.API_KEY_ELEVENLABS;
    this.elevenLabsVoiceId = 'ErXwobaYiN019PkySvjV'; // Indonesian female voice
  }

  /**
   * Generate speech audio using ElevenLabs API
   * @param {string} text - Text to convert to speech
   * @returns {Promise<Buffer>} Audio buffer
   */
  async generateElevenLabsSpeech(text) {
    try {
      // Create TwiML response for TTS
      const VoiceResponse = require('twilio').twiml.VoiceResponse;
      const twiml = new VoiceResponse();
      
      // Use Twilio TTS with Indonesian voice
      twiml.say({
        voice: 'Polly.Siti',
        language: 'id-ID'
      }, text);
      
      return twiml.toString();
    } catch (error) {
      console.error('Error generating speech:', error);
      throw error;
    }
  }

  /**
   * Make a voice call using Twilio
   * @param {string} toNumber - Destination phone number
   * @param {object} options - Additional options for the call
   * @returns {Promise} Twilio call object
   */
  async makeCall(toNumber, options = {}) {
    try {
      // Validate phone number format
      if (!this.isValidPhoneNumber(toNumber)) {
        throw new Error('Invalid phone number format');
      }

      // Get the BASE_URL environment variable which is set by ngrokService
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const configId = options.configId || '';
      const contactId = options.contactId || '';
      
      // Baca konfigurasi panggilan dari environment variables
      const callTimeout = parseInt(process.env.CALL_TIMEOUT || '60');
      const machineDetection = process.env.CALL_MACHINE_DETECTION || 'DetectMessageEnd';
      const machineTimeout = parseInt(process.env.CALL_MACHINE_TIMEOUT || '15');
      
      const twimlUrl = `${baseUrl}/voice/call?configId=${encodeURIComponent(configId)}&contactId=${encodeURIComponent(contactId)}`;
      const statusCallbackUrl = `${baseUrl}/voice/status-callback`;
      const waitUrl = `${baseUrl}/voice/wait`;

      console.log(`Melakukan panggilan ke ${toNumber} dengan TwiML URL: ${twimlUrl}`);
      console.log(`Status callback URL: ${statusCallbackUrl}`);
      console.log(`Wait URL: ${waitUrl}`);

      // Create call using Twilio with improved parameters for stability
      const call = await this.client.calls.create({
        url: twimlUrl,
        to: toNumber,
        from: this.fromNumber,
        statusCallback: statusCallbackUrl,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'in-progress', 'completed'],
        statusCallbackMethod: 'POST',
        machineDetection: machineDetection,
        asyncAmd: 'true',
        amdStatusCallback: statusCallbackUrl,
        machineDetectionTimeout: machineTimeout,
        machineDetectionSilenceTimeout: 5000,
        timeout: callTimeout,
        record: true,
        trim: 'do-not-trim',
        waitUrl: waitUrl,
        waitMethod: 'GET',
        earlyMedia: true, // Penting: Memungkinkan media diputar sebelum panggilan dijawab
        fallbackUrl: `${baseUrl}/voice/fallback?configId=${encodeURIComponent(configId)}&contactId=${encodeURIComponent(contactId)}`,
        fallbackMethod: 'POST'
      });

      console.log(`Panggilan dimulai dengan SID: ${call.sid}, Status: ${call.status}`);
      
      // Segera simpan SID panggilan untuk digunakan nanti
      try {
        await this.saveCallSid(call.sid, configId, contactId, toNumber);
        console.log(`SID panggilan ${call.sid} disimpan dalam database`);
      } catch (dbError) {
        console.error('Gagal menyimpan SID panggilan:', dbError);
      }

      return {
        success: true,
        callId: call.sid,
        status: call.status
      };

    } catch (error) {
      console.error('Twilio call error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Menyimpan Twilio Call SID untuk digunakan nanti
   * @param {string} callSid - Twilio Call SID
   * @param {string} configId - ID konfigurasi
   * @param {string} contactId - ID kontak
   * @param {string} toNumber - Nomor tujuan
   * @returns {Promise} Hasil penyimpanan
   */
  async saveCallSid(callSid, configId, contactId, toNumber) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      // Periksa apakah catatan sudah ada
      const [existing] = await pool.query(
        'SELECT * FROM call_records WHERE twilio_sid = ?',
        [callSid]
      );
      
      if (existing.length > 0) {
        console.log(`Call record untuk SID ${callSid} sudah ada`);
        return existing[0];
      }
      
      // Simpan catatan baru
      const [result] = await pool.query(
        'INSERT INTO call_records (contact_id, config_id, twilio_sid, status, phone_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        [contactId, configId, callSid, 'initiated', toNumber]
      );
      
      console.log(`Catatan panggilan dibuat dengan ID: ${result.insertId}`);
      return { id: result.insertId, callSid };
    } catch (error) {
      console.error('Error menyimpan Call SID:', error);
      throw error;
    }
  }

  /**
   * Validate phone number format
   * @param {string} phoneNumber 
   * @returns {boolean}
   */
  isValidPhoneNumber(phoneNumber) {
    // Basic E.164 format validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Dapatkan status panggilan dengan pendekatan yang lebih komprehensif
   * @param {string} callSid - Twilio Call SID
   * @returns {Promise<string>} Status panggilan
   */
  async getCallStatus(callSid) {
    try {
      // Pertama, coba dapatkan status dari database
      const callRecord = await VoiceAgent.findCallBySid(callSid);
      if (callRecord && callRecord.status) {
        return callRecord.status;
      }

      // Jika tidak ada di database, gunakan Twilio untuk mendapatkan status
      const twilioCall = await this.client.calls(callSid).fetch();
      const twilioStatus = twilioCall.status.toLowerCase();

      // Mapping status Twilio ke status internal
      const statusMapping = {
        'queued': 'queued',
        'ringing': 'ringing',
        'in-progress': 'in-progress',
        'completed': 'completed',
        'busy': 'failed',
        'failed': 'failed',
        'no-answer': 'no-answer',
        'canceled': 'canceled'
      };

      return statusMapping[twilioStatus] || 'unknown';
    } catch (error) {
      console.error(`Kesalahan mendapatkan status panggilan ${callSid}:`, error);
      
      // Jika Twilio gagal, kembalikan status default
      return 'unknown';
    }
  }
  
  /**
   * Send TTS message to an active call
   * @param {string} callSid - Call SID
   * @param {string} message - Message to speak 
   * @returns {Promise<object>} Result object
   */
  async sendTtsToCall(callSid, message) {
    try {
      console.log(`[TTS] Attempting to send TTS to call ${callSid}: "${message}"`);

      if (!callSid || !message) {
        throw new Error('CallSid and message are required');
      }

      // First check if call is active
      const twilioCall = await this.client.calls(callSid).fetch();
      const callStatus = twilioCall.status.toLowerCase();
      
      console.log(`[TTS] Current call status: ${callStatus}`);

      if (callStatus !== 'in-progress') {
        return {
          success: false,
          error: 'Call is not in progress',
          status: callStatus,
          shouldRetry: true
        };
      }

      // Generate audio using ElevenLabs
      console.log('[TTS] Generating audio with ElevenLabs...');
      const audioBuffer = await this.generateElevenLabsSpeech(message);

      // Create a temporary public URL for the audio file
      const uniqueId = Date.now();
      const tempPath = `/tmp/tts-${uniqueId}.mp3`;
      require('fs').writeFileSync(tempPath, audioBuffer);

      // Create TwiML response
      const VoiceResponse = require('twilio').twiml.VoiceResponse;
      const twiml = new VoiceResponse();
      
      // Add a short pause before playing
      twiml.pause({ length: 1 });
      
      // Play the generated audio file
      twiml.play({
        loop: 1
      }, `file://${tempPath}`);
      
      // Add another pause after playing
      twiml.pause({ length: 1 });

      // Update the call with the new TwiML
      await this.client.calls(callSid).update({
        twiml: twiml.toString()
      });
      
      console.log(`[TTS] Successfully sent audio to call ${callSid}`);
      
      // Clean up temp file
      setTimeout(() => {
        try {
          require('fs').unlinkSync(tempPath);
        } catch (err) {
          console.error('[TTS] Error cleaning up temp file:', err);
        }
      }, 5000);

      // Save to conversation database
      try {
        const callRecord = await VoiceAgent.getCallBySid(callSid);
        if (callRecord && callRecord.id) {
          await VoiceAgent.saveConversation({
            call_id: callRecord.id,
            sender_type: 'agent',
            message_text: message,
            created_at: new Date()
          });
        }
      } catch (dbError) {
        console.error('[TTS] Error saving to database:', dbError);
      }
      
      return {
        success: true,
        message: 'TTS sent successfully',
        status: 'in-progress'
      };

    } catch (error) {
      console.error('[TTS] Error in sendTtsToCall:', error);
      return {
        success: false,
        error: error.message,
        status: 'error'
      };
    }
  }

  /**
   * Update call status in database
   * @param {string} callSid - Twilio Call SID
   * @param {string} status - New call status
   * @returns {Promise<boolean>} True if updated successfully
   */
  async updateCallStatus(callSid, status) {
    try {
      // First get the call record
      const callRecord = await VoiceAgent.getCallBySid(callSid);
      if (!callRecord) {
        console.log(`No call record found for SID: ${callSid} to update status`);
        return false;
      }
      
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      // Update the call record with the new status
      const [result] = await pool.query(
        'UPDATE call_records SET status = ?, updated_at = NOW() WHERE id = ?',
        [status, callRecord.id]
      );
      
      console.log(`Updated call ${callSid} status to ${status} in database`);
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating call status:', error);
      return false;
    }
  }

  /**
   * Get all agent configurations
   * @returns {Promise<Array>} List of configurations
   */
  static async getAllConfigs() {
    try {
      const pool = getPool();
      const [rows] = await pool.query(`
        SELECT ac.*, am.name as model_name, vto.name as voice_name 
        FROM agent_configs ac
        LEFT JOIN ai_models am ON ac.ai_model = am.id
        LEFT JOIN voice_tts_options vto ON ac.tts_voice_id = vto.id
        ORDER BY ac.created_at DESC
      `);
      return rows;
    } catch (error) {
      console.error('Error getting configs:', error);
      throw error;
    }
  }

  /**
   * Save agent configuration
   * @param {object} config - Configuration object
   * @returns {Promise<object>} Saved configuration
   */
  static async saveConfig(config) {
    try {
      const pool = getPool();
      const now = new Date();
      
      // Periksa apakah tabel ai_models ada
      try {
        // Coba validasi AI model jika tabel ada
        const [tableExists] = await pool.query(`SHOW TABLES LIKE 'ai_models'`);
        
        if (tableExists.length > 0) {
          // Tabel ai_models ada, lakukan validasi seperti biasa
          const [modelExists] = await pool.query('SELECT id FROM ai_models WHERE id = ?', [config.aiModel]);
          if (!modelExists.length) {
            console.warn(`Warning: Model AI dengan ID ${config.aiModel} tidak ditemukan di database`);
            // Tetap lanjutkan walaupun model tidak ditemukan
          }
        } else {
          console.warn('Warning: Tabel ai_models tidak ada, melewati validasi model AI');
          // Tidak ada tabel ai_models, lewati validasi
        }
      } catch (validationError) {
        console.warn('Warning: Gagal memvalidasi model AI:', validationError.message);
        // Lanjutkan meskipun validasi gagal
      }
      
      // Validasi TTS voice jika disediakan, dengan penanganan error yang lebih baik
      if (config.ttsVoiceId) {
        try {
          const [tableExists] = await pool.query(`SHOW TABLES LIKE 'voice_tts_options'`);
          
          if (tableExists.length > 0) {
            const [voiceExists] = await pool.query('SELECT id FROM voice_tts_options WHERE id = ?', [config.ttsVoiceId]);
            if (!voiceExists.length) {
              console.warn(`Warning: Suara TTS dengan ID ${config.ttsVoiceId} tidak ditemukan di database`);
              // Tetap lanjutkan meskipun suara tidak ditemukan
            }
          } else {
            console.warn('Warning: Tabel voice_tts_options tidak ada, melewati validasi suara TTS');
          }
        } catch (voiceError) {
          console.warn('Warning: Gagal memvalidasi suara TTS:', voiceError.message);
          // Lanjutkan meskipun validasi gagal
        }
      }
      
      // Cek apakah tabel agent_configs memiliki kolom tts_voice_id
      let hasVoiceColumn = true;
      try {
        const [columns] = await pool.query(`SHOW COLUMNS FROM agent_configs LIKE 'tts_voice_id'`);
        hasVoiceColumn = columns.length > 0;
      } catch (columnError) {
        console.warn('Warning: Gagal memeriksa kolom tts_voice_id:', columnError.message);
        hasVoiceColumn = false;
      }
      
      let query;
      let params;
      
      if (hasVoiceColumn) {
        // Tabel memiliki kolom tts_voice_id
        query = `
          INSERT INTO agent_configs 
          (name, role, greeting_template, ai_model, knowledge_base, tts_voice_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        params = [
          config.name,
          config.role,
          config.greetingTemplate, // Using the correct property name to match with the controller
          config.ai_model,
          config.knowledge_base || null,
          config.ttsVoiceId || null,
          now,
          now
        ];
      } else {
        // Tabel tidak memiliki kolom tts_voice_id
        query = `
          INSERT INTO agent_configs 
          (name, role, greeting_template, ai_model, knowledge_base, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        params = [
          config.name,
          config.role,
          config.greetingTemplate, // Using the correct property name to match with the controller
          config.ai_model,
          config.knowledge_base || null,
          now,
          now
        ];
      }
      
      const [result] = await pool.query(query, params);
      
      return {
        id: result.insertId,
        ...config,
        created_at: now,
        updated_at: now
      };
    } catch (error) {
      console.error('Error saving config:', error);
      throw error;
    }
  }

  /**
   * Get configuration by ID
   * @param {number} id - Configuration ID
   * @returns {Promise<object>} Configuration object
   */
  static async findConfigById(id) {
    try {
      const pool = getPool();
      const [rows] = await pool.query(`
        SELECT ac.*, am.name as model_name, vto.name as voice_name 
        FROM agent_configs ac
        LEFT JOIN ai_models am ON ac.ai_model = am.id
        LEFT JOIN voice_tts_options vto ON ac.tts_voice_id = vto.id
        WHERE ac.id = ?
      `, [id]);
      
      return rows[0];
    } catch (error) {
      console.error('Error finding config:', error);
      throw error;
    }
  }

  /**
   * Delete agent configuration by ID
   * @param {number} id - Configuration ID
   * @returns {Promise<boolean>} True if deleted successfully, false if not found
   */
  static async deleteConfig(id) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      const [result] = await pool.query('DELETE FROM agent_configs WHERE id = ?', [id]);
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting agent config:', error);
      throw error;
    }
  }
  
  /**
   * Find contact by ID
   * @param {number} id - Contact ID
   * @returns {Promise<object|null>} Contact or null if not found
   */
  static async findContactById(id) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      const [rows] = await pool.query('SELECT * FROM contacts WHERE id = ?', [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error finding contact:', error);
      throw error;
    }
  }
  
  /**
   * Get all contacts with optional filters
   * @param {object} filters - Filters (status, etc.)
   * @returns {Promise<Array>} List of contacts
   */
  static async getAllContacts(filters = {}) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      let query = 'SELECT * FROM contacts';
      const params = [];
      
      // Apply filters if provided
      if (filters.status) {
        query += ' WHERE status = ?';
        params.push(filters.status);
      }
      
      query += ' ORDER BY id DESC';
      
      const [rows] = await pool.query(query, params);
      return rows;
    } catch (error) {
      console.error('Error getting contacts:', error);
      throw error;
    }
  }
  
  /**
   * Save contact
   * @param {object} contact - Contact information
   * @returns {Promise<object>} Saved contact
   */
  static async saveContact(contact) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      const { name, phone } = contact;
      
      const [result] = await pool.query(
        'INSERT INTO contacts (name, phone, created_at) VALUES (?, ?, NOW())',
        [name, phone]
      );
      
      return { id: result.insertId, ...contact };
    } catch (error) {
      console.error('Error saving contact:', error);
      throw error;
    }
  }
  
  /**
   * Save multiple contacts
   * @param {Array} contacts - List of contacts
   * @returns {Promise<Array>} Saved contacts
   */
  static async saveContacts(contacts) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      const values = contacts.map(contact => [contact.name, contact.phone, new Date()]);
      
      const [result] = await pool.query(
        'INSERT INTO contacts (name, phone, created_at) VALUES ?',
        [values]
      );
      
      return contacts.map((contact, index) => ({
        id: result.insertId + index,
        ...contact
      }));
    } catch (error) {
      console.error('Error saving contacts:', error);
      throw error;
    }
  }
  
  /**
   * Save call record
   * @param {object} call - Call information
   * @returns {Promise<object>} Saved call record
   */
  static async saveCall(call) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      const { contact_id, config_id, twilio_sid, status, duration } = call;
      
      console.log('Menyimpan call record dengan data:', { contact_id, config_id, twilio_sid, status, duration });
      
      const [result] = await pool.query(
        'INSERT INTO call_records (contact_id, config_id, twilio_sid, status, duration, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [contact_id, config_id, twilio_sid, status, duration]
      );
      
      // Update contact status based on call status
      try {
        let contactStatus = 'uncalled';
        if (status === 'initiated' || status === 'queued' || status === 'completed') {
          contactStatus = 'called';
        } else if (status === 'failed') {
          contactStatus = 'failed';
        } else if (status === 'no-answer') {
          contactStatus = 'unreachable';
        }
        
        console.log(`Mencoba update status kontak (ID: ${contact_id}) menjadi ${contactStatus}`);
        
        // Check if status column exists before updating
        try {
          await pool.query(
            'UPDATE contacts SET status = ?, last_call_date = NOW(), updated_at = NOW() WHERE id = ?',
            [contactStatus, contact_id]
          );
          console.log('Berhasil update status kontak');
        } catch (statusUpdateErr) {
          // If the error is about column not existing, just update the timestamp
          if (statusUpdateErr.message.includes("Unknown column 'status'")) {
            console.log('Kolom status tidak ditemukan, hanya mengupdate last_call_date');
            await pool.query(
              'UPDATE contacts SET updated_at = NOW() WHERE id = ?',
              [contact_id]
            );
          } else {
            // Re-throw error if it's not related to missing column
            throw statusUpdateErr;
          }
        }
      } catch (updateErr) {
        // Log error but don't fail the whole operation
        console.error('Error updating contact status:', updateErr);
        console.log('Melanjutkan meskipun gagal update status kontak');
      }
      
      return { id: result.insertId, ...call };
    } catch (error) {
      console.error('Error saving call record:', error);
      throw error;
    }
  }
  
  /**
   * Save conversation message
   * @param {object} message - Message information
   * @returns {Promise<object>} Saved message
   */
  static async saveConversation(message) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      const { call_id, sender_type, message_text, created_at } = message;
      
      const [result] = await pool.query(
        'INSERT INTO call_conversations (call_id, sender_type, message_text, created_at) VALUES (?, ?, ?, ?)',
        [call_id, sender_type, message_text, created_at || new Date()]
      );
      
      return { id: result.insertId, ...message };
    } catch (error) {
      console.error('Error saving conversation:', error);
      throw error;
    }
  }
  
  /**
   * Get call history
   * @returns {Promise<Array>} List of call records
   */
  static async getCallHistory() {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      const [rows] = await pool.query(`
        SELECT cr.*, c.name, c.phone
        FROM call_records cr
        JOIN contacts c ON cr.contact_id = c.id
        ORDER BY cr.created_at DESC
      `);
      
      return rows;
    } catch (error) {
      console.error('Error getting call history:', error);
      throw error;
    }
  }
  
  /**
   * Get conversation by call ID
   * @param {number} callId - Call ID
   * @returns {Promise<Array>} List of conversation messages
   */
  static async getConversationByCallId(callId) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      const [rows] = await pool.query(
        'SELECT * FROM call_conversations WHERE call_id = ? ORDER BY created_at ASC',
        [callId]
      );
      
      return rows;
    } catch (error) {
      console.error('Error getting conversation:', error);
      throw error;
    }
  }

  /**
   * Update contact status
   * @param {number} id - Contact ID
   * @param {string} status - New status
   * @returns {Promise<boolean>} True if updated successfully
   */
  static async updateContactStatus(id, status) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      const [result] = await pool.query(
        'UPDATE contacts SET status = ?, updated_at = NOW() WHERE id = ?',
        [status, id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating contact status:', error);
      throw error;
    }
  }

  /**
   * Get call by Twilio SID
   * @param {string} twilioSid - Twilio Call SID
   * @returns {Promise<object|null>} Call record or null if not found
   */
  static async getCallBySid(twilioSid) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      // First search in the call_records table
      const [rows] = await pool.query('SELECT * FROM call_records WHERE twilio_sid = ?', [twilioSid]);
      
      if (rows.length > 0) {
        return rows[0];
      }
      
      // If not found, it might be a direct ID (for testing or debugging)
      if (!isNaN(twilioSid)) {
        const [idRows] = await pool.query('SELECT * FROM call_records WHERE id = ?', [twilioSid]);
        if (idRows.length > 0) {
          return idRows[0];
        }
      }
      
      console.log(`No call record found for SID: ${twilioSid}`);
      return null;
    } catch (error) {
      console.error('Error finding call by SID:', error);
      throw error;
    }
  }

  /**
   * Temukan panggilan berdasarkan Twilio SID
   * @param {string} callSid - Twilio Call SID
   * @returns {Promise<object|null>} Informasi panggilan
   */
  static async findCallBySid(callSid) {
    const pool = await getPool();
    
    try {
      // Cari di tabel call_records
      const [callRecordRows] = await pool.query(
        `SELECT * FROM call_records 
         WHERE twilio_sid = ? 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [callSid]
      );
      
      if (callRecordRows.length > 0) {
        return {
          id: callRecordRows[0].id,
          status: callRecordRows[0].status || 'unknown',
          twilio_sid: callRecordRows[0].twilio_sid,
          contact_id: callRecordRows[0].contact_id,
          created_at: callRecordRows[0].created_at
        };
      }
      
      // Jika tidak ditemukan, kembalikan null
      console.log(`Tidak ada catatan panggilan ditemukan untuk SID: ${callSid} di tabel call_records`);
      return null;
    } catch (error) {
      console.error('Kesalahan mencari panggilan berdasarkan SID di call_records:', error);
      
      // Kembalikan objek dengan status unknown untuk menghindari kesalahan fatal
      return {
        id: null,
        status: 'unknown',
        twilio_sid: callSid,
        contact_id: null,
        created_at: new Date()
      };
    }
  }
}

module.exports = VoiceAgent;