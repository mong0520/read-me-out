import os
import boto3
import uuid
import hashlib
from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')
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

@app.route('/')
def index():
    return render_template('index.html')

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
    app.run(debug=True)