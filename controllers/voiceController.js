const VoiceResponse = require('twilio').twiml.VoiceResponse;
const OpenAI = require('openai');
const VoiceAgent = require('../models/VoiceAgentModels');
const path = require('path');
const fs = require('fs');
const NgrokService = require('../services/ngrokService');
const twilio = require('twilio');

// Store active calls for TTS injection
const activeCallsMap = new Map();

class VoiceController {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENROUTER_API_KEY,
            baseURL: process.env.OPENROUTER_API_URL
        });
        
        // Context storage for AI conversations
        this.conversationContext = new Map();
    }

    /**
     * Handle initial voice call with personalized greeting
     */
    async handleVoiceCall(req, res) {
        const twiml = new VoiceResponse();
        
        try {
            // Get call data from URL parameters
            const callSid = req.body.CallSid;
            const configId = req.query.configId;
            const contactId = req.query.contactId;
            
            console.log(`[Call] Handling new call ${callSid} with configId=${configId}, contactId=${contactId}`);

            // Generate greeting
            let greeting = 'Halo, saya adalah agent AI dari Asosiasi Artificial Intelligence Indonesia. Apa yang bisa saya bantu?';
            
            // Load config dan contact jika tersedia
            try {
                if (configId) {
                    const config = await VoiceAgent.findConfigById(configId);
                    if (config?.greeting_template) {
                        greeting = config.greeting_template;
                    }
                }
                
                if (contactId) {
                    const contact = await VoiceAgent.findContactById(contactId);
                    if (contact?.name) {
                        greeting = greeting.replace('[nama]', contact.name);
                    }
                }
            } catch (error) {
                console.error('[Call] Error loading config/contact:', error);
            }

            // Simpan greeting ke context untuk digunakan nanti
            const context = this.conversationContext.get(callSid) || {};
            context.greeting = greeting;
            this.conversationContext.set(callSid, context);

            // Simpan ke database
            try {
                const callRecord = await VoiceAgent.getCallBySid(callSid);
                if (callRecord?.id) {
                    await VoiceAgent.saveConversation({
                        call_id: callRecord.id,
                        sender_type: 'agent',
                        message_text: greeting,
                        created_at: new Date()
                    });
                }
            } catch (error) {
                console.error('[Call] Error saving conversation:', error);
            }

            // Play greeting using Twilio TTS
            twiml.say({
                voice: 'Polly.Siti',
                language: 'id-ID'
            }, greeting);

            // Setup gather untuk respons pengguna
            const gather = twiml.gather({
                input: 'speech',
                language: 'id-ID',
                speechTimeout: 'auto',
                timeout: 5,
                action: `/voice/respond?callSid=${encodeURIComponent(callSid)}`,
                method: 'POST'
            });

            // Update call status to in-progress
            try {
                await VoiceAgent.updateCallStatus(callSid, 'in-progress');
            } catch (error) {
                console.error('[Call] Error updating call status:', error);
            }

        } catch (error) {
            console.error('[Call] Error in handleVoiceCall:', error);
            twiml.pause({ length: 2 });
            
            // Use Twilio TTS for error message
            twiml.say({
                language: 'id-ID',
                voice: 'Polly.Siti'
            }, 'Mohon maaf, terjadi kesalahan teknis. Silakan coba beberapa saat lagi.');
        }
        
        res.type('text/xml');
        res.send(twiml.toString());
    }

    /**
     * Handle voice response with conversation context - Improved for better interaction
     */
    async handleVoiceResponse(req, res) {
        const twiml = new VoiceResponse();
        const userInput = req.body.SpeechResult;
        const callSid = req.query.callSid || req.body.CallSid;
        
        console.log(`[Response] Received speech from call ${callSid}: "${userInput}"`);
        
        try {
            // Get the internal call record to use the proper ID
            const callRecord = await VoiceAgent.getCallBySid(callSid);
            if (!callRecord || !callRecord.id) {
                console.error(`[Response] No call record found for SID ${callSid}`);
                throw new Error(`Call record not found for ${callSid}`);
            }
            const internalCallId = callRecord.id;
            
            // Save user input to database with proper internal call ID
            await VoiceAgent.saveConversation({
                call_id: internalCallId,
                sender_type: 'user',
                message_text: userInput,
                created_at: new Date()
            });
            console.log(`[Response] Saved user input to database for call ${callSid} with internal ID ${internalCallId}`);
            
            // Get context for this call
            const context = this.conversationContext.get(callSid) || {
                messages: [{
                    role: "system",
                    content: "Anda adalah agent AI dari Asosiasi Artificial Intelligence Indonesia. Berikan jawaban yang sopan, membantu, dan ringkas dalam Bahasa Indonesia. Jangan terlalu panjang, maksimal 2-3 kalimat saja."
                }]
            };
            
            // Add user message to context
            context.messages.push({
                role: "user",
                content: userInput
            });
            
            console.log(`[Response] Getting AI response for call ${callSid}`);
            // Get AI response with context
            const aiResponse = await this.getAIResponse(context.messages);
            console.log(`[Response] Got AI response for call ${callSid}: "${aiResponse}"`);
            
            // Add AI response to context
            context.messages.push({
                role: "assistant",
                content: aiResponse
            });
            
            // Update context in map
            this.conversationContext.set(callSid, context);
            
            // Save AI response to database with proper internal ID
            await VoiceAgent.saveConversation({
                call_id: internalCallId,
                sender_type: 'agent',
                message_text: aiResponse,
                created_at: new Date()
            });

            // Initialize VoiceAgent
            const voiceAgent = new VoiceAgent();
            
            // Generate response audio with ElevenLabs
            console.log('[Response] Generating response audio with ElevenLabs...');
            const audioBuffer = await voiceAgent.generateElevenLabsSpeech(aiResponse);

            // Create a temporary public URL for the audio file
            const uniqueId = Date.now();
            const tempPath = `/tmp/response-${uniqueId}.mp3`;
            require('fs').writeFileSync(tempPath, audioBuffer);
            
            // First pause for natural conversation flow
            twiml.pause({ length: 1 });
            
            // Play the generated audio file
            twiml.play({
                loop: 1
            }, `file://${tempPath}`);
            
            // Add another pause after playing
            twiml.pause({ length: 1 });
            
            // Set up gather for next user input with proper parameters
            const gather = twiml.gather({
                input: 'speech',
                language: 'id-ID',
                speechTimeout: 'auto',
                timeout: 8,
                action: `/voice/respond?callSid=${encodeURIComponent(callSid)}`,
                method: 'POST'
            });
            
            // If no response after gather timeout, check if call should continue
            twiml.redirect(`/voice/check-continue?callSid=${encodeURIComponent(callSid)}`);
            
            console.log(`[Response] Sending TwiML response for call ${callSid}`);

            // Clean up temporary audio file after sending response
            setTimeout(() => {
                try {
                    require('fs').unlinkSync(tempPath);
                } catch (cleanupError) {
                    console.error('[Response] Error cleaning up temp file:', cleanupError);
                }
            }, 5000);

        } catch (error) {
            console.error(`[Response] Error in handleVoiceResponse for call ${callSid}:`, error);
            
            // Add a pause for better timing
            twiml.pause({ length: 1 });
            
            // Give user feedback on error using basic TTS as fallback
            twiml.say({
                language: 'id-ID',
                voice: 'Polly.Siti'
            }, 'Maaf, terjadi kesalahan. Mohon tunggu sebentar dan coba bicara lagi.');
            
            // Try to continue conversation despite error
            const gather = twiml.gather({
                input: 'speech',
                language: 'id-ID',
                speechTimeout: 'auto',
                timeout: 5,
                action: `/voice/respond?callSid=${encodeURIComponent(callSid)}`,
                method: 'POST'
            });
        }
        
        res.type('text/xml');
        res.send(twiml.toString());
    }
    
    /**
     * Check if call should continue or end
     */
    async handleCheckContinue(req, res) {
        const twiml = new VoiceResponse();
        const callSid = req.query.callSid;
        
        // Add a question to see if the user wants to continue
        const gather = twiml.gather({
            input: 'speech',
            language: 'id-ID',
            speechTimeout: 'auto',
            action: `/voice/respond?callSid=${encodeURIComponent(callSid)}`,
            method: 'POST'
        });
        
        gather.say({
            language: 'id-ID',
            voice: 'Polly.Siti'
        }, 'Apakah ada hal lain yang bisa saya bantu?');
        
        // If no response, end the call
        twiml.say({
            language: 'id-ID',
            voice: 'Polly.Siti'
        }, 'Terima kasih telah menghubungi kami. Selamat tinggal!');
        
        twiml.hangup();
        
        res.type('text/xml');
        res.send(twiml.toString());
    }
    
    /**
     * Handle call status callback with improved TTS delivery
     */
    async handleStatusCallback(req, res) {
        try {
            const { CallSid, CallStatus } = req.body;
            console.log(`[Status] Panggilan ${CallSid} status: ${CallStatus}`);

            // Update status panggilan di database
            const callRecord = await VoiceAgent.getCallBySid(CallSid);
            if (callRecord?.id) {
                await VoiceAgent.updateCallStatus(callRecord.id, CallStatus);
                console.log(`[Status] Status panggilan ${CallSid} diperbarui ke ${CallStatus}`);
            }

            // Jika panggilan dijawab, pastikan status diupdate ke in-progress
            if (CallStatus === 'in-progress') {
                const client = twilio(
                    process.env.TWILIO_ACCOUNT_SID,
                    process.env.TWILIO_AUTH_TOKEN
                );
                
                // Update status di Twilio
                await client.calls(CallSid).update({
                    status: 'in-progress'
                });
                
                console.log(`[Status] Panggilan ${CallSid} siap untuk TTS`);
            }

            return res.sendStatus(200);
        } catch (error) {
            console.error('[Status] Error:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Terjadi kesalahan saat memproses status callback'
            });
        }
    }
    
    /**
     * Handle TTS dengan pendekatan Twilio TwiML yang fleksibel
     */
    async handleTts(req, res) {
        try {
            const { callSid, message } = req.body;
            
            if (!callSid || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'CallSid dan message diperlukan'
                });
            }

            console.log(`[TTS] Menerima permintaan TTS untuk panggilan ${callSid}: "${message}"`);

            // Periksa status panggilan
            const callStatus = await this.getCallStatus(callSid);
            console.log(`[TTS] Status panggilan ${callSid}: ${callStatus}`);

            if (callStatus !== 'in-progress') {
                console.log(`[TTS] Panggilan ${callSid} belum siap (${callStatus}), akan dicoba lagi nanti`);
                return res.status(202).json({
                    success: false,
                    status: callStatus,
                    message: 'Panggilan belum siap',
                    retryAfter: 2000 // Coba lagi setelah 2 detik
                });
            }

            // Buat TwiML untuk TTS
            const twiml = new VoiceResponse();
            twiml.say({
                voice: 'Polly.Siti',
                language: 'id-ID'
            }, message);

            // Update panggilan dengan TwiML baru
            const client = twilio(
                process.env.TWILIO_ACCOUNT_SID,
                process.env.TWILIO_AUTH_TOKEN
            );

            await client.calls(callSid).update({
                twiml: twiml.toString()
            });

            console.log(`[TTS] Berhasil mengirim TTS ke panggilan ${callSid}`);

            // Simpan ke database
            try {
                const callRecord = await VoiceAgent.getCallBySid(callSid);
                if (callRecord?.id) {
                    await VoiceAgent.saveConversation({
                        call_id: callRecord.id,
                        sender_type: 'agent',
                        message_text: message,
                        created_at: new Date()
                    });
                }
            } catch (error) {
                console.error('[TTS] Error saving conversation:', error);
            }

            return res.json({
                success: true,
                message: 'TTS berhasil dikirim'
            });

        } catch (error) {
            console.error('[TTS] Error:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Terjadi kesalahan saat mengirim TTS'
            });
        }
    }

    /**
     * Get AI response using OpenAI
     */
    async getAIResponse(messages) {
        try {
            const completion = await this.openai.chat.completions.create({
                model: "openai/gpt-3.5-turbo",
                messages: messages,
                max_tokens: 150,
                temperature: 0.7
            });
            
            return completion.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI error:', error);
            throw error;
        }
    }

    /**
     * Periksa status panggilan
     */
    async handleCallStatus(req, res) {
        const callSid = req.query.callSid;
        
        if (!callSid) {
            return res.status(400).json({ 
                success: false, 
                message: 'Call SID diperlukan' 
            });
        }
        
        try {
            // Cek status panggilan dari database atau Twilio
            const callStatus = await this.getCallStatus(callSid);
            
            res.json({
                success: true,
                status: callStatus
            });
        } catch (error) {
            console.error('Kesalahan memeriksa status panggilan:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal memeriksa status panggilan',
                error: error.message
            });
        }
    }

    /**
     * Dapatkan status panggilan dari database atau Twilio
     * @param {string} callSid - ID panggilan
     * @returns {Promise<string>} Status panggilan
     */
    async getCallStatus(callSid) {
        try {
            // Pertama, periksa di database
            const callRecord = await VoiceAgent.findCallBySid(callSid);
            if (callRecord && callRecord.status) {
                return callRecord.status;
            }
            
            // Jika tidak ada di database, kembalikan status default
            return 'in-progress';
        } catch (error) {
            console.error('Kesalahan mendapatkan status panggilan:', error);
            return 'unknown';
        }
    }

    // Metode baru untuk greeting sederhana
    handleSimpleGreeting(req, res) {
        const twiml = new VoiceResponse();

        twiml.say({
            language: 'id-ID',
            voice: 'Polly.Rizwan'
        }, 'Selamat datang! Terima kasih telah menghubungi kami.');

        res.writeHead(200, { 'Content-Type': 'text/xml' });
        res.end(twiml.toString());
    }

    // Metode untuk mendapatkan daftar suara TTS
    async getTTSVoices(req, res) {
        try {
            console.log('Request getTTSVoices diterima');
            console.log('Headers:', req.headers);
            console.log('Query:', req.query);
            console.log('Body:', req.body);

            // Daftar suara default
            const defaultVoices = [
                { id: 'Polly.Rizwan', name: 'Rizwan (Indonesia)', language: 'id-ID' },
                { id: 'Polly.Aditi', name: 'Aditi (India)', language: 'hi-IN' },
                { id: 'Polly.Raveena', name: 'Raveena (India)', language: 'hi-IN' },
                { id: 'Polly.Amy', name: 'Amy (Inggris)', language: 'en-GB' },
                { id: 'Polly.Emma', name: 'Emma (Inggris)', language: 'en-GB' },
                { id: 'Polly.Brian', name: 'Brian (Inggris)', language: 'en-GB' },
                { id: 'Polly.Joanna', name: 'Joanna (Amerika)', language: 'en-US' },
                { id: 'Polly.Matthew', name: 'Matthew (Amerika)', language: 'en-US' }
            ];

            // Coba ambil suara dari database jika ada tabel khusus
            try {
                const pool = require('../config/database').getPool();
                if (pool) {
                    const [rows] = await pool.query('SHOW TABLES LIKE "voice_tts_options"');
                    
                    if (rows.length > 0) {
                        const [voiceRows] = await pool.query('SELECT * FROM voice_tts_options');
                        
                        if (voiceRows.length > 0) {
                            console.log('Menggunakan suara dari database');
                            return res.json({
                                success: true,
                                voices: voiceRows
                            });
                        }
                    }
                }
            } catch (dbError) {
                console.warn('Gagal mengambil suara dari database:', dbError);
            }

            // Filter voice Indonesia
            const indonesianVoices = defaultVoices.filter(
                voice => voice.language === 'id-ID'
            );

            console.log('Indonesian Voices:', indonesianVoices);

            // Pastikan selalu mengembalikan JSON
            res.set('Content-Type', 'application/json');
            const responseData = {
                success: true,
                voices: indonesianVoices.length > 0 ? indonesianVoices : defaultVoices
            };

            console.log('Response Data:', responseData);
            res.json(responseData);
        } catch (error) {
            console.error('Kesalahan mengambil daftar voice:', error);
            
            // Pastikan mengembalikan JSON error
            res.status(500).set('Content-Type', 'application/json').json({ 
                success: false, 
                message: 'Gagal mengambil daftar voice',
                error: error.message 
            });
        }
    }

    /**
     * Menyajikan musik tunggu untuk panggilan
     */
    handleWaitMusic(req, res) {
        console.log('[Wait] Serving wait music');
        
        const twiml = new VoiceResponse();
        
        // Tambahkan musik tunggu
        twiml.play({
            loop: 10 // Putar hingga 10 kali untuk memastikan cukup waktu
        }, 'https://demo.twilio.com/docs/classic.mp3'); // Gunakan file musik dari Twilio
        
        // Jika musik selesai, atur tindakan default untuk menghindari panggilan terputus
        twiml.redirect({
            method: 'GET'
        }, '/voice/check-continue');
        
        res.type('text/xml');
        res.send(twiml.toString());
    }

    /**
     * Handler untuk fallback jika terjadi masalah pada panggilan
     */
    async handleFallback(req, res) {
        console.log('[Fallback] Handling fallback for call:', req.body.CallSid);
        
        const twiml = new VoiceResponse();
        const callSid = req.body.CallSid;
        const configId = req.query.configId;
        const contactId = req.query.contactId;
        
        try {
            // Get contact name if available
            let contactName = '';
            if (contactId) {
                try {
                    const contact = await VoiceAgent.findContactById(contactId);
                    if (contact && contact.name) {
                        contactName = contact.name;
                    }
                } catch (error) {
                    console.error('[Fallback] Error loading contact:', error);
                }
            }
            
            // Add significant pause to ensure connection is stable
            twiml.pause({ length: 4 });
            
            // Provide a greeting that works even under challenging conditions
            const greeting = contactName ? 
                `Halo ${contactName}, ini adalah panggilan dari Asosiasi Artificial Intelligence Indonesia. Mohon maaf jika ada gangguan. Kami akan menghubungi Anda kembali dalam waktu dekat.` : 
                `Halo, ini adalah panggilan dari Asosiasi Artificial Intelligence Indonesia. Mohon maaf jika ada gangguan. Kami akan menghubungi Anda kembali dalam waktu dekat.`;
            
            // Speak greeting with longer duration
            twiml.say({
                language: 'id-ID',
                voice: 'Polly.Siti'
            }, greeting);
            
            // Additional pause to ensure message fully delivered
            twiml.pause({ length: 3 });
            
            // End call gracefully after message delivered
            twiml.hangup();
            
            console.log('[Fallback] Generated fallback TwiML response');
        } catch (error) {
            console.error('[Fallback] Error generating fallback response:', error);
            
            // Simple response in case of error
            twiml.say({
                language: 'id-ID',
                voice: 'Polly.Siti'
            }, 'Mohon maaf, terjadi kesalahan teknis. Kami akan menghubungi Anda kembali.');
            
            twiml.hangup();
        }
        
        res.type('text/xml');
        res.send(twiml.toString());
    }
}

// Ekspor instance dari kelas
module.exports = new VoiceController();