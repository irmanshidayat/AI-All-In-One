// HeyGen Video Streaming Client
class VideoStreamingClient {
    constructor() {
        // Core state
        this.token = null;
        this.sessionId = null;
        this.selectedAvatarId = null;
        this.selectedVoiceId = null;
        this.isStreaming = false;
        this.currentRoom = null;

        // Debug state
        this.debugInfo = {};
        this.showDebug = false;

        // DOM Elements
        this.videoElement = document.getElementById('mediaElement');
        this.statusMessages = document.getElementById('statusMessages');
        this.debugPanel = document.getElementById('debugPanel');
        this.debugContent = document.getElementById('debugContent');
        this.avatarGrid = document.querySelector('.avatar-grid');

        // Initialize UI
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Avatar and Voice Selection
        document.querySelector('.avatar-tabs')?.addEventListener('click', (e) => {
            if (e.target.dataset.tab) {
                this.filterAvatars(e.target.dataset.tab);
            }
        });

        // Load avatars when modal is shown
        const avatarModal = document.getElementById('avatarModal');
        if (avatarModal) {
            avatarModal.addEventListener('show.bs.modal', () => {
                this.loadAvatars();
            });
        }

        // Load voices when modal is shown
        const voiceModal = document.getElementById('voiceModal');
        if (voiceModal) {
            voiceModal.addEventListener('show.bs.modal', () => {
                this.loadBrandVoices();
            });
        }

        // Streaming Controls
        document.getElementById('startBtn')?.addEventListener('click', () => this.startStreaming());
        document.getElementById('stopBtn')?.addEventListener('click', () => this.stopStreaming());
        document.getElementById('sendBtn')?.addEventListener('click', () => this.sendText());
        document.getElementById('refreshAvatarsBtn')?.addEventListener('click', () => this.loadAvatars());
        document.getElementById('altMethodBtn')?.addEventListener('click', () => this.loadAvatarsAlternative());
        document.getElementById('toggleDebugBtn')?.addEventListener('click', () => this.toggleDebugPanel());

        // Text Input
        document.getElementById('textInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendText();
            }
        });
    }

    // Add filter avatars method
    filterAvatars(tab) {
        const cards = this.avatarGrid?.querySelectorAll('.avatar-card');
        if (!cards) return;

        // Update active tab button
        document.querySelectorAll('.avatar-tabs .btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Filter avatars based on tab
        cards.forEach(card => {
            const avatarName = card.querySelector('.avatar-name').textContent.toLowerCase();
            const isMale = avatarName.includes('thaddeus') || 
                          avatarName.includes('pedro') || 
                          avatarName.includes('graham') || 
                          avatarName.includes('anthony') ||
                          avatarName.includes('bryan') ||
                          avatarName.includes('dexter') ||
                          avatarName.includes('silas') ||
                          avatarName.includes('wayne');
            
            const isFemale = avatarName.includes('marianne') || 
                           avatarName.includes('katya') || 
                           avatarName.includes('alessandra') || 
                           avatarName.includes('anastasia') ||
                           avatarName.includes('amina') ||
                           avatarName.includes('rika') ||
                           avatarName.includes('ann') ||
                           avatarName.includes('elenora') ||
                           avatarName.includes('judy') ||
                           avatarName.includes('june');
            
            if (tab === 'all' || 
                (tab === 'male' && isMale) || 
                (tab === 'female' && isFemale)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    }

    async authenticate() {
        try {
            this.logStatus('Authenticating with HeyGen API...');
            
            const response = await fetch('/dashboard/video-streaming/token', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.token = data.data.token;
                this.updateDebugInfo('authResponse', data);
                this.logStatus('Authentication successful', 'success');
                return true;
            }
            throw new Error(data.message || 'Authentication failed');
        } catch (error) {
            console.error('Authentication error:', error);
            this.logStatus('Authentication failed: ' + error.message, 'error');
            this.updateDebugInfo('authError', error);
            return false;
        }
    }

    async loadAvatars() {
        try {
            this.logStatus('Loading avatars...');
            this.setLoading(true);

            // First ensure we have a valid token
            if (!this.token) {
                const authSuccess = await this.authenticate();
                if (!authSuccess) {
                    throw new Error('Authentication failed. Please try logging in again.');
                }
            }

            const response = await fetch('/dashboard/video-streaming/avatars', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Token might be expired, try to re-authenticate
                    const authSuccess = await this.authenticate();
                    if (!authSuccess) {
                        throw new Error('Session expired. Please try logging in again.');
                    }
                    // Retry the request with new token
                    return this.loadAvatars();
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to fetch avatars');
            }

            this.updateDebugInfo('avatarsResponse', data);
            
            // Store metadata about supported features
            if (data.data.metadata) {
                this.availableVoiceTypes = data.data.metadata.voice_types;
                this.availableFeatures = data.data.metadata.features;
                this.updateDebugInfo('supportedFeatures', {
                    voiceTypes: this.availableVoiceTypes,
                    features: this.availableFeatures
                });
            }

            this.renderAvatars(data.data.avatars);
            this.logStatus(`Loaded ${data.data.avatars.length} avatars successfully`, 'success');
        } catch (error) {
            console.error('Error loading avatars:', error);
            this.logStatus('Failed to load avatars: ' + error.message, 'error');
            this.updateDebugInfo('avatarsError', error);
            
            if (error.message.includes('Please login') || error.message.includes('Session expired')) {
                // Show login required message
                this.showLoginRequired();
            } else {
                this.showRetryOptions();
            }
        } finally {
            this.setLoading(false);
        }
    }

    async loadAvatarsAlternative() {
        try {
            this.logStatus('Trying alternative avatar loading method...');
            this.setLoading(true);

            const response = await fetch('/dashboard/video-streaming/avatars?method=alternative');
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to fetch avatars using alternative method');
            }

            this.updateDebugInfo('altAvatarsResponse', data);
            this.renderAvatars(data.data.avatars);
            this.logStatus('Alternative method successful', 'success');
        } catch (error) {
            console.error('Alternative method error:', error);
            this.logStatus('Alternative method failed: ' + error.message, 'error');
            this.updateDebugInfo('altAvatarsError', error);
        } finally {
            this.setLoading(false);
        }
    }

    renderAvatars(avatars) {
        if (!this.avatarGrid) return;

        this.avatarGrid.innerHTML = '';
        
        if (avatars.length === 0) {
            this.avatarGrid.innerHTML = `
                <div class="no-avatars-message">
                    <p>No avatars found. You need to create avatars in your HeyGen account first.</p>
                    <a href="https://app.heygen.com/avatars" target="_blank" class="btn btn-primary">
                        Go to HeyGen Dashboard
                    </a>
                </div>
            `;
            return;
        }

        avatars.forEach(avatar => {
            const card = this.createAvatarCard(avatar);
            this.avatarGrid.appendChild(card);
        });
    }

    createAvatarCard(avatar) {
        const card = document.createElement('div');
        card.className = `avatar-card ${this.selectedAvatarId === avatar.id ? 'selected' : ''}`;
        card.dataset.avatarId = avatar.id;
        
        // Extract avatar name and determine gender
        const avatarName = avatar.name.toLowerCase();
        const isMale = avatarName.includes('thaddeus') || 
                      avatarName.includes('pedro') || 
                      avatarName.includes('graham') || 
                      avatarName.includes('anthony') ||
                      avatarName.includes('bryan') ||
                      avatarName.includes('dexter') ||
                      avatarName.includes('silas') ||
                      avatarName.includes('wayne');
        
        const isFemale = avatarName.includes('marianne') || 
                        avatarName.includes('katya') || 
                        avatarName.includes('alessandra') || 
                        avatarName.includes('anastasia') ||
                        avatarName.includes('amina') ||
                        avatarName.includes('rika') ||
                        avatarName.includes('ann') ||
                        avatarName.includes('elenora') ||
                        avatarName.includes('judy') ||
                        avatarName.includes('june');
        
        const gender = isMale ? 'Male' : isFemale ? 'Female' : 'Unknown';
        
        // Use photo_url from API response
        const photoUrl = avatar.thumbnail_url || avatar.photo_url;
        
        card.innerHTML = `
            <div class="avatar-image">
                ${photoUrl ? `
                    <img src="${photoUrl}" alt="${avatar.name}" 
                        onerror="this.onerror=null; this.src='https://via.placeholder.com/150?text=No+Image';"
                    />
                ` : `
                    <div class="avatar-placeholder">
                        <span>${avatar.name.substring(0, 2).toUpperCase()}</span>
                    </div>
                `}
            </div>
            <div class="avatar-info">
                <h4 class="avatar-name">${avatar.name}</h4>
                <p class="avatar-id">ID: ${avatar.id}</p>
                <p class="avatar-gender">${gender}</p>
                ${avatar.voice_type?.length ? `
                    <div class="avatar-voice-types">
                        <small>Voice Types: ${avatar.voice_type.join(', ')}</small>
                    </div>
                ` : ''}
                ${avatar.supported_features?.length ? `
                    <div class="avatar-features">
                        <small>Features: ${avatar.supported_features.join(', ')}</small>
                    </div>
                ` : ''}
                <p class="avatar-desc">${avatar.description || 'No description'}</p>
            </div>
            ${avatar.status !== 'available' ? `
                <div class="avatar-status ${avatar.status}">
                    ${avatar.status.toUpperCase()}
                </div>
            ` : ''}
        `;
        
        // Add click event listener for avatar selection
        card.addEventListener('click', () => {
            if (!this.isStreaming) {
                this.selectAvatar(avatar);
            }
        });
        
        return card;
    }

    async loadBrandVoices() {
        try {
            this.logStatus('Loading brand voices...');
            const voiceList = document.getElementById('voiceList');
            voiceList.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div></div>';
            
            const response = await fetch('/dashboard/video-streaming/brand-voices', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            console.log('Brand voices response:', data);
            
            if (!data.success) {
                throw new Error(data.message || 'Failed to load voices');
            }
            
            const brandVoices = data.data.list || [];
            voiceList.innerHTML = '';
            
            if (brandVoices.length === 0) {
                voiceList.innerHTML = `
                    <div class="alert alert-info">
                        No brand voices found. You need to create brand voices in your HeyGen account first.
                        <div class="mt-2">
                            <a href="https://app.heygen.com/voices" target="_blank" class="btn btn-primary btn-sm">
                                Go to HeyGen Dashboard
                            </a>
                        </div>
                    </div>
                `;
                return;
            }
            
            brandVoices.forEach(voice => {
                const voiceOption = this.createVoiceOption(voice);
                voiceList.appendChild(voiceOption);
            });
            
            this.logStatus(`Loaded ${brandVoices.length} brand voices successfully`, 'success');
        } catch (error) {
            console.error('Error loading brand voices:', error);
            this.logStatus('Error loading brand voices: ' + error.message, 'error');
            const voiceList = document.getElementById('voiceList');
            voiceList.innerHTML = `
                <div class="alert alert-danger">
                    <h5>Failed to load voices</h5>
                    <p>${error.message}</p>
                    <button class="btn btn-primary btn-sm mt-2" onclick="window.videoStreamingClient.loadBrandVoices()">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    createVoiceOption(voice) {
        const option = document.createElement('div');
        option.className = 'voice-option p-3 border rounded mb-2';
        
        option.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${voice.name || 'Unnamed Voice'}</strong>
                    <div class="text-muted small">
                        ${voice.language || 'Unknown'} - ${voice.gender || 'Unknown'}
                    </div>
                    ${voice.description ? `
                        <div class="mt-1 small">${voice.description}</div>
                    ` : ''}
                </div>
                ${voice.preview_audio ? `
                    <button class="btn btn-sm btn-outline-primary preview-voice" data-audio="${voice.preview_audio}">
                        <i class="bi bi-play-fill"></i> Preview
                    </button>
                ` : ''}
            </div>
        `;
        
        option.addEventListener('click', () => {
            document.querySelectorAll('.voice-option').forEach(v => v.classList.remove('selected'));
            option.classList.add('selected');
            this.selectedVoiceId = voice.voice_id;
            document.getElementById('selectedVoice').textContent = voice.name || 'Unnamed Voice';
            
            // Enable start streaming button if avatar is also selected
            const startBtn = document.getElementById('startBtn');
            if (startBtn && this.selectedAvatarId) {
                startBtn.disabled = false;
            }

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('voiceModal'));
            if (modal) {
                modal.hide();
            }
        });
        
        const previewBtn = option.querySelector('.preview-voice');
        if (previewBtn) {
            previewBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const audio = new Audio(voice.preview_audio);
                audio.play();
            });
        }
        
        return option;
    }

    selectAvatar(avatar) {
        // Remove selected class from all cards
        document.querySelectorAll('.avatar-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Add selected class to clicked card
        const selectedCard = document.querySelector(`.avatar-card[data-avatar-id="${avatar.id}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }
        
        // Update selected avatar ID and display name
        this.selectedAvatarId = avatar.id;
        document.getElementById('selectedAvatar').textContent = avatar.name;
        
        // Enable start streaming button if both avatar and voice are selected
        const startBtn = document.getElementById('startStreaming');
        if (startBtn && this.selectedVoiceId) {
            startBtn.disabled = false;
        }
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('avatarModal'));
        if (modal) {
            modal.hide();
        }
        
        this.logStatus(`Selected avatar: ${avatar.name}`);
    }

    async startStreaming() {
        if (!this.selectedAvatarId || !this.selectedVoiceId) {
            this.logStatus('Please select both an avatar and a voice first', 'error');
            return;
        }

        try {
            this.logStatus('Creating streaming session...');
            this.setLoading(true);

            // Create streaming session
            const sessionResponse = await fetch('/dashboard/video-streaming/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    avatarId: this.selectedAvatarId,
                    voiceId: this.selectedVoiceId,
                    quality: 'high',
                    voiceRate: 1,
                    videoEncoding: 'VP8',
                    disableIdleTimeout: false,
                    version: 'v2',
                    sttProvider: 'deepgram',
                    sttConfidence: 0.55
                })
            });

            if (!sessionResponse.ok) {
                const errorData = await sessionResponse.json();
                throw new Error(errorData.message || `HTTP error! status: ${sessionResponse.status}`);
            }

            const sessionData = await sessionResponse.json();
            console.log('Session created:', sessionData);

            if (!sessionData.success) {
                throw new Error(sessionData.message || 'Failed to create session');
            }

            if (!sessionData.data.sessionId) {
                throw new Error('No session ID received from server');
            }

            this.sessionId = sessionData.data.sessionId;
            this.accessToken = sessionData.data.accessToken;
            this.logStatus('Session created successfully');
            
            // Set up LiveKit room if available
            if (sessionData.data.livekit_token && sessionData.data.livekit_url) {
                await this.setupLiveKitRoom(sessionData.data.livekit_url, sessionData.data.livekit_token);
            }
            
            // Start streaming
            this.logStatus('Starting streaming...');
            const startResponse = await fetch('/dashboard/video-streaming/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: JSON.stringify({
                    sessionId: this.sessionId
                })
            });

            if (!startResponse.ok) {
                const errorData = await startResponse.json();
                throw new Error(errorData.message || `HTTP error! status: ${startResponse.status}`);
            }

            const startData = await startResponse.json();
            console.log('Streaming started:', startData);

            if (!startData.success) {
                throw new Error(startData.message || 'Failed to start streaming');
            }

            this.logStatus('Streaming started successfully', 'success');
            this.updateUIForActiveStream(true);
        } catch (error) {
            console.error('Error starting stream:', error);
            this.logStatus('Error starting stream: ' + error.message, 'error');
            this.updateUIForActiveStream(false);
        } finally {
            this.setLoading(false);
        }
    }

    async setupLiveKitRoom(livekitUrl, livekitToken) {
        try {
            // Clean up existing room if any
            if (this.currentRoom) {
                await this.currentRoom.disconnect();
            }

            this.currentRoom = new Room();
            
            // Set up event listeners
            this.currentRoom.on('trackSubscribed', (track, publication, participant) => {
                if (track.kind === 'video') {
                    console.log('Video track received:', track);
                    if (this.videoElement) {
                        // Create a new MediaStream
                        const stream = new MediaStream();
                        stream.addTrack(track.mediaStreamTrack);
                        
                        // Set the stream as source
                        this.videoElement.srcObject = stream;
                        
                        // Ensure video plays
                        this.videoElement.play().catch(error => {
                            console.error('Error playing video:', error);
                            this.logStatus('Error playing video: ' + error.message, 'error');
                        });
                        
                        this.logStatus('Video track connected successfully');
                    }
                }
            });

            this.currentRoom.on('trackUnsubscribed', (track, publication, participant) => {
                if (track.kind === 'video') {
                    console.log('Video track unsubscribed');
                    if (this.videoElement) {
                        this.videoElement.srcObject = null;
                    }
                    this.logStatus('Video track disconnected');
                }
            });

            this.currentRoom.on('disconnected', () => {
                console.log('Disconnected from room');
                this.logStatus('Disconnected from streaming room', 'error');
                if (this.videoElement) {
                    this.videoElement.srcObject = null;
                }
            });

            // Connect to room
            await this.currentRoom.connect(livekitUrl, livekitToken);
            this.logStatus('Connected to streaming room: ' + this.currentRoom.name);
            
            // Update connection status
            document.getElementById('livekitStatus').innerHTML = '<span class="badge ws-connected">Connected</span>';
            document.getElementById('connectionStatus').className = 'badge connected';
            document.getElementById('connectionStatus').textContent = 'Connected';
        } catch (error) {
            console.error('Failed to setup streaming room:', error);
            this.logStatus('Failed to setup streaming room: ' + error.message, 'error');
            document.getElementById('livekitStatus').innerHTML = '<span class="badge ws-error">Error</span>';
            document.getElementById('connectionStatus').className = 'badge disconnected';
            document.getElementById('connectionStatus').textContent = 'Error';
            throw error;
        }
    }

    async sendText(text, taskType = 'talk') {
        if (!text.trim() || !this.sessionId) {
            this.logStatus('Please enter text and ensure streaming is active', 'error');
            return;
        }

        try {
            const response = await fetch('/dashboard/video-streaming/text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    text: text,
                    taskType: taskType
                })
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.message);

            document.getElementById('textInput').value = '';
            this.logStatus(`Message sent: ${text}`);
        } catch (error) {
            this.logStatus('Error sending text: ' + error.message, 'error');
        }
    }

    async stopStreaming() {
        if (!this.sessionId) {
            this.logStatus('No active streaming session', 'error');
            return;
        }

        try {
            const response = await fetch('/dashboard/video-streaming/stop', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.sessionId
                })
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.message);

            if (this.videoElement) {
                this.videoElement.src = '';
            }

            this.sessionId = null;
            this.logStatus('Streaming stopped successfully');
            this.updateUIForActiveStream(false);
        } catch (error) {
            this.logStatus('Error stopping stream: ' + error.message, 'error');
        }
    }

    updateUIForActiveStream(isActive) {
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const textInput = document.getElementById('textInput');
        const sendBtn = document.getElementById('sendBtn');
        const taskType = document.getElementById('taskType');
        
        if (startBtn) startBtn.disabled = isActive;
        if (stopBtn) stopBtn.disabled = !isActive;
        if (textInput) textInput.disabled = !isActive;
        if (sendBtn) sendBtn.disabled = !isActive;
        if (taskType) taskType.disabled = !isActive;
    }

    logStatus(message, type = 'info') {
        const statusItem = document.createElement('div');
        statusItem.className = `status-item ${type}`;
        statusItem.innerHTML = `
            <span class="timestamp">${new Date().toLocaleTimeString()}</span>
            <span class="message">${message}</span>
        `;

        if (this.statusMessages) {
            this.statusMessages.appendChild(statusItem);
            this.statusMessages.scrollTop = this.statusMessages.scrollHeight;
        }
        
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    setLoading(isLoading) {
        const loadingElements = document.querySelectorAll('.loading-indicator');
        loadingElements.forEach(el => {
            el.style.display = isLoading ? 'block' : 'none';
        });

        // Update UI state
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        if (startBtn) startBtn.disabled = isLoading;
        if (stopBtn) stopBtn.disabled = isLoading;
    }

    showRetryOptions() {
        const retryActions = document.createElement('div');
        retryActions.className = 'retry-actions';
        retryActions.innerHTML = `
            <button onclick="window.videoStreamingClient.loadAvatars()" class="btn btn-primary">
                Retry Primary Method
            </button>
            <button onclick="window.videoStreamingClient.loadAvatarsAlternative()" class="btn btn-secondary">
                Try Alternative Method
            </button>
        `;

        const existingRetry = document.querySelector('.retry-actions');
        if (existingRetry) {
            existingRetry.remove();
        }

        this.avatarGrid.parentNode.insertBefore(retryActions, this.avatarGrid);
    }

    updateDebugInfo(key, value) {
        this.debugInfo[key] = value;
        if (this.showDebug) {
            this.updateDebugPanel();
        }
    }

    updateDebugPanel() {
        if (this.debugContent) {
            this.debugContent.innerHTML = `<pre>${JSON.stringify(this.debugInfo, null, 2)}</pre>`;
        }
    }

    toggleDebugPanel() {
        this.showDebug = !this.showDebug;
        if (this.debugPanel) {
            this.debugPanel.style.display = this.showDebug ? 'block' : 'none';
        }
        if (this.showDebug) {
            this.updateDebugPanel();
        }
    }

    showLoginRequired() {
        const loginMessage = document.createElement('div');
        loginMessage.className = 'alert alert-warning';
        loginMessage.innerHTML = `
            <h4>Login Required</h4>
            <p>Your session has expired. Please log in again to continue.</p>
            <a href="/auth/login" class="btn btn-primary">Go to Login</a>
        `;

        const existingMessage = document.querySelector('.alert-warning');
        if (existingMessage) {
            existingMessage.remove();
        }

        const container = document.querySelector('.container-fluid');
        if (container) {
            container.insertBefore(loginMessage, container.firstChild);
        }
    }
}

// Initialize the video streaming client when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.videoStreamingClient = new VideoStreamingClient();
});