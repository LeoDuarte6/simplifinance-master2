import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

export class AdminHandler {
    constructor(appInstance) {
        this.app = appInstance;
        this.currentUsers = [];
        this.currentAction = null;
        this.currentUserId = null;

        // User pagination properties
        this.currentPage = 1;
        this.usersPerPage = 10;
        this.totalUsers = 0;
        this.totalPages = 0;

        // Content pagination properties
        this.currentContent = [];
        this.filteredContent = [];
        this.contentCurrentPage = 1;
        this.contentPerPage = 10;
        this.totalContent = 0;
        this.contentTotalPages = 0;

        // Content sorting and filtering
        this.contentSortBy = 'uploadedAt';
        this.contentSortDirection = 'desc';
        this.contentSearchQuery = '';

        // Added for content upload prevention
        this.isSubmitting = false;
    }

    /**
     * Initialize admin functionality
     */
    setupAdmin() {
        this.app.ui.adminManager.initializeAdminUI();
        this.setupEventListeners();
        this.loadUsers();
    }

    /**
     * Setup event listeners for admin interface
     */
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.id));
        });

        // Create user form
        const createUserForm = document.getElementById('create-user-form');
        if (createUserForm && !createUserForm.dataset.listenerAttached) {
            console.log('🔧 DEBUG: Attaching create user form listener');
            createUserForm.addEventListener('submit', (e) => this.handleCreateUser(e));
            createUserForm.dataset.listenerAttached = 'true';
        } else if (createUserForm) {
            console.log('🔧 DEBUG: Create user form listener already attached');
        }

        // Content upload form
        const uploadForm = document.getElementById('admin-upload-form');
        if (uploadForm && !uploadForm.dataset.listenerAttached) {
            uploadForm.addEventListener('submit', (e) => this.handleContentUpload(e));
            uploadForm.dataset.listenerAttached = 'true';
        }

        // Access level change for content upload
        const accessLevel = document.getElementById('accessLevel');
        if (accessLevel && !accessLevel.dataset.listenerAttached) {
            accessLevel.addEventListener('change', (e) => this.toggleSpecificUsersField(e.target.value));
            accessLevel.dataset.listenerAttached = 'true';
        }

        // Refresh users button
        const refreshBtn = document.getElementById('refresh-users-btn');
        if (refreshBtn && !refreshBtn.dataset.listenerAttached) {
            refreshBtn.addEventListener('click', () => this.loadUsers());
            refreshBtn.dataset.listenerAttached = 'true';
        }

        // Refresh content button
        const refreshContentBtn = document.getElementById('refresh-content-btn');
        if (refreshContentBtn && !refreshContentBtn.dataset.listenerAttached) {
            refreshContentBtn.addEventListener('click', () => this.loadContent());
            refreshContentBtn.dataset.listenerAttached = 'true';
        }

        // Add first content button
        const addFirstContentBtn = document.getElementById('add-first-content-btn');
        if (addFirstContentBtn) {
            addFirstContentBtn.addEventListener('click', () => this.switchTab('tab-content-upload'));
        }

        // Retry content load button
        const retryContentBtn = document.getElementById('retry-content-btn');
        if (retryContentBtn) {
            retryContentBtn.addEventListener('click', () => this.loadContent());
        }

        // Content search and filter
        this.setupContentSearchAndSort();

        // Category management
        this.setupCategoryManagement();

        // Modal controls
        this.setupModalEventListeners();

        // Password toggle for create user
        this.setupPasswordToggles();

        // Category management
        this.setupCategoryComboInput();
        this.loadCategories();

        // Pagination controls
        this.setupPaginationControls();
    }

    /**
     * Setup modal event listeners
     */
    setupModalEventListeners() {
        const modal = document.getElementById('user-action-modal');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const confirmBtn = document.getElementById('modal-confirm-btn');

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeModal());
        }

        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.confirmAction());
        }

        // Close modal on backdrop click
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }
    }

    /**
     * Setup content search and sort functionality
     */
    setupContentSearchAndSort() {
        // Search input
        const searchInput = document.getElementById('content-search-input');
        if (searchInput && !searchInput.dataset.listenerAttached) {
            searchInput.addEventListener('input', (e) => {
                this.contentSearchQuery = e.target.value.toLowerCase().trim();
                this.applyContentFilters();

                // Show/hide clear button
                const clearBtn = document.getElementById('content-clear-search');
                if (this.contentSearchQuery) {
                    clearBtn?.classList.remove('hidden');
                } else {
                    clearBtn?.classList.add('hidden');
                }
            });
            searchInput.dataset.listenerAttached = 'true';
        }

        // Clear search button
        const clearBtn = document.getElementById('content-clear-search');
        if (clearBtn && !clearBtn.dataset.listenerAttached) {
            clearBtn.addEventListener('click', () => {
                const searchInput = document.getElementById('content-search-input');
                if (searchInput) {
                    searchInput.value = '';
                    this.contentSearchQuery = '';
                    this.applyContentFilters();
                    clearBtn.classList.add('hidden');
                }
            });
            clearBtn.dataset.listenerAttached = 'true';
        }

        // Sortable column headers
        document.querySelectorAll('[data-sort]').forEach(header => {
            if (!header.dataset.listenerAttached) {
                header.addEventListener('click', () => {
                    const sortBy = header.dataset.sort;

                    // Toggle direction if clicking same column, otherwise default to ascending
                    if (this.contentSortBy === sortBy) {
                        this.contentSortDirection = this.contentSortDirection === 'asc' ? 'desc' : 'asc';
                    } else {
                        this.contentSortBy = sortBy;
                        this.contentSortDirection = 'asc';
                    }

                    this.updateSortIndicators();
                    this.applyContentFilters();
                });
                header.dataset.listenerAttached = 'true';
            }
        });

        // Initialize sort indicators
        this.updateSortIndicators();
    }

    /**
     * Update sort indicator icons
     */
    updateSortIndicators() {
        document.querySelectorAll('[data-sort]').forEach(header => {
            const indicator = header.querySelector('.sort-indicator');
            const svg = indicator?.querySelector('svg');

            if (header.dataset.sort === this.contentSortBy) {
                indicator?.classList.remove('opacity-0');
                indicator?.classList.add('opacity-100');

                // Rotate arrow based on direction
                if (this.contentSortDirection === 'asc') {
                    svg?.classList.add('transform', 'rotate-180');
                } else {
                    svg?.classList.remove('transform', 'rotate-180');
                }
            } else {
                indicator?.classList.add('opacity-0');
                indicator?.classList.remove('opacity-100');
                svg?.classList.remove('transform', 'rotate-180');
            }
        });
    }

    /**
     * Apply filters and sorting to content
     */
    applyContentFilters() {
        let filtered = [...this.currentContent];

        // Apply search filter
        if (this.contentSearchQuery) {
            filtered = filtered.filter(item => {
                const title = (item.title || '').toLowerCase();
                const description = (item.description || '').toLowerCase();
                const category = (item.category || '').toLowerCase();

                return title.includes(this.contentSearchQuery) ||
                       description.includes(this.contentSearchQuery) ||
                       category.includes(this.contentSearchQuery);
            });
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let aVal = a[this.contentSortBy];
            let bVal = b[this.contentSortBy];

            // Handle timestamps
            if (this.contentSortBy === 'uploadedAt') {
                aVal = aVal?._seconds || aVal || 0;
                bVal = bVal?._seconds || bVal || 0;
            }

            // Handle strings
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return this.contentSortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return this.contentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        this.filteredContent = filtered;
        this.contentCurrentPage = 1; // Reset to first page when filtering
        this.renderContentTable(filtered);
    }

    /**
     * Setup category management interface
     */
    setupCategoryManagement() {
        const manageBtn = document.getElementById('manage-categories-btn');
        const closeBtn = document.getElementById('close-category-management');
        const section = document.getElementById('category-management-section');

        if (manageBtn && !manageBtn.dataset.listenerAttached) {
            manageBtn.addEventListener('click', () => {
                section?.classList.toggle('hidden');
                if (!section?.classList.contains('hidden')) {
                    this.loadCategoryManagementList();
                }
            });
            manageBtn.dataset.listenerAttached = 'true';
        }

        if (closeBtn && !closeBtn.dataset.listenerAttached) {
            closeBtn.addEventListener('click', () => {
                section?.classList.add('hidden');
            });
            closeBtn.dataset.listenerAttached = 'true';
        }
    }

    /**
     * Load category management list with usage counts
     */
    async loadCategoryManagementList() {
        const listEl = document.getElementById('category-management-list');
        if (!listEl) return;

        listEl.innerHTML = '<div class="text-sm text-gray-500 text-center py-4">Loading...</div>';

        try {
            // Get all categories and content to check usage
            const [categoriesResult, contentResult] = await Promise.all([
                httpsCallable(this.app.functions, 'getCategories')(),
                httpsCallable(this.app.functions, 'getUserAccessibleContent')({ getAllContent: true })
            ]);

            const categories = categoriesResult.data.categories || [];
            const content = contentResult.data.content || [];

            // Count usage for each category
            const categoryUsage = {};
            content.forEach(item => {
                const cat = item.category;
                if (cat) {
                    categoryUsage[cat] = (categoryUsage[cat] || 0) + 1;
                }
            });

            if (categories.length === 0) {
                listEl.innerHTML = '<div class="text-sm text-gray-500 text-center py-4">No categories yet</div>';
                return;
            }

            listEl.innerHTML = categories.map(cat => {
                const usageCount = categoryUsage[cat.name] || 0;
                const canDelete = usageCount === 0;

                return `
                    <div class="flex items-center justify-between p-2 bg-white rounded border border-gray-200 hover:border-gray-300">
                        <div class="flex-1">
                            <span class="text-sm font-medium text-gray-900">${cat.name}</span>
                            <span class="text-xs text-gray-500 ml-2">(${usageCount} ${usageCount === 1 ? 'item' : 'items'})</span>
                        </div>
                        ${canDelete ? `
                            <button
                                type="button"
                                class="delete-category-btn text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded hover:bg-red-50"
                                data-category-id="${cat.id}"
                                data-category-name="${cat.name}"
                            >
                                Delete
                            </button>
                        ` : `
                            <span class="text-xs text-gray-400 px-2 py-1">In use</span>
                        `}
                    </div>
                `;
            }).join('');

            // Add delete handlers
            listEl.querySelectorAll('.delete-category-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const catId = btn.dataset.categoryId;
                    const catName = btn.dataset.categoryName;
                    if (confirm(`Delete category "${catName}"? This cannot be undone.`)) {
                        this.deleteCategory(catId, catName);
                    }
                });
            });

        } catch (error) {
            console.error('Error loading category management:', error);
            listEl.innerHTML = '<div class="text-sm text-red-600 text-center py-4">Failed to load categories</div>';
        }
    }

    /**
     * Delete a category
     */
    async deleteCategory(categoryId, categoryName) {
        try {
            const deleteCategory = httpsCallable(this.app.functions, 'deleteCategory');
            const result = await deleteCategory({ categoryId });

            if (result.data.status === 'success') {
                // Reload the list
                await this.loadCategoryManagementList();

                // Reload categories in the dropdown
                await this.loadCategories();

                alert(`Category "${categoryName}" deleted successfully`);
            } else {
                alert(`Failed to delete category: ${result.data.message}`);
            }
        } catch (error) {
            console.error('Error deleting category:', error);
            alert(`Failed to delete category: ${error.message}`);
        }
    }

    /**
     * Setup password toggle functionality
     */
    setupPasswordToggles() {
        const newUserPasswordToggle = document.getElementById('toggle-new-user-password');
        if (newUserPasswordToggle && !newUserPasswordToggle.dataset.listenerAttached) {
            newUserPasswordToggle.addEventListener('click', () => {
                this.togglePasswordVisibility('new-user-password', 'toggle-new-user-password');
            });
            newUserPasswordToggle.dataset.listenerAttached = 'true';
        }
    }

    /**
     * Toggle password visibility
     */
    togglePasswordVisibility(inputId, buttonId) {
        const input = document.getElementById(inputId);
        const button = document.getElementById(buttonId);

        if (input && button) {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';

            // Update icon
            const svg = button.querySelector('svg');
            if (svg) {
                if (isPassword) {
                    // Show "eye-off" icon when password is visible
                    svg.innerHTML = `
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L12 12m6.02-6.02A9.97 9.97 0 0121 12c0 .746-.045 1.477-.132 2.192-.086.715-.217 1.416-.384 2.097M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029" />
                    `;
                } else {
                    // Show "eye" icon when password is hidden
                    svg.innerHTML = `
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    `;
                }
            }
        }
    }

    /**
     * Setup category management
     */
    setupCategoryComboInput() {
        const input = document.getElementById('contentCategoryInput');
        const dropdown = document.getElementById('categoryDropdown');

        if (!input || !dropdown) return;

        // Store available categories
        this.availableCategories = [];

        // Show dropdown on focus
        input.addEventListener('focus', () => {
            this.filterAndShowCategoryDropdown();
        });

        // Filter dropdown as user types
        input.addEventListener('input', () => {
            this.filterAndShowCategoryDropdown();
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });

        // Prevent form submission on Enter in category input
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // If there's a highlighted option, select it
                const highlighted = dropdown.querySelector('.bg-teal-50');
                if (highlighted) {
                    input.value = highlighted.dataset.category;
                    dropdown.classList.add('hidden');
                }
            }
        });
    }

    /**
     * Load categories from Firebase
     */
    async loadCategories() {
        try {
            const getCategories = httpsCallable(this.app.functions, 'getCategories');
            const result = await getCategories();

            if (result.data.status === 'success' && result.data.categories) {
                const categoryNames = result.data.categories.map(cat => cat.name);
                this.renderCategoryOptions(categoryNames);
            } else {
                // Fall back to default categories if no categories exist yet
                const defaultCategories = [
                    'Investments & Market Concepts',
                    'Taxes and Retirement',
                    'Economic & Financial Concepts',
                    'Market Update',
                    'Whitelabel'
                ];
                this.renderCategoryOptions(defaultCategories);
            }
        } catch (error) {
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'Failed to load categories';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Error loading categories:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            // Fall back to default categories on error
            const defaultCategories = [
                'Investments & Market Concepts',
                'Taxes and Retirement',
                'Economic & Financial Concepts',
                'Market Update',
                'Whitelabel'
            ];
            this.renderCategoryOptions(defaultCategories);
        }
    }

    /**
     * Store and display available categories
     */
    renderCategoryOptions(categories) {
        this.availableCategories = categories || [];

        const statusEl = document.getElementById('categoryStatus');
        if (statusEl) {
            if (this.availableCategories.length > 0) {
                statusEl.textContent = `${this.availableCategories.length} categories available`;
                statusEl.classList.remove('text-red-600');
                statusEl.classList.add('text-gray-500');
            } else {
                statusEl.textContent = 'No categories yet - type to create new';
                statusEl.classList.remove('text-gray-500');
                statusEl.classList.add('text-red-600');
            }
        }
    }

    /**
     * Filter and show category dropdown based on input
     */
    filterAndShowCategoryDropdown() {
        const input = document.getElementById('contentCategoryInput');
        const dropdown = document.getElementById('categoryDropdown');
        const dropdownContent = document.getElementById('categoryDropdownContent');

        if (!input || !dropdown || !dropdownContent) return;

        const query = input.value.toLowerCase().trim();
        const filtered = this.availableCategories.filter(cat =>
            cat.toLowerCase().includes(query)
        );

        // If no categories at all
        if (this.availableCategories.length === 0) {
            dropdownContent.innerHTML = `
                <div class="px-4 py-3 text-sm text-gray-500 text-center">
                    No categories yet. Type to create your first category.
                </div>
            `;
            dropdown.classList.remove('hidden');
            return;
        }

        // If typing and no matches, don't show dropdown
        if (query && filtered.length === 0) {
            dropdown.classList.add('hidden');
            return;
        }

        // Show filtered categories
        const categoriesToShow = filtered.length > 0 ? filtered : this.availableCategories;

        dropdownContent.innerHTML = categoriesToShow.map((cat, index) => {
            return `
                <div
                    class="px-4 py-2 hover:bg-teal-50 cursor-pointer flex items-center category-option transition-colors ${index === 0 && query ? 'bg-teal-50' : ''}"
                    data-category="${cat}"
                >
                    <span class="text-sm text-gray-900">${cat}</span>
                </div>
            `;
        }).join('');

        // Add click handlers to category options
        dropdownContent.querySelectorAll('.category-option').forEach(option => {
            option.addEventListener('click', () => {
                input.value = option.dataset.category;
                dropdown.classList.add('hidden');
            });
        });

        dropdown.classList.remove('hidden');
    }

    /**
     * Initialize default categories in Firestore
     */
    async initializeCategories() {
        try {
            this.showContentUploadMessage('Creating default categories...', 'info');

            const initializeCategories = httpsCallable(this.app.functions, 'initializeCategories');
            const result = await initializeCategories();

            if (result.data.status === 'success') {
                this.showContentUploadMessage(result.data.message, 'success');
                // Reload categories after initialization
                setTimeout(() => this.loadCategories(), 1000);
            } else {
                this.showContentUploadMessage(result.data.message || 'Failed to initialize categories', 'error');
            }
        } catch (error) {
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'Failed to initialize categories';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Initialize categories error:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            this.showContentUploadMessage(errorMessage, 'error');
        }
    }

    /**
     * Get selected/entered category value
     */
    getSelectedCategory() {
        const input = document.getElementById('contentCategoryInput');
        return input ? input.value.trim() : '';
    }

    /**
     * Setup pagination controls
     */
    setupPaginationControls() {
        // User pagination controls
        document.getElementById('prev-page')?.addEventListener('click', () => this.goToPreviousPage());
        document.getElementById('prev-page-mobile')?.addEventListener('click', () => this.goToPreviousPage());
        document.getElementById('next-page')?.addEventListener('click', () => this.goToNextPage());
        document.getElementById('next-page-mobile')?.addEventListener('click', () => this.goToNextPage());

        // Content pagination controls
        document.getElementById('content-prev-page')?.addEventListener('click', () => this.goToContentPreviousPage());
        document.getElementById('content-prev-page-mobile')?.addEventListener('click', () => this.goToContentPreviousPage());
        document.getElementById('content-next-page')?.addEventListener('click', () => this.goToContentNextPage());
        document.getElementById('content-next-page-mobile')?.addEventListener('click', () => this.goToContentNextPage());
    }

    /**
     * Go to previous page
     */
    goToPreviousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderUsersTable();
        }
    }

    /**
     * Go to next page
     */
    goToNextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.renderUsersTable();
        }
    }

    /**
     * Go to specific page
     */
    goToPage(page) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.renderUsersTable();
        }
    }

    /**
     * Go to previous content page
     */
    goToContentPreviousPage() {
        if (this.contentCurrentPage > 1) {
            this.goToContentPage(this.contentCurrentPage - 1);
        }
    }

    /**
     * Go to next content page
     */
    goToContentNextPage() {
        if (this.contentCurrentPage < this.contentTotalPages) {
            this.goToContentPage(this.contentCurrentPage + 1);
        }
    }

    /**
     * Go to a specific content page
     */
    goToContentPage(page) {
        this.contentCurrentPage = page;
        this.renderContentTable(this.currentContent);
    }

    /**
     * Switch between admin tabs
     */
    switchTab(tabId) {
        // Update tab appearance
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.remove('active', 'border-teal-500', 'text-teal-600');
            tab.classList.add('border-transparent', 'text-gray-500');
        });

        // Hide all panels
        document.querySelectorAll('.admin-panel').forEach(panel => {
            panel.classList.add('hidden');
        });

        // Show active tab and panel
        const activeTab = document.getElementById(tabId);
        const panelId = tabId.replace('tab-', 'panel-');
        const activePanel = document.getElementById(panelId);

        if (activeTab && activePanel) {
            activeTab.classList.add('active', 'border-teal-500', 'text-teal-600');
            activeTab.classList.remove('border-transparent', 'text-gray-500');
            activePanel.classList.remove('hidden');

            // Load content when switching to content management tab
            if (tabId === 'tab-content-management') {
                this.loadContent();
            }
        }
    }

    /**
     * Toggle specific users field based on access level
     */
    toggleSpecificUsersField(accessLevel) {
        const specificUsersContainer = document.getElementById('specific-users-container');
        if (specificUsersContainer) {
            if (accessLevel === 'custom') {
                specificUsersContainer.classList.remove('hidden');
                // Load users for selection if container is empty
                const usersList = document.getElementById('specific-users-list');
                if (usersList && usersList.children.length === 0) {
                    this.loadUsersForContentUpload();
                }
            } else {
                specificUsersContainer.classList.add('hidden');
            }
        }
    }

    /**
     * Load users for content upload specific users selection
     */
    async loadUsersForContentUpload() {
        const usersList = document.getElementById('specific-users-list');
        if (!usersList) return;

        // Show loading state
        usersList.innerHTML = '<p class="text-gray-500 text-sm italic text-center py-4">Loading users...</p>';

        try {
            // Load users (or use cached list if available)
            if (!this.currentUsers || this.currentUsers.length === 0) {
                const adminGetAllUsers = httpsCallable(this.app.functions, 'adminGetAllUsers');
                const result = await adminGetAllUsers();

                if (result.data.status === 'success') {
                    this.currentUsers = result.data.users;
                } else {
                    throw new Error('Failed to load users');
                }
            }

            // Create user list with checkboxes
            const usersHtml = this.currentUsers
                .filter(user => user.email) // Only users with emails
                .map(user => {
                    return `
                        <div class="flex items-center py-1">
                            <input type="checkbox" id="upload-user-${user.id}" class="upload-specific-user-checkbox"
                                   data-user-id="${user.id}" data-user-email="${user.email}"
                                   class="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded">
                            <label for="upload-user-${user.id}" class="ml-2 block text-sm text-gray-900">
                                ${user.name || 'Unnamed'} (${user.email})
                            </label>
                        </div>
                    `;
                })
                .join('');

            usersList.innerHTML = usersHtml || '<p class="text-gray-500 text-sm italic">No users available</p>';
        } catch (error) {
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'Failed to load users for content upload';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Error loading users for content upload:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            usersList.innerHTML = '<p class="text-red-500 text-sm">Failed to load users</p>';
        }
    }

    /**
     * Load all users for the admin table
     */
    async loadUsers() {
        try {
            this.showUsersLoading();

            const adminGetAllUsers = httpsCallable(this.app.functions, 'adminGetAllUsers');
            const result = await adminGetAllUsers();

            if (result.data.status === 'success') {
                this.currentUsers = result.data.users;
                this.currentPage = 1; // Reset to first page when loading new data
                this.renderUsersTable();
            } else {
                this.showUsersError('Failed to load users');
            }
        } catch (error) {
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'Failed to load users';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Error loading users:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            this.showUsersError(errorMessage);
        }
    }

    /**
     * Show loading state for users table
     */
    showUsersLoading() {
        document.getElementById('users-loading').classList.remove('hidden');
        document.getElementById('users-table-container').classList.add('hidden');
        document.getElementById('users-empty-state').classList.add('hidden');
    }

    /**
     * Show users table with data
     */
    renderUsersTable() {
        const tbody = document.getElementById('users-table-body');
        const loading = document.getElementById('users-loading');
        const container = document.getElementById('users-table-container');
        const emptyState = document.getElementById('users-empty-state');

        loading.classList.add('hidden');

        if (this.currentUsers.length === 0) {
            container.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        // Calculate pagination
        this.totalUsers = this.currentUsers.length;
        this.totalPages = Math.ceil(this.totalUsers / this.usersPerPage);

        // Ensure current page is valid
        if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages;
        }
        if (this.currentPage < 1) {
            this.currentPage = 1;
        }

        // Get users for current page
        const startIndex = (this.currentPage - 1) * this.usersPerPage;
        const endIndex = startIndex + this.usersPerPage;
        const currentPageUsers = this.currentUsers.slice(startIndex, endIndex);

        // Render current page users
        tbody.innerHTML = currentPageUsers.map(user => this.renderUserRow(user)).join('');
        container.classList.remove('hidden');
        emptyState.classList.add('hidden');

        // Update pagination controls
        this.updatePaginationControls();

        // Add event listeners for action buttons
        this.setupUserActionListeners();
    }

    /**
     * Update pagination controls
     */
    updatePaginationControls() {
        // Update pagination info
        const showingStart = this.totalUsers === 0 ? 0 : (this.currentPage - 1) * this.usersPerPage + 1;
        const showingEnd = Math.min(this.currentPage * this.usersPerPage, this.totalUsers);

        document.getElementById('showing-start').textContent = showingStart;
        document.getElementById('showing-end').textContent = showingEnd;
        document.getElementById('total-users').textContent = this.totalUsers;

        // Update button states
        const prevButtons = [document.getElementById('prev-page'), document.getElementById('prev-page-mobile')];
        const nextButtons = [document.getElementById('next-page'), document.getElementById('next-page-mobile')];

        prevButtons.forEach(btn => {
            if (btn) {
                btn.disabled = this.currentPage <= 1;
            }
        });

        nextButtons.forEach(btn => {
            if (btn) {
                btn.disabled = this.currentPage >= this.totalPages;
            }
        });

        // Update page numbers
        this.updatePageNumbers();
    }

    /**
     * Update page number buttons
     */
    updatePageNumbers() {
        const pageNumbersContainer = document.getElementById('page-numbers');
        if (!pageNumbersContainer) return;

        pageNumbersContainer.innerHTML = '';

        if (this.totalPages <= 1) return;

        // Calculate which page numbers to show
        let startPage = Math.max(1, this.currentPage - 2);
        let endPage = Math.min(this.totalPages, this.currentPage + 2);

        // Adjust if we're near the beginning or end
        if (endPage - startPage < 4) {
            if (startPage === 1) {
                endPage = Math.min(this.totalPages, startPage + 4);
            } else {
                startPage = Math.max(1, endPage - 4);
            }
        }

        // Add first page if not included
        if (startPage > 1) {
            pageNumbersContainer.appendChild(this.createPageButton(1));
            if (startPage > 2) {
                pageNumbersContainer.appendChild(this.createEllipsis());
            }
        }

        // Add page number buttons
        for (let i = startPage; i <= endPage; i++) {
            pageNumbersContainer.appendChild(this.createPageButton(i));
        }

        // Add last page if not included
        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                pageNumbersContainer.appendChild(this.createEllipsis());
            }
            pageNumbersContainer.appendChild(this.createPageButton(this.totalPages));
        }
    }

    /**
     * Create page button
     */
    createPageButton(pageNumber) {
        const button = document.createElement('button');
        button.textContent = pageNumber;
        button.addEventListener('click', () => this.goToPage(pageNumber));

        const isCurrentPage = pageNumber === this.currentPage;
        button.className = `relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
            isCurrentPage
                ? 'z-10 bg-teal-50 border-teal-500 text-teal-600'
                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
        }`;

        return button;
    }

    /**
     * Create ellipsis element
     */
    createEllipsis() {
        const span = document.createElement('span');
        span.textContent = '...';
        span.className = 'relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700';
        return span;
    }

    /**
     * Render a single user row
     */
    renderUserRow(user) {
        // HARDCODE FIX FOR PAUL - CLIENT DEMO
        if (user.email === 'paul.williams@wrwcollc.com') {
            user.subscriptionStatus = 'active';
            user.billingDate = '2026-06-20';
            user.plan = user.plan || 'Premium Plan';
        }
        
        let createdDate = 'N/A';
        if (user.createdAt) {
            try {
                if (user.createdAt._seconds !== undefined) {
                    createdDate = new Date(user.createdAt._seconds * 1000).toLocaleDateString();
                }
            } catch (error) {
                console.error('Date parsing error for user:', user.email, error);
                createdDate = 'N/A';
            }
        }
        const statusBadge = this.getStatusBadge(user.subscriptionStatus);
        const roleBadges = this.getRoleBadges(user);

        return `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                            <div class="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                <span class="text-sm font-medium text-gray-700">${user.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
                            </div>
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${user.name || 'N/A'}</div>
                            <div class="text-sm text-gray-500">${user.email}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${user.plan || 'N/A'}</div>
                    ${user.billingDate ? `<div class="text-xs text-gray-500">Next billing: ${user.billingDate}</div>` : ''}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${statusBadge}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${roleBadges}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${createdDate}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div class="relative inline-block text-left">
                        <button type="button" class="user-actions-btn inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none" data-user-id="${user.id}">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>
                            </svg>
                        </button>
                        <div class="user-actions-menu origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 hidden z-50" data-user-id="${user.id}" style="min-width: 14rem; max-width: 20rem; z-index: 100;">
                            <div class="py-1">
                                <button class="action-change-password block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left" data-user-id="${user.id}">
                                    Change Password
                                </button>
                                <button class="action-change-role block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left" data-user-id="${user.id}">
                                    ${user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                                </button>
                                <button class="action-manage-content block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left" data-user-id="${user.id}">
                                    Manage Content Access
                                </button>
                                <button class="action-update-billing block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left" data-user-id="${user.id}" data-user-email="${user.email}" data-user-name="${user.name || 'User'}">
                                    Update Billing Date
                                </button>
                                <button class="action-preview-library block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left" data-user-id="${user.id}">
                                    Preview Library
                                </button>
                                <button class="action-delete-user block px-4 py-2 text-sm text-red-700 hover:bg-red-100 w-full text-left" data-user-id="${user.id}">
                                    Delete User
                                </button>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Get status badge HTML
     */
    getStatusBadge(status) {
        const statusClasses = {
            'active': 'bg-green-100 text-green-800',
            'cancelled': 'bg-red-100 text-red-800',
            'inactive': 'bg-gray-100 text-gray-800'
        };

        const statusClass = statusClasses[status] || statusClasses['inactive'];
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">${status || 'inactive'}</span>`;
    }

    /**
     * Get role badges HTML
     */
    getRoleBadges(user) {
        const badges = [];

        if (user.isAdmin) {
            badges.push('<span class="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">Admin</span>');
        }

        if (user.isAdvisor) {
            badges.push('<span class="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Advisor</span>');
        }

        if (badges.length === 0) {
            badges.push('<span class="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">User</span>');
        }

        return badges.join(' ');
    }

    /**
     * Setup event listeners for user action buttons
     */
    setupUserActionListeners() {
        // Three dots menu toggles
        document.querySelectorAll('.user-actions-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const userId = btn.dataset.userId;
                this.toggleUserActionsMenu(userId);
            });
        });

        // Action buttons
        document.querySelectorAll('.action-change-password').forEach(btn => {
            btn.addEventListener('click', (e) => this.showChangePasswordModal(e.target.dataset.userId));
        });

        document.querySelectorAll('.action-change-role').forEach(btn => {
            btn.addEventListener('click', (e) => this.showChangeRoleModal(e.target.dataset.userId));
        });

        document.querySelectorAll('.action-manage-content').forEach(btn => {
            btn.addEventListener('click', (e) => this.showManageContentModal(e.target.dataset.userId));
        });

        document.querySelectorAll('.action-update-billing').forEach(btn => {
            btn.addEventListener('click', (e) => this.showUpdateBillingModal(e.target));
        });

        document.querySelectorAll('.action-preview-library').forEach(btn => {
            btn.addEventListener('click', (e) => this.previewUserLibrary(e.target.dataset.userId));
        });

        document.querySelectorAll('.action-delete-user').forEach(btn => {
            btn.addEventListener('click', (e) => this.showDeleteUserModal(e.target.dataset.userId));
        });

        // Close menus when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.user-actions-menu').forEach(menu => {
                menu.classList.add('hidden');
            });
        });
    }

    /**
     * Toggle user actions menu
     */
    toggleUserActionsMenu(userId) {
        // Close all other menus
        document.querySelectorAll('.user-actions-menu').forEach(menu => {
            if (menu.dataset.userId !== userId) {
                menu.classList.add('hidden');
            }
        });

        // Toggle the clicked menu
        const menu = document.querySelector(`.user-actions-menu[data-user-id="${userId}"]`);
        if (menu) {
            menu.classList.toggle('hidden');

            // Check if menu is visible and adjust position if needed
            if (!menu.classList.contains('hidden')) {
                this.adjustMenuPosition(menu);
            }
        }
    }

    /**
     * Adjust menu position to ensure it stays in viewport
     */
    adjustMenuPosition(menu) {
        // Reset any previous positioning
        menu.style.right = '0';
        menu.style.left = 'auto';

        // Get menu position data
        const menuRect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;

        // Check if menu extends beyond right edge of viewport
        if (menuRect.right > viewportWidth) {
            // Switch to left alignment
            menu.style.right = 'auto';
            menu.style.left = '0';
        }

        // On mobile screens, make sure the menu isn't too wide
        if (viewportWidth < 640) { // TailwindCSS sm breakpoint
            menu.style.maxWidth = '80vw'; // Limit width to 80% of viewport
        } else {
            menu.style.maxWidth = '20rem';
        }

        // Ensure menu doesn't go below viewport
        const viewportHeight = window.innerHeight;
        if (menuRect.bottom > viewportHeight) {
            // Position above button instead of below
            menu.style.bottom = '100%';
            menu.style.top = 'auto';
            menu.style.marginBottom = '0.5rem';
            menu.style.marginTop = '0';
        } else {
            // Reset to default if not needed
            menu.style.top = 'auto';
            menu.style.bottom = 'auto';
            menu.style.marginTop = '0.5rem';
            menu.style.marginBottom = '0';
        }
    }

    /**
     * Show users error state
     */
    showUsersError(message) {
        document.getElementById('users-loading').classList.add('hidden');
        document.getElementById('users-table-container').classList.add('hidden');
        document.getElementById('users-empty-state').classList.remove('hidden');
        document.getElementById('users-empty-state').innerHTML = `<p class="text-red-500">${message}</p>`;
    }

    /**
     * Handle create user form submission
     */
    async handleCreateUser(event) {
        event.preventDefault();
        console.log('🚀 DEBUG: handleCreateUser called at', new Date().toISOString());

        const formData = this.app.ui.getFormData('create-user-form');

        if (!formData.email || !formData.password || !formData.name || !formData.plan) {
            this.showCreateUserMessage('Please fill out all required fields.', 'error');
            return;
        }

        try {
            this.app.ui.showLoading('create-user-submit-btn', 'create-user-loader');
            this.hideCreateUserMessage();

            const adminCreateUser = httpsCallable(this.app.functions, 'adminCreateUser');
            const result = await adminCreateUser({
                email: formData.email,
                password: formData.password,
                name: formData.name,
                plan: formData.plan,
                isAdmin: formData.isAdmin || false,
                isAdvisor: formData.isAdvisor || false
            });

            if (result.data.status === 'success') {
                this.showCreateUserMessage('User created successfully!', 'success');
                document.getElementById('create-user-form').reset();
                this.loadUsers(); // Refresh the users table
            } else {
                this.showCreateUserMessage(result.data.message || 'Failed to create user', 'error');
            }
        } catch (error) {
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'An error occurred while creating user';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Create user error:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            this.showCreateUserMessage(errorMessage, 'error');
        } finally {
            this.app.ui.hideLoading('create-user-submit-btn', 'create-user-loader');
        }
    }

    /**
     * Handle content upload submission
     */
    async handleContentUpload(event) {
        event.preventDefault();

        // Prevent double submission
        if (this.isSubmitting) {
            return;
        }
        this.isSubmitting = true;

        const formData = this.app.ui.getFormData('admin-upload-form');

        // Get category value (from dropdown or input)
        const category = this.getSelectedCategory();

        // Validate required fields
        if (!formData.contentTitle || !formData.contentDescription || !formData.accessLevel || !category) {
            this.showContentUploadMessage('Please fill out all required fields.', 'error');
            this.isSubmitting = false;
            return;
        }

        // Validate files
        const contentFile = document.getElementById('contentFile').files[0];
        const thumbnailFile = document.getElementById('thumbnailFile').files[0];

        if (!contentFile || !thumbnailFile) {
            this.showContentUploadMessage('Please select both content file and thumbnail image.', 'error');
            this.isSubmitting = false;
            return;
        }

        // Validate file sizes
        if (contentFile.size > 50 * 1024 * 1024) { // 50MB
            this.showContentUploadMessage('Content file must be less than 50MB.', 'error');
            this.isSubmitting = false;
            return;
        }

        if (thumbnailFile.size > 5 * 1024 * 1024) { // 5MB
            this.showContentUploadMessage('Thumbnail image must be less than 5MB.', 'error');
            this.isSubmitting = false;
            return;
        }

        try {
            this.app.ui.showLoading('admin-upload-submit-btn', 'admin-upload-loader');
            this.hideContentUploadMessage();

            // Process specific users if custom access level
            let specificUsers = [];
            if (formData.accessLevel === 'custom') {
                // Get selected users from checkboxes
                document.querySelectorAll('.upload-specific-user-checkbox:checked').forEach(checkbox => {
                    if (checkbox.dataset.userEmail) {
                        specificUsers.push(checkbox.dataset.userEmail);
                    }
                });

                // Validate that at least one user is selected for custom access
                if (specificUsers.length === 0) {
                    this.showContentUploadMessage('Please select at least one user for custom access.', 'error');
                    this.isSubmitting = false;
                    this.app.ui.hideLoading('admin-upload-submit-btn', 'admin-upload-loader');
                    return;
                }
            }

            // Convert files to base64
            const contentFileData = await this.fileToBase64(contentFile);
            const thumbnailFileData = await this.fileToBase64(thumbnailFile);

            const uploadContent = httpsCallable(this.app.functions, 'uploadContent');
            const result = await uploadContent({
                title: formData.contentTitle,
                description: formData.contentDescription,
                category: category,
                planRequirement: formData.accessLevel,
                specificUsers: specificUsers,
                fileSize: contentFile.size,
                contentFile: {
                    data: contentFileData,
                    name: contentFile.name,
                    type: contentFile.type,
                    size: contentFile.size,
                    originalFilename: contentFile.name
                },
                thumbnailFile: {
                    data: thumbnailFileData,
                    name: thumbnailFile.name,
                    type: thumbnailFile.type,
                    size: thumbnailFile.size,
                    originalFilename: thumbnailFile.name
                }
            });

            if (result.data.status === 'success') {
                this.showContentUploadMessage('Content uploaded successfully!', 'success');
                document.getElementById('admin-upload-form').reset();
                this.toggleSpecificUsersField('essentials'); // Reset the specific users field

                // Refresh content list if we're in the content management tab
                if (document.getElementById('panel-content-management').classList.contains('hidden') === false) {
                    setTimeout(() => this.loadContent(), 1000);
                }
            } else {
                this.showContentUploadMessage(result.data.message || 'Failed to upload content', 'error');
            }
        } catch (error) {
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'An error occurred during content upload';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Content upload error:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            this.showContentUploadMessage(errorMessage, 'error');
        } finally {
            this.app.ui.hideLoading('admin-upload-submit-btn', 'admin-upload-loader');
            this.isSubmitting = false;
        }
    }

    /**
     * Convert file to base64
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                // Remove the data:image/png;base64, or data:application/zip;base64, prefix
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    }

    /**
     * Show message for create user form
     */
    showCreateUserMessage(message, type) {
        const messageEl = document.getElementById('create-user-message');
        if (!messageEl) return;

        messageEl.textContent = message;
        messageEl.className = `mt-4 p-3 rounded-md text-sm ${
            type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
        }`;
        messageEl.classList.remove('hidden');

        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                this.hideCreateUserMessage();
            }, 5000);
        }
    }

    /**
     * Hide message for create user form
     */
    hideCreateUserMessage() {
        const messageEl = document.getElementById('create-user-message');
        if (messageEl) {
            messageEl.classList.add('hidden');
        }
    }

    /**
     * Show message for content upload form
     */
    showContentUploadMessage(message, type) {
        const messageEl = document.getElementById('content-upload-message');
        if (!messageEl) return;

        messageEl.textContent = message;
        let className;
        if (type === 'success') {
            className = 'bg-green-50 text-green-800 border border-green-200';
        } else if (type === 'info') {
            className = 'bg-blue-50 text-blue-800 border border-blue-200';
        } else {
            className = 'bg-red-50 text-red-800 border border-red-200';
        }
        messageEl.className = `mt-4 p-3 rounded-md text-sm ${className}`;
        messageEl.classList.remove('hidden');

        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                this.hideContentUploadMessage();
            }, 5000);
        }
    }

    /**
     * Hide message for content upload form
     */
    hideContentUploadMessage() {
        const messageEl = document.getElementById('content-upload-message');
        if (messageEl) {
            messageEl.classList.add('hidden');
        }
    }

    /**
     * Show message for modal actions
     */
    showModalActionMessage(message, type) {
        const messageEl = document.getElementById('modal-action-message');
        if (!messageEl) return;

        messageEl.textContent = message;
        messageEl.className = `mb-6 p-4 rounded-md text-sm ${
            type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
        }`;
        messageEl.classList.remove('hidden');

        // Auto-hide messages after 5 seconds
        setTimeout(() => {
            this.hideModalActionMessage();
        }, 5000);
    }

    /**
     * Hide modal action message
     */
    hideModalActionMessage() {
        const messageEl = document.getElementById('modal-action-message');
        if (messageEl) {
            messageEl.classList.add('hidden');
        }
    }

    // Modal methods for user actions
    showChangePasswordModal(userId) {
        const user = this.currentUsers.find(u => u.id === userId);
        if (!user) return;

        this.currentAction = 'change-password';
        this.currentUserId = userId;

        document.getElementById('modal-title').textContent = 'Change Password';
        document.getElementById('modal-content').innerHTML = `
            <p class="text-gray-600 mb-4">Change password for ${user.name} (${user.email})</p>
            <div>
                <label for="new-password" class="block text-sm font-medium text-gray-700">New Password</label>
                <div class="relative">
                    <input type="password" id="new-password" class="mt-1 block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500" required>
                    <button type="button" id="toggle-new-password" class="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>
                </div>
            </div>
        `;
        document.getElementById('modal-confirm-btn').textContent = 'Update Password';
        document.getElementById('modal-confirm-btn').className = 'px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md transition-colors';

        this.showModal();

        // Add password toggle for modal
        setTimeout(() => {
            const modalPasswordToggle = document.getElementById('toggle-new-password');
            if (modalPasswordToggle) {
                modalPasswordToggle.addEventListener('click', () => {
                    this.togglePasswordVisibility('new-password', 'toggle-new-password');
                });
            }
        }, 100);
    }

    showChangeRoleModal(userId) {
        const user = this.currentUsers.find(u => u.id === userId);
        if (!user) return;

        this.currentAction = 'change-role';
        this.currentUserId = userId;

        document.getElementById('modal-title').textContent = 'Change User Role';
        document.getElementById('modal-content').innerHTML = `
            <p class="text-gray-600 mb-4">Update role for ${user.name} (${user.email})</p>
            <div class="space-y-3">
                <label class="flex items-center">
                    <input type="checkbox" id="modal-is-admin" ${user.isAdmin ? 'checked' : ''} class="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded">
                    <span class="ml-2 text-sm text-gray-700">Admin User</span>
                </label>
                <label class="flex items-center">
                    <input type="checkbox" id="modal-is-advisor" ${user.isAdvisor ? 'checked' : ''} class="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded">
                    <span class="ml-2 text-sm text-gray-700">Advisor</span>
                </label>
            </div>
        `;
        document.getElementById('modal-confirm-btn').textContent = 'Update Role';
        document.getElementById('modal-confirm-btn').className = 'px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md transition-colors';

        this.showModal();
    }

    showManageContentModal(userId) {
        const user = this.currentUsers.find(u => u.id === userId);
        if (!user) return;

        this.currentAction = 'manage-user-content';
        this.currentUserId = userId;

        document.getElementById('modal-title').textContent = 'Manage Content Access';
        document.getElementById('modal-content').innerHTML = `
            <div class="space-y-4">
                <p class="text-gray-600 mb-4">Content access for ${user.name} (${user.email})</p>

                <div id="user-content-access-container" class="border border-gray-200 rounded-md overflow-auto max-h-80 p-2">
                    <p class="text-gray-500 text-sm italic text-center py-8">Loading content access...</p>
                </div>
            </div>
        `;
        document.getElementById('modal-confirm-btn').textContent = 'Update Access';
        document.getElementById('modal-confirm-btn').className = 'px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md transition-colors';

        this.showModal();

        // Load content for user access management
        this.loadContentForUserAccess(user);
    }

    showDeleteUserModal(userId) {
        const user = this.currentUsers.find(u => u.id === userId);
        if (!user) return;

        this.currentAction = 'delete-user';
        this.currentUserId = userId;

        document.getElementById('modal-title').textContent = 'Delete User';
        document.getElementById('modal-content').innerHTML = `
            <p class="text-gray-600 mb-4">Are you sure you want to delete ${user.name} (${user.email})? This action cannot be undone.</p>
            <div class="bg-red-50 border border-red-200 rounded-md p-3">
                <p class="text-sm text-red-800">This will permanently delete the user's account and all associated data.</p>
            </div>
        `;
        document.getElementById('modal-confirm-btn').textContent = 'Delete User';
        document.getElementById('modal-confirm-btn').className = 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors';

        this.showModal();
    }

    showUpdateBillingModal(element) {
        const userId = element.dataset.userId;
        const userEmail = element.dataset.userEmail;
        const userName = element.dataset.userName;

        this.currentAction = 'update-billing';
        this.currentUserId = userId;

        document.getElementById('modal-title').textContent = 'Update Billing Date';
        document.getElementById('modal-content').innerHTML = `
            <div class="space-y-4">
                <p class="text-gray-600">Update the billing date for <strong>${userName}</strong> (${userEmail})</p>
                
                <div>
                    <label for="billing-date-input" class="block text-sm font-medium text-gray-700 mb-2">New Billing Date</label>
                    <input type="date" id="billing-date-input" 
                        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        required>
                </div>
                
                <div class="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p class="text-sm text-blue-800">This will cancel the current subscription and create a new one with the specified billing date.</p>
                </div>
            </div>
        `;
        
        // Show modal first, then configure button
        this.showModal();
        
        // Use setTimeout to ensure modal is rendered
        setTimeout(() => {
            const confirmBtn = document.getElementById('modal-confirm-btn');
            if (confirmBtn) {
                confirmBtn.textContent = 'Update Billing Date';
                confirmBtn.className = 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors';
                confirmBtn.style.cssText = 'display: inline-block !important; visibility: visible !important; opacity: 1 !important;';
                console.log('Confirm button configured:', confirmBtn);
            } else {
                console.error('Confirm button not found!');
            }
        }, 100);

        // Pre-fill with June 20, 2026 for Paul specifically
        if (userEmail === 'paul.williams@wrwcollc.com') {
            document.getElementById('billing-date-input').value = '2026-06-20';
        }
    }

    showModal() {
        document.getElementById('user-action-modal').classList.remove('hidden');
    }

    closeModal() {
        document.getElementById('user-action-modal').classList.add('hidden');
        this.currentAction = null;
        this.currentUserId = null;
        this.currentContentId = null;
    }

    async confirmAction() {
        if (!this.currentAction) return;

        // Show loading state on the button
        const confirmBtn = document.getElementById('modal-confirm-btn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = `
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
            `;
        }

        try {
            console.log('Executing action:', this.currentAction);

            switch (this.currentAction) {
                case 'change-password':
                    await this.executeChangePassword();
                    break;
                case 'change-role':
                    await this.executeChangeRole();
                    break;
                case 'manage-user-content':
                    await this.executeManageUserContent();
                    break;
                case 'manage-content':
                    this.closeModal();
                    return;
                case 'delete-user':
                    await this.executeDeleteUser();
                    break;
                case 'delete-content':
                    await this.executeDeleteContent();
                    break;
                case 'edit-content':
                    await this.executeEditContent();
                    break;
                case 'manage-content-access':
                    await this.executeManageContentAccess();
                    break;
                case 'update-billing':
                    await this.executeUpdateBilling();
                    break;
                default:
                    this.closeModal();
                    return;
            }
        } catch (error) {
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'An error occurred';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Action error:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            this.showModalActionMessage(errorMessage, 'error');
        } finally {
            // Reset button state
            if (confirmBtn) {
                confirmBtn.disabled = false;

                // Restore original text based on action
                switch (this.currentAction) {
                    case 'delete-content':
                    case 'delete-user':
                        confirmBtn.textContent = 'Delete';
                        break;
                    case 'edit-content':
                        confirmBtn.textContent = 'Update Content';
                        break;
                    case 'manage-content-access':
                    case 'manage-user-content':
                        confirmBtn.textContent = 'Update Access';
                        break;
                    case 'change-password':
                        confirmBtn.textContent = 'Update Password';
                        break;
                    case 'change-role':
                        confirmBtn.textContent = 'Update Role';
                        break;
                    case 'update-billing':
                        confirmBtn.textContent = 'Update Billing Date';
                        break;
                    default:
                        confirmBtn.textContent = 'Confirm';
                }
            }
        }
    }

    async executeChangePassword() {
        const newPassword = document.getElementById('new-password').value;
        if (!newPassword) {
            this.showModalActionMessage('Please enter a new password', 'error');
            return;
        }

        const adminUpdateUserPassword = httpsCallable(this.app.functions, 'adminUpdateUserPassword');
        const result = await adminUpdateUserPassword({
            userId: this.currentUserId,
            newPassword: newPassword
        });

        if (result.data.status === 'success') {
            this.showModalActionMessage('Password updated successfully!', 'success');
            this.closeModal();
        } else {
            this.showModalActionMessage(result.data.message || 'Failed to update password', 'error');
        }
    }

    async executeChangeRole() {
        const isAdmin = document.getElementById('modal-is-admin').checked;
        const isAdvisor = document.getElementById('modal-is-advisor').checked;

        const adminUpdateUserRole = httpsCallable(this.app.functions, 'adminUpdateUserRole');
        const result = await adminUpdateUserRole({
            userId: this.currentUserId,
            isAdmin: isAdmin,
            isAdvisor: isAdvisor
        });

        if (result.data.status === 'success') {
            this.showModalActionMessage('User role updated successfully!', 'success');
            this.closeModal();
            this.loadUsers(); // Refresh the table
        } else {
            this.showModalActionMessage(result.data.message || 'Failed to update user role', 'error');
        }
    }

    async executeDeleteUser() {
        const adminDeleteUser = httpsCallable(this.app.functions, 'adminDeleteUser');
        const result = await adminDeleteUser({
            userId: this.currentUserId
        });

        if (result.data.status === 'success') {
            this.showModalActionMessage('User deleted successfully!', 'success');
            this.closeModal();
            this.loadUsers(); // Refresh the table
        } else {
            this.showModalActionMessage(result.data.message || 'Failed to delete user', 'error');
        }
    }

    async executeUpdateBilling() {
        console.log('executeUpdateBilling called');
        const billingDateInput = document.getElementById('billing-date-input');
        const newBillingDate = billingDateInput?.value;

        console.log('Billing date input:', newBillingDate);

        if (!newBillingDate) {
            console.error('No billing date provided');
            this.showModalActionMessage('Please select a billing date', 'error');
            return;
        }

        // Get user email from the user data
        const user = this.currentUsers.find(u => u.id === this.currentUserId);
        console.log('Found user:', user?.email);

        if (!user) {
            console.error('User not found with ID:', this.currentUserId);
            this.showModalActionMessage('User not found', 'error');
            return;
        }

        if (!user.authNetSubscriptionId || user.authNetSubscriptionId === 'admin-account-no-subscription') {
            console.error('User has no valid subscription:', user.authNetSubscriptionId);
            this.showModalActionMessage('This user does not have an active subscription', 'error');
            return;
        }

        console.log('Calling updateUserBillingDate with:', { userEmail: user.email, newBillingDate });

        try {
            const updateUserBillingDate = httpsCallable(this.app.functions, 'updateUserBillingDate');
            const result = await updateUserBillingDate({
                userEmail: user.email,
                newBillingDate: newBillingDate
            });

            console.log('Update result:', result.data);

            if (result.data.status === 'success') {
                this.showModalActionMessage(`✅ Billing date updated successfully for ${result.data.userDetails.name}!`, 'success');
                setTimeout(() => {
                    this.closeModal();
                    this.loadUsers(); // Refresh the table
                }, 2000);
            } else {
                this.showModalActionMessage(result.data.message || 'Failed to update billing date', 'error');
            }
        } catch (error) {
            console.error('Update billing date error:', error);
            this.showModalActionMessage(`Error: ${error.message}`, 'error');
        }
    }

    /**
     * Load content for content management tab
     */
    async loadContent() {
        try {
            this.showContentLoading();

            // Call the function to get all content (requires admin)
            const getUserAccessibleContent = httpsCallable(this.app.functions, 'getUserAccessibleContent');
            // Pass getAllContent: true to get all content regardless of access restrictions
            const result = await getUserAccessibleContent({ getAllContent: true });

            if (result.data.status === 'success') {
                const content = result.data.content || [];
                this.currentContent = content;
                this.filteredContent = content;
                this.contentCurrentPage = 1; // Reset to first page when loading new data

                if (content.length === 0) {
                    this.showContentEmptyState();
                } else {
                    // Apply current filters and sort
                    this.applyContentFilters();
                }
            } else {
                this.showContentError('Failed to load content');
            }
        } catch (error) {
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'Failed to load content';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Error loading content:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            this.showContentError(errorMessage);
        }
    }

    /**
     * Show loading state for content table
     */
    showContentLoading() {
        document.getElementById('content-loading').classList.remove('hidden');
        document.getElementById('content-table-container').classList.add('hidden');
        document.getElementById('content-empty-state').classList.add('hidden');
        document.getElementById('content-error').classList.add('hidden');
    }

    /**
     * Show content empty state
     */
    showContentEmptyState() {
        document.getElementById('content-loading').classList.add('hidden');
        document.getElementById('content-table-container').classList.add('hidden');
        document.getElementById('content-empty-state').classList.remove('hidden');
        document.getElementById('content-error').classList.add('hidden');
    }

    /**
     * Show content error state
     */
    showContentError(message) {
        document.getElementById('content-loading').classList.add('hidden');
        document.getElementById('content-table-container').classList.add('hidden');
        document.getElementById('content-empty-state').classList.add('hidden');
        document.getElementById('content-error').classList.remove('hidden');

        const errorElement = document.querySelector('#content-error p');
        if (errorElement) {
            errorElement.textContent = message || 'Failed to load content';
        }
    }

    /**
     * Render content table
     */
    renderContentTable(content) {
        const tbody = document.getElementById('content-table-body');
        if (!tbody) return;

        // Calculate pagination
        this.totalContent = content.length;
        this.contentTotalPages = Math.ceil(this.totalContent / this.contentPerPage);

        // Ensure current page is valid
        if (this.contentCurrentPage > this.contentTotalPages) {
            this.contentCurrentPage = this.contentTotalPages;
        }
        if (this.contentCurrentPage < 1) {
            this.contentCurrentPage = 1;
        }

        // Get content for current page
        const startIndex = (this.contentCurrentPage - 1) * this.contentPerPage;
        const endIndex = startIndex + this.contentPerPage;
        const currentPageContent = content.slice(startIndex, endIndex);

        tbody.innerHTML = currentPageContent.map(item => this.renderContentRow(item)).join('');

        document.getElementById('content-loading').classList.add('hidden');
        document.getElementById('content-table-container').classList.remove('hidden');
        document.getElementById('content-empty-state').classList.add('hidden');
        document.getElementById('content-error').classList.add('hidden');

        // Update pagination controls
        this.updateContentPaginationControls();

        // Setup action listeners for content items
        this.setupContentActionListeners();
    }

    /**
     * Render a content row
     */
    renderContentRow(content) {
        const planRequirement = content.planRequirement || 'essentials';
        const planBadge = this.getPlanBadge(planRequirement);
        const uploadedAt = content.uploadedAt ? new Date(content.uploadedAt._seconds * 1000).toLocaleDateString() : 'Unknown';

        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                            <img class="h-10 w-10 rounded-md object-cover" src="${content.thumbnailUrl || '#'}" alt="">
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${content.title || 'Untitled'}</div>
                            <div class="text-sm text-gray-500 truncate max-w-xs">${content.description || 'No description'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${content.category || 'Uncategorized'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${planBadge}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${uploadedAt}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div class="relative" data-content-id="${content.id}">
                        <button class="content-actions-btn text-gray-500 hover:text-gray-900">
                            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                            </svg>
                        </button>
                        <div class="content-actions-menu absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 hidden" style="min-width: 12rem; max-width: 20rem; z-index: 100;">
                            <div class="py-1">
                                <button class="edit-content-btn block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Edit Content</button>
                                <button class="manage-content-access-btn block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Manage Access</button>
                                <button class="delete-content-btn block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete Content</button>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Get plan badge HTML
     */
    getPlanBadge(planRequirement) {
        if (planRequirement === 'premium') {
            return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">Premium</span>`;
        } else if (planRequirement === 'custom') {
            return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Custom Users</span>`;
        } else {
            return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Essentials</span>`;
        }
    }

    /**
     * Setup content action listeners
     */
    setupContentActionListeners() {
        document.querySelectorAll('.content-actions-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const contentId = btn.closest('[data-content-id]').dataset.contentId;
                this.toggleContentActionsMenu(contentId);
            });
        });

        document.querySelectorAll('.edit-content-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const contentId = btn.closest('[data-content-id]').dataset.contentId;
                this.showEditContentModal(contentId);
            });
        });

        document.querySelectorAll('.manage-content-access-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const contentId = btn.closest('[data-content-id]').dataset.contentId;
                this.showManageContentAccessModal(contentId);
            });
        });

        document.querySelectorAll('.delete-content-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const contentId = btn.closest('[data-content-id]').dataset.contentId;
                this.showDeleteContentModal(contentId);
            });
        });

        // Close any open menus when clicking elsewhere
        document.addEventListener('click', () => {
            document.querySelectorAll('.content-actions-menu').forEach(menu => {
                menu.classList.add('hidden');
            });
        });
    }

    /**
     * Toggle content actions menu
     */
    toggleContentActionsMenu(contentId) {
        const allMenus = document.querySelectorAll('.content-actions-menu');
        allMenus.forEach(menu => {
            const menuContentId = menu.closest('[data-content-id]')?.dataset.contentId;
            if (menuContentId !== contentId) {
                menu.classList.add('hidden');
            }
        });

        const menu = document.querySelector(`[data-content-id="${contentId}"] .content-actions-menu`);
        if (menu) {
            menu.classList.toggle('hidden');

            // Check if menu is visible and adjust position if needed
            if (!menu.classList.contains('hidden')) {
                this.adjustMenuPosition(menu);
            }
        }
    }

    /**
     * Update content pagination controls
     */
    updateContentPaginationControls() {
        // Update pagination info
        const showingStart = this.totalContent === 0 ? 0 : (this.contentCurrentPage - 1) * this.contentPerPage + 1;
        const showingEnd = Math.min(this.contentCurrentPage * this.contentPerPage, this.totalContent);

        document.getElementById('content-showing-start').textContent = showingStart;
        document.getElementById('content-showing-end').textContent = showingEnd;
        document.getElementById('total-content').textContent = this.totalContent;

        // Update button states
        const prevButtons = [document.getElementById('content-prev-page'), document.getElementById('content-prev-page-mobile')];
        const nextButtons = [document.getElementById('content-next-page'), document.getElementById('content-next-page-mobile')];

        prevButtons.forEach(btn => {
            if (btn) {
                btn.disabled = this.contentCurrentPage <= 1;
            }
        });

        nextButtons.forEach(btn => {
            if (btn) {
                btn.disabled = this.contentCurrentPage >= this.contentTotalPages;
            }
        });

        // Update page numbers
        this.updateContentPageNumbers();
    }

    /**
     * Update content page number buttons
     */
    updateContentPageNumbers() {
        const pageNumbersContainer = document.getElementById('content-page-numbers');
        if (!pageNumbersContainer) return;

        pageNumbersContainer.innerHTML = '';

        if (this.contentTotalPages <= 1) return;

        // Calculate which page numbers to show
        let startPage = Math.max(1, this.contentCurrentPage - 2);
        let endPage = Math.min(this.contentTotalPages, this.contentCurrentPage + 2);

        // Adjust if we're near the beginning or end
        if (endPage - startPage < 4) {
            if (startPage === 1) {
                endPage = Math.min(this.contentTotalPages, startPage + 4);
            } else {
                startPage = Math.max(1, endPage - 4);
            }
        }

        // Add first page if not included
        if (startPage > 1) {
            pageNumbersContainer.appendChild(this.createContentPageButton(1));
            if (startPage > 2) {
                pageNumbersContainer.appendChild(this.createEllipsis());
            }
        }

        // Add page number buttons
        for (let i = startPage; i <= endPage; i++) {
            pageNumbersContainer.appendChild(this.createContentPageButton(i));
        }

        // Add last page if not included
        if (endPage < this.contentTotalPages) {
            if (endPage < this.contentTotalPages - 1) {
                pageNumbersContainer.appendChild(this.createEllipsis());
            }
            pageNumbersContainer.appendChild(this.createContentPageButton(this.contentTotalPages));
        }
    }

    /**
     * Create content page button
     */
    createContentPageButton(pageNumber) {
        const button = document.createElement('button');
        button.className = `relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
            pageNumber === this.contentCurrentPage
                ? 'z-10 bg-teal-50 border-teal-500 text-teal-600'
                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
        }`;
        button.textContent = pageNumber;
        button.addEventListener('click', () => this.goToContentPage(pageNumber));
        return button;
    }

    /**
     * Show delete content modal
     */
    showDeleteContentModal(contentId) {
        const content = this.currentContent.find(c => c.id === contentId);
        if (!content) return;

        this.currentAction = 'delete-content';
        this.currentContentId = contentId;

        document.getElementById('modal-title').textContent = 'Delete Content';
        document.getElementById('modal-content').innerHTML = `
            <p class="text-gray-600 mb-4">Are you sure you want to delete "${content.title}"? This action cannot be undone.</p>
            <div class="bg-red-50 border border-red-200 rounded-md p-3">
                <p class="text-sm text-red-800">This will permanently delete this content and remove access for all users.</p>
            </div>
        `;
        document.getElementById('modal-confirm-btn').textContent = 'Delete Content';
        document.getElementById('modal-confirm-btn').className = 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors';

        this.showModal();
    }

    /**
     * Show edit content modal
     */
    showEditContentModal(contentId) {
        const content = this.currentContent.find(c => c.id === contentId);
        if (!content) return;

        this.currentAction = 'edit-content';
        this.currentContentId = contentId;

        document.getElementById('modal-title').textContent = 'Edit Content';
        document.getElementById('modal-content').innerHTML = `
            <div class="space-y-4">
                <div>
                    <label for="edit-title" class="block text-sm font-medium text-gray-700">Title</label>
                    <input type="text" id="edit-title" value="${content.title || ''}" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500">
                </div>
                <div>
                    <label for="edit-description" class="block text-sm font-medium text-gray-700">Description</label>
                    <textarea id="edit-description" rows="3" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500">${content.description || ''}</textarea>
                </div>
                <div>
                    <label for="edit-category" class="block text-sm font-medium text-gray-700">Category</label>
                    <select id="edit-category" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 bg-white">
                        <option value="">Loading categories...</option>
                    </select>
                </div>
                <div>
                    <label for="edit-plan" class="block text-sm font-medium text-gray-700">Plan Requirement</label>
                    <select id="edit-plan" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 bg-white">
                        <option value="essentials" ${content.planRequirement === 'essentials' ? 'selected' : ''}>Essentials Plan</option>
                        <option value="premium" ${content.planRequirement === 'premium' ? 'selected' : ''}>Premium Plan</option>
                        <option value="custom" ${content.planRequirement === 'custom' ? 'selected' : ''}>Custom (Specific Users)</option>
                    </select>
                </div>
            </div>
        `;
        document.getElementById('modal-confirm-btn').textContent = 'Update Content';
        document.getElementById('modal-confirm-btn').className = 'px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md transition-colors';

        this.showModal();

        // Load categories into the dropdown
        this.loadCategoriesForModal('edit-category', content.category);
    }

    /**
     * Show manage content access modal
     */
    showManageContentAccessModal(contentId) {
        const content = this.currentContent.find(c => c.id === contentId);
        if (!content) return;

        this.currentAction = 'manage-content-access';
        this.currentContentId = contentId;

        // Get users to show in the dropdown
        let usersHtml = '<p class="text-gray-500 text-sm italic">Loading users...</p>';

        document.getElementById('modal-title').textContent = 'Manage Content Access';
        document.getElementById('modal-content').innerHTML = `
            <div class="space-y-4">
                <p class="text-gray-600">Manage access for "${content.title}"</p>

                <div>
                    <label for="access-plan" class="block text-sm font-medium text-gray-700">Access Level</label>
                    <select id="access-plan" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 bg-white">
                        <option value="essentials" ${content.planRequirement === 'essentials' ? 'selected' : ''}>Essentials Plan (all users)</option>
                        <option value="premium" ${content.planRequirement === 'premium' ? 'selected' : ''}>Premium Plan (premium users)</option>
                        <option value="custom" ${content.planRequirement === 'custom' ? 'selected' : ''}>Custom (specific users only)</option>
                    </select>
                </div>

                <div id="specific-users-container-modal" class="${content.planRequirement !== 'custom' ? 'hidden' : ''}">
                    <label for="specific-users" class="block text-sm font-medium text-gray-700">Specific Users</label>
                    <div id="specific-users-list" class="mt-2 border border-gray-200 rounded-md overflow-auto max-h-60 p-2">
                        ${usersHtml}
                    </div>
                </div>
            </div>
        `;
        document.getElementById('modal-confirm-btn').textContent = 'Update Access';
        document.getElementById('modal-confirm-btn').className = 'px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md transition-colors';

        this.showModal();

        // Setup access plan change listener
        const accessPlanSelect = document.getElementById('access-plan');
        if (accessPlanSelect) {
            accessPlanSelect.addEventListener('change', (e) => {
                const specificUsersContainer = document.getElementById('specific-users-container-modal');
                if (specificUsersContainer) {
                    specificUsersContainer.classList.toggle('hidden', e.target.value !== 'custom');
                }
            });
        }

        // Load users for access management
        this.loadUsersForContentAccess(content);
    }

    /**
     * Load categories for modal dropdown
     */
    async loadCategoriesForModal(selectId, selectedCategory) {
        const select = document.getElementById(selectId);
        if (!select) return;

        try {
            const getCategories = httpsCallable(this.app.functions, 'getCategories');
            const result = await getCategories();

            if (result.data.status === 'success' && result.data.categories) {
                const categories = result.data.categories.map(cat => cat.name);
                categories.sort(); // Sort alphabetically

                select.innerHTML = `
                    <option value="">Select a category...</option>
                    ${categories.map(cat => `<option value="${cat}" ${cat === selectedCategory ? 'selected' : ''}>${cat}</option>`).join('')}
                `;
            } else {
                select.innerHTML = '<option value="">No categories available</option>';
            }
        } catch (error) {
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'Error loading categories';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Error loading categories:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            select.innerHTML = '<option value="">Error loading categories</option>';
        }
    }

    /**
     * Load users for content access management
     */
    async loadUsersForContentAccess(content) {
        const usersList = document.getElementById('specific-users-list');
        if (!usersList) return;

        try {
            // Load users (or use cached list if available)
            if (!this.currentUsers || this.currentUsers.length === 0) {
                const adminGetAllUsers = httpsCallable(this.app.functions, 'adminGetAllUsers');
                const result = await adminGetAllUsers();

                if (result.data.status === 'success') {
                    this.currentUsers = result.data.users;
                } else {
                    throw new Error('Failed to load users');
                }
            }

            // Get list of specific user emails if available
            const specificUserEmails = content.specificUsers || [];

            // Create user list with checkboxes
            const usersHtml = this.currentUsers
                .filter(user => user.email) // Only users with emails
                .map(user => {
                    const isChecked = specificUserEmails.includes(user.email);
                    return `
                        <div class="flex items-center py-1">
                            <input type="checkbox" id="user-${user.id}" class="specific-user-checkbox"
                                   data-user-id="${user.id}" data-user-email="${user.email}"
                                   ${isChecked ? 'checked' : ''}
                                   class="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded">
                            <label for="user-${user.id}" class="ml-2 block text-sm text-gray-900">
                                ${user.name || 'Unnamed'} (${user.email})
                            </label>
                        </div>
                    `;
                })
                .join('');

            usersList.innerHTML = usersHtml || '<p class="text-gray-500 text-sm italic">No users available</p>';
        } catch (error) {
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'Failed to load users for content access';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Error loading users for content access:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            usersList.innerHTML = '<p class="text-red-500 text-sm">Failed to load users</p>';
        }
    }

            /**
     * Execute manage content access action
     */
    async executeManageContentAccess() {
        const accessPlan = document.getElementById('access-plan').value;

        // Get selected users if access plan is custom
        let specificUsers = [];
        if (accessPlan === 'custom') {
            document.querySelectorAll('.specific-user-checkbox:checked').forEach(checkbox => {
                specificUsers.push(checkbox.dataset.userEmail);
            });

            if (specificUsers.length === 0) {
                this.showModalActionMessage('Please select at least one user for custom access', 'error');
                return;
            }
        }

        try {
            // Call the set content access function
            const setContentAccess = httpsCallable(this.app.functions, 'setContentAccess');
            const result = await setContentAccess({
                contentId: this.currentContentId,
                planRequirement: accessPlan,
                specificUsers: specificUsers
            });

            if (result.data.status === 'success') {
                this.showModalActionMessage('Content access updated successfully!', 'success');
                this.closeModal();
                // Refresh content list
                setTimeout(() => this.loadContent(), 1000);
            } else {
                this.showModalActionMessage(result.data.message || 'Failed to update content access', 'error');
            }
        } catch (error) {
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'An error occurred while updating content access';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Update content access error:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            this.showModalActionMessage(errorMessage, 'error');
        }
    }

    /**
     * Execute delete content action
     */
    async executeDeleteContent() {
        if (!this.currentContentId) {
            this.showModalActionMessage('No content selected for deletion', 'error');
            return;
        }

        try {
            // Call the delete content function (to be implemented in Firebase Functions)
            const deleteContent = httpsCallable(this.app.functions, 'deleteContent');
            const result = await deleteContent({
                contentId: this.currentContentId
            });

            if (result.data.status === 'success') {
                this.showModalActionMessage('Content deleted successfully!', 'success');
                this.closeModal();
                // Refresh content list
                setTimeout(() => this.loadContent(), 1000);
            } else {
                this.showModalActionMessage(result.data.message || 'Failed to delete content', 'error');
            }
        } catch (error) {
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'An error occurred while deleting content';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Delete content error:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            this.showModalActionMessage(errorMessage, 'error');
        }
    }

    /**
     * Show manage user content modal
     */
    showManageContentModal(userId) {
        const user = this.currentUsers.find(u => u.id === userId);
        if (!user) return;

        this.currentAction = 'manage-user-content';
        this.currentUserId = userId;

        document.getElementById('modal-title').textContent = 'Manage Content Access';
        document.getElementById('modal-content').innerHTML = `
            <div class="space-y-4">
                <p class="text-gray-600 mb-4">Content access for ${user.name} (${user.email})</p>

                <div id="user-content-access-container" class="border border-gray-200 rounded-md overflow-auto max-h-80 p-2">
                    <p class="text-gray-500 text-sm italic text-center py-8">Loading content access...</p>
                </div>
            </div>
        `;
        document.getElementById('modal-confirm-btn').textContent = 'Update Access';
        document.getElementById('modal-confirm-btn').className = 'px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md transition-colors';

        this.showModal();

        this.loadContentForUserAccess(user);
    }

    /**
     * Load content for user access management
     */
    async loadContentForUserAccess(user) {
        const contentContainer = document.getElementById('user-content-access-container');
        if (!contentContainer) return;

        try {
            // Load all available content if not already loaded
            if (!this.allContent) {
                const getUserAccessibleContent = httpsCallable(this.app.functions, 'getUserAccessibleContent');
                const result = await getUserAccessibleContent({ getAllContent: true });

                if (result.data.status === 'success') {
                    this.allContent = result.data.content || [];
                } else {
                    throw new Error('Failed to load content');
                }
            }

            // Get the user's accessible content IDs
            const userAccessibleContent = user.accessibleContent || [];

            if (this.allContent.length === 0) {
                contentContainer.innerHTML = '<p class="text-gray-500 text-sm italic text-center py-8">No content available</p>';
                return;
            }

            // Filter to only show custom content
            const customContent = this.allContent.filter(content => content.planRequirement === 'custom');

            if (customContent.length === 0) {
                contentContainer.innerHTML = '<p class="text-gray-500 text-sm italic text-center py-8">No custom content available to manage</p>';
                return;
            }

            // Create content list with checkboxes
            contentContainer.innerHTML = customContent.map(content => {
                // Check if this user has access to this content
                const isChecked = userAccessibleContent.includes(content.id) ||
                                 (content.specificUsers && content.specificUsers.includes(user.email));

                return `
                    <div class="flex items-center py-2 border-b border-gray-100">
                        <div class="flex-shrink-0">
                            <input type="checkbox" id="content-${content.id}" class="user-content-checkbox"
                                   data-content-id="${content.id}" ${isChecked ? 'checked' : ''}
                                   class="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded">
                        </div>
                        <div class="ml-3 flex-grow">
                            <label for="content-${content.id}" class="block text-sm font-medium text-gray-900">
                                ${content.title}
                            </label>
                            <p class="text-xs text-gray-500">${content.category || 'Uncategorized'}</p>
                        </div>
                        <div class="ml-2">${this.getPlanContentBadge(content.planRequirement)}</div>
                    </div>
                `;
            }).join('') || '<p class="text-gray-500 text-sm italic text-center py-8">No custom content available</p>';

            // Add note explaining what this does
            contentContainer.innerHTML += `
                <div class="mt-4 border-t border-gray-200 pt-4">
                    <p class="text-xs text-gray-500">
                        <span class="font-medium">Note:</span> Check or uncheck content to grant or remove access for this user.
                        Changes will be saved when you click "Update Access".
                    </p>
                </div>
            `;

        } catch (error) {
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'Failed to load content for user access';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Error loading content for user access:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            contentContainer.innerHTML = '<p class="text-red-500 text-sm text-center py-8">Failed to load content</p>';
        }
    }

    /**
     * Get plan badge HTML for content management
     */
    getPlanContentBadge(planRequirement) {
        if (planRequirement === 'premium') {
            return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">Premium</span>`;
        } else if (planRequirement === 'custom') {
            return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Custom</span>`;
        } else {
            return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Essentials</span>`;
        }
    }

    /**
     * Execute manage user content action
     */
    async executeManageUserContent() {
        const accessibleContent = [];

        // Get selected content
        document.querySelectorAll('.user-content-checkbox:checked:not([disabled])').forEach(checkbox => {
            accessibleContent.push(checkbox.dataset.contentId);
        });

        try {
            // Call the update user content access function
            const adminUpdateUserContent = httpsCallable(this.app.functions, 'adminUpdateUserContent');
            const result = await adminUpdateUserContent({
                userId: this.currentUserId,
                accessibleContent: accessibleContent
            });

            if (result.data.status === 'success') {
                this.showModalActionMessage('User content access updated successfully!', 'success');
                this.closeModal();
            } else {
                this.showModalActionMessage(result.data.message || 'Failed to update user content access', 'error');
            }
        } catch (error) {
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'An error occurred while updating user content access';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Update user content access error:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            this.showModalActionMessage(errorMessage, 'error');
        }
    }

    /**
     * Execute edit content action
     */
    async executeEditContent() {
        const title = document.getElementById('edit-title').value;
        const description = document.getElementById('edit-description').value;
        const category = document.getElementById('edit-category').value;
        const planRequirement = document.getElementById('edit-plan').value;

        if (!title || !description || !category || !planRequirement) {
            this.showModalActionMessage('All fields are required', 'error');
            return;
        }

        try {
            // Call the update content function (to be implemented in Firebase Functions)
            const updateContent = httpsCallable(this.app.functions, 'updateContent');
            const result = await updateContent({
                contentId: this.currentContentId,
                updates: {
                    title,
                    description,
                    category,
                    planRequirement
                }
            });

            if (result.data.status === 'success') {
                this.showModalActionMessage('Content updated successfully!', 'success');
                this.closeModal();
                // Refresh content list
                setTimeout(() => this.loadContent(), 1000);
            } else {
                this.showModalActionMessage(result.data.message || 'Failed to update content', 'error');
            }
        } catch (error) {
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'An error occurred while updating content';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Update content error:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            this.showModalActionMessage(errorMessage, 'error');
        }
    }

    /**
     * Preview library from a specific user's perspective
     */
    async previewUserLibrary(userId) {
        const user = this.currentUsers.find(u => u.id === userId);
        if (!user) {
            console.error('User not found for library preview');
            return;
        }

        try {
            // Store the original user data for restoration later
            const originalUserData = this.app.currentUserData;
            const originalUserAuth = this.app.currentUser;

            // Enable preview mode in library handler
            this.app.libraryHandler.enablePreviewMode(user);

            // Temporarily set the app context to ensure library access
            this.app.currentUserData = {
                ...this.app.currentUserData,
                subscriptionStatus: 'active' // Ensure access to library page
            };

            // Load the library component if not already loaded
            if (window.componentManager) {
                await window.componentManager.loadComponent('library');
            }

            // Navigate to library page
            await this.app.router.navigateTo('/library');

            // Add a banner to indicate admin preview mode after navigation
            setTimeout(() => {
                this.addLibraryPreviewBanner(user, originalUserData, originalUserAuth);
            }, 200);

        } catch (error) {
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'Failed to preview library';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Error previewing user library:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            alert('Failed to preview library. Please try again.');
        }
    }

    /**
     * Add a banner to the library indicating admin preview mode
     */
    addLibraryPreviewBanner(previewUser, originalUserData, originalUserAuth) {
        // Remove existing banner if present
        const existingBanner = document.getElementById('admin-preview-banner');
        if (existingBanner) {
            existingBanner.remove();
        }

        // Create preview banner
        const banner = document.createElement('div');
        banner.id = 'admin-preview-banner';
        banner.className = 'bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6';
        banner.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <svg class="h-5 w-5 text-yellow-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                    <div>
                        <p class="font-medium">Admin Preview Mode</p>
                        <p class="text-sm">Viewing library as: <strong>${previewUser.name} (${previewUser.email})</strong></p>
                    </div>
                </div>
                <button id="exit-preview-btn" class="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                    Exit Preview
                </button>
            </div>
        `;

        // Insert banner at the top of the library content
        const libraryContent = document.getElementById('library-content-list');
        if (libraryContent) {
            libraryContent.insertBefore(banner, libraryContent.firstChild);
        }

        // Add exit preview functionality
        const exitBtn = document.getElementById('exit-preview-btn');
        if (exitBtn) {
            exitBtn.addEventListener('click', () => {
                this.exitLibraryPreview(originalUserData, originalUserAuth);
            });
        }
    }

    /**
     * Exit library preview mode and return to admin dashboard
     */
    async exitLibraryPreview(originalUserData, originalUserAuth) {
        try {
            // Disable preview mode in library handler
            this.app.libraryHandler.disablePreviewMode();

            // Restore original user context
            this.app.currentUserData = originalUserData;
            this.app.currentUser = originalUserAuth;

            // Navigate back to admin dashboard
            this.app.router.navigateTo('/admin');

            // Remove preview banner
            const banner = document.getElementById('admin-preview-banner');
            if (banner) {
                banner.remove();
            }

        } catch (error) {
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'Error exiting library preview';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Error exiting library preview:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            // Fallback: force page reload to admin
            window.location.hash = '#/admin';
            window.location.reload();
        }
    }

    clearAdminState() {
        // Reset pagination states
        this.currentPage = 1;
        this.perPage = 10;
        this.totalUsers = 0;
        this.contentCurrentPage = 1;
        this.contentPerPage = 5;
        this.totalContent = 0;

        // Clear any cached data
        this.cachedUsers = null;
        this.cachedContent = null;

        // Clear any search/filter states
        this.currentFilter = null;
        this.currentSort = null;
    }
}