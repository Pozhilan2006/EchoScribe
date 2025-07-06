// Background script for Meeting Transcription extension
console.log('Meeting Transcription background script loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed:', details.reason);
    
    if (details.reason === 'install') {
        // Set default settings
        chrome.storage.sync.set({
            settings: {
                autoDetect: true,
                serverUrl: 'http://localhost:5000'
            }
        });
        
        // Open options page or show welcome message
        chrome.tabs.create({
            url: 'popup.html'
        });
    }
});

// Handle browser action click (when extension icon is clicked)
chrome.action.onClicked.addListener((tab) => {
    console.log('Extension icon clicked on tab:', tab.url);
    
    // Check if we're on Google Meet
    if (tab.url && tab.url.includes('meet.google.com')) {
        // Send message to content script
        chrome.tabs.sendMessage(tab.id, {
            action: 'toggle'
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error sending message:', chrome.runtime.lastError);
            } else {
                console.log('Toggle response:', response);
            }
        });
    } else {
        // Show notification that extension only works on Google Meet
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMWE3IDcgMCAwIDEgNyA3djNhNyA3IDAgMCAxLTE0IDBWOGE3IDcgMCAwIDEgNy03WiIgZmlsbD0iIzQyODVGNCIvPjxwYXRoIGQ9Ik0xMiAxN3YzIiBzdHJva2U9IiM0Mjg1RjQiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTggMjBoOCIgc3Ryb2tlPSIjNDI4NUY0IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==',
            title: 'Meeting Transcription',
            message: 'This extension only works on Google Meet. Please navigate to meet.google.com to use it.'
        });
    }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);
    
    switch (request.action) {
        case 'checkServer':
            // Check if the transcription server is running
            fetch(request.url || 'http://localhost:5000/transcript')
                .then(response => response.json())
                .then(data => {
                    sendResponse({ success: true, data });
                })
                .catch(error => {
                    sendResponse({ success: false, error: error.message });
                });
            return true; // Keep message channel open for async response
            
        case 'getActiveTab':
            // Get information about the active tab
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                sendResponse({
                    url: tab.url,
                    title: tab.title,
                    isMeet: tab.url && tab.url.includes('meet.google.com')
                });
            });
            return true;
            
        case 'openTranscriptionApp':
            // Open the transcription web app
            chrome.tabs.create({
                url: request.url || 'http://localhost:5000'
            });
            sendResponse({ success: true });
            break;
    }
});

// Handle tab updates to detect when user navigates to/from Google Meet
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (tab.url.includes('meet.google.com')) {
            console.log('User navigated to Google Meet');
            // Could show notification or badge
            chrome.action.setBadgeText({ text: 'ON', tabId: tabId });
            chrome.action.setBadgeBackgroundColor({ color: '#4285f4' });
        } else {
            // Clear badge when leaving Meet
            chrome.action.setBadgeText({ text: '', tabId: tabId });
        }
    }
});

// Handle notifications click
chrome.notifications.onClicked.addListener((notificationId) => {
    console.log('Notification clicked:', notificationId);
    chrome.notifications.clear(notificationId);
});

// Cleanup on extension suspend
chrome.runtime.onSuspend.addListener(() => {
    console.log('Extension suspending');
});
