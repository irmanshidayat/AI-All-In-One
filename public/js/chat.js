// Chat interface functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize chat UI elements
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    const settingsBtn = document.getElementById('settings-btn');
    const chatConfig = document.getElementById('chat-config');
    const saveConfigBtn = document.getElementById('save-config-btn');

    let currentDiscussion = {
        role: 'dosen',
        knowledgeBase: 'skripsi',
        context: ''
    };

    // Handle settings button click
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            chatConfig.classList.toggle('d-none');
        });
    }

    // Handle config save
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', () => {
            const role = document.getElementById('ai-role').value;
            const knowledgeBase = document.getElementById('knowledge-base').value;
            
            currentDiscussion = {
                ...currentDiscussion,
                role,
                knowledgeBase
            };

            chatConfig.classList.add('d-none');
            addSystemMessage(`Pengaturan disimpan. Saya sekarang berperan sebagai ${role} dengan fokus pada ${knowledgeBase}.`);
        });
    }

    // Handle chat form submission
    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const message = chatInput.value.trim();
            if (!message) return;

            // Clear input
            chatInput.value = '';

            // Add user message to chat
            addMessageToChat('user', message);

            // Show typing indicator
            showTypingIndicator();

            try {
                const response = await fetch('/dashboard/skripsi/api/consult', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message,
                        role: currentDiscussion.role,
                        knowledgeBase: currentDiscussion.knowledgeBase,
                        context: currentDiscussion.context
                    })
                });

                const result = await response.json();

                // Remove typing indicator
                hideTypingIndicator();

                if (result.success) {
                    // Add AI response to chat
                    addMessageToChat('ai', result.data);
                    
                    // Update context
                    currentDiscussion.context += `\nUser: ${message}\nAI: ${result.data}`;
                } else {
                    addErrorMessage('Maaf, terjadi kesalahan dalam memproses pesan Anda.');
                }
            } catch (error) {
                console.error('Chat error:', error);
                hideTypingIndicator();
                addErrorMessage('Terjadi kesalahan teknis. Silakan coba lagi.');
            }
        });
    }

    // Handle textarea auto-resize and Enter key
    if (chatInput) {
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = chatInput.scrollHeight + 'px';
        });

        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                chatForm.dispatchEvent(new Event('submit'));
            }
        });
    }

    // Helper functions
    function addMessageToChat(sender, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const formattedContent = sender === 'ai' ? formatAIResponse(content) : content;
        
        messageDiv.innerHTML = `
            <div class="message-content">
                ${formattedContent}
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addSystemMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system-message';
        messageDiv.innerHTML = `
            <div class="message-content text-muted">
                <i class="bi bi-info-circle me-2"></i>${content}
            </div>
        `;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addErrorMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message error-message';
        messageDiv.innerHTML = `
            <div class="message-content text-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>${content}
            </div>
        `;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function showTypingIndicator() {
        const indicatorDiv = document.createElement('div');
        indicatorDiv.className = 'message ai-message thinking';
        indicatorDiv.id = 'typing-indicator';
        indicatorDiv.innerHTML = `
            <div class="message-content">
                <div class="thinking">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
            </div>
        `;
        chatMessages.appendChild(indicatorDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    function formatAIResponse(text) {
        return text
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>');
    }
});