const HeyGenAvatarManager = require('../services/HeyGenAvatarManager');
const { Room, RoomEvent } = require('livekit-client');

const VideoStreamingController = {
    // Render video streaming page
    getVideoStreaming: async (req, res) => {
        try {
            if (!process.env.API_HEYGEN_PRO) {
                req.flash('error', 'HeyGen API key not configured. Please set API_HEYGEN_PRO in environment variables.');
                return res.redirect('/dashboard');
            }

            res.render('dashboard/video-streaming', {
                layout: 'layouts/main-layout',
                title: 'Agent Video Streaming',
                path: '/dashboard/video-streaming',
                user: req.user,
                API_HEYGEN_PRO: process.env.API_HEYGEN_PRO
            });
        } catch (error) {
            console.error('Error rendering video streaming page:', error);
            req.flash('error', 'Failed to load video streaming page');
            res.redirect('/dashboard');
        }
    },

    // Get session token for HeyGen API
    getSessionToken: async (req, res) => {
        try {
            if (!process.env.API_HEYGEN_PRO) {
                console.error('HeyGen API key not configured in environment variables');
                return res.status(500).json({
                    success: false,
                    message: 'HeyGen API key not configured. Please set API_HEYGEN_PRO in environment variables.'
                });
            }

            console.log('Getting HeyGen session token...');
            console.log('API key available:', process.env.API_HEYGEN_PRO ? 'Yes' : 'No');
            console.log('API key format:', process.env.API_HEYGEN_PRO.startsWith('YmI0O') ? 'Valid' : 'Invalid');
            
            const avatarManager = new HeyGenAvatarManager(process.env.API_HEYGEN_PRO);
            
            try {
                const token = await avatarManager.authenticate();
                console.log('Successfully obtained HeyGen token');
                
                // Store token in session for future use
                if (req.session) {
                    req.session.heygenToken = token;
                    req.session.heygenTokenCreated = Date.now();
                }
                
                res.json({
                    success: true,
                    data: { token }
                });
            } catch (authError) {
                console.error('HeyGen token creation error:', {
                    message: authError.message,
                    stack: authError.stack,
                    apiKey: process.env.API_HEYGEN_PRO ? 'Present' : 'Missing'
                });
                return res.status(401).json({
                    success: false,
                    message: authError.message || 'Failed to create HeyGen session token'
                });
            }
        } catch (error) {
            console.error('Error getting session token:', {
                message: error.message,
                stack: error.stack
            });
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    },

    // Create new streaming session
    createSession: async (req, res) => {
        try {
            const { 
                avatarId, 
                voiceId,
                quality, 
                voiceRate, 
                videoEncoding, 
                disableIdleTimeout, 
                version, 
                sttProvider, 
                sttConfidence
            } = req.body;

            console.log('Creating session with params:', req.body);
            
            if (!avatarId) {
                return res.status(400).json({
                    success: false,
                    message: 'Avatar ID is required'
                });
            }

            if (!voiceId) {
                return res.status(400).json({
                    success: false,
                    message: 'Voice ID is required'
                });
            }
            
            const avatarManager = new HeyGenAvatarManager(process.env.API_HEYGEN_PRO);
            
            const sessionData = await avatarManager.createStreamingSession({
                avatarId,
                voiceId,
                quality: quality || 'medium',
                voiceRate: voiceRate || 1,
                videoEncoding: videoEncoding || 'VP8',
                disableIdleTimeout: disableIdleTimeout || false,
                version: version || 'v2',
                sttProvider: sttProvider || 'deepgram',
                sttConfidence: sttConfidence || 0.55
            });
            
            console.log('Session created successfully:', sessionData);
            
            // Store session data in response
            res.json({
                success: true,
                data: {
                    sessionId: sessionData.sessionId,
                    accessToken: sessionData.accessToken,
                    ...sessionData
                }
            });
        } catch (error) {
            console.error('Error creating streaming session:', {
                message: error.message,
                stack: error.stack
            });
            
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to create streaming session'
            });
        }
    },

    // Start streaming session
    startStreaming: async (req, res) => {
        try {
            const { sessionId } = req.body;
            
            if (!sessionId) {
                return res.status(400).json({
                    success: false,
                    message: 'Session ID is required'
                });
            }

            const avatarManager = new HeyGenAvatarManager(process.env.API_HEYGEN_PRO);
            const result = await avatarManager.startStreaming(sessionId);

            res.json({
                success: true,
                message: 'Streaming started successfully',
                data: result
            });
        } catch (error) {
            console.error('Error starting streaming:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Send text to avatar
    sendText: async (req, res) => {
        const { sessionId, text, taskType } = req.body;
        
        try {
            const avatarManager = new HeyGenAvatarManager(process.env.API_HEYGEN_PRO);
            const result = await avatarManager.sendTextToAvatar(sessionId, text, taskType || 'talk');
            
            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Error sending text:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Stop streaming session
    stopStreaming: async (req, res) => {
        const { sessionId } = req.body;
        
        try {
            const avatarManager = new HeyGenAvatarManager(process.env.API_HEYGEN_PRO);
            await avatarManager.endStreamingSession(sessionId);
            
            res.json({
                success: true,
                message: 'Streaming session ended successfully'
            });
        } catch (error) {
            console.error('Error stopping streaming:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Get list of streaming avatars
    getAvatarList: async (req, res) => {
        try {
            if (!process.env.API_HEYGEN_PRO) {
                return res.status(500).json({
                    success: false,
                    message: 'HeyGen API key not configured'
                });
            }

            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const avatarManager = new HeyGenAvatarManager(process.env.API_HEYGEN_PRO);
            
            console.log('Fetching avatar list...', {
                userId: req.user.id
            });
            
            const avatars = await avatarManager.listAvatars();
            
            // Save avatars to session for caching
            if (req.session) {
                req.session.avatars = avatars;
                req.session.avatarsLastFetch = Date.now();
            }
            
            console.log(`Successfully fetched ${avatars.length} avatars`);
            
            res.json({
                success: true,
                data: { 
                    avatars,
                    metadata: {
                        voice_types: [...new Set(avatars.flatMap(a => a.voice_type || []))],
                        features: [...new Set(avatars.flatMap(a => a.supported_features || []))]
                    }
                }
            });
            
        } catch (error) {
            console.error('Error fetching avatar list:', error);
            res.status(error.response?.status || 500).json({
                success: false,
                message: error.message || 'Failed to fetch avatar list',
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    },

    // Get list of voices
    getVoiceList: async (req, res) => {
        try {
            if (!process.env.API_HEYGEN_PRO) {
                return res.status(500).json({
                    success: false,
                    message: 'HeyGen API key not configured'
                });
            }

            const response = await fetch('https://api.heygen.com/v2/voices', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': process.env.API_HEYGEN_PRO
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to fetch voice list');
            }

            const data = await response.json();
            console.log('Voice list response:', data); // Debug log

            // Transform the response to match our frontend expectations
            const transformedData = {
                voices: data.voices.map(voice => ({
                    voice_id: voice.voice_id,
                    name: voice.name,
                    language: voice.language,
                    gender: voice.gender,
                    preview_audio: voice.preview_audio,
                    support_pause: voice.support_pause,
                    emotion_support: voice.emotion_support,
                    support_locale: voice.support_locale
                }))
            };

            res.json({
                success: true,
                data: transformedData
            });
        } catch (error) {
            console.error('Error fetching voice list:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Get list of voice locales
    getVoiceLocales: async (req, res) => {
        try {
            if (!process.env.API_HEYGEN_PRO) {
                return res.status(500).json({
                    success: false,
                    message: 'HeyGen API key not configured'
                });
            }

            const avatarManager = new HeyGenAvatarManager(process.env.API_HEYGEN_PRO);
            const locales = await avatarManager.getVoiceLocales();
            
            res.json({
                success: true,
                data: { locales }
            });
        } catch (error) {
            console.error('Error fetching voice locales:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Get list of brand voices
    getBrandVoices: async (req, res) => {
        try {
            if (!process.env.API_HEYGEN_PRO) {
                return res.status(500).json({
                    success: false,
                    message: 'HeyGen API key not configured'
                });
            }

            console.log('Fetching brand voices...');
            const avatarManager = new HeyGenAvatarManager(process.env.API_HEYGEN_PRO);
            const brandVoices = await avatarManager.getBrandVoices();
            
            console.log('Brand voices response:', brandVoices);
            
            if (!brandVoices || !brandVoices.list) {
                throw new Error('Invalid response format from HeyGen API');
            }

            res.json({
                success: true,
                data: {
                    list: brandVoices.list,
                    total: brandVoices.total || brandVoices.list.length
                }
            });
        } catch (error) {
            console.error('Error fetching brand voices:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch brand voices'
            });
        }
    }
};

module.exports = VideoStreamingController;