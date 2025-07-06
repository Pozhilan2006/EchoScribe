// Popup script for Meeting Transcription extension
class PopupController {
    constructor() {
        this.settings = {
            autoDetect: true,
            serverUrl: 'http://localhost:5000'
        };
        
        this.init();
    }
    
    async init() {
        console.log('Popup initialized');
        
        // Load settings
        await this.loadSettings();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Update UI
        this.updateUI();
        
        // Check status
        this.checkStatus();
    }
    
    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['settings']);
            if (result.settings) {
                this.settings = { ...this.settings, ...result.settings };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
    
    async saveSettings() {
        try {
            await chrome.storage.sync.set({ settings: this.settings });
            console.log('Settings saved:', this.settings);
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }
    
    setupEventListeners() {
        // Auto-detect toggle
        const autoDetectToggle = document.getElementById('autoDetectToggle');
        autoDetectToggle.addEventListener('change', (e) => {
            this.settings.autoDetect = e.target.checked;
            this.saveSettings();
            this.updateAutoDetectStatus();
            this.sendMessageToContentScript({ action: 'updateSettings', settings: this.settings });
        });
        
        // Server URL input
        const serverUrlInput = document.getElementById('serverUrl');
        serverUrlInput.addEventListener('change', (e) => {
            this.settings.serverUrl = e.target.value;
            this.saveSettings();
            this.sendMessageToContentScript({ action: 'updateSettings', settings: this.settings });
        });
        
        // Test server button
        const testServerBtn = document.getElementById('testServerBtn');
        testServerBtn.addEventListener('click', () => {
            this.testServer();
        });
        
        // Send test message button
        const sendTestBtn = document.getElementById('sendTestBtn');
        sendTestBtn.addEventListener('click', () => {
            this.sendTestMessage();
        });
        
        // Open app button
        const openAppBtn = document.getElementById('openAppBtn');
        openAppBtn.addEventListener('click', () => {
            this.openTranscriptionApp();
        });
        
        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        refreshBtn.addEventListener('click', () => {
            this.checkStatus();
        });
    }
    
    updateUI() {
        // Update auto-detect toggle
        const autoDetectToggle = document.getElementById('autoDetectToggle');
        autoDetectToggle.checked = this.settings.autoDetect;
        this.updateAutoDetectStatus();
        
        // Update server URL
        const serverUrlInput = document.getElementById('serverUrl');
        serverUrlInput.value = this.settings.serverUrl;
    }
    
    updateAutoDetectStatus() {
        const statusElement = document.getElementById('autoDetectStatus');
        statusElement.textContent = this.settings.autoDetect ? 'Enabled' : 'Disabled';
    }
    
    async checkStatus() {
        console.log('Checking status...');
        
        // Check server status
        this.checkServerStatus();
        
        // Check Google Meet status
        this.checkMeetStatus();
        
        // Check current speaker
        this.checkCurrentSpeaker();
    }
    
    async checkServerStatus() {
        const statusElement = document.getElementById('serverStatus');
        statusElement.textContent = 'Checking...';
        statusElement.className = 'status-value status-unknown';
        
        try {
            const response = await fetch(`${this.settings.serverUrl}/transcript`);
            const data = await response.json();
            
            statusElement.textContent = 'Connected';
            statusElement.className = 'status-value status-connected';
            
            console.log('Server is running:', data);
        } catch (error) {
            console.error('Server check failed:', error);
            statusElement.textContent = 'Disconnected';
            statusElement.className = 'status-value status-disconnected';
        }
    }
    
    async checkMeetStatus() {
        const statusElement = document.getElementById('meetStatus');
        
        try {
            const tab = await this.getActiveTab();
            
            if (tab && tab.url && tab.url.includes('meet.google.com')) {
                statusElement.textContent = 'Active';
                statusElement.className = 'status-value status-connected';
            } else {
                statusElement.textContent = 'Not on Meet';
                statusElement.className = 'status-value status-disconnected';
            }
        } catch (error) {
            console.error('Error checking Meet status:', error);
            statusElement.textContent = 'Unknown';
            statusElement.className = 'status-value status-unknown';
        }
    }
    
    async checkCurrentSpeaker() {
        const speakerElement = document.getElementById('currentSpeaker');
        
        try {
            const response = await this.sendMessageToContentScript({ action: 'getStatus' });
            
            if (response && response.speaker) {
                speakerElement.textContent = response.speaker;
                speakerElement.className = 'status-value';
            } else {
                speakerElement.textContent = 'Unknown';
                speakerElement.className = 'status-value';
            }
        } catch (error) {
            console.error('Error getting current speaker:', error);
            speakerElement.textContent = 'Unknown';
            speakerElement.className = 'status-value';
        }
    }
    
    async testServer() {
        const testBtn = document.getElementById('testServerBtn');
        const originalText = testBtn.textContent;
        
        testBtn.textContent = 'Testing...';
        testBtn.disabled = true;
        
        try {
            const response = await fetch(`${this.settings.serverUrl}/transcript`);
            const data = await response.json();
            
            this.showMessage('Server connection successful!', 'success');
            console.log('Server test successful:', data);
        } catch (error) {
            console.error('Server test failed:', error);
            this.showMessage('Server connection failed: ' + error.message, 'error');
        } finally {
            testBtn.textContent = originalText;
            testBtn.disabled = false;
        }
    }
    
    async sendTestMessage() {
        const sendBtn = document.getElementById('sendTestBtn');
        const originalText = sendBtn.textContent;
        
        const speaker = document.getElementById('testSpeaker').value.trim();
        const message = document.getElementById('testMessage').value.trim();
        
        if (!speaker || !message) {
            this.showMessage('Please fill in both speaker name and message', 'error');
            return;
        }
        
        sendBtn.textContent = 'Sending...';
        sendBtn.disabled = true;
        
        try {
            const response = await fetch(`${this.settings.serverUrl}/transcribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    speaker_name: speaker,
                    text: message
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showMessage('Test message sent successfully!', 'success');
                // Clear message field
                document.getElementById('testMessage').value = '';
            } else {
                this.showMessage('Error sending test message: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Error sending test message:', error);
            this.showMessage('Network error: ' + error.message, 'error');
        } finally {
            sendBtn.textContent = originalText;
            sendBtn.disabled = false;
        }
    }
    
    openTranscriptionApp() {
        chrome.tabs.create({
            url: this.settings.serverUrl
        });
    }
    
    async getActiveTab() {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                resolve(tabs[0]);
            });
        });
    }
    
    async sendMessageToContentScript(message) {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('Error sending message:', chrome.runtime.lastError);
                            resolve(null);
                        } else {
                            resolve(response);
                        }
                    });
                } else {
                    resolve(null);
                }
            });
        });
    }
    
    showMessage(text, type = 'info') {
        const messageArea = document.getElementById('messageArea');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `${type === 'error' ? 'error-message' : 'success-message'}`;
        messageDiv.textContent = text;
        
        messageArea.innerHTML = '';
        messageArea.appendChild(messageDiv);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});
