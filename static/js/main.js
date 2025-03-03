/**
 * Read Me Out - Main JavaScript
 *
 * This file handles the main functionality of the Read Me Out application,
 * including text-to-speech conversion, user authentication display,
 * and hamburger menu/sidebar functionality.
 */

// 從 body 元素獲取 prefix
const BASE_PATH = document.body.getAttribute('data-prefix') || '';
console.log('BASE_PATH in main.js:', BASE_PATH); // 用於調試

// Wait for DOM to be fully loaded before executing code
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded');

    // DOM Elements - Authentication
    const userInfo = document.querySelector('.user-info');
    const userPic = document.querySelector('.user-pic');
    const userName = document.querySelector('.user-name');
    const loginContainer = document.querySelector('.login-container');
    const logoutLink = document.getElementById('logout-link');

    // DOM Elements - Sidebar
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const hamburgerIcon = document.querySelector('.hamburger-icon');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.overlay');
    const closeSidebar = document.querySelector('.close-sidebar');
    const authRequiredItems = document.querySelectorAll('.auth-required');

    // DOM Elements - Text to Speech
    const speedOptions = document.querySelectorAll('input[name="speed"]');
    const textDisplay = document.getElementById('text-display');
    const statusMessage = document.getElementById('status-message');

    // 保存當前加載的文章內容
    let currentArticleContent = '';
    let currentArticleId = '';

    // Initialize features
    checkAuthStatus();
    setupHamburgerMenu();
    setupTextToSpeech();
    loadArticleFromUrl();

    /**
     * Check user authentication status and update UI accordingly
     */
    async function checkAuthStatus() {
        try {
            const response = await fetch(`${BASE_PATH}/user`);
            const data = await response.json();

            const userInfo = document.querySelector('.user-info');
            const loginContainer = document.querySelector('.login-container');
            const authRequiredElements = document.querySelectorAll('.auth-required');

            if (data.authenticated) {
                // 更新用戶資訊
                if (userInfo) {
                    const userPic = userInfo.querySelector('.user-pic');
                    const userName = userInfo.querySelector('.user-name');
                    if (userPic) userPic.style.backgroundImage = `url(${data.profile_pic})`;
                    if (userName) userName.textContent = data.name;
                    userInfo.style.display = 'flex';
                }

                // 隱藏登入按鈕
                if (loginContainer) {
                    loginContainer.style.display = 'none';
                }

                // 顯示需要登入的元素
                authRequiredElements.forEach(element => {
                    element.style.display = 'block';
                });

                // 載入文章列表
                loadArticles();

                // 設置登出按鈕事件
                setupLogoutButton();
            } else {
                // 隱藏用戶資訊，顯示登入按鈕
                if (userInfo) userInfo.style.display = 'none';
                if (loginContainer) loginContainer.style.display = 'block';

                // 隱藏需要登入的元素
                authRequiredElements.forEach(element => {
                    element.style.display = 'none';
                });
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
        }
    }

    /**
     * Setup hamburger menu and sidebar functionality
     */
    function setupHamburgerMenu() {
        // Toggle sidebar when hamburger menu is clicked
        if (hamburgerMenu) {
            hamburgerMenu.addEventListener('click', function() {
                console.log('Hamburger menu clicked');
                if (hamburgerIcon) hamburgerIcon.classList.toggle('open');
                if (sidebar) sidebar.classList.toggle('open');
                if (overlay) overlay.classList.toggle('active');
            });
        }

        // Close sidebar when overlay is clicked
        if (overlay) {
            overlay.addEventListener('click', function() {
                if (hamburgerIcon) hamburgerIcon.classList.remove('open');
                if (sidebar) sidebar.classList.remove('open');
                if (overlay) overlay.classList.remove('active');
            });
        }

        // Close sidebar when close button is clicked
        if (closeSidebar) {
            closeSidebar.addEventListener('click', function() {
                if (hamburgerIcon) hamburgerIcon.classList.remove('open');
                if (sidebar) sidebar.classList.remove('open');
                if (overlay) overlay.classList.remove('active');
            });
        }

        // Handle logout clicks
        if (logoutLink) {
            logoutLink.addEventListener('click', function(e) {
                e.preventDefault();
                window.location.href = `${BASE_PATH}/logout`;
            });
        }
    }

    /**
     * Setup text-to-speech functionality
     */
    function setupTextToSpeech() {
        // 從 URL 參數加載文章
        loadArticleFromUrl();

        // 添加語音速度變更事件監聽器
        speedOptions.forEach(option => {
            option.addEventListener('change', function() {
                // 如果有當前文章內容，則使用新的速度重新轉換
                if (currentArticleContent) {
                    processTextToSpeech(currentArticleContent);
                }
            });
        });
    }

    /**
     * Get the selected speech rate
     * @return {number} The selected speech rate
     */
    function getSelectedRate() {
        // 默認使用正常速度 (1.0)
        let rate = 1.0;

        // 檢查是否有選中的速度選項
        speedOptions.forEach(option => {
            if (option.checked) {
                rate = parseFloat(option.value);
            }
        });

        console.log('Selected speech rate:', rate);
        return rate;
    }

    /**
     * Process text for text-to-speech conversion
     * @param {string} text - The text to convert
     */
    function processTextToSpeech(text) {
        // 顯示處理中狀態
        if (statusMessage) {
            statusMessage.textContent = '正在轉換...';
            statusMessage.className = 'info';
        }

        // Split text into paragraphs
        const paragraphs = text.split(/\n+/).filter(p => p.trim() !== '');

        // Clear previous text display
        textDisplay.innerHTML = '';

        // Create paragraph elements
        paragraphs.forEach((paragraph, index) => {
            const p = document.createElement('div');
            p.className = 'paragraph';
            p.dataset.index = index;
            p.dataset.text = paragraph; // Store paragraph text for later use

            // Split paragraph into words
            const words = paragraph.split(/\s+/).filter(w => w !== '');
            words.forEach((word, wordIndex) => {
                const span = document.createElement('span');
                span.className = 'word';
                span.textContent = word + ' ';
                span.dataset.index = wordIndex;
                span.dataset.word = word; // Store word text for later use
                p.appendChild(span);
            });

            textDisplay.appendChild(p);
        });

        // Get speech rate from radio buttons
        const rate = getSelectedRate();

        // Add click event to paragraphs - synthesize each paragraph separately
        const paragraphElements = textDisplay.querySelectorAll('.paragraph');
        paragraphElements.forEach(p => {
            p.addEventListener('click', function() {
                const paragraphText = this.dataset.text;

                // Show paragraph is being processed
                this.classList.add('processing');

                // Get current speech rate (it might have changed)
                const currentRate = getSelectedRate();

                // Synthesize just this paragraph
                fetch(`${BASE_PATH}/api/synthesize`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: paragraphText,
                        rate: currentRate
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Remove processing class
                        this.classList.remove('processing');

                        // Play just this paragraph
                        const paragraphAudio = new Audio(data.audio_url);
                        paragraphAudio.play();
                    }
                })
                .catch(error => {
                    console.error('Error synthesizing paragraph:', error);
                    this.classList.remove('processing');
                });
            });
        });

        // Add click event to words
        const wordElements = textDisplay.querySelectorAll('.word');
        wordElements.forEach(word => {
            word.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent paragraph click

                const wordText = this.dataset.word;

                // Show word is being processed
                this.classList.add('processing');

                // Get current speech rate (it might have changed)
                const currentRate = getSelectedRate();

                // Synthesize just this word
                fetch(`${BASE_PATH}/api/synthesize-word`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        word: wordText,
                        rate: currentRate
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Remove processing class
                        this.classList.remove('processing');

                        // Play just this word
                        const wordAudio = new Audio(data.audio_url);
                        wordAudio.play();
                    }
                })
                .catch(error => {
                    console.error('Error synthesizing word:', error);
                    this.classList.remove('processing');
                });
            });
        });

        // 顯示完成狀態
        if (statusMessage) {
            statusMessage.textContent = '轉換完成！點擊段落或單詞進行朗讀。';
            statusMessage.className = 'success';
        }
    }

    /**
     * Load article from URL parameter if present
     */
    function loadArticleFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const articleId = urlParams.get('article_id');

        if (articleId) {
            console.log('Loading article from URL:', articleId);
            currentArticleId = articleId;

            fetch(`${BASE_PATH}/api/articles/${articleId}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Article not found');
                    }
                    return response.json();
                })
                .then(article => {
                    console.log('Article loaded:', article.title);

                    // 保存當前文章內容
                    currentArticleContent = article.content;

                    // 處理文章內容
                    processTextToSpeech(currentArticleContent);
                })
                .catch(error => {
                    console.error('Error loading article:', error);
                    if (statusMessage) {
                        statusMessage.textContent = 'Error loading article: ' + error.message;
                        statusMessage.className = 'error';
                    }
                });
        }
    }

    // 載入文章列表
    async function loadArticles() {
        const articlesList = document.getElementById('index-articles-list');
        if (!articlesList) return;

        try {
            articlesList.innerHTML = '<div class="index-loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading articles...</div>';

            const response = await fetch(`${BASE_PATH}/api/articles`);
            if (!response.ok) {
                throw new Error('Failed to load articles');
            }

            const articles = await response.json();

            if (articles.length === 0) {
                articlesList.innerHTML = '<p class="index-no-articles">No articles found. Go to "My Articles" to create some.</p>';
                return;
            }

            // 顯示文章列表（只讀模式）
            displayArticlesList(articles);
        } catch (error) {
            console.error('Error loading articles:', error);
            articlesList.innerHTML = '<p class="index-error-message">Error loading articles. Please try again.</p>';
        }
    }

    // 顯示文章列表（只讀模式）
    function displayArticlesList(articles) {
        const articlesList = document.getElementById('index-articles-list');
        if (!articlesList) return;

        articlesList.innerHTML = '';

        articles.forEach(article => {
            const articleElement = document.createElement('div');
            articleElement.className = 'index-article-item';

            const titleElement = document.createElement('h4');
            titleElement.textContent = article.title;

            const dateElement = document.createElement('p');
            dateElement.className = 'index-article-date';
            const createdDate = new Date(article.created_at);
            dateElement.textContent = `${createdDate.toLocaleDateString()}`;

            const readButton = document.createElement('button');
            readButton.className = 'index-read-btn';
            readButton.innerHTML = '<i class="fas fa-book-reader"></i> 閱讀';
            readButton.addEventListener('click', () => {
                window.location.href = `/?article_id=${article.id}`;
            });

            articleElement.appendChild(titleElement);
            articleElement.appendChild(dateElement);
            articleElement.appendChild(readButton);

            articlesList.appendChild(articleElement);
        });
    }

    // 設置登出按鈕事件
    function setupLogoutButton() {
        if (logoutLink) {
            logoutLink.addEventListener('click', function(e) {
                e.preventDefault();
                window.location.href = `${BASE_PATH}/logout`;
            });
        }
    }
});