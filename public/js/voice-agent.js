/**
 * Voice Agent Client-side Script
 * Handles interactions with the Voice Agent feature
 */

document.addEventListener('DOMContentLoaded', function() {
  // Constants for API keys - these should be passed from server-side
  const TWILIO_ACCOUNT_SID = document.querySelector('meta[name="twilio-sid"]')?.content || '';
  const TWILIO_AUTH_TOKEN = document.querySelector('meta[name="twilio-token"]')?.content || '';
  const TWILIO_PHONE_NUMBER = document.querySelector('meta[name="twilio-phone"]')?.content || '';
  const OPENROUTER_API_KEY = document.querySelector('meta[name="openrouter-key"]')?.content || '';
  const OPENROUTER_API_URL = document.querySelector('meta[name="openrouter-url"]')?.content || '';
  
  // DOM Elements
  const importContactsForm = document.getElementById('importContactsForm');
  const contactsTableBody = document.getElementById('contactsTableBody');
  const batchCallBtn = document.getElementById('batchCallBtn');
  const selectAll = document.getElementById('selectAll');
  const agentConfigForm = document.getElementById('agentConfigForm');
  const refreshModelsBtn = document.getElementById('refreshModelsBtn');
  const activeCallsContainer = document.getElementById('activeCallsContainer');
  const callTemplate = document.getElementById('callTemplate');
  const agentMessageTemplate = document.getElementById('agentMessageTemplate');
  const userMessageTemplate = document.getElementById('userMessageTemplate');
  const callConfigSelect = document.getElementById('callConfigSelect');
  const selectedContactId = document.getElementById('selectedContactId');
  const batchCallMode = document.getElementById('batchCallMode');
  const startCallBtn = document.getElementById('startCallBtn');
  
  // Reference to the element that had focus before modal was opened
  let lastActiveElement = null;
  
  // Bootstrap modals
  const selectConfigModalElement = document.getElementById('selectConfigModal');
  const selectConfigModal = selectConfigModalElement ? new bootstrap.Modal(selectConfigModalElement) : null;
  const viewConversationModal = document.getElementById('viewConversationModal') ? new bootstrap.Modal(document.getElementById('viewConversationModal')) : null;
  
  // Setup modal accessibility
  if (selectConfigModalElement) {
    // Listen for modal events
    selectConfigModalElement.addEventListener('shown.bs.modal', function() {
      // Save the element that was focused before the modal opened
      lastActiveElement = document.activeElement;
      
      // Focus the first focusable element in the modal
      const firstInput = selectConfigModalElement.querySelector('select, input:not([type="hidden"]), button:not([data-bs-dismiss="modal"])');
      if (firstInput) {
        firstInput.focus();
      }
    });
    
    selectConfigModalElement.addEventListener('hidden.bs.modal', function() {
      // Restore focus to the element that had focus before the modal was opened
      if (lastActiveElement) {
        lastActiveElement.focus();
      }
    });
  }
  
  // State
  const activeCalls = new Map(); // Map to store active call information
  let callTimers = new Map(); // Map to store call timers
  let selectedContactIds = []; // Array to store selected contact IDs for batch calling
  
  // Initialize tabs - make sure they're clickable
  initializeTabs();
  
  // Initialize event listeners
  initializeEventListeners();
  
  // Force enable the batch call button after a slight delay
  setTimeout(() => {
    if (batchCallBtn) {
      batchCallBtn.disabled = false;
      console.log('Batch Call button forcefully enabled');
    }
  }, 1000);
  
  // WebSocket connection
  let socket;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;

  function initializeSocket() {
    socket = io({
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    socket.on('connect', () => {
      console.log('Terhubung ke server');
      reconnectAttempts = 0;
    });

    socket.on('disconnect', (reason) => {
      console.warn('Terputus dari server:', reason);
      
      if (reason === 'io server disconnect') {
        // Server memutuskan koneksi, coba sambungkan kembali
        socket.connect();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Gagal terhubung:', error);
      
      reconnectAttempts++;
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        showAlert('error', 'Gagal terhubung ke server. Silakan refresh halaman.');
      }
    });

    socket.on('message', (message) => {
      // Find chat container for this call
      const chatContainer = document.querySelector(`.active-call-card[data-call-id="${message.callId}"] .chat-container`);
      if (chatContainer) {
        addMessageToChatUI(chatContainer, message.type, message.text);
      }
    });

    // Listen for call status updates from server
    socket.on('call-status', async (data) => {
      const { callId, status } = data;
      console.log(`[Debug] Menerima status panggilan: ${callId} - ${status}`);

      const callCard = document.querySelector(`.active-call-card[data-call-id="${callId}"]`);
      
      if (callCard) {
        const statusBadge = callCard.querySelector('.status-badge');
        const callInfo = activeCalls.get(callId);
        
        if (statusBadge && callInfo) {
          // Update status badge dan state
          updateCallStatus(callId, status);
          
          if (status === 'in-progress' || status === 'connected') {
            statusBadge.textContent = 'Tersambung';
            statusBadge.className = 'badge bg-success status-badge';
            
            // Request audio permissions and play greeting
            try {
              console.log(`[Debug] Mencoba memainkan greeting untuk panggilan ${callId}`);
              const hasAudioPermissions = await requestAudioPermissions();
              if (!hasAudioPermissions) {
                console.error('[Error] Izin audio ditolak');
                showAlert('error', 'Mohon izinkan akses audio untuk mendengar suara agent');
                return;
              }
              
              if (callInfo.pendingGreeting) {
                console.log(`[Debug] Menemukan greeting tertunda: "${callInfo.pendingGreeting}"`);
                
                // Tambahkan delay kecil untuk memastikan koneksi stabil
                setTimeout(async () => {
                  try {
                    const greetingPlayed = await playGreetingOnCallConnect(callId, callInfo.pendingGreeting);
                    
                    if (greetingPlayed) {
                      console.log(`[Success] Greeting berhasil dimainkan untuk ${callId}`);
                      delete callInfo.pendingGreeting;
                      activeCalls.set(callId, callInfo);
                    } else {
                      console.warn(`[Warning] Gagal memainkan greeting untuk ${callId}`);
                      // Retry once after 2 seconds
                      setTimeout(async () => {
                        console.log(`[Debug] Mencoba ulang greeting untuk ${callId}`);
                        const retrySuccess = await playGreetingOnCallConnect(callId, callInfo.pendingGreeting);
                        if (retrySuccess) {
                          delete callInfo.pendingGreeting;
                          activeCalls.set(callId, callInfo);
                        }
                      }, 2000);
                    }
                  } catch (error) {
                    console.error(`[Error] Gagal memproses greeting untuk ${callId}:`, error);
                    showAlert('error', `Gagal memainkan suara agent: ${error.message}`);
                  }
                }, 1000);
              } else {
                console.log(`[Debug] Tidak ada greeting tertunda untuk ${callId}`);
              }
            } catch (error) {
              console.error('[Error] Gagal memproses greeting:', error);
              showAlert('error', 'Terjadi kesalahan saat memproses greeting');
            }
          } else if (status === 'completed' || status === 'failed') {
            endCall(callId);
          }
        }
      }
    });

    // New event handler for detailed call status updates
    socket.on('call-status-update', function(data) {
      const { callId, status } = data;
      console.log(`Received call status update for ${callId}: ${status}`);
      
      // Find the call information in our active calls map
      const callInfo = activeCalls.get(callId);
      if (callInfo) {
        // Update the status
        callInfo.status = status;
        activeCalls.set(callId, callInfo);
        
        // Update UI if the card exists
        const callCard = document.querySelector(`.active-call-card[data-call-id="${callId}"]`);
        if (callCard) {
          const statusBadge = callCard.querySelector('.status-badge');
          if (statusBadge) {
            if (status === 'in-progress') {
              statusBadge.textContent = 'Tersambung';
              statusBadge.className = 'badge bg-success status-badge';
              
              // Check if we have a pending greeting to send
              if (callInfo.pendingTts) {
                console.log(`Call ${callId} is now in-progress, sending pending TTS: "${callInfo.pendingTts}"`);
                sendTtsRequest(callId, callInfo.pendingTts)
                  .then(success => {
                    if (success) {
                      // Clear the pending TTS since it's been sent
                      callInfo.pendingTts = null;
                      activeCalls.set(callId, callInfo);
                    }
                  })
                  .catch(err => {
                    console.error('Error sending pending TTS:', err);
                  });
              }
            } else if (status === 'completed' || status === 'failed' || status === 'busy' || status === 'no-answer') {
              endCall(callId);
            } else {
              // Update status badge for other statuses
              let statusText = status;
              let statusClass = 'badge bg-warning status-badge';
              
              switch (status) {
                case 'queued':
                  statusText = 'Dalam antrian';
                  break;
                case 'ringing':
                  statusText = 'Berdering';
                  break;
                case 'initiated':
                  statusText = 'Memulai panggilan';
                  break;
                case 'canceled':
                  statusText = 'Dibatalkan';
                  statusClass = 'badge bg-danger status-badge';
                  break;
              }
              
              statusBadge.textContent = statusText;
              statusBadge.className = statusClass;
            }
          }
        }
      }
    });
  }

  // Panggil fungsi ini saat halaman dimuat
  initializeSocket();

  /**
   * Initialize tabs functionality
   */
  function initializeTabs() {
    console.log('Initializing tabs...');
    
    // Get all tab elements
    const tabButtons = document.querySelectorAll('.nav-link[data-bs-toggle="tab"]');
    console.log('Found tab buttons:', tabButtons.length);
    
    // Make sure all tab buttons are not disabled
    tabButtons.forEach(tab => {
      tab.classList.remove('disabled');
      tab.removeAttribute('disabled');
      console.log('Enabling tab:', tab.id);
      
      // Register click event handlers
      tab.addEventListener('click', function(event) {
        event.preventDefault();
        console.log(`Tab clicked: ${this.id}`);
        
        // Remove active class from all tabs and panels
        document.querySelectorAll('.nav-link').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active', 'show'));
        
        // Add active class to clicked tab
        this.classList.add('active');
        
        // Get the target panel ID
        const targetId = this.getAttribute('data-bs-target');
        console.log(`Target panel: ${targetId}`);
        const targetPanel = document.querySelector(targetId);
        
        if (targetPanel) {
          // Activate the target panel
          targetPanel.classList.add('active', 'show');
          
          // Special handling for specific tabs
          if (targetId === '#active-calls') {
            console.log('Active calls tab activated, rendering active calls');
            renderActiveCalls();
          } else if (targetId === '#history') {
            console.log('History tab activated');
          } else if (targetId === '#config') {
            console.log('Config tab activated');
          }
        }
      });
    });
    
    // Find the active-calls-tab specifically and add special handling
    const activeCallsTab = document.getElementById('active-calls-tab');
    if (activeCallsTab) {
      console.log('Found active-calls-tab, adding special handler');
      activeCallsTab.addEventListener('shown.bs.tab', function() {
        console.log('Active calls tab shown event triggered');
        renderActiveCalls();
      });
    }

    // Log all tab panes for debugging
    const tabPanes = document.querySelectorAll('.tab-pane');
    console.log('Tab panes found:', tabPanes.length);
    tabPanes.forEach(pane => {
      console.log(`- Tab pane: ${pane.id}`);
    });
  }
  
  /**
   * Initialize event listeners for the page
   */
  function initializeEventListeners() {
    // Import Contacts form submission
    if (importContactsForm) {
      importContactsForm.addEventListener('submit', handleImportContacts);
    }
    
    // Select all contacts checkbox
    if (selectAll) {
      selectAll.addEventListener('change', handleSelectAll);
    }
    
    // Listen for individual contact checkboxes
    document.addEventListener('change', function(e) {
      if (e.target.classList.contains('contact-checkbox')) {
        updateBatchCallButton();
      }
    });
    
    // Batch Call button
    if (batchCallBtn) {
      batchCallBtn.addEventListener('click', handleBatchCall);
    }
    
    // Agent Config form submission
    if (agentConfigForm) {
      agentConfigForm.addEventListener('submit', handleSaveConfig);
    }
    
    // Refresh models button
    if (refreshModelsBtn) {
      refreshModelsBtn.addEventListener('click', fetchAvailableModels);
    }
    
    // Individual call buttons
    document.addEventListener('click', function(e) {
      const callBtn = e.target.closest('.call-btn');
      if (callBtn) {
        e.preventDefault();
        handleSingleCall(callBtn.dataset.id, callBtn.dataset.name, callBtn.dataset.phone);
      }
    });
    
    // Load config buttons
    document.addEventListener('click', function(e) {
      if (e.target.closest('.load-config-btn')) {
        const configId = e.target.closest('.load-config-btn').dataset.id;
        loadConfigToForm(configId);
      }
    });
    
    // Delete config buttons
    document.addEventListener('click', function(e) {
      if (e.target.closest('.delete-config-btn')) {
        const configId = e.target.closest('.delete-config-btn').dataset.id;
        deleteConfig(configId);
      }
    });
    
    // View conversation buttons
    document.addEventListener('click', function(e) {
      if (e.target.closest('.view-conversation-btn')) {
        const callId = e.target.closest('.view-conversation-btn').dataset.id;
        viewConversation(callId);
      }
    });
    
    // End call buttons
    document.addEventListener('click', function(e) {
      if (e.target.closest('.end-call-btn')) {
        const callCard = e.target.closest('.active-call-card');
        const callId = callCard.dataset.callId;
        endCall(callId);
      }
    });
    
    // Start call button in modal
    if (startCallBtn) {
      startCallBtn.addEventListener('click', function() {
        const configId = callConfigSelect.value;
        
        if (batchCallMode.value === 'true') {
          // Batch call
          makeVoiceCall(selectedContactIds, configId, true);
        } else {
          // Single call
          makeVoiceCall([selectedContactId.value], configId, false);
        }
        
        selectConfigModal.hide();
      });
    }
    
    // Tab change event - Make sure to use button elements with data-bs-toggle="tab" attribute
    const tabEls = document.querySelectorAll('button[data-bs-toggle="tab"]');
    tabEls.forEach(tabEl => {
      tabEl.addEventListener('shown.bs.tab', function (event) {
        const targetId = event.target.getAttribute('data-bs-target');
        if (targetId === '#active-calls') {
          // Update active calls view when tab is shown
          renderActiveCalls();
        } else if (targetId === '#history') {
          // Could refresh history data here if needed
          console.log('History tab shown');
        } else if (targetId === '#config') {
          // Could refresh config data here if needed
          console.log('Config tab shown');
        }
      });
    });

    // Initialize Bootstrap tooltips if available
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
      const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
      const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    }
  }
  
  /**
   * Handle import contacts form submission
   * @param {Event} e - Form submit event
   */
  async function handleImportContacts(e) {
    // Do not prevent default - let the form submit normally for redirect
    // e.preventDefault();
    
    const fileInput = document.getElementById('contactsFile');
    
    if (!fileInput.files || fileInput.files.length === 0) {
      e.preventDefault(); // Prevent form submission if no file
      showAlert('error', 'Pilih file Excel terlebih dahulu');
      return;
    }
    
    // Add loading indicator
    const submitButton = importContactsForm.querySelector('button[type="submit"]');
    if (submitButton) {
      const originalText = submitButton.innerHTML;
      submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Mengimpor...';
      submitButton.disabled = true;
      
      // Reset button state after 10 seconds (if page doesn't redirect)
      setTimeout(() => {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
      }, 10000);
    }
    
    // Let the form submit normally - the server will handle redirect
  }
  
  /**
   * Update contacts table with new contacts
   * @param {Array} contacts - List of contacts
   */
  function updateContactsTable(contacts) {
    if (!contactsTableBody) return;
    
    // Clear existing content if it was empty
    const emptyRow = contactsTableBody.querySelector('tr td[colspan="5"]');
    if (emptyRow) {
      contactsTableBody.innerHTML = '';
    }
    
    // Add new contacts
    contacts.forEach(contact => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="contact-checkbox" value="${contact.id}"></td>
        <td>${contact.name}</td>
        <td>${contact.phone}</td>
        <td><span class="badge bg-secondary">Belum Dihubungi</span></td>
        <td>
          <button class="btn btn-primary btn-sm call-btn" data-id="${contact.id}" data-name="${contact.name}" data-phone="${contact.phone}">
            <i class="bi bi-telephone-outbound"></i> Call
          </button>
        </td>
      `;
      
      contactsTableBody.appendChild(tr);
    });
  }
  
  /**
   * Handle select all checkbox change
   * @param {Event} e - Change event
   */
  function handleSelectAll(e) {
    const checkboxes = document.querySelectorAll('.contact-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.checked = e.target.checked;
    });
    
    updateBatchCallButton();
  }
  
  /**
   * Update batch call button state based on selected contacts
   */
  function updateBatchCallButton() {
    const checkboxes = document.querySelectorAll('.contact-checkbox:checked');
    selectedContactIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (batchCallBtn) {
      batchCallBtn.disabled = checkboxes.length === 0;
    }
  }
  
  /**
   * Handle batch call button click
   */
  function handleBatchCall() {
    const checkboxes = document.querySelectorAll('.contact-checkbox:checked');
    if (checkboxes.length === 0) {
      showAlert('error', 'Pilih minimal satu kontak');
      return;
    }
    
    selectedContactIds = Array.from(checkboxes).map(cb => cb.value);
    batchCallMode.value = 'true';
    
    // Show config selection modal
    selectConfigModal.show();
  }
  
  /**
   * Handle single call button click
   * @param {string} id - Contact ID
   * @param {string} name - Contact name
   * @param {string} phone - Contact phone number
   */
  function handleSingleCall(id, name, phone) {
    if (!selectedContactId) {
      console.error('Element selectedContactId tidak ditemukan');
      return;
    }
    
    selectedContactId.value = id;
    batchCallMode.value = 'false';
    
    // Show config selection modal
    document.getElementById('selectConfigModalLabel').textContent = 'Panggil ' + name;
    selectConfigModal.show();
  }
  
  /**
   * Make voice call to contacts
   * @param {Array} contactIds - List of contact IDs
   * @param {string} configId - Agent configuration ID
   * @param {boolean} isBatch - Whether this is a batch call
   */
  async function makeVoiceCall(contactIds, configId, isBatch) {
    if (!contactIds || contactIds.length === 0 || !configId) {
      showAlert('error', 'Data kontak atau konfigurasi tidak lengkap');
      return;
    }
    
    try {
      // Gunakan URL relatif alih-alih URL absolut untuk menghindari masalah port
      const endpoint = isBatch ? '/dashboard/voice-agent/batch-call' : '/dashboard/voice-agent/call';
      const payload = isBatch 
        ? { contactIds, configId }
        : { contactId: contactIds[0], configId };
      
      // Tampilkan loading indicator
      const loadingAlert = document.createElement('div');
      loadingAlert.className = 'alert alert-info';
      loadingAlert.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Sedang memproses panggilan...';
      const contentArea = document.querySelector('.content-area') || document.querySelector('.voice-agent-content');
      if (contentArea) {
        contentArea.insertAdjacentElement('afterbegin', loadingAlert);
      }
      
      console.log('Mengirim request ke:', endpoint, 'dengan payload:', payload);
      
      // Lakukan permintaan ke server dengan URL relatif
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      // Hapus loading indicator
      if (loadingAlert) {
        loadingAlert.remove();
      }
      
      console.log('Respons dari server:', response.status);
      
      // Tambahkan penanganan error yang lebih detail
      if (!response.ok) {
        // Coba dapatkan teks respons untuk debugging
        const responseText = await response.text();
        console.error('Respons server tidak valid:', responseText);
        
        // Coba parsing sebagai JSON jika memungkinkan
        let errorMsg = `Error ${response.status}: ${response.statusText}`;
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.message) {
            errorMsg = errorData.message;
          }
        } catch (parseError) {
          // Jika bukan JSON, gunakan teks respons
          errorMsg = responseText || errorMsg;
        }
        
        throw new Error(errorMsg);
      }
      
      // Pastikan respons adalah JSON yang valid
      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('Gagal parsing JSON:', jsonError);
        throw new Error('Respons server tidak valid');
      }
      
      console.log('Hasil dari server:', result);
      
      if (result.success) {
        showAlert('success', result.message);
        
        // Switch to Active Calls tab
        const activeCallsTab = document.querySelector('#active-calls-tab');
        if (activeCallsTab) {
          const tab = new bootstrap.Tab(activeCallsTab);
          tab.show();
        }
        
        if (isBatch) {
          // For batch calls
          result.calls.forEach(call => {
            createActiveCallCard(call.id, call.contact);
          });
        } else {
          // For single call
          createActiveCallCard(result.call.id, result.call.contact, result.call.greeting);
        }
      } else {
        showAlert('error', result.message || 'Gagal melakukan panggilan');
      }
    } catch (error) {
      console.error('Error making call:', error);
      showAlert('error', error.message || 'Terjadi kesalahan saat melakukan panggilan');
    }
  }
  
  /**
   * Create an active call card for UI
   * @param {string} callId - Call ID
   * @param {object} contact - Contact information
   * @param {string} greeting - Initial greeting message
   */
  function createActiveCallCard(callId, contact, greeting) {
    if (!callTemplate || !activeCallsContainer) return;
    
    // Remove placeholder text if present
    const placeholder = activeCallsContainer.querySelector('p.text-muted');
    if (placeholder) {
      placeholder.remove();
    }
    
    const name = contact.name;
    const phone = contact.phone;
    
    // Clone the template
    const template = callTemplate.content.cloneNode(true);
    const callCard = template.querySelector('.active-call-card');
    
    // Set card data
    callCard.dataset.callId = callId;
    
    // Fill in template placeholders
    const cardHtml = callCard.outerHTML
      .replace('{callId}', callId)
      .replace('{name}', name)
      .replace('{phone}', phone);
    
    // Insert the new card
    activeCallsContainer.insertAdjacentHTML('beforeend', cardHtml);
    
    // Get the inserted card
    const insertedCard = activeCallsContainer.querySelector(`.active-call-card[data-call-id="${callId}"]`);
    const chatContainer = insertedCard.querySelector('.chat-container');
    
    // Store call information
    activeCalls.set(callId, {
      id: callId,
      contact: contact,
      status: 'connecting',
      startTime: new Date(),
      messages: [],
      pendingTts: null, // New property to track pending TTS messages
      pendingGreeting: greeting // Simpan greeting untuk diputar nanti
    });
    
    // Add initial greeting message if provided
    if (greeting) {
      addMessageToChatUI(chatContainer, 'agent', greeting);
      
      // Store message in active calls
      const callInfo = activeCalls.get(callId);
      if (callInfo) {
        callInfo.messages.push({
          type: 'agent',
          text: greeting,
          time: new Date()
        });
        activeCalls.set(callId, callInfo);
        
        // Don't force play greeting - TTS will be sent when call is ready
        console.log('Greeting stored, waiting for call connection...');
      }
    }
    
    // Start call timer
    startCallTimer(callId);
    
    // Join call room when card is created
    socket.emit('join-call', callId);

    // Add input field for real-time chat
    const chatInput = document.createElement('div');
    chatInput.className = 'chat-input';
    chatInput.innerHTML = `
      <div class="input-group">
        <input type="text" class="form-control" placeholder="Ketik pesan...">
        <button class="btn btn-primary send-message-btn">
          <i class="bi bi-send"></i>
        </button>
      </div>
    `;

    // Add event listener for send button
    const sendBtn = chatInput.querySelector('.send-message-btn');
    const input = chatInput.querySelector('input');

    sendBtn.addEventListener('click', () => sendMessage(callId, input));
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage(callId, input);
      }
    });

    // Insert chat input before end call button
    const callFooter = insertedCard.querySelector('.call-footer');
    callFooter.insertBefore(chatInput, callFooter.firstChild);
  }
  
  /**
   * Add a message to the chat UI
   * @param {Element} chatContainer - Chat container element
   * @param {string} sender - Message sender ('agent' or 'user')
   * @param {string} message - Message content
   */
  function addMessageToChatUI(chatContainer, sender, message) {
    if (!chatContainer) return;
    
    const template = sender === 'agent' ? agentMessageTemplate : userMessageTemplate;
    if (!template) return;
    
    // Clone the template
    const messageTemplate = template.content.cloneNode(true);
    const messageElement = messageTemplate.querySelector('.chat-message');
    
    // Format current time
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Fill in template placeholders
    const messageHtml = messageElement.outerHTML
      .replace('{message}', message)
      .replace('{time}', timeStr);
    
    // Insert the new message
    chatContainer.insertAdjacentHTML('beforeend', messageHtml);
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Play TTS for agent messages
    if (sender === 'agent') {
      playAgentMessage(message);
    }
  }
  
  /**
   * Start a timer for an active call
   * @param {string} callId - Call ID
   */
  function startCallTimer(callId) {
    if (callTimers.has(callId)) {
      clearInterval(callTimers.get(callId));
    }
    
    const callInfo = activeCalls.get(callId);
    if (!callInfo) return;
    
    const startTime = callInfo.startTime;
    const timerElement = document.querySelector(`.active-call-card[data-call-id="${callId}"] .call-timer`);
    
    if (!timerElement) return;
    
    const timer = setInterval(() => {
      const elapsed = Math.floor((new Date() - startTime) / 1000);
      const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const seconds = (elapsed % 60).toString().padStart(2, '0');
      timerElement.textContent = `${minutes}:${seconds}`;
    }, 1000);
    
    callTimers.set(callId, timer);
  }
  
  /**
   * End an active call
   * @param {string} callId - Call ID
   */
  function endCall(callId) {
    // Clear timer
    if (callTimers.has(callId)) {
      clearInterval(callTimers.get(callId));
      callTimers.delete(callId);
    }
    
    const callCard = document.querySelector(`.active-call-card[data-call-id="${callId}"]`);
    if (callCard) {
      // Update UI
      const statusBadge = callCard.querySelector('.status-badge');
      if (statusBadge) {
        statusBadge.textContent = 'Selesai';
        statusBadge.className = 'badge bg-secondary status-badge';
      }
      
      // Add end message
      const chatContainer = callCard.querySelector('.chat-container');
      addMessageToChatUI(chatContainer, 'agent', 'Panggilan berakhir. Terima kasih atas waktunya.');
      
      // Disable end call button
      const endCallBtn = callCard.querySelector('.end-call-btn');
      if (endCallBtn) {
        endCallBtn.disabled = true;
        endCallBtn.textContent = 'Panggilan Berakhir';
      }
      
      // Remove call card after delay
      setTimeout(() => {
        callCard.remove();
        activeCalls.delete(callId);
        
        // Check if there are no more active calls
        if (activeCallsContainer && activeCallsContainer.children.length === 0) {
          activeCallsContainer.innerHTML = '<p class="text-muted text-center">Tidak ada panggilan aktif</p>';
        }
      }, 3000);
    }
  }
  
  /**
   * Handle save agent configuration
   * @param {Event} e - Form submit event
   */
  async function handleSaveConfig(e) {
    e.preventDefault();
    
    const formData = new FormData(agentConfigForm);
    const configData = {
      configName: formData.get('configName'),
      agentRole: formData.get('agentRole'),
      greetingTemplate: formData.get('greetingTemplate'),
      aiModel: formData.get('aiModel'),
      knowledgeBase: formData.get('knowledgeBase')
    };
    
    try {
      // Aktifkan indikator loading pada tombol submit
      const submitButton = agentConfigForm.querySelector('button[type="submit"]');
      const originalText = submitButton.textContent;
      submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Menyimpan...';
      submitButton.disabled = true;
      
      const response = await fetch('/dashboard/voice-agent/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData)
      });
      
      // Periksa apakah respons tidak ok
      if (!response.ok) {
        let errorMessage = `Error ${response.status}: ${response.statusText}`;
        
        // Coba dapatkan informasi error dari respons
        try {
          const responseText = await response.text();
          
          // Coba parse sebagai JSON jika memungkinkan
          try {
            const errorData = JSON.parse(responseText);
            if (errorData.message) {
              errorMessage = errorData.message;
            }
          } catch (jsonError) {
            // Jika bukan JSON yang valid, gunakan text response sebagai fallback
            console.warn('Response is not valid JSON:', responseText);
            
            if (responseText.includes('<!DOCTYPE html>')) {
              // Ini adalah error halaman HTML dari server
              errorMessage = 'Server mengembalikan halaman HTML alih-alih JSON. Kemungkinan terjadi kesalahan server.';
            } else if (responseText) {
              errorMessage = responseText;
            }
          }
        } catch (textError) {
          console.error('Failed to read error response:', textError);
        }
        
        throw new Error(errorMessage);
      }
      
      // Parse JSON response
      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('Error parsing JSON response:', jsonError);
        throw new Error('Invalid JSON response from server');
      }
      
      // Reset tombol submit
      submitButton.innerHTML = originalText;
      submitButton.disabled = false;
      
      if (result.success) {
        showAlert('success', result.message);
        // Refresh page to show new config
        window.location.reload();
      } else {
        showAlert('error', result.message || 'Gagal menyimpan konfigurasi');
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
      
      // Pastikan tombol submit kembali normal
      const submitButton = agentConfigForm.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.textContent = 'Simpan Konfigurasi';
        submitButton.disabled = false;
      }
      
      showAlert('error', `Terjadi kesalahan saat menyimpan konfigurasi: ${error.message}`);
    }
  }
  
  /**
   * Fetch available AI models from OpenRouter API
   */
  async function fetchAvailableModels() {
    try {
      const response = await fetch('/dashboard/voice-agent/models');
      const result = await response.json();
      
      if (result.success && result.models) {
        updateModelsList(result.models);
        showAlert('success', 'Daftar model berhasil diperbarui');
      } else {
        showAlert('error', result.error || 'Gagal mendapatkan daftar model');
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      showAlert('error', 'Terjadi kesalahan saat mengambil daftar model');
    }
  }
  
  /**
   * Update models dropdown list
   * @param {Array} models - List of AI models
   */
  function updateModelsList(models) {
    const aiModelSelect = document.getElementById('aiModel');
    if (!aiModelSelect) return;
    
    // Store selected value
    const selectedValue = aiModelSelect.value;
    
    // Clear options
    aiModelSelect.innerHTML = '';
    
    // Add new options
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = `${model.name} ${model.type === 'free' ? '(Gratis)' : ''}`;
      aiModelSelect.appendChild(option);
    });
    
    // Try to restore selected value
    try {
      aiModelSelect.value = selectedValue;
    } catch (e) {
      // Jika sebelumnya nilai yang dipilih tidak ada dalam daftar baru
      if (aiModelSelect.options.length > 0) {
        aiModelSelect.selectedIndex = 0;
      }
    }
  }
  
  /**
   * Load a configuration to the config form
   * @param {string} configId - Configuration ID
   */
  async function loadConfigToForm(configId) {
    try {
      const response = await fetch(`/dashboard/voice-agent/config/${configId}`);
      const data = await response.json();
      
      if (data.success && data.config) {
        const config = data.config;
        
        // Update form fields
        document.getElementById('configName').value = config.name;
        document.getElementById('agentRole').value = config.role;
        document.getElementById('greetingTemplate').value = config.greeting_template;
        
        if (config.knowledge_base) {
          document.getElementById('knowledgeBase').value = config.knowledge_base;
        }
        
        // Try to select the model
        const aiModelSelect = document.getElementById('aiModel');
        if (aiModelSelect) {
          // Find option that matches the model id
          for (let i = 0; i < aiModelSelect.options.length; i++) {
            if (aiModelSelect.options[i].value === config.ai_model) {
              aiModelSelect.selectedIndex = i;
              break;
            }
          }
        }
        
        // Switch to the config tab
        const configTab = document.querySelector('#config-tab');
        if (configTab) {
          const tab = new bootstrap.Tab(configTab);
          tab.show();
        }
        
        showAlert('info', `Konfigurasi "${config.name}" dimuat ke form`);
      } else {
        showAlert('error', data.message || 'Gagal memuat konfigurasi');
      }
    } catch (error) {
      console.error('Error loading config:', error);
      showAlert('error', 'Gagal memuat konfigurasi');
    }
  }
  
  /**
   * Delete a configuration
   * @param {string} configId - Configuration ID
   */
  function deleteConfig(configId) {
    const configRow = document.querySelector(`.delete-config-btn[data-id="${configId}"]`).closest('tr');
    if (!configRow) return;
    
    const configName = configRow.cells[0].textContent.trim();
    
    if (confirm(`Yakin ingin menghapus konfigurasi "${configName}"?`)) {
      fetch(`/dashboard/voice-agent/config/${configId}`, {
        method: 'DELETE'
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Remove the row from the table
          configRow.remove();
          
          showAlert('success', data.message || `Konfigurasi "${configName}" berhasil dihapus`);
          
          // Check if table is now empty
          const configsTable = document.getElementById('configsTableBody');
          if (configsTable && configsTable.querySelector('tr') === null) {
            configsTable.innerHTML = `
              <tr>
                <td colspan="4" class="text-center">Belum ada konfigurasi tersimpan</td>
              </tr>
            `;
          }
        } else {
          showAlert('error', data.message || 'Gagal menghapus konfigurasi');
        }
      })
      .catch(error => {
        console.error('Error deleting configuration:', error);
        showAlert('error', 'Terjadi kesalahan saat menghapus konfigurasi');
      });
    }
  }
  
  /**
   * View conversation history
   * @param {string} callId - Call ID
   */
  async function viewConversation(callId) {
    try {
      const response = await fetch(`/dashboard/voice-agent/conversation/${callId}`);
      const data = await response.json();
      
      const conversationContainer = document.querySelector('#viewConversationModal .conversation-container');
      if (!conversationContainer) return;
      
      // Clear previous content
      conversationContainer.innerHTML = '';
      
      if (data.success && data.conversation && data.conversation.length > 0) {
        // Add messages to conversation container
        data.conversation.forEach(message => {
          let messageHTML;
          const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          if (message.sender_type === 'system') {
            messageHTML = `
              <div class="text-center my-3">
                <span class="badge bg-secondary">${message.message_text}</span>
                <small class="d-block text-muted mt-1">${time}</small>
              </div>
            `;
          } else {
            const template = message.sender_type === 'agent' ? agentMessageTemplate : userMessageTemplate;
            if (!template) return;
            
            const messageTemplate = template.content.cloneNode(true);
            const messageElement = messageTemplate.querySelector('.chat-message');
            
            messageHTML = messageElement.outerHTML
              .replace('{message}', message.message_text)
              .replace('{time}', time);
          }
          
          conversationContainer.insertAdjacentHTML('beforeend', messageHTML);
        });
      } else {
        // No conversation found or empty
        conversationContainer.innerHTML = '<p class="text-center text-muted">Tidak ada percakapan yang tersedia</p>';
      }
      
      // Show modal
      viewConversationModal.show();
    } catch (error) {
      console.error('Error fetching conversation:', error);
      showAlert('error', 'Terjadi kesalahan saat memuat percakapan');
    }
  }
  
  /**
   * Render active calls from the active calls map with improved conversation display
   */
  function renderActiveCalls() {
    if (!activeCallsContainer) {
      console.error('activeCallsContainer not found');
      return;
    }
    
    // Clear container
    activeCallsContainer.innerHTML = '';
    
    console.log('Rendering active calls, count:', activeCalls.size);
    
    if (activeCalls.size === 0) {
      activeCallsContainer.innerHTML = '<p class="text-muted text-center">Tidak ada panggilan aktif</p>';
      return;
    }
    
    // Add each active call
    activeCalls.forEach((callInfo, callId) => {
      // Clone the template
      const template = callTemplate.content.cloneNode(true);
      const callCard = template.querySelector('.active-call-card');
      
      // Set card data
      callCard.dataset.callId = callId;
      
      // Fill in template placeholders
      const cardHtml = callCard.outerHTML
        .replace('{callId}', callId)
        .replace('{name}', callInfo.contact.name)
        .replace('{phone}', callInfo.contact.phone);
      
      // Insert the new card
      activeCallsContainer.insertAdjacentHTML('beforeend', cardHtml);
      
      // Get the inserted card
      const insertedCard = document.querySelector(`.active-call-card[data-call-id="${callId}"]`);
      const chatContainer = insertedCard.querySelector('.chat-container');
      const statusBadge = insertedCard.querySelector('.status-badge');
      
      // Update status badge
      if (statusBadge) {
        let statusText = callInfo.status;
        let statusClass = 'badge bg-secondary status-badge';
        
        switch (callInfo.status) {
          case 'connecting':
          case 'initiated':
          case 'queued':
            statusText = 'Menghubungi...';
            statusClass = 'badge bg-warning status-badge';
            break;
          case 'ringing':
            statusText = 'Berdering';
            statusClass = 'badge bg-warning status-badge';
            break;
          case 'in-progress':
          case 'connected':
            statusText = 'Tersambung';
            statusClass = 'badge bg-success status-badge';
            break;
          case 'completed':
            statusText = 'Selesai';
            statusClass = 'badge bg-secondary status-badge';
            break;
          case 'failed':
            statusText = 'Gagal';
            statusClass = 'badge bg-danger status-badge';
            break;
        }
        
        statusBadge.textContent = statusText;
        statusBadge.className = statusClass;
      }
      
      // Add messages
      if (callInfo.messages && callInfo.messages.length > 0) {
        callInfo.messages.forEach(message => {
          const timeStr = new Date(message.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          const template = message.type === 'agent' ? agentMessageTemplate : userMessageTemplate;
          if (!template) return;
          
          const messageTemplate = template.content.cloneNode(true);
          const messageElement = messageTemplate.querySelector('.chat-message');
          
          const messageHtml = messageElement.outerHTML
            .replace('{message}', message.text)
            .replace('{time}', timeStr);
          
          chatContainer.insertAdjacentHTML('beforeend', messageHtml);
        });
        
        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
      
      // Add input field for real-time chat
      const chatInput = document.createElement('div');
      chatInput.className = 'chat-input mt-2';
      chatInput.innerHTML = `
        <div class="input-group">
          <input type="text" class="form-control" placeholder="Ketik pesan...">
          <button class="btn btn-primary send-message-btn">
            <i class="bi bi-send"></i>
          </button>
        </div>
      `;

      // Add event listener for send button
      const sendBtn = chatInput.querySelector('.send-message-btn');
      const input = chatInput.querySelector('input');

      sendBtn.addEventListener('click', () => sendMessage(callId, input));
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          sendMessage(callId, input);
        }
      });

      // Insert chat input before end call button
      const callFooter = insertedCard.querySelector('.call-footer');
      callFooter.insertBefore(chatInput, callFooter.firstChild);
      
      // Restart timer
      startCallTimer(callId);
    });
  }
  
  /**
   * Show alert message
   * @param {string} type - Alert type ('success', 'error', 'info', 'warning')
   * @param {string} message - Alert message
   */
  function showAlert(type, message) {
    // Map type to Bootstrap alert class
    const alertClass = {
      success: 'alert-success',
      error: 'alert-danger',
      info: 'alert-info',
      warning: 'alert-warning'
    }[type] || 'alert-info';
    
    // Create alert element
    const alertElement = document.createElement('div');
    alertElement.className = `alert ${alertClass} alert-dismissible fade show`;
    alertElement.setAttribute('role', 'alert');
    
    // Add icon based on type
    let icon = '';
    switch (type) {
      case 'success':
        icon = '<i class="bi bi-check-circle me-2"></i>';
        break;
      case 'error':
        icon = '<i class="bi bi-exclamation-circle me-2"></i>';
        break;
      case 'info':
        icon = '<i class="bi bi-info-circle me-2"></i>';
        break;
      case 'warning':
        icon = '<i class="bi bi-exclamation-triangle me-2"></i>';
        break;
    }
    
    alertElement.innerHTML = `
      ${icon}${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Insert alert at the top of the content area
    const contentArea = document.querySelector('.content-area') || document.querySelector('.voice-agent-content');
    if (contentArea) {
      contentArea.insertAdjacentElement('afterbegin', alertElement);
      
      // Auto-dismiss alert after 5 seconds
      setTimeout(() => {
        alertElement.classList.remove('show');
        setTimeout(() => alertElement.remove(), 300);
      }, 5000);
    } else {
      // Fallback to console if content area not found
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }

  /**
   * Periksa status panggilan dari server
   * @param {string} callId - ID panggilan
   * @returns {Promise<string>} Status panggilan
   */
  async function checkCallStatus(callId) {
    try {
      const response = await fetch(`/voice/call-status?callSid=${callId}`);
      if (!response.ok) {
        console.warn(`Gagal memeriksa status panggilan ${callId}`);
        return 'unknown';
      }
      const result = await response.json();
      return result.status || 'unknown';
    } catch (error) {
      console.error('Error memeriksa status panggilan:', error);
      return 'unknown';
    }
  }

  /**
   * Kirim TTS dengan penanganan error yang lebih baik
   * @param {string} callId - ID panggilan
   * @param {string} text - Teks untuk diubah menjadi suara
   * @returns {Promise<boolean>} Status keberhasilan
   */
  async function sendTtsRequest(callId, text, retryCount = 0) {
    if (!callId || !text) {
      console.error('[TTS] Missing required parameters:', { callId, text });
      return false;
    }
  
    const maxRetries = 3;
    const retryDelay = 2000;
  
    try {
      console.log(`[TTS] Sending request for call ${callId} (attempt ${retryCount + 1}): "${text}"`);
      
      const response = await fetch('/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callSid: callId,
          message: text,
          retryCount
        })
      });
  
      const result = await response.json();
      
      if (response.status === 202) {
        console.log(`[TTS] Call ${callId} not ready, will retry after delay`);
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return sendTtsRequest(callId, text, retryCount + 1);
        }
        return false;
      }
  
      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }
  
      if (result.success) {
        console.log(`[TTS] Successfully sent to call ${callId}`);
        return true;
      }
  
      if (result.retryAfter && retryCount < maxRetries) {
        console.log(`[TTS] Need to retry for call ${callId} after ${result.retryAfter}ms`);
        await new Promise(resolve => setTimeout(resolve, result.retryAfter));
        return sendTtsRequest(callId, text, retryCount + 1);
      }
  
      return false;
    } catch (error) {
      console.error(`[TTS] Error for call ${callId}:`, error);
      
      if (retryCount < maxRetries) {
        console.log(`[TTS] Will retry for call ${callId} after ${retryDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return sendTtsRequest(callId, text, retryCount + 1);
      }
      
      showAlert('error', `Failed to send voice message: ${error.message}`);
      return false;
    }
  }

  /**
   * Play agent message using Twilio TTS
   * @param {string} text - Text to be spoken
   */
  async function playAgentMessage(text) {
    const activeCallsCards = document.querySelectorAll('.active-call-card');
    if (!activeCallsCards || activeCallsCards.length === 0) return;

    for (const card of activeCallsCards) {
      const callId = card.dataset.callId;
      const statusBadge = card.querySelector('.status-badge');
      
      // Skip if call is not active
      if (statusBadge && statusBadge.textContent === 'Selesai') continue;

      try {
        console.log(`[TTS] Sending Twilio TTS to call ${callId}: "${text}"`);
        const success = await sendTtsRequest(callId, text);
        
        if (!success) {
          console.log('[TTS] Message will be delivered later when call is connected');
        }
        
        break; // Kirim ke satu panggilan saja
      } catch (error) {
        console.error('[TTS] Error sending Twilio TTS:', error);
        showAlert('error', `Failed to send voice message: ${error.message}`);
      }
    }
  }
});

/**
 * Send a message to the server
 * @param {string} callId - Call ID
 * @param {HTMLInputElement} inputElement - Input element containing the message
 */
async function sendMessage(callId, inputElement) {
  const message = inputElement.value.trim();
  if (!message) return;

  // Clear input
  inputElement.value = '';

  // Emit message to server
  socket.emit('agent-message', {
    callId,
    message
  });
}

// Fungsi baru untuk menangani greeting tertunda
function handlePendingGreeting(callId) {
  const callInfo = activeCalls.get(callId);
  
  if (callInfo && callInfo.pendingGreeting) {
    console.log(`Mencoba memainkan greeting tertunda untuk panggilan ${callId}`);
    
    // Coba mainkan greeting
    playGreetingOnCallConnect(callId, callInfo.pendingGreeting)
      .then(success => {
        if (success) {
          // Hapus greeting tertunda jika berhasil
          delete callInfo.pendingGreeting;
          activeCalls.set(callId, callInfo);
        }
      });
  }
}

// Modifikasi fungsi yang mengatur status panggilan untuk memanggil handlePendingGreeting
function updateCallStatus(callId, newStatus) {
  const callInfo = activeCalls.get(callId);
  
  if (callInfo) {
    // Update status
    callInfo.status = newStatus;
    activeCalls.set(callId, callInfo);
    
    // Jika status berubah menjadi in-progress, coba mainkan greeting tertunda
    if (newStatus === 'in-progress') {
      handlePendingGreeting(callId);
    }
  }
}

/**
 * Handle pending greeting with better status checks
 */
function handlePendingGreeting(callId) {
  const callInfo = activeCalls.get(callId);
  
  if (callInfo && callInfo.pendingGreeting) {
    console.log(`[Greeting] Attempting to play pending greeting for call ${callId}`);
    
    // Check call status before attempting to play
    checkCallStatus(callId).then(status => {
      if (status === 'in-progress') {
        console.log(`[Greeting] Call ${callId} is ready, playing greeting`);
        playGreetingOnCallConnect(callId, callInfo.pendingGreeting)
          .then(success => {
            if (success) {
              console.log(`[Greeting] Successfully played greeting for ${callId}`);
              delete callInfo.pendingGreeting;
              activeCalls.set(callId, callInfo);
            } else {
              console.warn(`[Greeting] Failed to play greeting for ${callId}, will retry on next status update`);
            }
          })
          .catch(error => {
            console.error(`[Greeting] Error playing greeting for ${callId}:`, error);
          });
      } else {
        console.log(`[Greeting] Call ${callId} not ready yet (${status}), keeping pending greeting`);
      }
    });
  }
}

/**
 * Update call status with improved state management
 */
function updateCallStatus(callId, newStatus, previousStatus) {
  console.log(`[Status] Updating call ${callId} status: ${previousStatus} -> ${newStatus}`);
  
  const callInfo = activeCalls.get(callId);
  if (!callInfo) {
    console.warn(`[Status] No active call info found for ${callId}`);
    return;
  }

  // Update status
  callInfo.status = newStatus;
  activeCalls.set(callId, callInfo);

  // Update UI
  const statusBadge = document.querySelector(`.active-call-card[data-call-id="${callId}"] .status-badge`);
  if (statusBadge) {
    let statusText = newStatus;
    let statusClass = 'badge bg-secondary status-badge';

    switch (newStatus) {
      case 'in-progress':
        statusText = 'Tersambung';
        statusClass = 'badge bg-success status-badge';
        break;
      case 'ringing':
        statusText = 'Berdering';
        statusClass = 'badge bg-warning status-badge';
        break;
      case 'queued':
        statusText = 'Dalam Antrian';
        statusClass = 'badge bg-info status-badge';
        break;
      case 'completed':
        statusText = 'Selesai';
        statusClass = 'badge bg-secondary status-badge';
        break;
      case 'failed':
        statusText = 'Gagal';
        statusClass = 'badge bg-danger status-badge';
        break;
    }

    statusBadge.textContent = statusText;
    statusBadge.className = statusClass;
  }

  // Handle status-specific actions
  if (newStatus === 'in-progress' && previousStatus !== 'in-progress') {
    handlePendingGreeting(callId);
  } else if (['completed', 'failed', 'busy', 'no-answer'].includes(newStatus)) {
    setTimeout(() => endCall(callId), 1000);
  }
}

/**
 * Send TTS with improved error handling and retry logic
 */
async function sendTtsRequest(callId, text, retryCount = 0) {
  if (!callId || !text) {
    console.error('[TTS] Missing required parameters:', { callId, text });
    return false;
  }

  const maxRetries = 3;
  const retryDelay = 2000;

  try {
    console.log(`[TTS] Sending request for call ${callId} (attempt ${retryCount + 1}): "${text}"`);
    
    // Show pending indicator in UI
    const callCard = document.querySelector(`.active-call-card[data-call-id="${callId}"]`);
    const statusBadge = callCard?.querySelector('.status-badge');
    const originalStatus = statusBadge?.textContent || '';
    
    if (statusBadge) {
      statusBadge.innerHTML = '<i class="bi bi-hourglass-split"></i> Mengirim...';
    }

    const response = await fetch('/voice/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callSid: callId,
        message: text,
        retryCount
      })
    });

    // Restore original status
    if (statusBadge) {
      statusBadge.textContent = originalStatus;
    }

    if (!response.ok && response.status !== 202) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    // Handle 202 Accepted (message queued)
    if (response.status === 202) {
      console.log(`[TTS] Message queued for ${callId}, status: ${result.status}`);
      
      // Add message to UI as pending
      if (callCard) {
        const chatContainer = callCard.querySelector('.chat-container');
        if (chatContainer) {
          addMessageToChatUI(chatContainer, 'agent', text + ' (Menunggu...)');
        }
      }

      // If should retry
      if (result.retryAfter && retryCount < maxRetries) {
        console.log(`[TTS] Server suggested retry after ${result.retryAfter}ms`);
        await new Promise(resolve => setTimeout(resolve, result.retryAfter));
        return sendTtsRequest(callId, text, retryCount + 1);
      }

      // Even if we won't retry, consider it a success since the message is queued
      return true;
    }

    if (result.success) {
      console.log(`[TTS] Successfully processed request for call ${callId}`);
      // Update any pending message indicators
      if (callCard) {
        const pendingMsg = callCard.querySelector('.chat-message.pending');
        if (pendingMsg) {
          pendingMsg.classList.remove('pending');
        }
      }
      return true;
    }

    throw new Error(result.message || 'TTS request failed');

  } catch (error) {
    console.error(`[TTS] Error for ${callId}:`, error);
    
    if (retryCount < maxRetries) {
      console.log(`[TTS] Will retry after ${retryDelay}ms`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return sendTtsRequest(callId, text, retryCount + 1);
    }
    
    // Don't show error for expected conditions
    if (!error.message.includes('tidak valid') && !error.message.includes('queued')) {
      showAlert('error', `Gagal mengirim pesan suara: ${error.message}`);
    }
    
    return false;
  }
}
