// js/ui/library-manager.js
import { UIHelpers } from './ui-helpers.js';

export class LibraryManager {
    constructor() {
        this.loadedItemCount = 0;
        this.totalItemCount = 0;
        this.itemCategories = {};
        this.userPlan = 'essentials';
        this.activeCategory = null;
    }

    showLibraryLoading() {
        const container = document.getElementById('library-content-list');
        if (container) container.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-12"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mb-4"></div><h3 class="text-lg font-semibold text-gray-700">Loading Content...</h3></div>`;
    }

    showLibraryStructure(totalItems, userPlan = 'essentials') {
        const container = document.getElementById('library-content-list');
        if (!container) return;
        this.totalItemCount = totalItems;
        this.loadedItemCount = 0;
        this.userPlan = userPlan;

        container.innerHTML = `
            <div class="flex flex-col md:flex-row md:items-center justify-between mb-6">
                <h2 class="text-2xl font-bold text-gray-800">Educational Library</h2>
                <div class="flex items-center mt-2 md:mt-0">
                    <div class="mr-4">
                        <span class="px-2 py-1 bg-${this.userPlan === 'premium' ? 'purple' : 'green'}-100 text-${this.userPlan === 'premium' ? 'purple' : 'green'}-800 rounded-full text-xs font-medium">${this.userPlan === 'premium' ? 'Premium' : 'Essentials'} Plan</span>
                    </div>
                    <div id="loading-progress" class="text-sm text-gray-600">Loading... (0/${totalItems})</div>
                </div>
            </div>
            <div id="library-items-container" class="space-y-12"></div>`;
    }

    addCategoryContent(category, items) {
        this.loadedItemCount += items.length;
        UIHelpers.updateElementText('loading-progress', `Loading... (${this.loadedItemCount}/${this.totalItemCount})`);

        // Save items in the category
        this.itemCategories[category] = items;

        const container = document.getElementById('library-items-container');
        if (!container) return;

        const categoryId = this.getCategoryId(category);
        let categorySection = document.getElementById(`category-${categoryId}`);

        if (!categorySection) {
            categorySection = document.createElement('div');
            categorySection.id = `category-${categoryId}`;
            categorySection.className = 'mb-16';
            categorySection.innerHTML = `
                <h2 class="text-2xl font-bold text-gray-800 mb-8 pb-2 border-b border-gray-200" id="${categoryId}">${category}</h2>
                <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-8" id="items-${categoryId}"></div>`;
            container.appendChild(categorySection);
        }

