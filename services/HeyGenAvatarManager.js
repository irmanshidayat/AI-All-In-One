const axios = require('axios');

class HeyGenAvatarManager {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('API key is required');
        }
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.heygen.com/v1';
    }

    async authenticate() {
        try {
            console.log('Creating session token...');
            const response = await fetch(`${this.baseUrl}/streaming.create_token`, {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'x-api-key': this.apiKey
                },
                body: JSON.stringify({})
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Authentication response:', data);

            if (data.error) {
                throw new Error(data.error);
            }

            if (!data.data?.token) {
                throw new Error('No token received in response');
            }

            return data.data.token;
        } catch (error) {
            console.error('Error creating session token:', error);
            throw error;
        }
    }

    async listAvatars() {
        try {
            console.log('Fetching avatar list...');
            console.log('Using API key:', this.apiKey.substring(0, 5) + '...');
            
            const response = await axios.get(`${this.baseUrl}/streaming/avatar.list`, {
                headers: {
                    'accept': 'application/json',
                    'x-api-key': this.apiKey
                }
            });

            console.log('Avatar list response:', {
                status: response.status,
                statusText: response.statusText
            });

            if (!response.data || !response.data.data) {
                console.error('Unexpected API response:', response.data);
                throw new Error('Invalid response format from HeyGen API');
            }

            // Transform the response to match our expected format
            const avatars = response.data.data.map(avatar => ({
                id: avatar.avatar_id,
                name: `Avatar ${avatar.avatar_id}`,
                status: avatar.status.toLowerCase(),
                created_at: avatar.created_at,
                is_public: avatar.is_public
            }));

            console.log(`Successfully transformed ${avatars.length} avatars`);
            return avatars;

        } catch (error) {
            console.error('Error fetching avatars:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to fetch avatar list');
        }
    }

    async getBrandVoices(limit = 100) {
        try {
            console.log('Fetching voices...');
            
            // Try V2 voices endpoint first
            try {
                const response = await axios.get('https://api.heygen.com/v2/voices', {
                    headers: {
                        'accept': 'application/json',
                        'x-api-key': this.apiKey
                    }
                });

                console.log('V2 voices response:', response.data);

                if (response.data && response.data.data && response.data.data.voices) {
                    // Transform V2 response to match expected format
                    const voices = response.data.data.voices.map(voice => ({
                        voice_id: voice.voice_id,
                        name: voice.name,
                        language: voice.language,
                        gender: voice.gender,
                        preview_audio: voice.preview_audio,
                        support_pause: voice.support_pause,
                        emotion_support: voice.emotion_support,
                        support_interactive_avatar: voice.support_interactive_avatar,
                        support_locale: voice.support_locale
                    }));

                    return {
                        list: voices,
                        total: voices.length
                    };
                }
            } catch (v2Error) {
                console.log('V2 voices endpoint failed:', v2Error.message);
            }

            // If V2 fails, try brand voices endpoint
            try {
                const response = await axios.get(`${this.baseUrl}/brand_voice/list`, {
                    params: { limit },
                    headers: {
                        'accept': 'application/json',
                        'x-api-key': this.apiKey
                    }
                });

                console.log('Brand voices response:', response.data);

                if (response.data && response.data.data) {
                    return response.data.data;
                }
            } catch (brandError) {
                console.log('Brand voices endpoint failed:', brandError.message);
            }

            // If both endpoints fail, return empty list
            return { 
                list: [],
                total: 0
            };

        } catch (error) {
            console.error('Error fetching voices:', error);
            throw new Error('Failed to fetch voices: ' + error.message);
        }
    }

    async createStreamingSession(params = {}) {
        try {
            console.log('Creating streaming session with params:', params);
            
            if (!params.avatarId) {
                throw new Error('Avatar ID is required');
            }

            if (!params.voiceId) {
                throw new Error('Voice ID is required');
            }

            // Prepare request body according to HeyGen API documentation
            const requestBody = {
                avatar_id: params.avatarId,
                voice: {
                    voice_id: params.voiceId,
                    rate: params.voiceRate || 1
                },
                quality: params.quality || 'medium',
                video_encoding: params.videoEncoding || 'VP8',
                disable_idle_timeout: params.disableIdleTimeout || false,
                version: params.version || 'v2',
                stt_settings: {
                    provider: params.sttProvider || 'deepgram',
                    confidence: params.sttConfidence || 0.55
                }
            };

            console.log('Sending request to HeyGen API:', {
                url: `${this.baseUrl}/streaming.new`,
                body: requestBody
            });

            const response = await axios.post(`${this.baseUrl}/streaming.new`, requestBody, {
                headers: {
                    'accept': 'application/json',
                    'content-type': 'application/json',
                    'x-api-key': this.apiKey
                },
                timeout: 30000 // 30 second timeout
            });

            console.log('Streaming session response:', response.data);

            if (response.data.error) {
                throw new Error(response.data.error);
            }

            if (!response.data.data) {
                throw new Error('Invalid response format from HeyGen API');
            }

            // Extract session_id and access_token from response
            const { session_id, access_token } = response.data.data;
            
            if (!session_id) {
                throw new Error('No session_id received from HeyGen API');
            }

            return {
                sessionId: session_id,
                accessToken: access_token,
                ...response.data.data
            };
        } catch (error) {
            console.error('Error creating streaming session:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });

            if (error.response?.data?.message) {
                throw new Error(error.response.data.message);
            }
            throw error;
        }
    }

    async startStreaming(sessionId) {
        try {
            console.log('Starting streaming session:', sessionId);
            
            if (!sessionId) {
                throw new Error('Session ID is required');
            }

            const requestBody = {
                session_id: sessionId
            };

            console.log('Sending start streaming request:', {
                url: `${this.baseUrl}/streaming.start`,
                body: requestBody
            });

            const response = await axios.post(`${this.baseUrl}/streaming.start`, requestBody, {
                headers: {
                    'accept': 'application/json',
                    'content-type': 'application/json',
                    'x-api-key': this.apiKey
                }
            });

            console.log('Start streaming response:', response.data);

            if (response.data.error) {
                throw new Error(response.data.error);
            }

            return response.data.data;
        } catch (error) {
            console.error('Error starting streaming:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });

            if (error.response?.data?.message) {
                throw new Error(error.response.data.message);
            }
            throw error;
        }
    }

    async sendTextToAvatar(sessionId, text, taskType = 'talk') {
        try {
            console.log('Sending text to avatar:', { sessionId, text, taskType });
            const response = await fetch(`${this.baseUrl}/streaming.text`, {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'x-api-key': this.apiKey
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    text: text,
                    task_type: taskType
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Send text response:', data);

            if (data.error) {
                throw new Error(data.error);
            }

            return data.data;
        } catch (error) {
            console.error('Error sending text to avatar:', error);
            throw error;
        }
    }

    async endStreamingSession(sessionId) {
        try {
            console.log('Ending streaming session:', sessionId);
            const response = await fetch(`${this.baseUrl}/streaming.stop`, {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'x-api-key': this.apiKey
                },
                body: JSON.stringify({ session_id: sessionId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('End streaming response:', data);

            if (data.error) {
                throw new Error(data.error);
            }

            return data.data;
        } catch (error) {
            console.error('Error ending streaming session:', error);
            throw error;
        }
    }

    async getVoices() {
        try {
            const response = await axios.get(`${this.baseUrl}/voices`, {
                headers: {
                    'accept': 'application/json',
                    'x-api-key': this.apiKey
                }
            });
            return response.data.voices;
        } catch (error) {
            console.error('Error fetching voices:', error.response?.data || error.message);
            throw new Error('Failed to fetch voice list');
        }
    }

    async getVoiceLocales() {
        try {
            const response = await axios.get(`${this.baseUrl}/voices/locales`, {
                headers: {
                    'accept': 'application/json',
                    'x-api-key': this.apiKey
                }
            });
            return response.data.data.locales;
        } catch (error) {
            console.error('Error fetching voice locales:', error.response?.data || error.message);
            throw new Error('Failed to fetch voice locales');
        }
    }
}

module.exports = HeyGenAvatarManager;