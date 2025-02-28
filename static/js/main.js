document.addEventListener('DOMContentLoaded', function() {
    const textInput = document.getElementById('text-input');
    const submitButton = document.getElementById('submit-button');
    const textDisplay = document.getElementById('text-display');
    const loadingElement = document.getElementById('loading');
    const statusElement = document.getElementById('status');
    const speedControl = document.getElementById('speed-control');

    // Fixed voice
    const VOICE_ID = 'Ruth';

    // Default speech rate
    let speechRate = 0.8; // 0.8 = 80% of normal speed

    // Initialize speed control if it exists
    if (speedControl) {
        speedControl.value = speechRate;
        speedControl.addEventListener('change', function() {
            speechRate = parseFloat(this.value);
            document.getElementById('speed-value').textContent = `${Math.round(speechRate * 100)}%`;
        });
    }

    // Audio player
    let audioPlayer = new Audio();

    // Submit button event listener
    submitButton.addEventListener('click', function() {
        const text = textInput.value.trim();

        if (!text) {
            showStatus('Please enter some text', 'error');
            return;
        }

        // Show loading indicator
        loadingElement.style.display = 'block';

        // Clear previous status
        statusElement.textContent = '';
        statusElement.className = 'status';

        // Send text to backend
        fetch('/api/synthesize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                voice_id: VOICE_ID,
                rate: speechRate
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Hide loading indicator
                loadingElement.style.display = 'none';

                // Display the text with interactive elements
                displayText(text);

                // Set the audio source
                audioPlayer.src = data.audio_url;

                // Check if the URL contains a timestamp parameter (indicates new generation)
                if (data.audio_url.includes('?')) {
                    showStatus('Text processed successfully! (New audio generated)', 'success');
                } else {
                    showStatus('Text processed successfully! (Using cached audio)', 'success cached');
                }
            } else {
                throw new Error(data.error || 'Failed to process text');
            }
        })
        .catch(error => {
            loadingElement.style.display = 'none';
            showStatus(`Error: ${error.message}`, 'error');
        });
    });

    // Function to display text with interactive elements
    function displayText(text) {
        // Clear previous content
        textDisplay.innerHTML = '';

        // Split text into paragraphs
        const paragraphs = text.split(/\n+/);

        paragraphs.forEach((paragraph, index) => {
            if (paragraph.trim() === '') return;

            const paragraphElement = document.createElement('div');
            paragraphElement.className = 'paragraph';
            paragraphElement.dataset.index = index;

            // Split paragraph into words
            const words = paragraph.split(/\s+/);

            words.forEach(word => {
                if (word.trim() === '') return;

                const wordSpan = document.createElement('span');
                wordSpan.className = 'word';
                wordSpan.textContent = word + ' ';

                // Add click event to play individual word
                wordSpan.addEventListener('click', function(e) {
                    e.stopPropagation(); // Prevent paragraph click
                    playWord(word);
                });

                paragraphElement.appendChild(wordSpan);
            });

            // Add click event to play entire paragraph
            paragraphElement.addEventListener('click', function() {
                playParagraph(paragraph);
            });

            textDisplay.appendChild(paragraphElement);
        });
    }

    // Function to play a single word
    function playWord(word) {
        loadingElement.style.display = 'block';

        fetch('/api/synthesize-word', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                word: word,
                voice_id: VOICE_ID,
                rate: speechRate
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadingElement.style.display = 'none';

                // Play the audio
                const wordAudio = new Audio(data.audio_url);
                wordAudio.play();

                // Indicate if cached audio was used
                if (data.audio_url.includes('?')) {
                    showStatus(`Playing: "${word}" (New audio)`, 'info');
                } else {
                    showStatus(`Playing: "${word}" (Cached audio)`, 'info cached');
                }
            } else {
                throw new Error(data.error || 'Failed to process word');
            }
        })
        .catch(error => {
            loadingElement.style.display = 'none';
            showStatus(`Error: ${error.message}`, 'error');
        });
    }

    // Function to play a paragraph
    function playParagraph(paragraph) {
        loadingElement.style.display = 'block';

        fetch('/api/synthesize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: paragraph,
                voice_id: VOICE_ID,
                rate: speechRate
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadingElement.style.display = 'none';

                // Play the audio
                const paragraphAudio = new Audio(data.audio_url);
                paragraphAudio.play();

                // Indicate if cached audio was used
                if (data.audio_url.includes('?')) {
                    showStatus('Playing paragraph (New audio)', 'info');
                } else {
                    showStatus('Playing paragraph (Cached audio)', 'info cached');
                }
            } else {
                throw new Error(data.error || 'Failed to process paragraph');
            }
        })
        .catch(error => {
            loadingElement.style.display = 'none';
            showStatus(`Error: ${error.message}`, 'error');
        });
    }

    // Function to show status messages
    function showStatus(message, type) {
        statusElement.textContent = message;
        statusElement.className = 'status ' + type;
    }
});