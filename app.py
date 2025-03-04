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
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from werkzeug.middleware.proxy_fix import ProxyFix
from flask_migrate import Migrate

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')
app.wsgi_app = ProxyFix(app.wsgi_app, x_prefix=1)
app.secret_key = os.getenv('SECRET_KEY', 'your-secret-key')
CORS(app)

# Configure database
print(os.getenv('DATABASE_URL', 'mysql+pymysql://readmeout:readmeoutpass@localhost:3307/read_me_out'))
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'mysql+pymysql://readmeout:readmeoutpass@localhost:3307/read_me_out')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)  # 設定 session 效期為 7 天
app.config['REMEMBER_COOKIE_DURATION'] = timedelta(days=7)    # 設定 remember cookie 效期為 7 天
db = SQLAlchemy(app)
migrate = Migrate(app, db)

# Define database models
class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.String(255), primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    profile_pic = db.Column(db.String(1024))
    level = db.Column(db.Integer, default=0)  # 添加 level 欄位，預設為 0 (free)
    edit_count = db.Column(db.Integer, default=0)  # 添加編輯次數計數
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    articles = db.relationship('Article', backref='author', lazy=True)

class Article(db.Model):
    __tablename__ = 'articles'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(255), db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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
    redirect_uri='https://www.nt1.dev/read-me-out/authorize',
    userinfo_endpoint='https://www.googleapis.com/oauth2/v3/userinfo'
)

# User loader for Flask-Login
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)

@app.route('/')
def index():
    article_id = request.args.get('article_id')
    prefix = request.script_root
    return render_template('index.html', article_id=article_id, prefix=prefix)

@app.route('/dashboard')
@login_required
def dashboard():
    prefix = request.script_root
    return render_template('dashboard.html', prefix=prefix)

@app.route('/login')
def login():
    redirect_uri = url_for('authorize', _external=True, _scheme='https')
    return google.authorize_redirect(redirect_uri)

@app.route('/authorize')
def authorize():
    try:
        token = google.authorize_access_token()
        print(f"Received token: {token}")

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

            user_id = user_info['sub']
            user = User.query.get(user_id)

            if user:
                # Update existing user
                user.name = user_info.get('name', user_info.get('given_name', ''))
                user.email = user_info.get('email', '')
                user.profile_pic = user_info.get('picture', '')
            else:
                # Create new user with default values
                user = User(
                    id=user_id,
                    name=user_info.get('name', user_info.get('given_name', '')),
                    email=user_info.get('email', ''),
                    profile_pic=user_info.get('picture', ''),
                    level=0,  # 設置預設 level 為 0 (free)
                    edit_count=0  # 設置預設 edit_count 為 0
                )
                db.session.add(user)
                db.session.commit()  # 先提交用戶以獲得 user.id

                # 為新用戶創建示範文章
                demo_article = Article(
                    user_id=user.id,
                    title="A very hungry caterpillar",
                    content="""In the light of the moon a little egg lay on a leaf.
One Sunday morning the warm sun came up and - pop! - out of the egg came a tiny and very hungry caterpillar.
He started to look for some food. I'm so HUNGRY!
On Monday he ate through 1 apple. But he was still hungry.
On Tuesday he ate through 2 pears, but he was still hungry.
On Wednesday he ate through 3 plums, but he was still hungry.
On Thursday he ate through 4 strawberries, but he was still hungry.
On Friday he ate through 5 oranges, but he was still hungry.
On Saturday he ate through 1 piece of chocolate cake , 1 icecream cone, 1 pickle,One slice of Swiss cheese, 1 slice of salami, 1 lollipop, 1 piece of cherry pie, 1 sausage, 1 cupcake, And 1 slice of watermelon.
That night he had a stomachache!
The very hungry caterpillar then ate through one green leaf. He started to feel better.
Now, the caterpillar was no longer small. He was a big, fat, caterpillar. little BIG
He built a small house, called a cocoon around himself. He stayed inside for more than 2 weeks. Then he nibbled a small hole in the cocoon, pushed his way out and…
A Beautiful Butterfly!"""
                )
                db.session.add(demo_article)

            db.session.commit()
            login_user(user, remember=True)

            return redirect(url_for('index'))

        except Exception as e:
            print(f"Exception while getting user info: {str(e)}")
            return f"Error getting user info: {str(e)}", 400

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/logout')
def logout():
    print("Logout route called")
    logout_user()
    return redirect(url_for('index'))


