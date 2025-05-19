// Client-side JavaScript for Chatbot Dadan AI

// Auto-close alert messages after 5 seconds
document.addEventListener('DOMContentLoaded', function() {
  // Get all alert elements
  const alerts = document.querySelectorAll('.alert');
  
  // Set timeout to automatically close alerts
  alerts.forEach(function(alert) {
    setTimeout(function() {
      const bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    }, 5000);
  });

  // Add event listeners for dashboard buttons
  const newChatButton = document.querySelector('.btn-primary:not(.pulse-on-hover)');
  const viewHistoryButton = document.querySelector('.btn-outline-primary:nth-of-type(1)');
  const chatSettingsButton = document.querySelector('.btn-outline-primary:nth-of-type(2)');
  
  // Mulai Percakapan Baru button
  if (newChatButton) {
    newChatButton.addEventListener('click', function() {
      // Show modal for starting a new conversation
      const startChatModal = new bootstrap.Modal(document.getElementById('startChatModal'));
      startChatModal.show();
    });
  }
  
  // Lihat Riwayat Percakapan button
  if (viewHistoryButton) {
    viewHistoryButton.addEventListener('click', function() {
      // Redirect to conversations page or show history in a modal
      window.location.href = '/dashboard/conversations';
    });
  }
  
  // Pengaturan Chatbot button
  if (chatSettingsButton) {
    chatSettingsButton.addEventListener('click', function() {
      // Show settings modal
      const settingsModal = new bootstrap.Modal(document.getElementById('chatSettingsModal'));
      settingsModal.show();
    });
  }
  
  // Handle Start Chat button click in modal
  const startChatBtn = document.getElementById('startChatBtn');
  if (startChatBtn) {
    startChatBtn.addEventListener('click', function() {
      const customerName = document.getElementById('customerName').value;
      const initialQuestion = document.getElementById('initialQuestion').value;
      const chatbotType = document.getElementById('chatbotType').value;
      
      if (!customerName) {
        showAlert('warning', 'Silakan masukkan nama pelanggan');
        return;
      }
      
      // Here we would normally submit to the server via AJAX
      // For now, just show a success message and hide the modal
      showAlert('success', `Percakapan dengan ${customerName} telah dimulai!`);
      
      // Hide the modal
      const startChatModal = bootstrap.Modal.getInstance(document.getElementById('startChatModal'));
      startChatModal.hide();
      
      // In a real implementation, we would redirect to the chat interface
      // window.location.href = `/dashboard/chat?customer=${encodeURIComponent(customerName)}&type=${chatbotType}`;
      
      // For this demo, we'll create a simulated chat interface in the dashboard
      simulateChat(customerName, initialQuestion, chatbotType);
    });
  }
  
  // Handle temperature slider in settings modal
  const temperatureSlider = document.getElementById('temperature');
  if (temperatureSlider) {
    temperatureSlider.addEventListener('input', function() {
      document.getElementById('tempValue').textContent = this.value;
    });
  }
  
  // Handle Save Settings button click
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', function() {
      // Get values from all three forms
      const generalSettings = {
        botName: document.getElementById('botName').value,
        welcomeMessage: document.getElementById('welcomeMessage').value,
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        operateAllDay: document.getElementById('operateAllDaySwitch').checked,
        transferToHuman: document.getElementById('transferToHumanSwitch').checked
      };
      
      const aiSettings = {
        aiModel: document.getElementById('aiModel').value,
        contextSize: document.getElementById('contextSize').value,
        temperature: document.getElementById('temperature').value,
        knowledgeBase: document.getElementById('knowledgeBase').value
      };
      
      const templateSettings = {
        greetingTemplate: document.getElementById('greetingTemplate').value,
        transferTemplate: document.getElementById('transferTemplate').value,
        endTemplate: document.getElementById('endTemplate').value,
        feedbackTemplate: document.getElementById('feedbackTemplate').value
      };
      
      // Here we would normally submit to the server via AJAX
      console.log('Settings saved:', { generalSettings, aiSettings, templateSettings });
      
      // Show success message and hide modal
      showAlert('success', 'Pengaturan chatbot berhasil disimpan!');
      
      // Hide the modal
      const settingsModal = bootstrap.Modal.getInstance(document.getElementById('chatSettingsModal'));
      settingsModal.hide();
    });
  }
  
  // Helper function to show alerts
  function showAlert(type, message) {
    // Map type to Bootstrap alert class
    const alertClass = {
      success: 'alert-success',
      warning: 'alert-warning',
      danger: 'alert-danger',
      info: 'alert-info'
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
      case 'warning':
        icon = '<i class="bi bi-exclamation-triangle me-2"></i>';
        break;
      case 'danger':
        icon = '<i class="bi bi-exclamation-circle me-2"></i>';
        break;
      case 'info':
      default:
        icon = '<i class="bi bi-info-circle me-2"></i>';
        break;
    }
    
    alertElement.innerHTML = `
      ${icon}${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Insert alert at the top of the content area
    const contentArea = document.querySelector('.content-area') || document.querySelector('.container');
    if (contentArea) {
      contentArea.insertAdjacentElement('afterbegin', alertElement);
      
      // Auto-dismiss alert after 5 seconds
      setTimeout(() => {
        alertElement.classList.remove('show');
        setTimeout(() => alertElement.remove(), 300);
      }, 5000);
    }
  }
  
  // Simulated chat function for demo purposes
  function simulateChat(customerName, initialQuestion, chatbotType) {
    // Create chat container if it doesn't exist
    let chatContainer = document.getElementById('chatSimulation');
    
    if (!chatContainer) {
      // Create a new chat simulation area
      chatContainer = document.createElement('div');
      chatContainer.id = 'chatSimulation';
      chatContainer.className = 'card shadow mb-4';
      
      const chatHeader = document.createElement('div');
      chatHeader.className = 'card-header bg-primary text-white d-flex justify-content-between align-items-center';
      chatHeader.innerHTML = `
        <h5 class="mb-0">Chat dengan ${customerName}</h5>
        <button type="button" class="btn-close btn-close-white" id="closeChat" aria-label="Close"></button>
      `;
      
      const chatBody = document.createElement('div');
      chatBody.className = 'card-body chat-body';
      chatBody.style.maxHeight = '400px';
      chatBody.style.overflowY = 'auto';
      
      const chatFooter = document.createElement('div');
      chatFooter.className = 'card-footer';
      chatFooter.innerHTML = `
        <div class="input-group">
          <input type="text" class="form-control" id="chatMessage" placeholder="Ketik pesan...">
          <button class="btn btn-primary" id="sendMessage" type="button">
            <i class="bi bi-send"></i>
          </button>
        </div>
      `;
      
      chatContainer.appendChild(chatHeader);
      chatContainer.appendChild(chatBody);
      chatContainer.appendChild(chatFooter);
      
      // Add to page
      document.querySelector('.container').insertAdjacentElement('afterbegin', chatContainer);
      
      // Add event listener for close button
      document.getElementById('closeChat').addEventListener('click', function() {
        chatContainer.remove();
      });
      
      // Add event listener for send message button
      document.getElementById('sendMessage').addEventListener('click', sendUserMessage);
      
      // Add event listener for Enter key in message input
      document.getElementById('chatMessage').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
          sendUserMessage();
        }
      });
      
      // Function to send user message
      function sendUserMessage() {
        const messageInput = document.getElementById('chatMessage');
        const message = messageInput.value.trim();
        
        if (message) {
          // Add user message to chat
          addMessageToChat('user', message);
          
          // Clear input
          messageInput.value = '';
          
          // Simulate bot response after a delay
          setTimeout(() => {
            const responses = [
              `Terima kasih atas pertanyaannya. Sebagai ${getBotType(chatbotType)}, saya siap membantu Anda.`,
              'Mohon tunggu sebentar sementara saya mencari informasi untuk Anda.',
              'Apakah ada hal lain yang bisa saya bantu?',
              'Jangan ragu untuk bertanya lebih lanjut jika informasinya kurang jelas.'
            ];
            
            // Select a random response
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            addMessageToChat('bot', randomResponse);
          }, 1000);
        }
      }
      
      // Function to get bot type description
      function getBotType(type) {
        switch (type) {
          case 'support':
            return 'chatbot customer support';
          case 'sales':
            return 'chatbot sales';
          case 'information':
            return 'chatbot informasi';
          default:
            return 'chatbot';
        }
      }
      
      // Initial bot greeting
      setTimeout(() => {
        addMessageToChat('bot', `Halo ${customerName}! Ada yang bisa saya bantu hari ini?`);
      }, 500);
      
      // Add initial question if provided
      if (initialQuestion && initialQuestion.trim()) {
        setTimeout(() => {
          addMessageToChat('user', initialQuestion);
        }, 1000);
        
        // Simulate bot response to initial question
        setTimeout(() => {
          addMessageToChat('bot', 'Terima kasih atas pertanyaan Anda. Saya akan bantu menjawabnya sebaik mungkin.');
        }, 2000);
      }
    }
  }
  
  // Helper function to add message to chat
  function addMessageToChat(sender, message) {
    const chatBody = document.querySelector('.chat-body');
    if (!chatBody) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${sender === 'user' ? 'user-message' : 'bot-message'}`;
    
    // Format current time
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageElement.innerHTML = `
      <div class="message-content">${message}</div>
      <div class="message-time">${timeStr}</div>
    `;
    
    chatBody.appendChild(messageElement);
    
    // Scroll to bottom
    chatBody.scrollTop = chatBody.scrollHeight;
  }
});