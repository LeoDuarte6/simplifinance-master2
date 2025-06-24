// js/app/library-handler.js

import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

export class LibraryHandler {
    constructor(appInstance) {
        this.app = appInstance;
        this.contentCache = new Map();
        this.previewMode = false;
        this.previewUser = null;
    }

    async loadLibraryContent() {
        if (!this.app.currentUserData) {
            this.app.ui.libraryManager.showLibraryAccessDenied();
            return;
        }

        if (this.app.currentUserData.subscriptionStatus !== 'active') {
            this.app.ui.libraryManager.showLibraryAccessDenied();
            return;
        }

        this.app.ui.libraryManager.showLibraryLoading();

        try {
            let result;

            // Check if we're in preview mode (admin previewing another user's library)
            if (this.previewMode && this.previewUser) {
                result = await this.loadLibraryContentForUser(this.previewUser);
            } else {
                const getUserAccessibleContent = httpsCallable(this.app.functions, 'getUserAccessibleContent');
                result = await getUserAccessibleContent();
            }

            if (result.data.status === 'success') {
                const content = result.data.content || [];
                const userPlan = result.data.userPlan || 'essentials';

                this.app.ui.libraryManager.showLibraryStructure(content.length, userPlan);

                // Group content by category
                const contentByCategory = this.groupContentByCategory(content);

                // Display content
                Object.keys(contentByCategory).forEach(category => {
                    this.app.ui.libraryManager.addCategoryContent(category, contentByCategory[category]);
                });

                this.app.ui.libraryManager.finalizeLibraryDisplay();
            } else {
                this.app.ui.libraryManager.showLibraryError('Could not load content.');
            }
        } catch (error) {
            // Extract error details from HttpsError format
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'Could not load content.';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Library loading error:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            this.app.ui.libraryManager.showLibraryError(errorMessage);
        }
    }

    /**
     * Load library content filtered for a specific user (admin preview mode)
     */
    async loadLibraryContentForUser(user) {
        try {
            // First get all content (admin call)
            const getUserAccessibleContent = httpsCallable(this.app.functions, 'getUserAccessibleContent');
            const result = await getUserAccessibleContent({ getAllContent: true });

            if (result.data.status !== 'success') {
                throw new Error('Failed to load all content');
            }

            const allContent = result.data.content || [];

            // Filter content based on the preview user's permissions
            const filteredContent = this.filterContentForUser(allContent, user);

            // Get user's plan level
            const userPlan = user.planLevel || (user.plan && user.plan.toLowerCase().includes('premium') ? 'premium' : 'essentials');

            return {
                data: {
                    status: 'success',
                    content: filteredContent,
                    userPlan: userPlan
                }
            };
        } catch (error) {
            console.error('Error loading content for user preview:', error);
            throw error;
        }
    }

    /**
     * Filter content based on a specific user's access permissions
     */
    filterContentForUser(allContent, user) {
        const filteredContent = [];
        const userEmail = user.email;
        const userId = user.id;
        const isAdmin = user.isAdmin === true;
        const planLevel = user.planLevel || (user.plan && user.plan.toLowerCase().includes('premium') ? 'premium' : 'essentials');

        allContent.forEach(content => {
            // Admin users can see all content
            if (isAdmin) {
                filteredContent.push(content);
                return;
            }

            // Check access based on plan requirement
            if (content.planRequirement === 'essentials' ||
                (content.planRequirement === 'premium' && planLevel === 'premium')) {
                filteredContent.push(content);
            }
            // Check custom content access by email
            else if (content.planRequirement === 'custom' &&
                     content.specificUsers &&
                     content.specificUsers.length > 0) {
                // Check if user's email is included
                if (userEmail && content.specificUsers.includes(userEmail)) {
                    filteredContent.push(content);
                }
                // Also check if user's ID is included (legacy support)
                else if (content.specificUsers.includes(userId)) {
                    filteredContent.push(content);
                }
            }
            // Check user's specific accessible content list
            else if (user.accessibleContent &&
                     user.accessibleContent.includes(content.id)) {
                filteredContent.push(content);
            }
        });

        return filteredContent;
    }

    /**
     * Enable preview mode for a specific user
     */
    enablePreviewMode(user) {
        this.previewMode = true;
        this.previewUser = user;
    }

    /**
     * Disable preview mode
     */
    disablePreviewMode() {
        this.previewMode = false;
        this.previewUser = null;
    }

    groupContentByCategory(contentItems) {
        const categories = {};

        // Process each content item
        contentItems.forEach(item => {
            const category = item.category || 'Miscellaneous';

            if (!categories[category]) {
                categories[category] = [];
            }

            categories[category].push({
                id: item.id,
                title: item.title,
                description: item.description,
                thumbnailUrl: item.thumbnailUrl,
                downloadUrl: item.downloadUrl,
                category: category,
                planRequirement: item.planRequirement
            });
        });

        // Sort content items within each category
        Object.keys(categories).forEach(category => {
            categories[category].sort((a, b) => a.title.localeCompare(b.title));
        });

        return categories;
    }

    clearLibraryState() {
        // Clear content cache
        this.contentCache.clear();

        // Clear preview mode
        this.previewMode = false;
        this.previewUser = null;

        // Clear any library-specific UI state
        const libraryContainer = document.getElementById('library-content');
        if (libraryContainer) {
            libraryContainer.innerHTML = '';
        }
    }
}