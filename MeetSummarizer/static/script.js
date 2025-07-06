class TranscriptionApp {
    constructor() {
        this.socket = null;
        this.transcriptData = [];
        this.isConnected = false;
        this.recognition = null;
        this.isListening = false;
        this.finalTranscript = '';
        this.interimTranscript = '';
        
        this.initializeSocket();
        this.initializeEventListeners();
        this.initializeVoiceRecognition();
        this.updateConnectionStatus('connecting');
    }
    
    initializeSocket() {
        try {
            // Try to connect to Socket.IO
            if (typeof io !== 'undefined') {
                this.socket = io();
                
                this.socket.on('connect', () => {
                    console.log('Connected to server');
                    this.isConnected = true;
                    this.updateConnectionStatus('connected');
                    this.showNotification('Connected to server', 'success');
                    
                    // Request current data
                    this.socket.emit('request_update');
                });
                
                this.socket.on('disconnect', () => {
                    console.log('Disconnected from server');
                    this.isConnected = false;
                    this.updateConnectionStatus('disconnected');
                    this.showNotification('Disconnected from server', 'warning');
                });
                
                this.socket.on('transcript_update', (data) => {
                    console.log('Received transcript update:', data);
                    this.handleTranscriptUpdate(data);
                });
                
                this.socket.on('summary_update', (data) => {
                    console.log('Received summary update:', data);
                    this.handleSummaryUpdate(data);
                });
                
                this.socket.on('connect_error', (error) => {
                    console.error('Connection error:', error);
                    this.updateConnectionStatus('error');
                    this.showNotification('WebSocket not available, using polling mode', 'warning');
                    this.startPolling();
                });
                
            } else {
                console.log('Socket.IO not available, starting polling mode');
                this.updateConnectionStatus('polling');
                this.showNotification('Using polling mode (WebSocket unavailable)', 'info');
                this.startPolling();
            }
            
        } catch (error) {
            console.error('Error initializing socket:', error);
            this.updateConnectionStatus('error');
            this.startPolling();
        }
    }
    
    initializeEventListeners() {
        // Test form submission
        const testForm = document.getElementById('testForm');
        testForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitTestMessage();
        });
        
        // Clear button
        const clearBtn = document.getElementById('clearBtn');
        clearBtn.addEventListener('click', () => {
            this.clearTranscript();
        });
        
        // Voice input button
        const startVoiceBtn = document.getElementById('startVoiceBtn');
        startVoiceBtn.addEventListener('click', () => {
            this.toggleVoiceRecognition();
        });
        
        // Auto-focus on message input after adding
        const messageInput = document.getElementById('messageText');
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                testForm.dispatchEvent(new Event('submit'));
            }
        });
    }
    
    submitTestMessage() {
        const speakerName = document.getElementById('speakerName').value.trim();
        const messageText = document.getElementById('messageText').value.trim();
        
        if (!speakerName || !messageText) {
            this.showNotification('Please fill in both speaker name and message', 'warning');
            return;
        }
        
        const data = {
            speaker_name: speakerName,
            text: messageText
        };
        
        fetch('/transcribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                // Clear message field but keep speaker name
                document.getElementById('messageText').value = '';
                document.getElementById('messageText').focus();
                this.showNotification('Message added successfully', 'success');
            } else {
                this.showNotification('Error adding message: ' + result.error, 'danger');
            }
        })
        .catch(error => {
            console.error('Error submitting message:', error);
            this.showNotification('Error submitting message', 'danger');
        });
    }
    
    clearTranscript() {
        if (this.transcriptData.length === 0) {
            this.showNotification('Transcript is already empty', 'info');
            return;
        }
        
        if (confirm('Are you sure you want to clear the entire transcript?')) {
            fetch('/clear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    this.showNotification('Transcript cleared successfully', 'success');
                } else {
                    this.showNotification('Error clearing transcript', 'danger');
                }
            })
            .catch(error => {
                console.error('Error clearing transcript:', error);
                this.showNotification('Error clearing transcript', 'danger');
            });
        }
    }
    
    handleTranscriptUpdate(data) {
        if (data.transcript) {
            this.transcriptData = data.transcript;
            this.renderTranscript();
        }
        
        if (data.new_entry) {
            this.scrollToBottom();
        }
    }
    
    handleSummaryUpdate(data) {
        const summaryContent = document.getElementById('summaryContent');
        const summaryLoading = document.getElementById('summaryLoading');
        
        // Hide loading spinner
        summaryLoading.style.display = 'none';
        
        if (data.summary) {
            summaryContent.innerHTML = `
                <div class="summary-text">
                    <p class="mb-0">${this.escapeHtml(data.summary)}</p>
                </div>
                <div class="summary-meta mt-2">
                    <small class="text-muted">
                        <i class="fas fa-clock me-1"></i>
                        Updated: ${new Date().toLocaleTimeString()}
                    </small>
                </div>
            `;
        } else {
            summaryContent.innerHTML = `
                <div class="empty-state text-center py-4">
                    <i class="fas fa-robot fa-2x text-muted mb-3"></i>
                    <p class="text-muted small">
                        AI summary will appear here once there's enough content to analyze...
                    </p>
                </div>
            `;
        }
    }
    
    scrollToBottom() {
        const transcriptContainer = document.getElementById('transcriptContainer');
        setTimeout(() => {
            transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
        }, 100);
    }
    
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        
        switch (status) {
            case 'connected':
                statusElement.innerHTML = '<i class="fas fa-circle me-1"></i>Connected';
                statusElement.className = 'badge bg-success';
                break;
            case 'connecting':
                statusElement.innerHTML = '<i class="fas fa-circle me-1"></i>Connecting...';
                statusElement.className = 'badge bg-warning';
                break;
            case 'polling':
                statusElement.innerHTML = '<i class="fas fa-sync-alt me-1"></i>Polling';
                statusElement.className = 'badge bg-info';
                break;
            case 'disconnected':
                statusElement.innerHTML = '<i class="fas fa-circle me-1"></i>Disconnected';
                statusElement.className = 'badge bg-danger';
                break;
            case 'error':
                statusElement.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i>Error';
                statusElement.className = 'badge bg-danger';
                break;
        }
    }
    
    showNotification(message, type = 'info') {
        const toast = document.getElementById('notificationToast');
        const toastBody = toast.querySelector('.toast-body');
        const toastHeader = toast.querySelector('.toast-header');
        
        // Update toast content
        toastBody.textContent = message;
        
        // Update toast icon based on type
        const icon = toastHeader.querySelector('i');
        icon.className = `fas me-2 ${this.getIconClass(type)}`;
        
        // Show toast
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    }
    
    getIconClass(type) {
        switch (type) {
            case 'success':
                return 'fa-check-circle text-success';
            case 'warning':
                return 'fa-exclamation-triangle text-warning';
            case 'danger':
                return 'fa-exclamation-circle text-danger';
            default:
                return 'fa-info-circle text-primary';
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    startPolling() {
        // Poll for updates every 3 seconds
        this.pollInterval = setInterval(() => {
            this.fetchTranscriptData();
        }, 3000);
        
        // Initial fetch
        this.fetchTranscriptData();
    }
    
    async fetchTranscriptData() {
        try {
            const response = await fetch('/transcript');
            const data = await response.json();
            
            if (data.transcript) {
                this.handleTranscriptUpdate({ transcript: data.transcript });
            }
            
            if (data.summary) {
                this.handleSummaryUpdate({ summary: data.summary });
            }
            
            if (!this.isConnected) {
                this.updateConnectionStatus('polling');
            }
            
        } catch (error) {
            console.error('Error fetching transcript data:', error);
            this.updateConnectionStatus('error');
        }
    }
    
    initializeVoiceRecognition() {
        // Check if browser supports Web Speech API
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Web Speech API not supported in this browser');
            document.getElementById('startVoiceBtn').disabled = true;
            document.getElementById('startVoiceBtn').innerHTML = '<i class="fas fa-microphone-slash me-1"></i>Not Supported';
            return;
        }
        
        // Create recognition instance
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        // Configure recognition
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;
        
        // Event handlers
        this.recognition.onstart = () => {
            console.log('Voice recognition started');
            this.isListening = true;
            this.updateVoiceStatus('listening');
            this.updateVoiceButton();
            this.addVisualListeningFeedback();
        };
        
        this.recognition.onend = () => {
            console.log('Voice recognition ended');
            this.isListening = false;
            this.updateVoiceStatus('ready');
            this.updateVoiceButton();
            this.removeVisualListeningFeedback();
        };
        
        this.recognition.onerror = (event) => {
            console.error('Voice recognition error:', event.error);
            this.isListening = false;
            this.updateVoiceStatus('error');
            this.updateVoiceButton();
            this.showNotification(`Speech recognition error: ${event.error}`, 'danger');
        };
        
        this.recognition.onresult = (event) => {
            this.finalTranscript = '';
            this.interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    this.finalTranscript += transcript + ' ';
                } else {
                    this.interimTranscript += transcript;
                }
            }
            
            // Update live transcript display
            this.updateLiveTranscript();
            
            // Send final transcript to server
            if (this.finalTranscript.trim()) {
                this.sendVoiceTranscription(this.finalTranscript.trim());
                this.finalTranscript = '';
            }
        };
    }
    
    toggleVoiceRecognition() {
        if (!this.recognition) {
            this.showNotification('Voice recognition not available', 'warning');
            return;
        }
        
        if (this.isListening) {
            this.recognition.stop();
        } else {
            try {
                this.recognition.start();
            } catch (error) {
                console.error('Error starting voice recognition:', error);
                this.showNotification('Error starting voice recognition', 'danger');
            }
        }
    }
    
    updateVoiceStatus(status) {
        const statusElement = document.getElementById('voiceStatus');
        
        switch (status) {
            case 'listening':
                statusElement.innerHTML = '<i class="fas fa-microphone me-1"></i>Listening...';
                statusElement.className = 'badge bg-success';
                break;
            case 'processing':
                statusElement.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Processing...';
                statusElement.className = 'badge bg-info';
                break;
            case 'error':
                statusElement.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i>Error';
                statusElement.className = 'badge bg-danger';
                break;
            default:
                statusElement.innerHTML = '<i class="fas fa-microphone-slash me-1"></i>Ready';
                statusElement.className = 'badge bg-secondary';
        }
    }
    
    updateVoiceButton() {
        const button = document.getElementById('startVoiceBtn');
        
        if (this.isListening) {
            button.innerHTML = '<i class="fas fa-stop me-1"></i>Stop Speaking';
            button.className = 'btn btn-danger w-100';
        } else {
            button.innerHTML = '<i class="fas fa-microphone me-1"></i>Start Speaking';
            button.className = 'btn btn-success w-100';
        }
    }
    
    updateLiveTranscript() {
        const liveTranscriptElement = document.getElementById('liveTranscript');
        const displayText = this.finalTranscript + this.interimTranscript;
        
        if (displayText.trim()) {
            liveTranscriptElement.innerHTML = this.escapeHtml(displayText);
        } else {
            liveTranscriptElement.innerHTML = '<em class="text-muted">Your speech will appear here in real-time...</em>';
        }
    }
    
    async sendVoiceTranscription(text) {
        const speakerName = document.getElementById('voiceSpeakerName').value.trim() || 'You';
        
        if (!text.trim()) {
            return;
        }
        
        const data = {
            speaker_name: speakerName,
            text: text
        };
        
        try {
            const response = await fetch('/transcribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('Voice transcription sent successfully');
                this.updateVoiceStatus('processing');
                setTimeout(() => {
                    if (!this.isListening) {
                        this.updateVoiceStatus('ready');
                    }
                }, 1000);
            } else {
                console.error('Error sending voice transcription:', result.error);
                this.showNotification('Error sending voice transcription: ' + result.error, 'danger');
            }
        } catch (error) {
            console.error('Error sending voice transcription:', error);
            this.showNotification('Error sending voice transcription', 'danger');
        }
    }
    
    addVisualListeningFeedback() {
        const liveTranscriptElement = document.getElementById('liveTranscript');
        const voiceButton = document.getElementById('startVoiceBtn');
        const voiceStatus = document.getElementById('voiceStatus');
        
        // Add visual classes for listening state
        liveTranscriptElement.classList.add('listening');
        voiceButton.classList.add('voice-button-recording');
        voiceStatus.classList.add('voice-status-listening');
        
        // Update live transcript placeholder
        liveTranscriptElement.innerHTML = '<em class="text-success">🎤 Listening... Start speaking now</em>';
    }
    
    removeVisualListeningFeedback() {
        const liveTranscriptElement = document.getElementById('liveTranscript');
        const voiceButton = document.getElementById('startVoiceBtn');
        const voiceStatus = document.getElementById('voiceStatus');
        
        // Remove visual classes
        liveTranscriptElement.classList.remove('listening');
        voiceButton.classList.remove('voice-button-recording');
        voiceStatus.classList.remove('voice-status-listening');
        
        // Reset live transcript if empty
        if (!this.finalTranscript && !this.interimTranscript) {
            liveTranscriptElement.innerHTML = '<em class="text-muted">Your speech will appear here in real-time...</em>';
        }
    }
    
    // Enhanced transcript rendering with voice entry detection
    renderTranscript() {
        const transcriptList = document.getElementById('transcriptList');
        const emptyState = document.getElementById('emptyState');
        const transcriptCount = document.getElementById('transcriptCount');
        
        // Update count
        transcriptCount.textContent = this.transcriptData.length;
        
        if (this.transcriptData.length === 0) {
            emptyState.style.display = 'block';
            transcriptList.innerHTML = '';
            return;
        }
        
        emptyState.style.display = 'none';
        
        const transcriptHtml = this.transcriptData.map(entry => {
            const timestamp = new Date(entry.timestamp).toLocaleTimeString();
            const voiceSpeakerName = document.getElementById('voiceSpeakerName').value.trim() || 'You';
            const isVoiceEntry = entry.speaker_name === voiceSpeakerName;
            
            return `
                <div class="transcript-entry mb-3 ${isVoiceEntry ? 'voice-entry' : ''}" data-id="${entry.id}">
                    <div class="transcript-header d-flex justify-content-between align-items-center mb-1">
                        <span class="speaker-name fw-bold text-primary">
                            <i class="fas ${isVoiceEntry ? 'fa-microphone' : 'fa-user'} me-1"></i>
                            ${this.escapeHtml(entry.speaker_name)}
                        </span>
                        <small class="timestamp text-muted">
                            <i class="fas fa-clock me-1"></i>
                            ${timestamp}
                        </small>
                    </div>
                    <div class="transcript-text">
                        <p class="mb-0">${this.escapeHtml(entry.text)}</p>
                    </div>
                </div>
            `;
        }).join('');
        
        transcriptList.innerHTML = transcriptHtml;
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new TranscriptionApp();
});
