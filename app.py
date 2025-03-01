import os
import boto3
import uuid
import hashlib
import json
from flask import Flask, request, jsonify, send_file, render_template, redirect, url_for, session
from flask_cors import CORS
from dotenv import load_dotenv
from authlib.integrations.flask_client import OAuth
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.getenv('SECRET_KEY', 'your-secret-key')
CORS(app)

# Configure AWS Polly client
polly_client = boto3.client(
    'polly',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION')
)

# Default voice
DEFAULT_VOICE = 'Kevin'
# Default speech rate (0.5 = half speed, 1.0 = normal speed)
DEFAULT_RATE = 0.8

# Create audio directory if it doesn't exist
AUDIO_DIR = os.path.join(app.static_folder, 'audio')
os.makedirs(AUDIO_DIR, exist_ok=True)

# Configure Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Configure OAuth
app.config['GOOGLE_CLIENT_ID'] = os.getenv('GOOGLE_CLIENT_ID')
app.config['GOOGLE_CLIENT_SECRET'] = os.getenv('GOOGLE_CLIENT_SECRET')
app.config['GOOGLE_DISCOVERY_URL'] = (
    'https://accounts.google.com/.well-known/openid-configuration'
)

oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=app.config['GOOGLE_CLIENT_ID'],
    client_secret=app.config['GOOGLE_CLIENT_SECRET'],
    server_metadata_url=app.config['GOOGLE_DISCOVERY_URL'],
    client_kwargs={
        'scope': 'openid email profile'
    },
    redirect_uri='https://localhost:5001/authorize',
    userinfo_endpoint='https://www.googleapis.com/oauth2/v3/userinfo'
)

# User model
class User(UserMixin):
    def __init__(self, id, name, email, profile_pic):
        self.id = id
        self.name = name
        self.email = email
        self.profile_pic = profile_pic

# User loader for Flask-Login
@login_manager.user_loader
def load_user(user_id):
    if 'users' not in session:
        return None
    users = session['users']
    if user_id not in users:
        return None
    user_data = users[user_id]
    return User(
        id=user_id,
        name=user_data['name'],
        email=user_data['email'],
        profile_pic=user_data['profile_pic']
    )

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login')
def login():
    redirect_uri = url_for('authorize', _external=True)
    return google.authorize_redirect(redirect_uri)

@app.route('/authorize')
def authorize():
    try:
        token = google.authorize_access_token()
        print(f"Received token: {token}")

        # Use the token to get user info
        try:
            resp = google.get('https://www.googleapis.com/oauth2/v3/userinfo', token=token)
            print(f"API Response status: {resp.status_code}")
            print(f"API Response headers: {resp.headers}")
            print(f"API Response content: {resp.text}")

            if resp.status_code != 200:
                print(f"Error response from Google API: {resp.text}")
                return f"Failed to get user info: {resp.text}", 400

            user_info = resp.json()
            print(f"Parsed user info: {user_info}")
        except Exception as e:
            print(f"Exception while getting user info: {str(e)}")
            return f"Error getting user info: {str(e)}", 400

        # Check if we have valid user info
        if not user_info:
            print(f"Invalid user info received: {user_info}")
            return 'Invalid user info: empty response', 400

        # Google OAuth2 uses 'sub' as the unique identifier, not 'id'
        if 'sub' not in user_info:
            print(f"Invalid user info: missing 'sub' field: {user_info}")
            return 'Invalid user info: missing sub field', 400

        print(f"Successfully retrieved user info: {user_info}")

        # Initialize users dict in session if not exists
        if 'users' not in session:
            session['users'] = {}

        # Save user info in session
        user_id = user_info['sub']
        session['users'][user_id] = {
            'name': user_info.get('name', user_info.get('given_name', '')),
            'email': user_info.get('email', ''),
            'profile_pic': user_info.get('picture', '')
        }
        session.modified = True

        # Create user object and login
        user = User(
            id=user_id,
            name=user_info.get('name', ''),
            email=user_info.get('email', ''),
            profile_pic=user_info.get('picture', '')
        )
        login_user(user)

        return redirect('/')

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/logout')
def logout():
    print("Logout route called")
    print(f"Session before logout: {session}")

    # Clear the specific user session data
    if 'users' in session:
        print("Clearing users from session")
        session.pop('users')

    # Also clear the Flask-Login session
    logout_user()

    # Force session modification flag
    session.modified = True

    print(f"Session after logout: {session}")

    # Redirect to home page
    return redirect('/')

