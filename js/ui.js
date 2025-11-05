/**
 * UI Controller Module
 * Handles all user interface interactions and DOM manipulation
 */

import { CONFIG } from './config.js';
import { DOM, Formatter, AppError, ErrorTypes } from './utils.js';

export class UIController {
    constructor() {
        this.currentRecipe = null;
        this.originalServings = 1;
        this.currentServings = 1;
        this.savedRecipes = [];
        this.allSavedRecipes = []; // Keep original list separate from displayed list
        this.eventListeners = new Map();
        this.isRecipeFromSaved = false; // Track if recipe came from saved list

        this.initializeElements();
    }

    /**
     * Initialize DOM elements and cache references
     */
    initializeElements() {
        this.elements = {
            // Views
            homeView: DOM.getElementById('homeView'),
            savedView: DOM.getElementById('savedView'),
            detailView: DOM.getElementById('detailView'),

            // Input elements
            recipeUrl: DOM.getElementById('recipeUrl'),
            fetchBtn: DOM.getElementById('fetchBtn'),
            searchInput: DOM.getElementById('searchInput'),

            // Display containers
            recipeContainer: DOM.getElementById('recipeContainer'),
            savedRecipesContainer: DOM.getElementById('savedRecipesContainer'),
            recipeDetailContainer: DOM.getElementById('recipeDetailContainer'),

            // Message elements
            loadingContainer: DOM.getElementById('loadingContainer'),
            errorMessage: DOM.getElementById('errorMessage'),
            successMessage: DOM.getElementById('successMessage'),

            // Image upload elements
            imageUpload: DOM.getElementById('imageUpload'), // Keep for backward compatibility
            cameraInput: DOM.getElementById('cameraInput'),
            galleryInput: DOM.getElementById('galleryInput'),
            uploadArea: DOM.getElementById('uploadArea'),
            imagePreview: DOM.getElementById('imagePreview'),
            processImageBtn: DOM.getElementById('processImageBtn'),
            clearImageBtn: DOM.getElementById('clearImageBtn'),

            // Help modal elements
            helpBtn: DOM.getElementById('helpBtn'),
            helpModal: DOM.getElementById('helpModal'),
            helpModalClose: DOM.querySelector('.help-modal-close'),

            // Backup/restore elements
            backupBtn: DOM.getElementById('backupBtn'),
            restoreBtn: DOM.getElementById('restoreBtn'),
            restoreFileInput: DOM.getElementById('restoreFileInput'),

            // Navigation
            navItems: DOM.querySelectorAll('.nav-item')
        };

        // Debug: Log if critical elements are found
        console.log('UI Elements initialized:');
        console.log('- cameraInput:', !!this.elements.cameraInput);
        console.log('- galleryInput:', !!this.elements.galleryInput);
        console.log('- navItems found:', this.elements.navItems.length);
        console.log('- helpBtn found:', !!this.elements.helpBtn);
        console.log('- helpModal found:', !!this.elements.helpModal);

        // Log each nav item for debugging
        this.elements.navItems.forEach((nav, index) => {
            console.log(`Nav item ${index}:`, nav.textContent.trim(), 'data-view:', nav.getAttribute('data-view'));
        });
    }

