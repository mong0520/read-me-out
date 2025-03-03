/**
 * Read Me Out - Dashboard JavaScript
 *
 * This file handles the article management functionality in the dashboard,
 * including listing, creating, editing, and deleting articles.
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard: DOM fully loaded');

    // DOM Elements
    const articlesList = document.getElementById('articles-list');
    const newArticleBtn = document.getElementById('new-article-btn');
    const articleModal = document.getElementById('article-modal');
    const modalTitle = document.getElementById('modal-title');
    const articleForm = document.getElementById('article-form');
    const articleIdInput = document.getElementById('article-id');
    const articleTitleInput = document.getElementById('article-title');
    const articleContentInput = document.getElementById('article-content');
    const cancelBtn = document.getElementById('cancel-btn');
    const closeModal = document.querySelector('.close-modal');

    // Initialize
    loadArticles();
    setupEventListeners();

    /**
     * Load articles from the server
     */
    async function loadArticles() {
        if (!articlesList) return;

        // Show loading spinner
        articlesList.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading articles...</div>';

        try {
            const response = await fetch(`${BASE_PATH}/api/articles`);
            if (!response.ok) {
                throw new Error('Failed to load articles');
            }
            const articles = await response.json();
            displayArticles(articles);
        } catch (error) {
            console.error('Error loading articles:', error);
            articlesList.innerHTML = `<div class="error">Error loading articles: ${error.message}</div>`;
        }
    }

    /**
     * Add event listeners to article action buttons
     */
    function addArticleButtonListeners() {
        // Edit buttons
        document.querySelectorAll('.btn-edit').forEach(button => {
            button.addEventListener('click', function() {
                const articleId = this.getAttribute('data-id');
                openEditModal(articleId);
            });
        });

        // Delete buttons
        document.querySelectorAll('.btn-delete').forEach(button => {
            button.addEventListener('click', function() {
                const articleId = this.getAttribute('data-id');
                deleteArticle(articleId);
            });
        });

        // Read buttons
        document.querySelectorAll('.btn-read').forEach(button => {
            button.addEventListener('click', function() {
                const articleId = this.getAttribute('data-id');
                window.location.href = `${BASE_PATH}/?article_id=${articleId}`;
            });
        });
    }

    /**
     * Setup event listeners for dashboard elements
     */
    function setupEventListeners() {
        // New article button
        if (newArticleBtn) {
            newArticleBtn.addEventListener('click', openNewModal);
        }

        // Article form submission
        if (articleForm) {
            articleForm.addEventListener('submit', saveArticle);
        }

        // Cancel button
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModalFunc);
        }

        // Close modal button
        if (closeModal) {
            closeModal.addEventListener('click', closeModalFunc);
        }

        // Close modal when clicking outside
        window.addEventListener('click', function(event) {
            if (event.target === articleModal) {
                closeModalFunc();
            }
        });
    }

    /**
     * Open modal for creating a new article
     */
    function openNewModal() {
        if (!articleModal) return;

        modalTitle.textContent = 'New Article';
        articleIdInput.value = '';
        articleTitleInput.value = '';
        articleContentInput.value = '';
        articleModal.style.display = 'block';
    }

    /**
     * Open modal for editing an existing article
     * @param {string} articleId - The ID of the article to edit
     */
    function openEditModal(articleId) {
        if (!articleModal) return;

        modalTitle.textContent = 'Edit Article';

        // Show loading state
        articleTitleInput.value = 'Loading...';
        articleContentInput.value = 'Loading...';
        articleModal.style.display = 'block';

        // Fetch article data
        getArticle(articleId)
            .then(article => {
                articleIdInput.value = article.id;
                articleTitleInput.value = article.title;
                articleContentInput.value = article.content;
            })
            .catch(error => {
                console.error('Error loading article for editing:', error);
                alert(`Error: ${error.message}`);
                closeModalFunc();
            });
    }

    /**
     * Close the article modal
     */
    function closeModalFunc() {
        if (articleModal) {
            articleModal.style.display = 'none';
        }
    }

    /**
     * Save an article (create or update)
     * @param {Event} event - The form submission event
     */
    function saveArticle(event) {
        event.preventDefault();

        const articleId = articleIdInput.value;
        const title = articleTitleInput.value;
        const content = articleContentInput.value;

        if (!title || !content) {
            alert('Title and content are required');
            return;
        }

        if (articleId) {
            updateArticle(articleId, title, content);
        } else {
            createArticle(title, content);
        }
    }

    /**
     * Delete an article
     * @param {string} articleId - The ID of the article to delete
     */
    async function deleteArticle(articleId) {
        if (!confirm('Are you sure you want to delete this article?')) {
            return;
        }

        try {
            const response = await fetch(`${BASE_PATH}/api/articles/${articleId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete article');
            }

            await loadArticles();
            showMessage('Article deleted successfully!', 'success');
        } catch (error) {
            console.error('Error deleting article:', error);
            showMessage('Error deleting article. Please try again.', 'error');
        }
    }

    /**
     * Get a single article
     * @param {string} articleId - The ID of the article to get
     * @returns {Promise<Object>} - The article data
     */
    async function getArticle(articleId) {
        try {
            const response = await fetch(`${BASE_PATH}/api/articles/${articleId}`);
            if (!response.ok) {
                throw new Error('Failed to load article');
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading article:', error);
            showMessage('Error loading article. Please try again.', 'error');
            return null;
        }
    }

    /**
     * Create a new article
     * @param {string} title - The title of the new article
     * @param {string} content - The content of the new article
     */
    async function createArticle(title, content) {
        try {
            const response = await fetch(`${BASE_PATH}/api/articles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });

            if (!response.ok) {
                throw new Error('Failed to create article');
            }

            await loadArticles();
            closeModal();
            showMessage('Article created successfully!', 'success');
        } catch (error) {
            console.error('Error creating article:', error);
            showMessage('Error creating article. Please try again.', 'error');
        }
    }

    /**
     * Update an article
     * @param {string} id - The ID of the article to update
     * @param {string} title - The new title of the article
     * @param {string} content - The new content of the article
     */
    async function updateArticle(id, title, content) {
        try {
            const response = await fetch(`${BASE_PATH}/api/articles/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });

            if (!response.ok) {
                throw new Error('Failed to update article');
            }

            await loadArticles();
            closeModal();
            showMessage('Article updated successfully!', 'success');
        } catch (error) {
            console.error('Error updating article:', error);
            showMessage('Error updating article. Please try again.', 'error');
        }
    }

    /**
     * Display articles in the articles list
     * @param {Array<Object>} articles - The list of articles to display
     */
    function displayArticles(articles) {
        if (articles.length === 0) {
            // No articles found
            articlesList.innerHTML = '<div class="no-articles">You don\'t have any articles yet. Click "New Article" to create one.</div>';
            return;
        }

        // Clear articles list
        articlesList.innerHTML = '';

        // Add each article to the list
        articles.forEach(article => {
            const articleElement = document.createElement('div');
            articleElement.className = 'article-item';
            articleElement.innerHTML = `
                <div class="article-header">
                    <h3 class="article-title">${escapeHtml(article.title)}</h3>
                    <div class="article-actions">
                        <button class="btn btn-small btn-edit" data-id="${article.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-small btn-delete" data-id="${article.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn btn-small btn-read" data-id="${article.id}">
                            <i class="fas fa-book-reader"></i>
                        </button>
                    </div>
                </div>
                <div class="article-date">
                    Last updated: ${new Date(article.updated_at).toLocaleString()}
                </div>
                <div class="article-preview">
                    ${escapeHtml(article.content.substring(0, 150))}${article.content.length > 150 ? '...' : ''}
                </div>
            `;

            articlesList.appendChild(articleElement);
        });

        // Add event listeners to buttons
        addArticleButtonListeners();
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} unsafe - The unsafe string
     * @return {string} - The escaped string
     */
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Show a message to the user
     * @param {string} message - The message to show
     * @param {string} type - The type of message (e.g., 'success', 'error')
     */
    function showMessage(message, type) {
        // Implementation of showMessage function
    }
});
