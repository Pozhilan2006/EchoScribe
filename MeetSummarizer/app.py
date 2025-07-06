import os
import logging
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
import threading
import time

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")

# Global variables for transcript and summarization
transcript_data = []
current_summary = ""
summarization_lock = threading.Lock()

# Try to import optional dependencies
try:
    import subprocess
    import sys
    
    # Try to install flask-socketio if not available
    try:
        from flask_socketio import SocketIO, emit
    except ImportError:
        logger.info("Installing flask-socketio...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "flask-socketio"])
        from flask_socketio import SocketIO, emit
    
    socketio = SocketIO(app, cors_allowed_origins="*", logger=True, engineio_logger=True)
    SOCKETIO_AVAILABLE = True
    logger.info("Flask-SocketIO loaded successfully")
except Exception as e:
    logger.warning(f"Flask-SocketIO not available: {e}. WebSocket functionality will be disabled.")
    SOCKETIO_AVAILABLE = False
    socketio = None

# AI model variables
tokenizer = None
model = None
AI_AVAILABLE = False

def load_model():
    """Load the Hugging Face model and tokenizer"""
    global tokenizer, model, AI_AVAILABLE
    try:
        logger.info("Attempting to load Hugging Face model...")
        
        # Try to install transformers if not available
        try:
            from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
            import torch
        except ImportError:
            logger.info("Installing transformers and torch...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", "transformers", "torch", "--index-url", "https://download.pytorch.org/whl/cpu"])
            from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
            import torch
        
        model_name = "t5-small"  # Using t5-small for better performance
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        AI_AVAILABLE = True
        logger.info("Model loaded successfully")
    except ImportError as e:
        logger.warning(f"Transformers library not available: {e}")
        AI_AVAILABLE = False
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        AI_AVAILABLE = False

def generate_summary(text):
    """Generate summary using Hugging Face model or basic text processing"""
    global tokenizer, model, AI_AVAILABLE
    
    if not AI_AVAILABLE:
        logger.info("AI model not available, using basic text summarization")
        return generate_basic_summary(text)
    
    try:
        # Prepare input text for T5 model
        input_text = f"summarize: {text}"
        
        # Tokenize input
        inputs = tokenizer.encode(input_text, return_tensors="pt", max_length=1024, truncation=True)
        
        # Generate summary
        import torch
        with torch.no_grad():
            summary_ids = model.generate(
                inputs,
                max_length=150,
                min_length=30,
                length_penalty=2.0,
                num_beams=4,
                early_stopping=True
            )
        
        # Decode summary
        summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        logger.info(f"Generated AI summary: {summary[:100]}...")
        return summary
        
    except Exception as e:
        logger.error(f"Error generating AI summary: {e}")
        return generate_basic_summary(text)

def generate_basic_summary(text):
    """Generate basic summary using text processing"""
    if not text or len(text.strip()) == 0:
        return "No content to summarize."
    
    # Split text into sentences
    sentences = text.replace('!', '.').replace('?', '.').split('.')
    sentences = [s.strip() for s in sentences if s.strip()]
    
    if len(sentences) <= 2:
        return f"Brief discussion: {text[:200]}..."
    
    # Simple extractive summarization - take first and last sentences if reasonable length
    summary_parts = []
    
    # Key topics (basic keyword extraction)
    common_words = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']
    
    words = text.lower().split()
    important_words = [w for w in words if w not in common_words and len(w) > 3]
    
    if important_words:
        word_count = {}
        for word in important_words:
            word_count[word] = word_count.get(word, 0) + 1
        
        # Get top 3 most frequent words
        top_words = sorted(word_count.items(), key=lambda x: x[1], reverse=True)[:3]
        key_topics = [word for word, count in top_words]
        
        if key_topics:
            summary_parts.append(f"Key topics discussed: {', '.join(key_topics)}")
    
    # Add sentence count and length info
    summary_parts.append(f"Discussion contained {len(sentences)} main points")
    
    # Add brief content snippet
    if len(text) > 150:
        summary_parts.append(f"Main content: {text[:150]}...")
    else:
        summary_parts.append(f"Content: {text}")
    
    return " | ".join(summary_parts)