    /**
     * Setup event listeners with automatic cleanup tracking
     */
    setupEventListeners() {
        try {
            // Navigation
            console.log('Setting up navigation listeners, found nav items:', this.elements.navItems.length);
            if (this.elements.navItems.length === 0) {
                console.error('No navigation items found! This will prevent navigation from working.');
            }

            this.elements.navItems.forEach((nav, index) => {
                console.log(`Nav item ${index}:`, nav, 'data-view:', nav.getAttribute('data-view'));
                this.addEventListenerWithCleanup(nav, 'click', (e) => {
                    e.preventDefault();
                    const viewId = nav.getAttribute('data-view');
                    console.log('Navigation clicked:', viewId); // Debug logging
                    this.showView(viewId);
                });
            });
        } catch (error) {
            console.error('Error setting up navigation listeners:', error);
        }

        // Recipe URL input
        if (this.elements.fetchBtn) {
            this.addEventListenerWithCleanup(this.elements.fetchBtn, 'click', () => {
                this.handleFetchRecipe();
            });
        }

        if (this.elements.recipeUrl) {
            this.addEventListenerWithCleanup(this.elements.recipeUrl, 'keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleFetchRecipe();
                }
            });
        }

        // Search functionality
        if (this.elements.searchInput) {
            this.addEventListenerWithCleanup(this.elements.searchInput, 'input', (e) => {
                const query = e.target.value;
                this.handleSearch(query);
                this.toggleClearButton(query);
            });
        }

        // Clear search button
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        console.log('Clear search button element:', clearSearchBtn);
        if (clearSearchBtn) {
            console.log('Adding click listener to clear search button');
            this.addEventListenerWithCleanup(clearSearchBtn, 'click', () => {
                console.log('Clear button clicked!');
                this.clearSearch();
            });
        } else {
            console.log('Clear search button not found!');
        }

        // Image upload functionality
        this.setupImageUploadListeners();
        this.setupImageModalListeners();

        // Help modal functionality
        this.setupHelpModalListeners();

        // Backup/restore functionality
        this.setupBackupRestoreListeners();

        // Layout orientation detection
        this.setupLayoutDetection();

        // Saved recipes click handling (using event delegation)
        if (this.elements.savedRecipesContainer) {
            this.addEventListenerWithCleanup(this.elements.savedRecipesContainer, 'click', (e) => {
                const action = e.target.getAttribute('data-action') || e.target.closest('[data-action]')?.getAttribute('data-action');

                // Try multiple ways to get the URL or recipe ID
                let url = e.target.getAttribute('data-url');
                let recipeId = e.target.getAttribute('data-recipe-id');
                console.log('URL from target:', url, 'Recipe ID from target:', recipeId); // Debug log

                if (!url && !recipeId) {
                    const closestWithData = e.target.closest('[data-url], [data-recipe-id]');
                    if (closestWithData) {
                        url = closestWithData.getAttribute('data-url');
                        recipeId = closestWithData.getAttribute('data-recipe-id');
                        console.log('URL from closest:', url, 'Recipe ID from closest:', recipeId); // Debug log
                    }
                }

                if (!url && !recipeId) {
                    // Fall back to getting data from the recipe list item
                    const recipeItem = e.target.closest('.recipe-list-item');
                    if (recipeItem) {
                        url = recipeItem.getAttribute('data-url');
                        recipeId = recipeItem.getAttribute('data-recipe-id');
                        console.log('URL from recipe item:', url, 'Recipe ID from recipe item:', recipeId); // Debug log
                    }
                }

                console.log('Saved recipes click - Target:', e.target.tagName, e.target.className); // Debug log
                console.log('Saved recipes click - Action:', action, 'URL:', url, 'Recipe ID:', recipeId); // Debug log

                switch (action) {
                    case 'load-recipe':
                        if (url || recipeId) {
                            this.loadRecipeFromSaved(url, recipeId);
                        }
                        break;
                    case 'toggle-menu':
                        e.stopPropagation(); // Prevent recipe loading
                        this.toggleRecipeMenu(e.target);
                        break;
                    case 'delete-recipe':
                        e.stopPropagation(); // Prevent recipe loading
                        console.log('Delete recipe clicked with URL:', url, 'Recipe ID:', recipeId); // Debug log
                        console.log('Delete button element:', e.target);
                        console.log('Delete button data-url:', e.target.getAttribute('data-url'));
                        console.log('Delete button data-recipe-id:', e.target.getAttribute('data-recipe-id'));

                        // Try to get the data from the button directly if not found above
                        const buttonUrl = e.target.getAttribute('data-url') || url;
                        const buttonRecipeId = e.target.getAttribute('data-recipe-id') || recipeId;

                        console.log('Final values - URL:', buttonUrl, 'Recipe ID:', buttonRecipeId);

                        if (buttonUrl || buttonRecipeId) {
                            this.handleDeleteRecipe(buttonUrl, buttonRecipeId);
                        } else {
                            console.error('No URL or Recipe ID found for delete action'); // Debug log
                            console.error('Available allSavedRecipes:', this.allSavedRecipes.map(r => ({ title: r.title, url: r.url, recipeId: r.recipeId })));
                        }
                        break;
                    default:
                        // Handle clicks on recipe info area (backward compatibility)
                        const item = e.target.closest('.recipe-list-item');
                        if (item && !e.target.closest('.recipe-menu')) {
                            const itemUrl = item.getAttribute('data-url');
                            const itemRecipeId = item.getAttribute('data-recipe-id');
                            if (itemUrl || itemRecipeId) {
                                this.loadRecipeFromSaved(itemUrl, itemRecipeId);
                            }
                        }
                }
            });
        }

        // Recipe display click handling (using event delegation)
        if (this.elements.recipeContainer) {
            this.addEventListenerWithCleanup(this.elements.recipeContainer, 'click', (e) => {
                console.log('Recipe container clicked:', e.target); // Debug log
                console.log('Target element:', e.target.tagName, e.target.className);

                const action = e.target.getAttribute('data-action');
                const index = e.target.getAttribute('data-index');

                console.log('Action detected:', action); // Debug log

                switch (action) {
                    case 'decrease-serving':
                        console.log('Decrease serving clicked');
                        this.adjustServing(-1);
                        break;
                    case 'increase-serving':
                        console.log('Increase serving clicked');
                        this.adjustServing(1);
                        break;
                    case 'toggle-ingredient':
                        console.log('Toggle ingredient clicked');
                        this.toggleIngredient(parseInt(index));
                        break;
                    case 'view-instructions':
                        console.log('View instructions clicked'); // Debug log
                        this.showDetailedView();
                        break;
                    case 'save-recipe':
                        console.log('Save recipe clicked');
                        this.handleSaveRecipe();
                        break;
                    case 'share-recipe':
                        console.log('Share recipe clicked');
                        this.shareRecipe();
                        break;
                    case 'print-recipe':
                        console.log('Print recipe clicked');
                        this.printRecipe();
                        break;
                    case 'edit-ingredient':
                        console.log('Edit ingredient clicked');
                        this.editIngredient(parseInt(index));
                        break;
                    case 'edit-step':
                        console.log('Edit step clicked');
                        this.editStep(parseInt(index));
                        break;
                    case 'add-ingredient':
                        console.log('Add ingredient clicked');
                        this.addNewIngredient();
                        break;
                    case 'add-step':
                        console.log('Add step clicked');
                        this.addNewStep();
                        break;
                    case 'edit-title':
                        console.log('Edit title clicked');
                        this.editTitle();
                        break;
                    case 'save-title':
                        console.log('Save title clicked');
                        this.saveTitle();
                        break;
                    case 'cancel-title':
                        console.log('Cancel title clicked');
                        this.cancelTitleEdit();
                        break;
                    case 'edit-prep-time':
                        console.log('Edit prep time clicked');
                        this.editPrepTime();
                        break;
                    case 'save-prep-time':
                        console.log('Save prep time clicked');
                        this.savePrepTime();
                        break;
                    case 'cancel-prep-time':
                        console.log('Cancel prep time clicked');
                        this.cancelPrepTimeEdit();
                        break;
                    case 'edit-cook-time':
                        console.log('Edit cook time clicked');
                        this.editCookTime();
                        break;
                    case 'save-cook-time':
                        console.log('Save cook time clicked');
                        this.saveCookTime();
                        break;
                    case 'cancel-cook-time':
                        console.log('Cancel cook time clicked');
                        this.cancelCookTimeEdit();
                        break;
                    case 'edit-servings':
                        console.log('Edit servings clicked');
                        this.editServings();
                        break;
                    case 'save-servings':
                        console.log('Save servings clicked');
                        this.saveServings();
                        break;
                    case 'cancel-servings':
                        console.log('Cancel servings clicked');
                        this.cancelServingsEdit();
                        break;
                    case 'save-ingredient':
                        console.log('Save ingredient clicked');
                        this.saveIngredient(parseInt(index));
                        break;
                    case 'cancel-ingredient':
                        console.log('Cancel ingredient clicked');
                        this.cancelIngredientEdit(parseInt(index));
                        break;
                    case 'delete-ingredient':
                        console.log('Delete ingredient clicked');
                        this.deleteIngredient(parseInt(index));
                        break;
                    case 'save-step':
                        console.log('Save step clicked');
                        this.saveStep(parseInt(index));
                        break;
                    case 'cancel-step':
                        console.log('Cancel step clicked');
                        this.cancelStepEdit(parseInt(index));
                        break;
                    case 'delete-step':
                        console.log('Delete step clicked');
                        this.deleteStep(parseInt(index));
                        break;
                    default:
                        console.log('No action found for click');
                }
            });
        }

        // Global keyboard shortcuts
        this.addEventListenerWithCleanup(document, 'keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Close menus when clicking outside
        this.addEventListenerWithCleanup(document, 'click', (e) => {
            // Close recipe menus if clicking outside
            if (!e.target.closest('.recipe-menu')) {
                const openMenus = document.querySelectorAll('.recipe-menu-dropdown.active');
                openMenus.forEach(menu => menu.classList.remove('active'));
            }
        });

        // Fallback: Add direct event listeners if the wrapped version fails
        console.log('Adding fallback event listeners...');
        this.setupFallbackListeners();
    }

    /**
     * Setup backup and restore event listeners
     */
    setupBackupRestoreListeners() {
        try {
            console.log('Setting up backup/restore listeners...');

            // Backup button
            if (this.elements.backupBtn) {
                this.addEventListenerWithCleanup(this.elements.backupBtn, 'click', async () => {
                    console.log('Backup button clicked');
                    try {
                        const event = new CustomEvent('backup-requested');
                        document.dispatchEvent(event);
                    } catch (error) {
                        console.error('Backup failed:', error);
                        this.showError('Failed to create backup');
                    }
                });
                console.log('Backup button listener added');
            } else {
                console.warn('Backup button not found');
            }

            // Restore button
            if (this.elements.restoreBtn) {
                this.addEventListenerWithCleanup(this.elements.restoreBtn, 'click', () => {
                    console.log('Restore button clicked');
                    if (this.elements.restoreFileInput) {
                        this.elements.restoreFileInput.click();
                    }
                });
                console.log('Restore button listener added');
            } else {
                console.warn('Restore button not found');
            }

            // File input for restore
            if (this.elements.restoreFileInput) {
                this.addEventListenerWithCleanup(this.elements.restoreFileInput, 'change', async (e) => {
                    console.log('Restore file selected');
                    const file = e.target.files[0];
                    if (file) {
                        try {
                            const event = new CustomEvent('restore-requested', {
                                detail: { file }
                            });
                            document.dispatchEvent(event);
                        } catch (error) {
                            console.error('Restore failed:', error);
                            this.showError('Failed to restore from file');
                        }
                    }
                    // Clear the input
                    e.target.value = '';
                });
                console.log('Restore file input listener added');
            } else {
                console.warn('Restore file input not found');
            }

        } catch (error) {
            console.error('Error setting up backup/restore listeners:', error);
        }
    }

    /**
     * Setup fallback event listeners using direct DOM access
     */
    setupFallbackListeners() {
        try {
            // Direct navigation setup
            const navItems = document.querySelectorAll('.nav-item');
            console.log('Fallback: Found nav items:', navItems.length);

            navItems.forEach((nav, index) => {
                console.log(`Fallback nav item ${index}:`, nav.textContent.trim());
                nav.addEventListener('click', (e) => {
                    e.preventDefault();
                    const viewId = nav.getAttribute('data-view');
                    console.log('Fallback navigation clicked:', viewId);
                    this.showView(viewId);
                });
            });

            // Direct help button setup
            const helpBtn = document.getElementById('helpBtn');
            console.log('Fallback: Help button found:', !!helpBtn);

            if (helpBtn) {
                helpBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('Fallback help button clicked');
                    this.openHelpModal();
                });
            }
        } catch (error) {
            console.error('Error in fallback listener setup:', error);
        }
    }

    /**
     * Add event listener with cleanup tracking
     * @param {Element} element - DOM element
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     */
    addEventListenerWithCleanup(element, event, handler, options = {}) {
        if (!element) {
            console.warn(`Cannot add ${event} listener: element is null or undefined`);
            return;
        }

        console.log(`Adding ${event} listener to`, element.tagName || element.nodeName, element.id || element.className);

        const wrappedHandler = (e) => {
            try {
                console.log(`Event ${event} fired on`, element.tagName || element.nodeName);
                handler(e);
            } catch (error) {
                console.error('Event handler error:', error);
                this.showError(`An error occurred: ${error.message}`);
            }
        };

        try {
            element.addEventListener(event, wrappedHandler, options);
            console.log(`Successfully added ${event} listener`);

            // Track for cleanup
            const key = `${element.tagName}-${event}`;
            if (!this.eventListeners.has(key)) {
                this.eventListeners.set(key, []);
            }
            this.eventListeners.get(key).push({ element, event, handler: wrappedHandler, options });
        } catch (error) {
            console.error(`Failed to add ${event} listener:`, error);
        }
    }

    /**
     * Clean up all event listeners
     */
    cleanup() {
        this.eventListeners.forEach(listeners => {
            listeners.forEach(({ element, event, handler, options }) => {
                element.removeEventListener(event, handler, options);
            });
        });
        this.eventListeners.clear();
    }

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyboardShortcuts(e) {
        // Escape key - clear current operation
        if (e.key === 'Escape') {
            this.hideMessages();
            this.showLoading(false);
        }

        // Ctrl/Cmd + K - Focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (this.elements.searchInput) {
                this.elements.searchInput.focus();
            }
        }
    }

    /**
     * Handle fetch recipe button click
     */
    async handleFetchRecipe() {
        const url = this.elements.recipeUrl?.value?.trim();

        if (!url) {
            this.showError('Please enter a recipe URL');
            return;
        }

        // Dispatch custom event for recipe fetch
        const event = new CustomEvent('recipe-fetch-requested', {
            detail: { url }
        });
        document.dispatchEvent(event);
    }

    /**
     * Handle search input
     * @param {string} query - Search query
     */
    handleSearch(query) {
        const event = new CustomEvent('recipe-search', {
            detail: { query: query.toLowerCase().trim() }
        });
        document.dispatchEvent(event);
    }

    /**
     * Toggle visibility of clear search button
     * @param {string} query - Current search query
     */
    toggleClearButton(query) {
        const clearBtn = document.getElementById('clearSearchBtn');
        if (clearBtn) {
            clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
        }
    }

    /**
     * Clear search input and show all recipes
     */
    clearSearch() {
        console.log('clearSearch() called');
        if (this.elements.searchInput) {
            console.log('Setting search input value to empty');
            this.elements.searchInput.value = '';
            console.log('Calling handleSearch with empty string');
            this.handleSearch('');
            console.log('Calling toggleClearButton');
            this.toggleClearButton('');
            console.log('clearSearch() completed');
        } else {
            console.log('searchInput element not found!');
        }
    }

    /**
     * Show specific view
     * @param {string} viewId - View ID to show
     */
    showView(viewId) {
        console.log('showView called with:', viewId); // Debug logging

        // Hide all views
        document.querySelectorAll('.view-container').forEach(view => {
            view.classList.remove('active');
        });

        // Show target view
        const targetView = DOM.getElementById(viewId);
        if (targetView) {
            targetView.classList.add('active');
        }

        // Update navigation
        this.elements.navItems.forEach(nav => {
            nav.classList.remove('active');
        });

        const activeNav = document.querySelector(`[data-view="${viewId}"]`);
        if (activeNav) {
            activeNav.classList.add('active');
        }

        // Clear recipe display when returning to home view
        if (viewId === 'homeView') {
            console.log('Clearing recipe display for home view'); // Debug logging
            this.clearRecipeDisplay();
        }

        // Dispatch view change event
        const event = new CustomEvent('view-changed', {
            detail: { viewId }
        });
        document.dispatchEvent(event);
    }

    /**
     * Show specific view without clearing recipe display
     * @param {string} viewId - View ID to show
     */
    showViewWithoutClearing(viewId) {
        console.log('showViewWithoutClearing called with:', viewId); // Debug logging

        // Hide all views
        document.querySelectorAll('.view-container').forEach(view => {
            view.classList.remove('active');
        });

        // Show target view
        const targetView = DOM.getElementById(viewId);
        if (targetView) {
            targetView.classList.add('active');
        }

        // Update navigation
        this.elements.navItems.forEach(nav => {
            nav.classList.remove('active');
        });

        const activeNav = document.querySelector(`[data-view="${viewId}"]`);
        if (activeNav) {
            activeNav.classList.add('active');
        }

        // Don't clear recipe display - that's the key difference from showView

        // Dispatch view change event
        const event = new CustomEvent('view-changed', {
            detail: { viewId }
        });
        document.dispatchEvent(event);
    }

    /**
     * Clear recipe display and reset to initial state
     */
    clearRecipeDisplay() {
        if (this.elements.recipeContainer) {
            this.elements.recipeContainer.innerHTML = '';
        }

        // Reset recipe state
        this.currentRecipe = null;
        this.originalServings = 1;
        this.currentServings = 1;
        this.isRecipeFromSaved = false;

        // Clear any messages
        this.hideMessages();

        // Show input methods when clearing recipe display
        this.showInputMethods();

        // Clear URL input
        if (this.elements.recipeUrl) {
            this.elements.recipeUrl.value = '';
        }
    }

    /**
     * Hide input methods (URL and Photo options)
     */
    hideInputMethods() {
        const inputMethods = document.querySelectorAll('.input-method');
        inputMethods.forEach(element => {
            element.style.display = 'none';
        });
    }

    /**
     * Show input methods (URL and Photo options)
     */
    showInputMethods() {
        const inputMethods = document.querySelectorAll('.input-method');
        inputMethods.forEach(element => {
            element.style.display = 'block';
        });
    }

    /**
     * Setup image modal event listeners
     */
    setupImageModalListeners() {
        const modal = document.getElementById('imageModal');
        const closeBtn = document.querySelector('.image-modal-close');

        if (closeBtn) {
            this.addEventListenerWithCleanup(closeBtn, 'click', () => {
                this.closeImageModal();
            });
        }

        if (modal) {
            // Close modal when clicking overlay
            this.addEventListenerWithCleanup(modal, 'click', (e) => {
                if (e.target === modal || e.target.classList.contains('image-modal-overlay')) {
                    this.closeImageModal();
                }
            });
        }

        // Handle ESC key to close modal
        this.addEventListenerWithCleanup(document, 'keydown', (e) => {
            if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
                this.closeImageModal();
            }
        });

        // Handle clicks on recipe images (using event delegation)
        this.addEventListenerWithCleanup(document, 'click', (e) => {
            if (e.target.classList.contains('recipe-image')) {
                this.openImageModal(e.target.src, e.target.alt);
            }
        });
    }

    /**
     * Setup help modal event listeners
     */
    setupHelpModalListeners() {
        try {
            console.log('Setting up help modal listeners...');
            console.log('Help button found:', !!this.elements.helpBtn);
            console.log('Help modal found:', !!this.elements.helpModal);
            console.log('Help modal close button found:', !!this.elements.helpModalClose);

            // Help button click
            if (this.elements.helpBtn) {
                this.addEventListenerWithCleanup(this.elements.helpBtn, 'click', (e) => {
                    e.preventDefault();
                    console.log('Help button clicked');
                    this.openHelpModal();
                });
                console.log('Help button listener added');
            } else {
                console.error('Help button not found!');
            }

            // Help modal close button
            if (this.elements.helpModalClose) {
                this.addEventListenerWithCleanup(this.elements.helpModalClose, 'click', () => {
                    this.closeHelpModal();
                });
            } else {
                console.warn('Help modal close button not found');
            }
        } catch (error) {
            console.error('Error setting up help modal listeners:', error);
        }

        // Close modal when clicking overlay
        if (this.elements.helpModal) {
            this.addEventListenerWithCleanup(this.elements.helpModal, 'click', (e) => {
                if (e.target === this.elements.helpModal || e.target.classList.contains('help-modal-overlay')) {
                    this.closeHelpModal();
                }
            });
        }

        // Handle ESC key to close help modal
        this.addEventListenerWithCleanup(document, 'keydown', (e) => {
            if (e.key === 'Escape' && this.elements.helpModal && this.elements.helpModal.style.display === 'flex') {
                this.closeHelpModal();
            }
        });
    }

    /**
     * Open image modal with given image
     */
    openImageModal(imageSrc, imageAlt = 'Recipe Image') {
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');

        if (modal && modalImage) {
            modalImage.src = imageSrc;
            modalImage.alt = imageAlt;
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }
    }

    /**
     * Close image modal
     */
    closeImageModal() {
        const modal = document.getElementById('imageModal');

        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = ''; // Restore scrolling
        }
    }

    /**
     * Open help modal
     */
    openHelpModal() {
        console.log('openHelpModal called');
        console.log('Help modal element:', this.elements.helpModal);

        if (this.elements.helpModal) {
            console.log('Opening help modal...');
            this.elements.helpModal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent background scrolling

            // Focus on the modal for accessibility
            const modalContent = this.elements.helpModal.querySelector('.help-modal-content');
            if (modalContent) {
                modalContent.focus();
            }
            console.log('Help modal opened');
        } else {
            console.error('Help modal element not found when trying to open!');
        }
    }

    /**
     * Close help modal
     */
    closeHelpModal() {
        if (this.elements.helpModal) {
            this.elements.helpModal.style.display = 'none';
            document.body.style.overflow = ''; // Restore scrolling
        }
    }

    /**
     * Setup layout detection for responsive design
     */
    setupLayoutDetection() {
        // Initial layout check
        this.updateRecipeLayout();

        // Listen for orientation and resize changes
        this.addEventListenerWithCleanup(window, 'orientationchange', () => {
            // Delay to allow orientation change to complete
            setTimeout(() => {
                this.updateRecipeLayout();
            }, 100);
        });

        this.addEventListenerWithCleanup(window, 'resize', () => {
            // Debounce resize events
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                this.updateRecipeLayout();
            }, 250);
        });
    }

    /**
     * Determine if side-by-side layout should be used
     */
    shouldUseSideBySideLayout() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const isLandscape = width > height;

        // Desktop/large screens: always side-by-side if wide enough
        if (width >= 1024) {
            console.log(`Large screen detected (${width}px), using side-by-side layout`);
            return true;
        }

        // Tablet landscape: side-by-side if wide enough
        if (isLandscape && width >= 768) {
            console.log(`Tablet landscape detected (${width}px), using side-by-side layout`);
            return true;
        }

        // Mobile: always stacked
        console.log(`Small screen detected (${width}px), using stacked layout`);
        return false;
    }

    /**
     * Update recipe layout based on screen size and orientation
     */
    updateRecipeLayout() {
        const recipeContent = document.querySelector('.recipe-content');
        if (!recipeContent) return;

        const shouldUseSideBySide = this.shouldUseSideBySideLayout();

        if (shouldUseSideBySide) {
            recipeContent.classList.add('auto-layout');
            console.log('Switched to side-by-side layout');
        } else {
            recipeContent.classList.remove('auto-layout');
            console.log('Switched to stacked layout');
        }
    }

    /**
     * Display recipe in the UI
     * @param {Object} recipe - Recipe to display
     */
    displayRecipe(recipe) {
        console.log('displayRecipe called with:', recipe); // Debug log

        if (!recipe || !this.elements.recipeContainer) {
            console.log('No recipe or container element'); // Debug log
            return;
        }

        // Clear image upload UI when displaying a recipe
        this.clearImageUpload();

        // Hide input methods when viewing a recipe
        this.hideInputMethods();

        this.currentRecipe = recipe;
        this.originalServings = recipe.servings || 1;
        this.currentServings = this.originalServings;

        console.log('Setting current recipe:', this.currentRecipe.title); // Debug log
        console.log('Recipe is from saved collection:', this.isRecipeFromSaved); // Debug log

        // Generate image HTML
        const imageHtml = this.generateImageHtml(recipe);

        this.elements.recipeContainer.innerHTML = `
            <div class="recipe-card">
                ${imageHtml}
                <div class="recipe-header">
                    ${this.generateTitleHtml(recipe)}
                    ${this.generateMetaHtml(recipe)}
                </div>

                ${this.generateEditingNoticeHtml()}

                <div class="recipe-content">
                    <div class="recipe-ingredients-section">
                        <div class="ingredients-container">
                            <div class="ingredients-header">
                                <h3 class="ingredients-title">🥘 Ingredients</h3>
                                <div class="serving-adjuster">
                                    <button class="serving-btn" data-action="decrease-serving">−</button>
                                    <div class="serving-count">${this.currentServings} servings</div>
                                    <button class="serving-btn" data-action="increase-serving">+</button>
                                </div>
                            </div>
                            <ul class="ingredients-list" id="ingredientsList">
                                ${this.generateIngredientsHtml(recipe.ingredients)}
                            </ul>
                        </div>
                    </div>

                    <div class="recipe-instructions-section">
                        <div class="instructions-container">
                            <div class="instructions-header">
                                <h3 class="instructions-title">👨‍🍳 Instructions</h3>
                            </div>
                            <ul class="steps-list">
                                ${this.generateInstructionsHtml(recipe.steps)}
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="action-buttons">
                    ${!this.isRecipeFromSaved ? '<button class="btn btn-success" data-action="save-recipe">Save Recipe</button>' : ''}
                    <button class="btn btn-outline" data-action="share-recipe">Share</button>
                    <button class="btn btn-outline" data-action="print-recipe">Print</button>
                </div>
            </div>
        `;

        // Apply current layout after rendering
        setTimeout(() => {
            this.updateRecipeLayout();
        }, 0);
    }

    /**
     * Generate title HTML for recipe
     * @param {Object} recipe - Recipe object
     * @returns {string} - Title HTML
     */
    generateTitleHtml(recipe) {
        const isOCRRecipe = this.currentRecipe && !this.currentRecipe.url && this.currentRecipe.recipeId;
        const hasUrl = this.currentRecipe && this.currentRecipe.url && this.currentRecipe.url.trim().length > 0;

        // Allow editing for OCR recipes (both fresh and saved), but not for URL-based recipes
        if (isOCRRecipe || (!hasUrl && this.isRecipeFromSaved)) {
            // Editable version for OCR recipes (fresh or saved)
            return `<h2 class="recipe-title editable-title" data-action="edit-title">${this.escapeHtml(recipe.title)}</h2>`;
        } else {
            // Regular version for URL-based recipes
            return `<h2 class="recipe-title">${this.escapeHtml(recipe.title)}</h2>`;
        }
    }

    /**
     * Generate meta HTML for recipe (prep time, cook time, servings)
     * @param {Object} recipe - Recipe object
     * @returns {string} - Meta HTML
     */
    generateMetaHtml(recipe) {
        const isOCRRecipe = this.currentRecipe && !this.currentRecipe.url && this.currentRecipe.recipeId;
        const hasUrl = this.currentRecipe && this.currentRecipe.url && this.currentRecipe.url.trim().length > 0;

        // Allow editing for OCR recipes (both fresh and saved), but not for URL-based recipes
        if (isOCRRecipe || (!hasUrl && this.isRecipeFromSaved)) {
            return `
                <div class="recipe-meta">
                    <div class="recipe-meta-item editable-meta" data-action="edit-prep-time">⏱️ Prep: ${recipe.prepTime || 0} min</div>
                    <div class="recipe-meta-item editable-meta" data-action="edit-cook-time">🔥 Cook: ${recipe.cookTime || 0} min</div>
                    <div class="recipe-meta-item editable-meta" data-action="edit-servings">🍽️ Servings: ${recipe.servings || 1}</div>
                </div>
            `;
        } else {
            return `
                <div class="recipe-meta">
                    <div class="recipe-meta-item">⏱️ Prep: ${recipe.prepTime || 0} min</div>
                    <div class="recipe-meta-item">🔥 Cook: ${recipe.cookTime || 0} min</div>
                    <div class="recipe-meta-item">🍽️ Servings: ${recipe.servings || 1}</div>
                </div>
            `;
        }
    }

    /**
     * Generate image HTML for recipe
     * @param {Object} recipe - Recipe object
     * @returns {string} - Image HTML
     */
    generateImageHtml(recipe) {
        // Handle PDF recipes - show PDF icon instead of image
        if (recipe.sourceType === 'pdf') {
            return `
                <div class="recipe-pdf-indicator">
                    <div class="pdf-icon">📄</div>
                    <div class="pdf-info">
                        <div class="pdf-label">Recipe from PDF</div>
                        <div class="pdf-filename">${this.escapeHtml(recipe.originalFileName || 'document.pdf')}</div>
                    </div>
                </div>
            `;
        }

        // Handle regular image recipes
        if (!recipe.imageUrl) return '';

        const imgUrl = typeof recipe.imageUrl === 'string'
            ? recipe.imageUrl
            : (recipe.imageUrl.url || '');

        if (!imgUrl) return '';

        return `<img src="${this.escapeHtml(imgUrl)}" alt="${this.escapeHtml(recipe.title)}" class="recipe-image" onerror="this.style.display='none'" loading="lazy">`;
    }

    /**
     * Generate ingredients HTML
     * @param {Array} ingredients - Ingredients array
     * @returns {string} - Ingredients HTML
     */
    generateIngredientsHtml(ingredients) {
        if (!Array.isArray(ingredients)) return '';

        const isOCRRecipe = this.currentRecipe && !this.currentRecipe.url && this.currentRecipe.recipeId;
        const hasUrl = this.currentRecipe && this.currentRecipe.url && this.currentRecipe.url.trim().length > 0;
        const isEditable = isOCRRecipe || (!hasUrl && this.isRecipeFromSaved);

        let html = ingredients.map((ingredient, idx) => {
            if (isEditable) {
                // Editable version for OCR recipes (both fresh and saved)
                return `
                    <li class="ingredient-item editable-ingredient" data-index="${idx}">
                        <div class="ingredient-checkbox" data-action="toggle-ingredient" data-index="${idx}"></div>
                        <div class="ingredient-text" data-action="edit-ingredient" data-index="${idx}">
                            <span class="ingredient-amount">${this.formatIngredientAmount(ingredient.amount)}</span>
                            ${this.escapeHtml(ingredient.unit)} ${this.escapeHtml(ingredient.item)}
                        </div>
                    </li>
                `;
            } else {
                // Regular version for URL recipes
                return `
                    <li class="ingredient-item" data-index="${idx}">
                        <div class="ingredient-checkbox" data-action="toggle-ingredient" data-index="${idx}"></div>
                        <div class="ingredient-text">
                            <span class="ingredient-amount">${this.formatIngredientAmount(ingredient.amount)}</span>
                            ${this.escapeHtml(ingredient.unit)} ${this.escapeHtml(ingredient.item)}
                        </div>
                    </li>
                `;
            }
        }).join('');

        // Add "+" button for OCR recipes
        if (isEditable) {
            html += `
                <li class="add-ingredient-item">
                    <button class="add-item-btn" data-action="add-ingredient" title="Add ingredient">+</button>
                </li>
            `;
        }

        return html;
    }

    /**
     * Generate instructions HTML
     * @param {Array} steps - Instructions array
     * @returns {string} - Instructions HTML
     */
    generateInstructionsHtml(steps) {
        if (!Array.isArray(steps)) return '';

        const isOCRRecipe = this.currentRecipe && !this.currentRecipe.url && this.currentRecipe.recipeId;
        const hasUrl = this.currentRecipe && this.currentRecipe.url && this.currentRecipe.url.trim().length > 0;
        const isEditable = isOCRRecipe || (!hasUrl && this.isRecipeFromSaved);

        let html = steps.map((step, idx) => {
            if (isEditable) {
                // Editable version for OCR recipes (both fresh and saved)
                return `
                    <li class="step-item editable-step" data-step="${idx}" data-action="edit-step" data-index="${idx}">
                        ${this.escapeHtml(step)}
                    </li>
                `;
            } else {
                // Regular version for URL recipes
                return `
                    <li class="step-item" data-step="${idx}" data-action="toggle-step">
                        ${this.escapeHtml(step)}
                    </li>
                `;
            }
        }).join('');

        // Add "+" button for OCR recipes
        if (isEditable) {
            html += `
                <li class="add-step-item">
                    <button class="add-item-btn" data-action="add-step" title="Add instruction step">+</button>
                </li>
            `;
        }

        return html;
    }

    /**
     * Adjust serving size
     * @param {number} change - Change in serving size
     */
    adjustServing(change) {
        const newServings = this.currentServings + change;
        if (newServings < 1) return;

        this.currentServings = newServings;
        this.updateServingDisplay();
    }

    /**
     * Update serving display
     */
    updateServingDisplay() {
        // Update serving count
        const servingCount = DOM.querySelector('.serving-count');
        if (servingCount) {
            servingCount.textContent = `${this.currentServings} servings`;
        }

        // Update ingredient amounts
        const ingredientItems = DOM.querySelectorAll('.ingredient-item');
        ingredientItems.forEach((item, idx) => {
            if (this.currentRecipe && this.currentRecipe.ingredients[idx]) {
                const ingredient = this.currentRecipe.ingredients[idx];
                const amountSpan = item.querySelector('.ingredient-amount');
                if (amountSpan) {
                    amountSpan.textContent = this.formatIngredientAmount(ingredient.amount);
                }
            }
        });
    }

    /**
     * Format ingredient amount for current serving size
     * @param {string} amount - Original amount
     * @returns {string} - Formatted amount
     */
    formatIngredientAmount(amount) {
        return Formatter.formatIngredientAmount(amount, this.currentServings, this.originalServings);
    }

    /**
     * Toggle ingredient checkbox
     * @param {number} index - Ingredient index
     */
    toggleIngredient(index) {
        const item = DOM.querySelector(`.ingredient-item[data-index="${index}"]`);
        if (!item) return;

        const checkbox = item.querySelector('.ingredient-checkbox');

        item.classList.toggle('checked');
        if (checkbox) {
            checkbox.classList.toggle('checked');
        }
    }

    /**
     * Show detailed view with cooking instructions
     */
    showDetailedView() {
        if (!this.currentRecipe || !this.elements.recipeDetailContainer) return;

        this.elements.recipeDetailContainer.innerHTML = `
            <div class="recipe-card">
                <button class="btn btn-outline" data-action="back-to-recipe" style="margin-bottom: 20px;">← Back</button>

                <h2 class="recipe-title">${this.escapeHtml(this.currentRecipe.title)}</h2>

                <div class="recipe-meta">
                    <div class="recipe-meta-item">⏱️ Total: ${(this.currentRecipe.prepTime || 0) + (this.currentRecipe.cookTime || 0)} min</div>
                    <div class="recipe-meta-item">🍽️ ${this.currentServings} servings</div>
                </div>

                <h3 style="margin: 30px 0 15px;">Cooking Instructions</h3>
                <div class="steps-list">
                    ${this.generateStepsHtml(this.currentRecipe.steps)}
                </div>

                <div class="action-buttons">
                    <button class="btn btn-primary" data-action="back-to-recipe">Back to Recipe</button>
                    <button class="btn btn-outline" data-action="print-recipe">Print</button>
                </div>
            </div>
        `;

        // Setup event listeners for detail view
        this.addEventListenerWithCleanup(this.elements.recipeDetailContainer, 'click', (e) => {
            const action = e.target.getAttribute('data-action');

            switch (action) {
                case 'back-to-recipe':
                    console.log('Back to recipe clicked'); // Debug log
                    this.showViewWithoutClearing('homeView');
                    break;
                case 'print-recipe':
                    this.printRecipe();
                    break;
                case 'toggle-step':
                    const stepIndex = parseInt(e.target.getAttribute('data-step'));
                    this.toggleStep(stepIndex);
                    break;
            }
        });

        this.showView('detailView');
    }

    /**
     * Generate steps HTML
     * @param {Array} steps - Steps array
     * @returns {string} - Steps HTML
     */
    generateStepsHtml(steps) {
        if (!Array.isArray(steps)) return '';

        const isOCRRecipe = this.currentRecipe && !this.currentRecipe.url && this.currentRecipe.recipeId;
        const hasUrl = this.currentRecipe && this.currentRecipe.url && this.currentRecipe.url.trim().length > 0;
        const isEditable = isOCRRecipe || (!hasUrl && this.isRecipeFromSaved);

        let html = steps.map((step, idx) => {
            if (isEditable) {
                // Editable version for OCR recipes (both fresh and saved)
                return `
                    <div class="step-item editable-step" data-step="${idx}" data-action="edit-step" data-index="${idx}">
                        ${this.escapeHtml(step)}
                    </div>
                `;
            } else {
                // Regular version for URL recipes
                return `
                    <div class="step-item" data-step="${idx}" data-action="toggle-step" data-step="${idx}">
                        ${this.escapeHtml(step)}
                    </div>
                `;
            }
        }).join('');

        // Add "+" button for OCR recipes
        if (isEditable) {
            html += `
                <div class="add-step-item">
                    <button class="add-item-btn" data-action="add-step" title="Add instruction step">+</button>
                </div>
            `;
        }

        return html;
    }

    /**
     * Generate editing notice for OCR recipes
     * @returns {string} - Editing notice HTML
     */
    generateEditingNoticeHtml() {
        const isOCRRecipe = this.currentRecipe && !this.currentRecipe.url && this.currentRecipe.recipeId;
        const hasUrl = this.currentRecipe && this.currentRecipe.url && this.currentRecipe.url.trim().length > 0;

        // Show editing notice for OCR recipes (both fresh and saved), but not for URL-based recipes
        if (isOCRRecipe || (!hasUrl && this.isRecipeFromSaved)) {
            return `
                <div class="editing-notice">
                    <div class="editing-notice-content">
                        <span class="editing-notice-icon">✏️</span>
                        <span class="editing-notice-text">Tap title, times, servings, ingredients, or steps to edit ${this.isRecipeFromSaved ? '(saved OCR recipe)' : '• Use + to add missing items'}</span>
                    </div>
                </div>
            `;
        }

        return '';
    }

    /**
     * Toggle step completion
     * @param {number} index - Step index
     */
    toggleStep(index) {
        const step = DOM.querySelector(`.step-item[data-step="${index}"]`);
        if (step) {
            step.classList.toggle('completed');
        }
    }

    /**
     * Handle save recipe action
     */
    handleSaveRecipe() {
        if (!this.currentRecipe) return;

        const event = new CustomEvent('recipe-save-requested', {
            detail: { recipe: this.currentRecipe }
        });
        document.dispatchEvent(event);
    }

    /**
     * Share recipe
     */
    async shareRecipe() {
        if (!this.currentRecipe) return;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: this.currentRecipe.title,
                    text: `Check out this recipe: ${this.currentRecipe.title}`,
                    url: this.currentRecipe.url
                });
            } else {
                // Fallback - copy to clipboard
                await navigator.clipboard.writeText(this.currentRecipe.url);
                this.showSuccess('Recipe URL copied to clipboard!');
            }
        } catch (error) {
            console.error('Share failed:', error);
            this.showError('Failed to share recipe');
        }
    }

    /**
     * Print recipe
     */
    printRecipe() {
        window.print();
    }

    /**
     * Display saved recipes
     * @param {Array} recipes - Recipes to display
     */
    displaySavedRecipes(recipes) {
        if (!this.elements.savedRecipesContainer) return;

        console.log(`ui.displaySavedRecipes() called with ${recipes.length} recipes:`, recipes.map(r => r.title));

        // Check if this is the initial load (all recipes) or a filtered view
        if (recipes.length === this.allSavedRecipes.length || this.allSavedRecipes.length === 0) {
            // This is the full recipe list
            this.allSavedRecipes = [...recipes]; // Store original list
            console.log(`Stored ${this.allSavedRecipes.length} recipes as original list`);
        }

        this.savedRecipes = recipes; // This is what's currently displayed
        console.log(`ui.savedRecipes now contains ${this.savedRecipes.length} recipes:`, this.savedRecipes.map(r => r.title));

        if (recipes.length === 0) {
            this.elements.savedRecipesContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📖</div>
                    <p>No saved recipes yet</p>
                    <p style="font-size: 14px; margin-top: 10px;">Start by adding a recipe URL on the home page</p>
                </div>
            `;
            return;
        }

        // Show all recipes, but handle those without URLs differently
        console.log('Total recipes to display:', recipes.length); // Debug log

        const htmlString = recipes.map(recipe => {
            const hasUrl = recipe.url && recipe.url.trim().length > 0;
            console.log('Rendering recipe card:', recipe.title, 'hasUrl:', hasUrl, 'URL:', recipe.url, 'recipeId:', recipe.recipeId);

            // For delete functionality, we need to pass both URL and recipeId properly
            const escapedUrl = hasUrl ? this.escapeHtml(recipe.url) : '';
            const escapedRecipeId = this.escapeHtml(recipe.recipeId || '');

            if (!recipe.recipeId && !hasUrl) {
                console.error('WARNING: Recipe has no identifier!', recipe.title, recipe);
            }

            console.log('Using data attributes - URL:', escapedUrl, 'RecipeID:', escapedRecipeId);

            const htmlTemplate = `
            <div class="recipe-list-item" data-url="${escapedUrl}" data-recipe-id="${escapedRecipeId}">
                <div class="recipe-list-content">
                    <div class="recipe-list-info" data-action="load-recipe">
                        <div class="recipe-list-title">${this.escapeHtml(recipe.title)}</div>
                        <div class="recipe-list-meta">
                            ${recipe.servings || 0} servings • ${(recipe.prepTime || 0) + (recipe.cookTime || 0)} min total
                            ${!hasUrl ? ' • <span style="color: var(--text-secondary);">From Photo</span>' : ''}
                        </div>
                    </div>
                    <div class="recipe-menu">
                        <button class="recipe-menu-trigger" data-action="toggle-menu" data-url="${escapedUrl}" data-recipe-id="${escapedRecipeId}">
                            ⋯
                        </button>
                        <div class="recipe-menu-dropdown">
                            <button class="recipe-menu-item delete" data-action="delete-recipe" data-url="${escapedUrl}" data-recipe-id="${escapedRecipeId}">
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;

            console.log('Generated HTML contains data-url:', htmlTemplate.includes(`data-url="${escapedUrl}"`)); // Debug log
            return htmlTemplate;
        }).join('');

        console.log('Final HTML string length:', htmlString.length); // Debug log
        this.elements.savedRecipesContainer.innerHTML = htmlString;

        // Debug: Check the actual HTML that was generated
        setTimeout(() => {
            const firstRecipeItem = this.elements.savedRecipesContainer.querySelector('.recipe-list-item');
            if (firstRecipeItem) {
                console.log('First recipe item data-url:', firstRecipeItem.getAttribute('data-url')); // Debug log
                const deleteButton = firstRecipeItem.querySelector('[data-action="delete-recipe"]');
                if (deleteButton) {
                    console.log('Delete button data-url:', deleteButton.getAttribute('data-url')); // Debug log
                }
            }
        }, 100);
    }

    /**
     * Load recipe from saved recipes
     * @param {string} url - Recipe URL
     */
    loadRecipeFromSaved(url, recipeId) {
        console.log('Loading saved recipe - URL:', url, 'Recipe ID:', recipeId); // Debug log

        // Try to find recipe by URL first, then by recipeId
        let recipe = null;
        if (url && url.trim().length > 0) {
            recipe = this.allSavedRecipes.find(r => r.url === url);
        }
        if (!recipe && recipeId) {
            recipe = this.allSavedRecipes.find(r => r.recipeId === recipeId);
        }

        if (recipe) {
            console.log('Found recipe:', recipe.title); // Debug log

            // Mark this recipe as coming from saved collection
            this.isRecipeFromSaved = true;

            // Switch to home view first, but don't clear the recipe yet
            this.showViewWithoutClearing('homeView');

            // Then display the recipe
            this.displayRecipe(recipe);
        } else {
            console.log('Recipe not found for URL:', url); // Debug log
        }
    }

    /**
     * Filter and display recipes based on search query
     * @param {string} query - Search query
     */
    filterSavedRecipes(query) {
        console.log('filterSavedRecipes called with query:', `"${query}"`, 'length:', query.length);
        console.log('Current allSavedRecipes count:', this.allSavedRecipes.length);

        if (!query) {
            console.log('Empty query - showing all recipes');
            this.displaySavedRecipes(this.allSavedRecipes);
            return;
        }

        const filtered = this.allSavedRecipes.filter(recipe => {
            // Check title
            if (recipe.title && recipe.title.toLowerCase().includes(query)) {
                return true;
            }

            // Check ingredients
            if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
                return recipe.ingredients.some(ingredient => {
                    if (ingredient && ingredient.item) {
                        return ingredient.item.toLowerCase().includes(query);
                    }
                    return false;
                });
            }

            return false;
        });

        if (filtered.length === 0) {
            this.elements.savedRecipesContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <p>No recipes found matching "${this.escapeHtml(query)}"</p>
                </div>
            `;
        } else {
            this.displaySavedRecipes(filtered);
        }
    }

    /**
     * Show loading state
     * @param {boolean} show - Whether to show loading
     */
    showLoading(show) {
        if (this.elements.loadingContainer) {
            this.elements.loadingContainer.classList.toggle('active', show);
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        if (this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
            this.elements.errorMessage.classList.add('active');

            setTimeout(() => {
                this.elements.errorMessage.classList.remove('active');
            }, CONFIG.MESSAGE_DISPLAY_DURATION.ERROR);
        }
    }

    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccess(message) {
        if (this.elements.successMessage) {
            this.elements.successMessage.textContent = message;
            this.elements.successMessage.classList.add('active');

            setTimeout(() => {
                this.elements.successMessage.classList.remove('active');
            }, CONFIG.MESSAGE_DISPLAY_DURATION.SUCCESS);
        }

        // Scroll to top to ensure message is visible
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /**
     * Hide all messages
     */
    hideMessages() {
        if (this.elements.errorMessage) {
            this.elements.errorMessage.classList.remove('active');
        }
        if (this.elements.successMessage) {
            this.elements.successMessage.classList.remove('active');
        }
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        if (!text) return '';

        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Toggle recipe menu dropdown
     * @param {Element} trigger - Menu trigger button
     */
    toggleRecipeMenu(trigger) {
        // Close all other open menus first
        const allDropdowns = document.querySelectorAll('.recipe-menu-dropdown.active');
        allDropdowns.forEach(dropdown => {
            if (dropdown !== trigger.nextElementSibling) {
                dropdown.classList.remove('active');
            }
        });

        // Toggle this menu
        const dropdown = trigger.nextElementSibling;
        if (dropdown) {
            dropdown.classList.toggle('active');
        }
    }

    /**
     * Handle recipe deletion
     * @param {string} url - Recipe URL to delete
     */
    async handleDeleteRecipe(url, recipeId) {
        console.log('Deleting recipe - URL:', url, 'RecipeID:', recipeId);

        // Find recipe by URL first, then by recipeId
        let recipe = null;
        if (url && url.trim().length > 0) {
            recipe = this.allSavedRecipes.find(r => r.url === url);
        }
        if (!recipe && recipeId) {
            recipe = this.allSavedRecipes.find(r => r.recipeId === recipeId);
        }

        if (!recipe) {
            console.error('Recipe not found. URL:', url, 'RecipeID:', recipeId);
            this.showError('Recipe not found');
            return;
        }

        console.log('Found recipe to delete:', recipe.title);

        // Show confirmation dialog
        const confirmed = this.showConfirmation(
            `Are you sure you want to delete "${recipe.title}"? This action cannot be undone.`
        );

        if (!confirmed) {
            return;
        }

        try {
            // Dispatch delete event to main app
            const event = new CustomEvent('recipe-delete-requested', {
                detail: {
                    url: recipe.url || url,
                    recipeId: recipe.recipeId || recipeId,
                    title: recipe.title
                }
            });
            document.dispatchEvent(event);

        } catch (error) {
            console.error('Delete recipe error:', error);
            this.showError('Failed to delete recipe');
        } finally {
            // Close the menu
            const openMenu = document.querySelector('.recipe-menu-dropdown.active');
            if (openMenu) {
                openMenu.classList.remove('active');
            }
        }
    }

    /**
     * Show confirmation dialog
     * @param {string} message - Confirmation message
     * @returns {boolean} - User confirmation
     */
    showConfirmation(message) {
        return confirm(message);
    }

    /**
     * Setup image upload event listeners
     */
    setupImageUploadListeners() {
        // Camera input (for taking photos)
        if (this.elements.cameraInput) {
            this.addEventListenerWithCleanup(this.elements.cameraInput, 'change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.handleImageSelected(e.target.files[0]);
                }
            });
        }

        // Gallery input (for choosing from gallery/files)
        if (this.elements.galleryInput) {
            this.addEventListenerWithCleanup(this.elements.galleryInput, 'change', (e) => {
                console.log('Gallery input change event triggered');
                console.log('Files:', e.target.files);
                if (e.target.files && e.target.files.length > 0) {
                    const filesArray = Array.from(e.target.files);
                    console.log(`${filesArray.length} file(s) selected`);
                    this.handleImagesSelected(filesArray);
                } else {
                    console.log('No file selected or files array empty');
                }
            });
        } else {
            console.error('Gallery input element not found!');
        }

        // Note: Using labels now, so no button click handlers needed
        // The labels directly trigger their associated file inputs

        // Legacy file input change (for backward compatibility)
        if (this.elements.imageUpload) {
            this.addEventListenerWithCleanup(this.elements.imageUpload, 'change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.handleImageSelected(e.target.files[0]);
                }
            });
        }

        // Upload area click (legacy - now shows the upload area after file selection)
        if (this.elements.uploadArea) {
            this.addEventListenerWithCleanup(this.elements.uploadArea, 'click', () => {
                // If upload area is visible, it means a file is already selected
                // Do nothing or optionally trigger the process button
            });
        }

        // Drag and drop
        if (this.elements.uploadArea) {
            this.addEventListenerWithCleanup(this.elements.uploadArea, 'dragover', (e) => {
                e.preventDefault();
                this.elements.uploadArea.classList.add('dragover');
            });

            this.addEventListenerWithCleanup(this.elements.uploadArea, 'dragleave', (e) => {
                e.preventDefault();
                this.elements.uploadArea.classList.remove('dragover');
            });

            this.addEventListenerWithCleanup(this.elements.uploadArea, 'drop', (e) => {
                e.preventDefault();
                this.elements.uploadArea.classList.remove('dragover');

                const files = e.dataTransfer.files;
                if (files && files.length > 0) {
                    const filesArray = Array.from(files);
                    this.handleImagesSelected(filesArray);
                }
            });
        }

        // Process and clear buttons
        if (this.elements.processImageBtn) {
            this.addEventListenerWithCleanup(this.elements.processImageBtn, 'click', () => {
                this.handleProcessImage();
            });
        }

        if (this.elements.clearImageBtn) {
            this.addEventListenerWithCleanup(this.elements.clearImageBtn, 'click', () => {
                this.clearImageUpload();
            });
        }
    }

    /**
     * Handle multiple images selection
     * @param {Array<File>} files - Array of selected files
     */
    async handleImagesSelected(files) {
        try {
            // Filter to only image files (exclude PDFs when multiple files selected)
            const imageFiles = files.filter(file => file.type.startsWith('image/'));
            const pdfFiles = files.filter(file => file.type === 'application/pdf');

            // If only one file and it's a PDF, handle normally
            if (files.length === 1 && pdfFiles.length === 1) {
                return this.handleImageSelected(files[0]);
            }

            // If multiple files but some are PDFs, show error
            if (pdfFiles.length > 0 && imageFiles.length > 0) {
                this.showError('Please upload either images OR a PDF, not both');
                return;
            }

            // If multiple PDFs, show error
            if (pdfFiles.length > 1) {
                this.showError('Please upload only one PDF file at a time');
                return;
            }

            // If only one image, handle normally
            if (imageFiles.length === 1) {
                return this.handleImageSelected(imageFiles[0]);
            }

            // Handle multiple images
            if (imageFiles.length > 0) {
                console.log(`Processing ${imageFiles.length} images`);

                // Show upload area with multiple files info
                if (this.elements.uploadArea) {
                    this.elements.uploadArea.style.display = 'block';
                    const uploadText = document.getElementById('uploadText');
                    if (uploadText) {
                        uploadText.textContent = `${imageFiles.length} images selected`;
                    }
                }

                // Create preview for multiple images
                if (this.elements.imagePreview) {
                    this.elements.imagePreview.innerHTML = `
                        <div class="multi-image-preview">
                            <p style="margin-bottom: 10px; font-weight: 600;">${imageFiles.length} images will be combined:</p>
                            <div class="image-preview-grid">
                                ${await this.generateMultiImagePreviews(imageFiles)}
                            </div>
                            <p style="margin-top: 10px; font-size: 14px; color: var(--text-secondary);">
                                Ready to extract and combine text from all images
                            </p>
                        </div>
                    `;

                    // Show action buttons
                    const uploadActions = document.querySelector('.upload-actions');
                    if (uploadActions) {
                        uploadActions.style.display = 'flex';
                    }
                }

                // Store selected images
                this.selectedImages = imageFiles;
            }

        } catch (error) {
            console.error('Image selection error:', error);
            this.showError('Failed to load image preview');
        }
    }

    /**
     * Generate preview HTML for multiple images
     * @param {Array<File>} files - Array of image files
     * @returns {Promise<string>} - Preview HTML
     */
    async generateMultiImagePreviews(files) {
        const previews = await Promise.all(
            files.map(async (file, index) => {
                const dataUrl = await this.fileToBase64Preview(file);
                return `
                    <div class="preview-thumbnail">
                        <img src="${dataUrl}" alt="Image ${index + 1}">
                        <div class="preview-label">Page ${index + 1}</div>
                    </div>
                `;
            })
        );
        return previews.join('');
    }

    /**
     * Convert file to base64 for preview
     * @param {File} file - Image file
     * @returns {Promise<string>} - Base64 data URL
     */
    async fileToBase64Preview(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read image'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Handle image selection and preview (single file)
     * @param {File} file - Selected image file
     */
    async handleImageSelected(file) {
        try {
            // Validate basic file type (images and PDFs)
            if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
                this.showError('Please select an image or PDF file');
                return;
            }

            // Show upload area with file info
            if (this.elements.uploadArea) {
                this.elements.uploadArea.style.display = 'block';
                const uploadText = document.getElementById('uploadText');
                if (uploadText) {
                    uploadText.textContent = file.type === 'application/pdf' ?
                        `PDF selected: ${file.name}` :
                        `Image selected: ${file.name}`;
                }
            }

            // Create preview
            if (this.elements.imagePreview) {
                if (file.type === 'application/pdf') {
                    // PDF preview
                    this.elements.imagePreview.innerHTML = `
                        <div class="pdf-preview">
                            <div class="pdf-preview-icon">📄</div>
                            <div class="pdf-preview-info">
                                <div class="pdf-preview-name">${this.escapeHtml(file.name)}</div>
                                <div class="pdf-preview-size">${(file.size / (1024 * 1024)).toFixed(1)} MB</div>
                            </div>
                        </div>
                        <p style="margin-top: 10px; font-size: 14px; color: var(--text-secondary);">
                            Ready to extract text from this PDF
                        </p>
                    `;

                    // Show action buttons
                    const uploadActions = document.querySelector('.upload-actions');
                    if (uploadActions) {
                        uploadActions.style.display = 'flex';
                    }
                } else {
                    // Image preview
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        this.elements.imagePreview.innerHTML = `
                            <img src="${e.target.result}" alt="Preview" class="preview-image">
                            <p style="margin-top: 10px; font-size: 14px; color: var(--text-secondary);">
                                Ready to extract text from this image
                            </p>
                        `;

                        // Show action buttons
                        const uploadActions = document.querySelector('.upload-actions');
                        if (uploadActions) {
                            uploadActions.style.display = 'flex';
                        }
                    };
                    reader.readAsDataURL(file);
                }
            }
            this.selectedImage = file;

        } catch (error) {
            console.error('Image selection error:', error);
            this.showError('Failed to load image preview');
        }
    }

    /**
     * Handle image processing (OCR)
     */
    async handleProcessImage() {
        // Check for multiple images first
        if (this.selectedImages && this.selectedImages.length > 0) {
            console.log(`Processing ${this.selectedImages.length} images`);
            const event = new CustomEvent('multiple-images-ocr-requested', {
                detail: { imageFiles: this.selectedImages }
            });
            document.dispatchEvent(event);
            return;
        }

        // Fall back to single image
        if (!this.selectedImage) {
            this.showError('No image selected');
            return;
        }

        // Dispatch OCR request event
        const event = new CustomEvent('image-ocr-requested', {
            detail: { imageFile: this.selectedImage }
        });
        document.dispatchEvent(event);
    }

    /**
     * Clear image upload
     */
    clearImageUpload() {
        // Clear all file inputs
        if (this.elements.imageUpload) {
            this.elements.imageUpload.value = '';
        }
        if (this.elements.cameraInput) {
            this.elements.cameraInput.value = '';
        }
        if (this.elements.galleryInput) {
            this.elements.galleryInput.value = '';
        }

        // Hide upload area
        if (this.elements.uploadArea) {
            this.elements.uploadArea.style.display = 'none';
        }

        // Clear preview
        if (this.elements.imagePreview) {
            this.elements.imagePreview.innerHTML = '';
        }

        // Hide action buttons
        const uploadActions = document.querySelector('.upload-actions');
        if (uploadActions) {
            uploadActions.style.display = 'none';
        }

        this.selectedImage = null;
        this.selectedImages = null;
    }

    /**
     * Show OCR processing state
     */
    showOCRProcessing() {
        if (this.elements.imagePreview) {
            this.elements.imagePreview.innerHTML = `
                <div class="ocr-loading">
                    <div class="spinner"></div>
                    <p>Extracting recipe text from image...</p>
                    <p style="font-size: 12px; color: var(--text-secondary);">This may take a few moments</p>
                </div>
            `;
        }
    }

    /**
     * Show extracted OCR text
     * @param {string} extractedText - Text extracted from image
     */
    showOCRResult(extractedText) {
        if (this.elements.imagePreview) {
            this.elements.imagePreview.innerHTML = `
                <div class="ocr-result">
                    <h4 style="margin: 0 0 15px 0;">Extracted Text:</h4>
                    <div class="ocr-text">${this.escapeHtml(extractedText)}</div>
                </div>
            `;
        }
    }

    /**
     * Initialize the UI controller
     */
    init() {
        try {
            console.log('Starting UI Controller initialization...');
            this.setupEventListeners();
            console.log('UI Controller initialized successfully');
        } catch (error) {
            console.error('Failed to initialize UI Controller:', error);
            // Show a user-friendly error
            this.showError('Failed to initialize user interface. Please refresh the page.');
            throw error;
        }
    }

    /**
     * Edit an ingredient
     * @param {number} index - Ingredient index
     */
    editIngredient(index) {
        if (!this.currentRecipe || !this.currentRecipe.ingredients[index]) return;

        const ingredient = this.currentRecipe.ingredients[index];
        const ingredientElement = document.querySelector(`.editable-ingredient[data-index="${index}"]`);
        if (!ingredientElement) return;

        // Create editing form
        const editForm = this.createIngredientEditForm(ingredient, index);
        ingredientElement.innerHTML = editForm;
        ingredientElement.classList.add('editing');

        // Focus on first input
        const firstInput = ingredientElement.querySelector('input');
        if (firstInput) firstInput.focus();
    }

    /**
     * Edit a step
     * @param {number} index - Step index
     */
    editStep(index) {
        if (!this.currentRecipe || !this.currentRecipe.steps[index]) return;

        const step = this.currentRecipe.steps[index];
        const stepElement = document.querySelector(`.editable-step[data-index="${index}"]`);
        if (!stepElement) return;

        // Create editing form
        const editForm = this.createStepEditForm(step, index);
        stepElement.innerHTML = editForm;
        stepElement.classList.add('editing');

        // Focus on textarea
        const textarea = stepElement.querySelector('textarea');
        if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
    }

    /**
     * Add a new ingredient
     */
    addNewIngredient() {
        if (!this.currentRecipe) return;

        const newIngredient = { amount: '', unit: '', item: '' };
        this.currentRecipe.ingredients.push(newIngredient);

        // Refresh the ingredients display
        const ingredientsList = document.getElementById('ingredientsList');
        if (ingredientsList) {
            ingredientsList.innerHTML = this.generateIngredientsHtml(this.currentRecipe.ingredients);
        }

        // Automatically edit the new ingredient
        const newIndex = this.currentRecipe.ingredients.length - 1;
        setTimeout(() => this.editIngredient(newIndex), 100);
    }

    /**
     * Add a new step
     */
    addNewStep() {
        if (!this.currentRecipe) return;

        this.currentRecipe.steps.push('');

        // Refresh the steps display in detail view if visible
        const stepsContainer = document.querySelector('.steps-container');
        if (stepsContainer) {
            stepsContainer.innerHTML = this.generateStepsHtml(this.currentRecipe.steps);
        }

        // Automatically edit the new step
        const newIndex = this.currentRecipe.steps.length - 1;
        setTimeout(() => this.editStep(newIndex), 100);
    }

    /**
     * Create ingredient edit form
     * @param {Object} ingredient - Ingredient to edit
     * @param {number} index - Ingredient index
     * @returns {string} - Edit form HTML
     */
    createIngredientEditForm(ingredient, index) {
        return `
            <div class="ingredient-edit-form">
                <div class="ingredient-edit-inputs">
                    <input type="text" class="ingredient-amount-input" value="${this.escapeHtml(ingredient.amount || '')}" placeholder="Amount">
                    <input type="text" class="ingredient-unit-input" value="${this.escapeHtml(ingredient.unit || '')}" placeholder="Unit">
                    <input type="text" class="ingredient-item-input" value="${this.escapeHtml(ingredient.item || '')}" placeholder="Ingredient">
                </div>
                <div class="edit-form-actions">
                    <button class="btn btn-sm btn-success" onclick="this.closest('.editable-ingredient').querySelector('.save-ingredient-btn').click()" data-action="save-ingredient" data-index="${index}">Save</button>
                    <button class="btn btn-sm btn-outline" onclick="this.closest('.editable-ingredient').querySelector('.cancel-ingredient-btn').click()" data-action="cancel-ingredient" data-index="${index}">Cancel</button>
                    <button class="btn btn-sm btn-danger" onclick="this.closest('.editable-ingredient').querySelector('.delete-ingredient-btn').click()" data-action="delete-ingredient" data-index="${index}">Delete</button>
                    <button class="save-ingredient-btn" style="display: none;" data-action="save-ingredient" data-index="${index}"></button>
                    <button class="cancel-ingredient-btn" style="display: none;" data-action="cancel-ingredient" data-index="${index}"></button>
                    <button class="delete-ingredient-btn" style="display: none;" data-action="delete-ingredient" data-index="${index}"></button>
                </div>
            </div>
        `;
    }

    /**
     * Create step edit form
     * @param {string} step - Step to edit
     * @param {number} index - Step index
     * @returns {string} - Edit form HTML
     */
    createStepEditForm(step, index) {
        return `
            <div class="step-edit-form">
                <textarea class="step-edit-textarea" placeholder="Enter instruction step">${this.escapeHtml(step)}</textarea>
                <div class="edit-form-actions">
                    <button class="btn btn-sm btn-success" onclick="this.closest('.editable-step').querySelector('.save-step-btn').click()" data-action="save-step" data-index="${index}">Save</button>
                    <button class="btn btn-sm btn-outline" onclick="this.closest('.editable-step').querySelector('.cancel-step-btn').click()" data-action="cancel-step" data-index="${index}">Cancel</button>
                    <button class="btn btn-sm btn-danger" onclick="this.closest('.editable-step').querySelector('.delete-step-btn').click()" data-action="delete-step" data-index="${index}">Delete</button>
                    <button class="save-step-btn" style="display: none;" data-action="save-step" data-index="${index}"></button>
                    <button class="cancel-step-btn" style="display: none;" data-action="cancel-step" data-index="${index}"></button>
                    <button class="delete-step-btn" style="display: none;" data-action="delete-step" data-index="${index}"></button>
                </div>
            </div>
        `;
    }

    /**
     * Save ingredient edit
     * @param {number} index - Ingredient index
     */
    saveIngredient(index) {
        if (!this.currentRecipe || !this.currentRecipe.ingredients[index]) return;

        const ingredientElement = document.querySelector(`.editable-ingredient[data-index="${index}"]`);
        if (!ingredientElement) return;

        const amountInput = ingredientElement.querySelector('.ingredient-amount-input');
        const unitInput = ingredientElement.querySelector('.ingredient-unit-input');
        const itemInput = ingredientElement.querySelector('.ingredient-item-input');

        if (!amountInput || !unitInput || !itemInput) return;

        // Update the ingredient
        this.currentRecipe.ingredients[index] = {
            amount: amountInput.value.trim(),
            unit: unitInput.value.trim(),
            item: itemInput.value.trim()
        };

        // Refresh the ingredients display
        this.refreshIngredientsDisplay();
    }

    /**
     * Cancel ingredient edit
     * @param {number} index - Ingredient index
     */
    cancelIngredientEdit(index) {
        // Refresh the ingredients display to restore original content
        this.refreshIngredientsDisplay();
    }

    /**
     * Delete ingredient
     * @param {number} index - Ingredient index
     */
    deleteIngredient(index) {
        if (!this.currentRecipe || !this.currentRecipe.ingredients[index]) return;

        this.currentRecipe.ingredients.splice(index, 1);
        this.refreshIngredientsDisplay();
    }

    /**
     * Save step edit
     * @param {number} index - Step index
     */
    saveStep(index) {
        if (!this.currentRecipe || !this.currentRecipe.steps[index] === undefined) return;

        const stepElement = document.querySelector(`.editable-step[data-index="${index}"]`);
        if (!stepElement) return;

        const textarea = stepElement.querySelector('.step-edit-textarea');
        if (!textarea) return;

        // Update the step
        this.currentRecipe.steps[index] = textarea.value.trim();

        // Refresh the steps display
        this.refreshStepsDisplay();
    }

    /**
     * Cancel step edit
     * @param {number} index - Step index
     */
    cancelStepEdit(index) {
        // Refresh the steps display to restore original content
        this.refreshStepsDisplay();
    }

    /**
     * Delete step
     * @param {number} index - Step index
     */
    deleteStep(index) {
        if (!this.currentRecipe || !this.currentRecipe.steps[index] === undefined) return;

        this.currentRecipe.steps.splice(index, 1);
        this.refreshStepsDisplay();
    }

    /**
     * Refresh ingredients display
     */
    refreshIngredientsDisplay() {
        const ingredientsList = document.getElementById('ingredientsList');
        if (ingredientsList && this.currentRecipe) {
            ingredientsList.innerHTML = this.generateIngredientsHtml(this.currentRecipe.ingredients);
        }
    }

    /**
     * Refresh steps display
     */
    refreshStepsDisplay() {
        const stepsContainer = document.querySelector('.steps-container');
        if (stepsContainer && this.currentRecipe) {
            stepsContainer.innerHTML = this.generateStepsHtml(this.currentRecipe.steps);
        }
    }

    /**
     * Edit the recipe title
     */
    editTitle() {
        if (!this.currentRecipe) return;

        const titleElement = document.querySelector('.editable-title');
        if (!titleElement) return;

        // Create editing form
        const editForm = this.createTitleEditForm(this.currentRecipe.title);
        titleElement.innerHTML = editForm;
        titleElement.classList.add('editing');

        // Focus on input
        const input = titleElement.querySelector('.title-edit-input');
        if (input) {
            input.focus();
            input.select();
        }
    }

    /**
     * Create title edit form
     * @param {string} title - Title to edit
     * @returns {string} - Edit form HTML
     */
    createTitleEditForm(title) {
        return `
            <div class="title-edit-form">
                <input type="text" class="title-edit-input" value="${this.escapeHtml(title)}" placeholder="Recipe title">
                <div class="edit-form-actions">
                    <button class="btn btn-sm btn-success" data-action="save-title">Save</button>
                    <button class="btn btn-sm btn-outline" data-action="cancel-title">Cancel</button>
                </div>
            </div>
        `;
    }

    /**
     * Save title edit
     */
    saveTitle() {
        if (!this.currentRecipe) return;

        // Prevent rapid double-clicks
        if (this.savingTitle) {
            console.log('Already saving title, ignoring duplicate click');
            return;
        }
        this.savingTitle = true;

        const titleElement = document.querySelector('.editable-title');
        if (!titleElement) {
            this.savingTitle = false;
            return;
        }

        const input = titleElement.querySelector('.title-edit-input');
        if (!input) {
            this.savingTitle = false;
            return;
        }

        const newTitle = input.value.trim();
        if (newTitle) {
            // Update the recipe
            this.currentRecipe.title = newTitle;

            // Refresh the title display
            this.refreshTitleDisplay();

            // If this is a saved recipe, trigger a save to update it
            if (this.isRecipeFromSaved) {
                console.log('Updating saved recipe with new title:', newTitle);
                // Dispatch save event to update the saved recipe
                const event = new CustomEvent('recipe-save-requested', {
                    detail: { recipe: this.currentRecipe }
                });
                document.dispatchEvent(event);

                // Also dispatch a custom event to refresh the saved recipes list
                setTimeout(() => {
                    const refreshEvent = new CustomEvent('refresh-saved-recipes');
                    document.dispatchEvent(refreshEvent);
                    this.savingTitle = false; // Reset the flag after everything completes
                }, 500); // Small delay to ensure save completes first
            } else {
                this.savingTitle = false; // Reset the flag
            }
        } else {
            this.cancelTitleEdit();
            this.savingTitle = false; // Reset the flag
        }
    }

    /**
     * Cancel title edit
     */
    cancelTitleEdit() {
        // Refresh the title display to restore original content
        this.refreshTitleDisplay();
    }

    /**
     * Refresh title display
     */
    refreshTitleDisplay() {
        const titleElement = document.querySelector('.recipe-title');
        if (titleElement && this.currentRecipe) {
            titleElement.outerHTML = this.generateTitleHtml(this.currentRecipe);
        }
    }

    /**
     * Edit prep time
     */
    editPrepTime() {
        if (!this.currentRecipe) return;

        const metaElement = document.querySelector('[data-action="edit-prep-time"]');
        if (!metaElement) return;

        const editForm = `
            <div class="meta-edit-form">
                <span>⏱️ Prep: </span>
                <input type="number" class="meta-edit-input" value="${this.currentRecipe.prepTime || 0}" min="0" step="1">
                <span> min</span>
                <button class="btn-icon" data-action="save-prep-time" title="Save">✓</button>
                <button class="btn-icon" data-action="cancel-prep-time" title="Cancel">✕</button>
            </div>
        `;
        metaElement.innerHTML = editForm;
        metaElement.classList.add('editing');

        const input = metaElement.querySelector('.meta-edit-input');
        if (input) {
            input.focus();
            input.select();
        }
    }

    /**
     * Save prep time
     */
    savePrepTime() {
        if (!this.currentRecipe) return;

        const metaElement = document.querySelector('[data-action="save-prep-time"]')?.closest('.recipe-meta-item');
        if (!metaElement) return;

        const input = metaElement.querySelector('.meta-edit-input');
        if (!input) return;

        const newValue = parseInt(input.value) || 0;
        this.currentRecipe.prepTime = newValue;

        this.refreshMetaDisplay();

        if (this.isRecipeFromSaved) {
            const event = new CustomEvent('recipe-save-requested', {
                detail: { recipe: this.currentRecipe }
            });
            document.dispatchEvent(event);
        }
    }

    /**
     * Cancel prep time edit
     */
    cancelPrepTimeEdit() {
        this.refreshMetaDisplay();
    }

    /**
     * Edit cook time
     */
    editCookTime() {
        if (!this.currentRecipe) return;

        const metaElement = document.querySelector('[data-action="edit-cook-time"]');
        if (!metaElement) return;

        const editForm = `
            <div class="meta-edit-form">
                <span>🔥 Cook: </span>
                <input type="number" class="meta-edit-input" value="${this.currentRecipe.cookTime || 0}" min="0" step="1">
                <span> min</span>
                <button class="btn-icon" data-action="save-cook-time" title="Save">✓</button>
                <button class="btn-icon" data-action="cancel-cook-time" title="Cancel">✕</button>
            </div>
        `;
        metaElement.innerHTML = editForm;
        metaElement.classList.add('editing');

        const input = metaElement.querySelector('.meta-edit-input');
        if (input) {
            input.focus();
            input.select();
        }
    }

    /**
     * Save cook time
     */
    saveCookTime() {
        if (!this.currentRecipe) return;

        const metaElement = document.querySelector('[data-action="save-cook-time"]')?.closest('.recipe-meta-item');
        if (!metaElement) return;

        const input = metaElement.querySelector('.meta-edit-input');
        if (!input) return;

        const newValue = parseInt(input.value) || 0;
        this.currentRecipe.cookTime = newValue;

        this.refreshMetaDisplay();

        if (this.isRecipeFromSaved) {
            const event = new CustomEvent('recipe-save-requested', {
                detail: { recipe: this.currentRecipe }
            });
            document.dispatchEvent(event);
        }
    }

    /**
     * Cancel cook time edit
     */
    cancelCookTimeEdit() {
        this.refreshMetaDisplay();
    }

    /**
     * Edit servings
     */
    editServings() {
        if (!this.currentRecipe) return;

        const metaElement = document.querySelector('[data-action="edit-servings"]');
        if (!metaElement) return;

        const editForm = `
            <div class="meta-edit-form">
                <span>🍽️ Servings: </span>
                <input type="number" class="meta-edit-input" value="${this.currentRecipe.servings || 1}" min="1" step="1">
                <button class="btn-icon" data-action="save-servings" title="Save">✓</button>
                <button class="btn-icon" data-action="cancel-servings" title="Cancel">✕</button>
            </div>
        `;
        metaElement.innerHTML = editForm;
        metaElement.classList.add('editing');

        const input = metaElement.querySelector('.meta-edit-input');
        if (input) {
            input.focus();
            input.select();
        }
    }

    /**
     * Save servings
     */
    saveServings() {
        if (!this.currentRecipe) return;

        const metaElement = document.querySelector('[data-action="save-servings"]')?.closest('.recipe-meta-item');
        if (!metaElement) return;

        const input = metaElement.querySelector('.meta-edit-input');
        if (!input) return;

        const newValue = parseInt(input.value) || 1;
        this.currentRecipe.servings = newValue;
        this.originalServings = newValue;
        this.currentServings = newValue;

        this.refreshMetaDisplay();
        this.updateServingDisplay();

        if (this.isRecipeFromSaved) {
            const event = new CustomEvent('recipe-save-requested', {
                detail: { recipe: this.currentRecipe }
            });
            document.dispatchEvent(event);
        }
    }

    /**
     * Cancel servings edit
     */
    cancelServingsEdit() {
        this.refreshMetaDisplay();
    }

    /**
     * Refresh meta display
     */
    refreshMetaDisplay() {
        const metaElement = document.querySelector('.recipe-meta');
        if (metaElement && this.currentRecipe) {
            metaElement.outerHTML = this.generateMetaHtml(this.currentRecipe);
        }
    }

    /**
     * Destroy the UI controller and clean up
     */
    destroy() {
        this.cleanup();
        this.closeImageModal(); // Close any open modal
        this.closeHelpModal(); // Close help modal
        this.currentRecipe = null;
        this.savedRecipes = [];
        this.allSavedRecipes = [];
        console.log('UI Controller destroyed');
    }
}