@app.route('/user')
def get_user():
    print(f"Session data: {session}")
    if 'users' in session:
        # Get the first user in the session (we only support one user for now)
        users = session.get('users', {})
        print(f"Users in session: {users}")
        if users:
            user_id = next(iter(users))
            user = users[user_id]
            print(f"Returning user info: {user}")
            return jsonify({
                'authenticated': True,
                'name': user.get('name', ''),
                'email': user.get('email', ''),
                'profile_pic': user.get('profile_pic', '')
            })

    print("No authenticated user found in session")
    return jsonify({'authenticated': False})

def get_text_hash(text, voice_id=DEFAULT_VOICE, rate=DEFAULT_RATE):
    """Generate a hash for the text, voice and rate combination"""
    # Create a hash of the text, voice ID and rate to use as a unique identifier
    hash_input = f"{text}_{voice_id}_{rate}"
    return hashlib.md5(hash_input.encode('utf-8')).hexdigest()

def get_cached_audio_path(text_hash):
    """Get the path to the cached audio file"""
    return os.path.join(AUDIO_DIR, f"{text_hash}.mp3")

def is_audio_cached(text_hash):
    """Check if the audio file is already cached"""
    audio_path = get_cached_audio_path(text_hash)
    return os.path.exists(audio_path)

def wrap_with_ssml(text, rate=DEFAULT_RATE):
    """Wrap text with SSML to control speech rate"""
    # Convert rate to percentage string for prosody tag
    rate_percent = f"{int(rate * 100)}%"
    return f'<speak><prosody rate="{rate_percent}">{text}</prosody></speak>'

def synthesize_and_cache(text, voice_id=DEFAULT_VOICE, rate=DEFAULT_RATE):
    """Synthesize speech using AWS Polly and cache the result"""
    # Generate hash for the text, voice and rate
    text_hash = get_text_hash(text, voice_id, rate)
    audio_path = get_cached_audio_path(text_hash)

    # Check if the audio is already cached
    if is_audio_cached(text_hash):
        print(f"Using cached audio for: {text[:30]}...")
        return text_hash

    # If not cached, synthesize using AWS Polly with SSML for rate control
    print(f"Synthesizing new audio for: {text[:30]}... with rate {rate}")

    # Wrap text with SSML for rate control
    ssml_text = wrap_with_ssml(text, rate)

    response = polly_client.synthesize_speech(
        Text=ssml_text,
        OutputFormat='mp3',
        VoiceId=voice_id,
        LanguageCode='en-US',
        Engine='neural',
        TextType='ssml'  # Specify that we're using SSML
    )

    # Save the audio file with the hash as the filename
    with open(audio_path, 'wb') as file:
        file.write(response['AudioStream'].read())

    return text_hash

@app.route('/api/synthesize', methods=['POST'])
def synthesize_speech():
    try:
        data = request.json
        text = data.get('text', '')
        voice_id = data.get('voice_id', DEFAULT_VOICE)
        rate = float(data.get('rate', DEFAULT_RATE))

        if not text:
            return jsonify({'error': 'No text provided'}), 400

        # Synthesize and cache the audio
        text_hash = synthesize_and_cache(text, voice_id, rate)

        # Return the URL to the audio file
        return jsonify({
            'success': True,
            'audio_url': f'/static/audio/{text_hash}.mp3'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/synthesize-word', methods=['POST'])
def synthesize_word():
    try:
        data = request.json
        word = data.get('word', '')
        voice_id = data.get('voice_id', DEFAULT_VOICE)
        rate = float(data.get('rate', DEFAULT_RATE))

        if not word:
            return jsonify({'error': 'No word provided'}), 400

        # Synthesize and cache the audio for the word
        text_hash = synthesize_and_cache(word, voice_id, rate)

        # Return the URL to the audio file
        return jsonify({
            'success': True,
            'audio_url': f'/static/audio/{text_hash}.mp3'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Run with HTTPS using provided certificate and key
    app.run(
        debug=True,
        ssl_context=('server.crt', 'server.key'),
        host='0.0.0.0',  # Allow external access
        port=5001
    )