# Meeting Transcription & Summarization System

## Overview

This is a real-time meeting transcription and summarization system that consists of a Flask web application and a Chrome extension. The system captures speech from Google Meet sessions, processes it through a Chrome extension, sends the data to a Flask backend for AI-powered summarization using Hugging Face transformers, and displays the results in a web interface with real-time updates via WebSockets.

## System Architecture

### Frontend Architecture
- **Web Interface**: Static HTML/CSS/JavaScript with Bootstrap for responsive design
- **Real-time Communication**: Socket.IO client for live updates
- **Chrome Extension**: Manifest V3 extension with content scripts, background service worker, and popup interface
- **UI Components**: Dashboard with transcript display, live summary, and connection status

### Backend Architecture
- **Web Framework**: Flask with Socket.IO for real-time WebSocket communication
- **AI Processing**: Hugging Face Transformers with T5-small model for text summarization
- **Threading**: Multi-threaded processing for concurrent transcript handling and summarization
- **Static File Serving**: Flask serves the web interface and assets

### Data Flow
1. Chrome extension captures captions and speaker information from Google Meet
2. Extension sends transcript data to Flask backend via HTTP/WebSocket
3. Flask processes and stores transcript entries in memory
4. Background thread generates summaries using T5-small model
5. Real-time updates pushed to web interface via Socket.IO
6. Web dashboard displays live transcript and AI-generated summaries

## Key Components

### Flask Backend (`app.py`)
- **Purpose**: Core server handling transcript processing and AI summarization
- **Key Features**:
  - Socket.IO integration for real-time communication
  - Hugging Face T5-small model for text summarization
  - Thread-safe transcript data management
  - REST API endpoints for transcript submission

### Chrome Extension
- **Manifest**: Defines permissions for Google Meet access and storage
- **Content Script**: Monitors Google Meet captions and speaker detection
- **Background Script**: Handles extension lifecycle and tab management
- **Popup Interface**: User settings and extension control

### Web Interface
- **Frontend**: Bootstrap-based responsive design with real-time updates
- **Features**: Live transcript display, AI summary generation, connection status
- **Styling**: Custom CSS with dark theme support and smooth animations

## Data Flow

1. **Capture**: Extension monitors Google Meet DOM for caption changes
2. **Processing**: Extension extracts speaker names and transcript text
3. **Transmission**: Data sent to Flask backend via WebSocket/HTTP
4. **Storage**: Backend stores transcript entries in memory with timestamps
5. **Summarization**: Background thread processes text with T5-small model
6. **Broadcasting**: Updates pushed to all connected web clients
7. **Display**: Web interface shows live transcript and generated summaries

## External Dependencies

### Python Dependencies
- **Flask**: Web framework and routing
- **Flask-SocketIO**: Real-time WebSocket communication
- **Transformers**: Hugging Face library for AI model integration
- **PyTorch**: Deep learning framework for model inference

### Frontend Dependencies
- **Bootstrap**: CSS framework for responsive design
- **Font Awesome**: Icon library for UI elements
- **Socket.IO**: Client-side real-time communication

### Chrome Extension APIs
- **chrome.runtime**: Extension messaging and lifecycle
- **chrome.storage**: Settings persistence
- **chrome.tabs**: Tab management and communication
- **chrome.notifications**: User notifications

## Deployment Strategy

### Development Setup
- Flask development server with debug mode enabled
- Chrome extension loaded in developer mode
- Local model loading from Hugging Face Hub

### Production Considerations
- **Security**: Update SECRET_KEY environment variable
- **Performance**: Consider model optimization or cloud API integration
- **Scalability**: Implement persistent storage (database) for transcript data
- **Monitoring**: Add logging and error tracking
- **HTTPS**: Secure communication for production deployment

## Changelog

- July 06, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.
