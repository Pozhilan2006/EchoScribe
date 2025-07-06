// Google Meet Transcription Content Script
console.log('Meeting Transcription extension loaded');

class MeetTranscriptionHelper {
    constructor() {
        this.isActive = false;
        this.lastSpeaker = null;
        this.serverUrl = 'http://localhost:5000';
        this.captionObserver = null;
        this.speakerObserver = null;
        this.settings = {
            autoDetect: true,
            serverUrl: 'http://localhost:5000'
        };
        
        this.init();
    }
    
    async init() {
        console.log('Initializing Meet Transcription Helper');
        
        // Load settings from storage
        await this.loadSettings();
        
        // Wait for Meet to load
        this.waitForMeet();
        
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
        });
    }
    
    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['settings']);
            if (result.settings) {
                this.settings = { ...this.settings, ...result.settings };
            }
            console.log('Settings loaded:', this.settings);
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
    
    waitForMeet() {
        // Check if we're on Google Meet
        if (!window.location.href.includes('meet.google.com')) {
            console.log('Not on Google Meet, extension inactive');
            return;
        }
        
        console.log('On Google Meet, waiting for interface to load');
        
        // Wait for the meeting interface to load
        const checkInterval = setInterval(() => {
            if (this.findMeetElements()) {
                clearInterval(checkInterval);
                console.log('Meet interface detected, setting up observers');
                this.setupObservers();
            }
        }, 1000);
        
        // Stop checking after 30 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
        }, 30000);
    }
    
    findMeetElements() {
        // Try to find key Meet elements
        const participantArea = document.querySelector('[data-participant-id]') || 
                              document.querySelector('.NzPR9b') || 
                              document.querySelector('[jscontroller="kAPYbd"]');
        
        const captionArea = document.querySelector('[data-is-caption="true"]') ||
                           document.querySelector('.iTTPOb') ||
                           document.querySelector('[jscontroller="r4nke"]');
        
        return participantArea || captionArea;
    }
    
    setupObservers() {
        console.log('Setting up DOM observers');
        
        // Observer for captions (if available)
        this.observeCaptions();
        
        // Observer for speaker changes
        this.observeSpeakers();
        
        // Add visual indicator
        this.addVisualIndicator();
        
        this.isActive = true;
        console.log('Extension is now active');
    }
    
    observeCaptions() {
        // Try to find caption elements
        const captionSelectors = [
            '[data-is-caption="true"]',
            '.iTTPOb',
            '[jscontroller="r4nke"]',
            '.a4cQT',
            '.YSxPC'
        ];
        
        for (const selector of captionSelectors) {
            const captionContainer = document.querySelector(selector);
            if (captionContainer) {
                console.log('Found caption container:', selector);
                this.captionObserver = new MutationObserver((mutations) => {
                    this.handleCaptionChange(mutations);
                });
                
                this.captionObserver.observe(captionContainer, {
                    childList: true,
                    subtree: true,
                    characterData: true
                });
                break;
            }
        }
    }
    
    observeSpeakers() {
        // Try to find speaker/participant elements
        const speakerSelectors = [
            '[data-participant-id]',
            '.NzPR9b',
            '[jscontroller="kAPYbd"]',
            '.KV1GEc',
            '.VfPpkd-Bz112c'
        ];
        
        for (const selector of speakerSelectors) {
            const speakerContainer = document.querySelector(selector);
            if (speakerContainer) {
                console.log('Found speaker container:', selector);
                this.speakerObserver = new MutationObserver((mutations) => {
                    this.handleSpeakerChange(mutations);
                });
                
                this.speakerObserver.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['data-participant-id', 'aria-label']
                });
                break;
            }
        }
    }
    
    handleCaptionChange(mutations) {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
                const captionText = this.extractCaptionText(mutation.target);
                if (captionText && captionText.trim()) {
                    this.processCaptionText(captionText);
                }
            }
        });
    }
    
    extractCaptionText(element) {
        // Try to extract caption text from various possible structures
        if (element.textContent) {
            return element.textContent.trim();
        }
        
        // Look for text in child elements
        const textElements = element.querySelectorAll('*');
        for (const textElement of textElements) {
            if (textElement.textContent && textElement.textContent.trim()) {
                return textElement.textContent.trim();
            }
        }
        
        return null;
    }
    
    processCaptionText(text) {
        console.log('Processing caption text:', text);
        
        // Simple speaker detection - look for patterns like "John: Hello"
        const speakerMatch = text.match(/^([^:]+):\s*(.+)/);
        let speaker = 'Unknown Speaker';
        let message = text;
        
        if (speakerMatch) {
            speaker = speakerMatch[1].trim();
            message = speakerMatch[2].trim();
        } else {
            // Use last known speaker or try to detect current speaker
            speaker = this.getCurrentSpeaker() || 'Unknown Speaker';
        }
        
        this.sendTranscription(speaker, message);
    }
    
    handleSpeakerChange(mutations) {
        // Try to detect who is currently speaking
        const currentSpeaker = this.getCurrentSpeaker();
        if (currentSpeaker && currentSpeaker !== this.lastSpeaker) {
            this.lastSpeaker = currentSpeaker;
            console.log('Speaker changed to:', currentSpeaker);
        }
    }
    
    getCurrentSpeaker() {
        // Try various methods to detect current speaker
        const methods = [
            () => this.getSpeakerFromActiveBadge(),
            () => this.getSpeakerFromParticipantList(),
            () => this.getSpeakerFromAudioIndicator(),
            () => this.getSpeakerFromDOM()
        ];
        
        for (const method of methods) {
            try {
                const speaker = method();
                if (speaker) {
                    return speaker;
                }
            } catch (error) {
                console.debug('Speaker detection method failed:', error);
            }
        }
        
        return null;
    }
    
    getSpeakerFromActiveBadge() {
        // Look for active speaker badge
        const activeBadges = document.querySelectorAll('[data-speaking="true"], .speaking, .active-speaker');
        for (const badge of activeBadges) {
            const name = badge.querySelector('[data-name], .name')?.textContent?.trim();
            if (name) return name;
        }
        return null;
    }
    
    getSpeakerFromParticipantList() {
        // Look for highlighted participant in participant list
        const participants = document.querySelectorAll('[data-participant-id]');
        for (const participant of participants) {
            if (participant.classList.contains('speaking') || 
                participant.getAttribute('data-speaking') === 'true') {
                const name = participant.querySelector('[data-name]')?.textContent?.trim() ||
                           participant.getAttribute('data-name') ||
                           participant.getAttribute('aria-label');
                if (name) return name;
            }
        }
        return null;
    }
    
    getSpeakerFromAudioIndicator() {
        // Look for audio level indicators
        const audioIndicators = document.querySelectorAll('[data-audio-level], .audio-indicator');
        for (const indicator of audioIndicators) {
            const level = indicator.getAttribute('data-audio-level');
            if (level && parseFloat(level) > 0) {
                const name = indicator.closest('[data-participant-id]')?.querySelector('[data-name]')?.textContent?.trim();
                if (name) return name;
            }
        }
        return null;
    }
    
    getSpeakerFromDOM() {
        // Generic DOM search for speaker names
        const possibleSelectors = [
            '[data-name]',
            '.participant-name',
            '.speaker-name',
            '[aria-label*="speaking"]',
            '[title*="speaking"]'
        ];
        
        for (const selector of possibleSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                const name = element.textContent?.trim() || element.getAttribute('data-name') || element.getAttribute('aria-label');
                if (name && name.length > 0 && name !== 'undefined') {
                    return name;
                }
            }
        }
        
        return null;
    }
    
    async sendTranscription(speaker, text) {
        if (!this.settings.autoDetect) {
            console.log('Auto-detect disabled, skipping transcription');
            return;
        }
        
        try {
            console.log('Sending transcription:', { speaker, text });
            
            const response = await fetch(`${this.settings.serverUrl}/transcribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    speaker_name: speaker,
                    text: text
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('Transcription sent successfully');
                this.updateIndicator('success');
            } else {
                console.error('Error sending transcription:', result.error);
                this.updateIndicator('error');
            }
        } catch (error) {
            console.error('Network error sending transcription:', error);
            this.updateIndicator('error');
        }
    }
    
    addVisualIndicator() {
        // Add a small indicator to show the extension is active
        const indicator = document.createElement('div');
        indicator.id = 'meet-transcription-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background-color: #4285f4;
            z-index: 9999;
            opacity: 0.7;
            transition: all 0.3s ease;
        `;
        indicator.title = 'Meeting Transcription Active';
        
        document.body.appendChild(indicator);
    }
    
    updateIndicator(status) {
        const indicator = document.getElementById('meet-transcription-indicator');
        if (!indicator) return;
        
        switch (status) {
            case 'success':
                indicator.style.backgroundColor = '#34a853';
                setTimeout(() => {
                    indicator.style.backgroundColor = '#4285f4';
                }, 1000);
                break;
            case 'error':
                indicator.style.backgroundColor = '#ea4335';
                setTimeout(() => {
                    indicator.style.backgroundColor = '#4285f4';
                }, 2000);
                break;
        }
    }
    
    handleMessage(request, sender, sendResponse) {
        console.log('Received message:', request);
        
        switch (request.action) {
            case 'getStatus':
                sendResponse({
                    active: this.isActive,
                    speaker: this.lastSpeaker,
                    url: window.location.href
                });
                break;
                
            case 'toggle':
                this.settings.autoDetect = !this.settings.autoDetect;
                chrome.storage.sync.set({ settings: this.settings });
                sendResponse({ autoDetect: this.settings.autoDetect });
                break;
                
            case 'sendTest':
                this.sendTranscription(request.speaker || 'Test Speaker', request.text || 'Test message');
                sendResponse({ success: true });
                break;
                
            case 'updateSettings':
                this.settings = { ...this.settings, ...request.settings };
                chrome.storage.sync.set({ settings: this.settings });
                sendResponse({ success: true });
                break;
        }
    }
}

// Initialize the extension when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new MeetTranscriptionHelper();
    });
} else {
    new MeetTranscriptionHelper();
}