        const itemsGrid = document.getElementById(`items-${categoryId}`);
        if (itemsGrid) {
            itemsGrid.innerHTML = items.map(item => this.createLibraryItemHTML(item)).join('');
            this.setupCategoryEventListeners(itemsGrid);
        }
    }

    finalizeLibraryDisplay() {
        const progressEl = document.getElementById('loading-progress');
        if(progressEl) progressEl.textContent = `✅ Loaded ${this.loadedItemCount} items.`;
        setTimeout(() => progressEl?.parentElement?.querySelector('#loading-progress')?.remove(), 2000);
        UIHelpers.announceToScreenReader('Library loaded successfully.');

        // Update categories sidebar
        this.updateCategoriesList();

        // Show empty state if no content
        if (this.loadedItemCount === 0) {
            const container = document.getElementById('library-items-container');
            if (container) {
                container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-center">
                    <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 class="text-lg font-semibold text-gray-700">No content available</h3>
                    <p class="text-gray-500 mt-1">No content is available for your current plan.</p>
                </div>`;
            }
        }
    }

    updateCategoriesList() {
        const categoriesList = document.getElementById('library-categories-list');
        if (!categoriesList) return;

        // Get all categories with content
        const categories = Object.keys(this.itemCategories).filter(cat =>
            this.itemCategories[cat] && this.itemCategories[cat].length > 0
        );

        if (categories.length === 0) {
            categoriesList.innerHTML = `<li class="text-gray-500 text-sm">No categories available</li>`;
            return;
        }

        // Sort categories alphabetically
        categories.sort();

        // Generate HTML for categories
        const categoriesHTML = categories.map(category => {
            const categoryId = this.getCategoryId(category);
            return `
                <li>
                    <a href="#${categoryId}" class="category-link flex items-center text-teal-700 hover:text-teal-900 font-medium" data-category="${category}">
                        <span class="mr-2">•</span>
                        ${category}
                    </a>
                </li>
            `;
        }).join('');

        categoriesList.innerHTML = categoriesHTML;

        // Add event listeners for category links
        categoriesList.querySelectorAll('.category-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const category = e.currentTarget.getAttribute('data-category');
                const id = e.currentTarget.getAttribute('href').substring(1);

                // Smooth scroll to category
                document.getElementById(id)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });

                this.setActiveCategory(category);
            });
        });
    }

    setActiveCategory(category) {
        this.activeCategory = category;

        // Update active state in UI
        document.querySelectorAll('.category-link').forEach(link => {
            const linkCategory = link.getAttribute('data-category');
            if (linkCategory === category) {
                link.classList.add('text-teal-900', 'font-bold');
            } else {
                link.classList.remove('text-teal-900', 'font-bold');
            }
        });
    }

    getCategoryId(categoryName) {
        return categoryName.replace(/\W+/g, '-').toLowerCase();
    }

    createLibraryItemHTML(item) {
        const planBadge = item.planRequirement === 'premium' ?
            `<span class="absolute top-2 right-2 px-2 py-1 bg-purple-600 text-white text-xs font-bold rounded">PREMIUM</span>` : '';

        return `
            <div class="library-item-container cursor-pointer group" data-download-url="${item.downloadUrl}" data-title="${item.title}" tabindex="0" role="button" aria-label="Download ${item.title}">
                <div class="relative overflow-hidden rounded-lg shadow-md transition-all duration-300 group-hover:shadow-xl">
                    <img src="${item.thumbnailUrl}" alt="${item.title}" class="w-full aspect-[1/1.414] object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy">
                    ${planBadge}
                </div>
                <div class="mt-3">
                    <div class="text-sm text-teal-700 font-medium">${item.category}</div>
                    <h3 class="font-bold text-gray-900 text-lg leading-tight mt-1">${item.title}</h3>
                    <p class="text-sm text-gray-500 mt-1 line-clamp-2">${item.description || ''}</p>
                </div>
            </div>`;
    }

    setupCategoryEventListeners(container) {
        container.querySelectorAll('.library-item-container').forEach(item => {
            const handler = (e) => {
                e.preventDefault();
                const downloadUrl = item.dataset.downloadUrl;
                const title = item.dataset.title;
                this.downloadLibraryItem(downloadUrl, title);
            };
            item.addEventListener('click', handler);
            item.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') handler(e);
            });
        });
    }

    downloadLibraryItem(downloadUrl, title) {
        try {
            UIHelpers.announceToScreenReader(`Downloading ${title}`);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `${title.replace(/\s/g, '_')}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.trackDownload(title);
        } catch (error) {
            console.error('Download error:', error);
            this.showLibraryMessage('Failed to start download.', 'error');
        }
    }

    trackDownload(title) {
        // Simple tracking notification
        this.showLibraryMessage(`Downloading ${title}...`, 'success');
        // In the future, this could log downloads to analytics or update download count
    }

    showLibraryAccessDenied() {
        const container = document.getElementById('library-content-list');
        if (container) container.innerHTML = `<div class="text-center py-12"><h3 class="text-lg font-semibold">Subscription Required</h3><p>You need an active subscription to access the library.</p><button onclick="window.simpliFinanceApp.ui.pageManager.showPage('home-page')" class="mt-4 bg-teal-600 text-white font-semibold py-2 px-6 rounded-md">View Plans</button></div>`;

        // Hide loading indicator from categories
        this.clearCategoriesLoading();
    }

    showLibraryError(message) {
        const container = document.getElementById('library-content-list');
        if (container) container.innerHTML = `<div class="text-center py-12"><h3 class="text-lg font-semibold text-red-600">Loading Error</h3><p>${message}</p><button onclick="window.simpliFinanceApp.libraryHandler.loadLibraryContent()" class="mt-4 bg-teal-600 text-white font-semibold py-2 px-6 rounded-md">Try Again</button></div>`;

        // Hide loading indicator from categories
        this.clearCategoriesLoading();
    }

    clearCategoriesLoading() {
        const categoriesList = document.getElementById('library-categories-list');
        if (categoriesList) {
            categoriesList.innerHTML = `<li class="text-gray-500 text-sm">No categories available</li>`;
        }
    }

    showLibraryMessage(message, type) {
        let messageEl = document.getElementById('library-message');
        if (!messageEl) {
            // Create message element if it doesn't exist
            messageEl = document.createElement('div');
            messageEl.id = 'library-message';
            messageEl.className = 'mb-6 p-4 rounded-md text-sm';

            // Insert at the top of the library content
            const container = document.getElementById('library-content-list');
            if (container) {
                container.insertBefore(messageEl, container.firstChild);
            }
        }

        messageEl.textContent = message;
        messageEl.className = `mb-6 p-4 rounded-md text-sm ${
            type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
        }`;
        messageEl.style.display = 'block';

        // Auto-hide messages after 3 seconds
        setTimeout(() => {
            this.hideLibraryMessage();
        }, 3000);
    }

    hideLibraryMessage() {
        const messageEl = document.getElementById('library-message');
        if (messageEl) {
            messageEl.style.display = 'none';
        }
    }
}