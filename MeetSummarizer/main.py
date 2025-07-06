from app import app, socketio, initialize_app, SOCKETIO_AVAILABLE

# Initialize the application
initialize_app()

if __name__ == '__main__':
    if SOCKETIO_AVAILABLE and socketio:
        socketio.run(app, host='0.0.0.0', port=5000, debug=True)
    else:
        app.run(host='0.0.0.0', port=5000, debug=True)