@app.route('/user')
def get_user():
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'id': current_user.id,
            'name': current_user.name,
            'email': current_user.email,
            'profile_pic': current_user.profile_pic,
            'level': current_user.level
        })
    return jsonify({'authenticated': False})

# Article API routes
@app.route('/api/articles', methods=['GET'])
@login_required
def get_articles():
    articles = Article.query.filter_by(user_id=current_user.id).order_by(Article.updated_at.desc()).all()
    return jsonify([{
        'id': article.id,
        'title': article.title,
        'content': article.content,
        'created_at': article.created_at.isoformat(),
        'updated_at': article.updated_at.isoformat()
    } for article in articles])

@app.route('/api/articles/<int:article_id>', methods=['GET'])
@login_required
def get_article(article_id):
    article = Article.query.filter_by(id=article_id, user_id=current_user.id).first()
    if not article:
        return jsonify({'error': 'Article not found'}), 404

    return jsonify({
        'id': article.id,
        'title': article.title,
        'content': article.content,
        'created_at': article.created_at.isoformat(),
        'updated_at': article.updated_at.isoformat()
    })

@app.route('/api/articles', methods=['POST'])
@login_required
def create_article():
    # 檢查是否為免費用戶
    if current_user.level == 0:
        # 檢查現有文章數量
        article_count = Article.query.filter_by(user_id=current_user.id).count()
        if article_count >= 2:
            return jsonify({'error': 'Free users can only create one article'}), 403

        # 檢查內容長度
        content = request.json.get('content', '')
        if len(content) > 300:
            return jsonify({'error': 'Free users are limited to 300 characters'}), 403

    data = request.json
    title = data.get('title', '')
    content = data.get('content', '')

    if not title or not content:
        return jsonify({'error': 'Title and content are required'}), 400

    article = Article(
        user_id=current_user.id,
        title=title,
        content=content
    )

    db.session.add(article)
    db.session.commit()

    return jsonify({
        'id': article.id,
        'title': article.title,
        'content': article.content,
        'created_at': article.created_at.isoformat(),
        'updated_at': article.updated_at.isoformat()
    }), 201

@app.route('/api/articles/<int:article_id>', methods=['PUT'])
@login_required
def update_article(article_id):
    article = Article.query.filter_by(id=article_id, user_id=current_user.id).first()
    if not article:
        return jsonify({'error': 'Article not found'}), 404

    # 檢查是否為免費用戶
    if current_user.level == 0:
        # 檢查編輯次數
        if current_user.edit_count >= 3:
            return jsonify({'error': 'Free users can only edit 3 times'}), 403

        # 檢查內容長度
        content = request.json.get('content', '')
        if len(content) > 300:
            return jsonify({'error': 'Free users are limited to 300 characters'}), 403

        # 增加編輯次數
        current_user.edit_count += 1
        db.session.add(current_user)

    data = request.json
    title = data.get('title')
    content = data.get('content')

    if title:
        article.title = title
    if content:
        article.content = content

    db.session.commit()

    # 返回剩餘編輯次數（如果是免費用戶）
    response_data = {
        'id': article.id,
        'title': article.title,
        'content': article.content,
        'created_at': article.created_at.isoformat(),
        'updated_at': article.updated_at.isoformat()
    }

    if current_user.level == 0:
        remaining_edits = 3 - current_user.edit_count
        response_data['remaining_edits'] = remaining_edits
        response_data['message'] = f'Article updated successfully! You have {remaining_edits} edits remaining.'

    return jsonify(response_data)

@app.route('/api/articles/<int:article_id>', methods=['DELETE'])
@login_required
def delete_article(article_id):
    # 檢查是否為免費用戶
    if current_user.level == 0:
        return jsonify({'error': 'Free users cannot delete articles'}), 403

    article = Article.query.filter_by(id=article_id, user_id=current_user.id).first()
    if not article:
        return jsonify({'error': 'Article not found'}), 404

    db.session.delete(article)
    db.session.commit()

    return jsonify({'success': True})

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

        prefix = request.script_root

        # Return the URL to the audio file with the correct prefix
        return jsonify({
            'success': True,
            'audio_url': f'{prefix}/static/audio/{text_hash}.mp3'
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

        # 使用 request.script_root 獲取 prefix
        prefix = request.script_root

        # Return the URL to the audio file with the correct prefix
        return jsonify({
            'success': True,
            'audio_url': f'{prefix}/static/audio/{text_hash}.mp3'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Create database tables
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    # Run with HTTPS using provided certificate and key
    app.run(
        debug=True,
        ssl_context=('server.crt', 'server.key'),
        host='0.0.0.0',  # Allow external access
        port=5001
    )