def update_summary():
    """Update the current summary based on transcript data"""
    global current_summary, transcript_data
    
    with summarization_lock:
        if not transcript_data:
            current_summary = "No content to summarize yet."
            return
        
        # Combine all transcript text
        full_text = " ".join([entry["text"] for entry in transcript_data])
        
        # Only summarize if there's substantial content
        if len(full_text.split()) < 10:
            current_summary = "Not enough content to summarize yet."
            return
        
        # Generate summary
        current_summary = generate_summary(full_text)
        
        # Emit updated summary to all connected clients (if SocketIO available)
        if SOCKETIO_AVAILABLE and socketio:
            socketio.emit('summary_update', {'summary': current_summary})

@app.route('/')
def index():
    """Serve the main HTML page"""
    return send_from_directory('static', 'index.html')

@app.route('/static/<path:filename>')
def static_files(filename):
    """Serve static files"""
    return send_from_directory('static', filename)

@app.route('/transcribe', methods=['POST'])
def transcribe():
    """Handle transcription requests"""
    try:
        data = request.get_json()
        
        if not data or 'speaker_name' not in data or 'text' not in data:
            return jsonify({'error': 'Missing required fields: speaker_name, text'}), 400
        
        speaker_name = data['speaker_name']
        text = data['text']
        
        # Create transcript entry
        entry = {
            'timestamp': datetime.now().isoformat(),
            'speaker_name': speaker_name,
            'text': text,
            'id': len(transcript_data) + 1
        }
        
        # Add to transcript
        transcript_data.append(entry)
        
        logger.info(f"Added transcript entry: {speaker_name}: {text[:50]}...")
        
        # Emit updated transcript to all connected clients (if SocketIO available)
        if SOCKETIO_AVAILABLE and socketio:
            socketio.emit('transcript_update', {
                'transcript': transcript_data,
                'new_entry': entry
            })
        
        # Update summary in background thread
        threading.Thread(target=update_summary, daemon=True).start()
        
        return jsonify({'success': True, 'entry_id': entry['id']})
        
    except Exception as e:
        logger.error(f"Error in transcribe endpoint: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/transcript', methods=['GET'])
def get_transcript():
    """Get the current transcript"""
    return jsonify({
        'transcript': transcript_data,
        'summary': current_summary
    })

@app.route('/clear', methods=['POST'])
def clear_transcript():
    """Clear the current transcript"""
    global transcript_data, current_summary
    transcript_data.clear()
    current_summary = ""
    
    # Emit updates to all connected clients (if SocketIO available)
    if SOCKETIO_AVAILABLE and socketio:
        socketio.emit('transcript_update', {'transcript': []})
        socketio.emit('summary_update', {'summary': ''})
    
    logger.info("Transcript cleared")
    return jsonify({'success': True})

# Socket.IO event handlers (only if SocketIO is available)
if SOCKETIO_AVAILABLE and socketio:
    @socketio.on('connect')
    def handle_connect():
        """Handle WebSocket connection"""
        logger.info(f"Client connected: {request.sid}")
        
        # Send current transcript and summary to new client
        emit('transcript_update', {'transcript': transcript_data})
        emit('summary_update', {'summary': current_summary})

    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle WebSocket disconnection"""
        logger.info(f"Client disconnected: {request.sid}")

    @socketio.on('request_update')
    def handle_request_update():
        """Handle client request for current data"""
        emit('transcript_update', {'transcript': transcript_data})
        emit('summary_update', {'summary': current_summary})

# Load model on startup
def initialize_app():
    """Initialize the application"""
    try:
        load_model()
        logger.info("Application initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize application: {e}")
        # Continue without model - will show error messages in summaries

if __name__ == '__main__':
    initialize_app()
    if SOCKETIO_AVAILABLE and socketio:
        socketio.run(app, host='0.0.0.0', port=5000, debug=True)
    else:
        logger.info("Running Flask app without SocketIO support")
        app.run(host='0.0.0.0', port=5000, debug=True)
