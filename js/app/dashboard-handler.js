// js/app/dashboard-handler.js
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

export class DashboardHandler {
    constructor(appInstance) {
        this.app = appInstance;
    }

    setupDashboard() {
        this.app.ui.addSubmitListener('profile-update-form', (e) => this.handleProfileUpdate(e));
    }

    async handleProfileUpdate(event) {
        event.preventDefault();
        const formData = this.app.ui.getFormData('profile-update-form');
        if (!formData.name || formData.name.trim().length < 2) {
            this.showProfileMessage('Name must be at least 2 characters.', 'error');
            return;
        }

        // Show loading spinner
        this.showProfileLoading(true);
        this.hideProfileMessage();

        try {
            const updateUserProfile = httpsCallable(this.app.functions, 'updateUserProfile');
            await updateUserProfile({ updates: { name: formData.name.trim(), isAdvisor: !!formData.isAdvisor } });

            await this.app.authManager.loadUserData(this.app.currentUser.uid);
            this.app.ui.dashboardManager.updateDashboard(this.app.currentUserData);

            this.showProfileMessage('Profile updated successfully!', 'success');
        } catch (error) {
            // Extract error details from HttpsError format
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'Failed to update profile. Please try again.';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Profile update error:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            this.showProfileMessage(errorMessage, 'error');
        } finally {
            this.showProfileLoading(false);
        }
    }

    showProfileLoading(show) {
        const submitBtn = document.querySelector('#profile-update-form button[type="submit"]');
        if (!submitBtn) return;

        if (show) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <div class="flex items-center justify-center">
                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                </div>
            `;
        } else {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Update Profile';
        }
    }

    showProfileMessage(message, type) {
        let messageEl = document.getElementById('profile-update-message');
        if (!messageEl) {
            // Create message element if it doesn't exist
            messageEl = document.createElement('div');
            messageEl.id = 'profile-update-message';
            messageEl.className = 'mt-4 p-3 rounded-md text-sm';

            const form = document.getElementById('profile-update-form');
            if (form) {
                form.appendChild(messageEl);
            }
        }

        messageEl.textContent = message;
        messageEl.className = `mt-4 p-3 rounded-md text-sm ${
            type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
        }`;
        messageEl.style.display = 'block';

        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                this.hideProfileMessage();
            }, 5000);
        }
    }

    hideProfileMessage() {
        const messageEl = document.getElementById('profile-update-message');
        if (messageEl) {
            messageEl.style.display = 'none';
        }
    }

    async cancelSubscriptionHandler() {
        this.app.ui.showLoading('cancel-subscription', 'cancel-loader');
        try {
            const cancelSubscription = httpsCallable(this.app.functions, 'cancelSubscription');
            await cancelSubscription({ subscriptionId: this.app.currentUserData.authNetSubscriptionId });

            await this.app.authManager.loadUserData(this.app.currentUser.uid);
            this.app.ui.dashboardManager.updateDashboard(this.app.currentUserData);
            this.app.ui.updateNavigationForUser(this.app.currentUser, this.app.currentUserData, this.app.isAdmin);

            this.showDashboardMessage('Subscription cancelled successfully.', 'success');
        } catch (error) {
            // Extract error details from HttpsError format
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'Failed to cancel subscription. Please contact support.';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Cancellation error:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            this.showDashboardMessage(errorMessage, 'error');
        } finally {
            this.app.ui.hideLoading('cancel-subscription', 'cancel-loader');
        }
    }

    showDashboardMessage(message, type) {
        let messageEl = document.getElementById('dashboard-message');
        if (!messageEl) {
            // Create message element if it doesn't exist
            messageEl = document.createElement('div');
            messageEl.id = 'dashboard-message';
            messageEl.className = 'mb-6 p-4 rounded-md text-sm';

            // Insert at the top of the dashboard, after the header
            const dashboard = document.querySelector('.max-w-4xl.mx-auto');
            const firstCard = dashboard?.querySelector('.bg-white.rounded-xl.shadow-lg');
            if (dashboard && firstCard) {
                dashboard.insertBefore(messageEl, firstCard);
            }
        }

        messageEl.textContent = message;
        messageEl.className = `mb-6 p-4 rounded-md text-sm ${
            type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
        }`;
        messageEl.style.display = 'block';

        // Auto-hide messages after 5 seconds
        setTimeout(() => {
            this.hideDashboardMessage();
        }, 5000);
    }

    hideDashboardMessage() {
        const messageEl = document.getElementById('dashboard-message');
        if (messageEl) {
            messageEl.style.display = 'none';
        }
    }

    clearDashboardState() {
        // Clear any dashboard-specific UI elements
        const dashboardContent = document.getElementById('dashboard-content');
        if (dashboardContent) {
            dashboardContent.innerHTML = '';
        }

        // Hide any dashboard messages
        this.hideDashboardMessage();

        // Clear any cached dashboard data
        this.cachedUserData = null;
    }
}