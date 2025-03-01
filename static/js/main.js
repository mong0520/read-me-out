/**
 * Read Me Out - Main JavaScript
 *
 * This file handles the main functionality of the Read Me Out application,
 * including text-to-speech conversion, user authentication display,
 * and hamburger menu/sidebar functionality.
 */

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
    const convertBtn = document.getElementById('convert-btn');
    const textInput = document.getElementById('text-input');
    const speedOptions = document.querySelectorAll('input[name="speed"]');
    const textDisplay = document.getElementById('text-display');
    const statusMessage = document.getElementById('status-message');

    // Initialize features
    checkAuthStatus();
    setupHamburgerMenu();
    setupTextToSpeech();
    loadArticleFromUrl();

    /**
     * Check user authentication status and update UI accordingly
     */
    function checkAuthStatus() {
        console.log('Checking authentication status');
        fetch('/user')
            .then(response => response.json())
            .then(data => {
                if (data.authenticated) {
                    // User is authenticated
                    console.log('User is authenticated:', data.name);

                    // Update main header
                    if (userInfo) userInfo.style.display = 'flex';
                    if (loginContainer) loginContainer.style.display = 'none';
                    if (userPic) userPic.style.backgroundImage = `url(${data.profile_pic})`;
                    if (userName) userName.textContent = data.name;

                    // Show auth-required items
                    if (authRequiredItems) {
                        authRequiredItems.forEach(item => {
                            item.style.display = 'block';
                        });
                    }
                } else {
                    // User is not authenticated
                    console.log('User is not authenticated');

                    // Update main header
                    if (userInfo) userInfo.style.display = 'none';
                    if (loginContainer) loginContainer.style.display = 'block';

                    // Hide auth-required items
                    if (authRequiredItems) {
                        authRequiredItems.forEach(item => {
                            item.style.display = 'none';
                        });
                    }
                }
            })
            .catch(error => {
                console.error('Error checking authentication status:', error);
            });
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
                window.location.href = '/logout';
            });
        }
    }

    /**
     * Setup text-to-speech functionality
     */
    function setupTextToSpeech() {
        // Skip if required elements don't exist
        if (!convertBtn || !textInput || !textDisplay) {
            return;
        }

        // Handle convert button click
        convertBtn.addEventListener('click', function() {
            console.log('Convert button clicked');
            const text = textInput.value.trim();

            // Validate input
            if (!text) {
                if (statusMessage) {
                    statusMessage.textContent = 'Please enter some text.';
                    statusMessage.className = 'error';
                }
                return;
            }

            // Show converting status
            if (statusMessage) {
                statusMessage.textContent = 'Converting...';
                statusMessage.className = 'info';
            }

            // Process text
            processTextToSpeech(text);
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

        return rate;
    }

    /**
     * Process text for text-to-speech conversion
     * @param {string} text - The text to convert
     */
    function processTextToSpeech(text) {
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
        console.log('Selected speech rate:', rate);

        // Create full text audio for reference (but don't use it for paragraph clicks)
        fetch('/api/synthesize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                rate: rate
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show success message
                if (statusMessage) {
                    statusMessage.textContent = 'Conversion complete!';
                    statusMessage.className = 'success';
                }

                // Add click event to paragraphs - synthesize each paragraph separately
                const paragraphElements = textDisplay.querySelectorAll('.paragraph');
                paragraphElements.forEach(p => {
                    p.addEventListener('click', function() {
                        const paragraphText = this.dataset.text;

                        // Show paragraph is being processed
                        this.classList.add('processing');

                        // Synthesize just this paragraph
                        fetch('/api/synthesize', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                text: paragraphText,
                                rate: rate
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

                        // Synthesize just this word
                        fetch('/api/synthesize-word', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                word: wordText,
                                rate: rate
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
            } else {
                // Show error message
                if (statusMessage) {
                    statusMessage.textContent = 'Error: ' + data.error;
                    statusMessage.className = 'error';
                }
            }
        })
        .catch(error => {
            // Show error message
            if (statusMessage) {
                statusMessage.textContent = 'Error: ' + error.message;
                statusMessage.className = 'error';
            }
            console.error('Error synthesizing speech:', error);
        });
    }

    /**
     * Load article from URL parameter if present
     */
    function loadArticleFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const articleId = urlParams.get('article_id');

        if (articleId && textInput) {
            console.log('Loading article from URL:', articleId);

            fetch(`/api/articles/${articleId}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Article not found');
                    }
                    return response.json();
                })
                .then(article => {
                    console.log('Article loaded:', article.title);
                    textInput.value = article.content;

                    // Trigger conversion
                    if (convertBtn) {
                        convertBtn.click();
                    }
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
});