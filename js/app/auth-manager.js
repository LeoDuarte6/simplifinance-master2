// js/app/auth-manager.js

import { APP_CONSTANTS } from '../config.js';
import {
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export class AuthManager {
    constructor(appInstance) {
        this.app = appInstance;
        this.isInitialAuthCheck = true;
    }

    async handleAuthStateChange(user) {
        try {
            const wasLoggedIn = !!this.app.currentUser;
            const isNowLoggedIn = !!user;
            this.app.currentUser = user;

            if (user) {
                await this.loadUserData(user.uid);
                this.app.isAdmin = (this.app.currentUserData?.isAdmin || APP_CONSTANTS.ADMIN_EMAIL === user.email);
            } else {
                this.app.currentUserData = null;
                this.app.isAdmin = false;

                // Only clear user data if this is an actual sign-out, not the initial auth check
                if (!this.isInitialAuthCheck) {
                    // Use the comprehensive state clearing method
                    this.clearAllApplicationState();
                }

                this.app.ui.pageManager.debouncedUpdateHomePageForAuth(null, null);
            }

            if (this.isInitialAuthCheck) {
                this.isInitialAuthCheck = false;
            }
            this.app.ui.updateNavigationForUser(user, this.app.currentUserData, this.app.isAdmin);

            // Handle page redirect based on auth state
            const currentPath = window.location.pathname;
            const router = this.app.router;

            // If logged out now but was previously logged in (user signed out)
            if (wasLoggedIn && !isNowLoggedIn && !this.isInitialAuthCheck) {
                // Already handled in signOut method with proper routing
            }
            // User is not logged in but trying to access protected routes
            else if (!isNowLoggedIn) {
                const currentRoute = router?.findRoute(currentPath);
                if (currentRoute && currentRoute.requiresAuth) {
                    // Redirect to login page
                    if (router) {
                        router.navigateTo('/login', true);
                    } else {
                        this.app.ui.showPage('login-page');
                    }
                }
            }

            // Always update home page for authenticated state, regardless of current page
            if (user) {
                this.app.ui.pageManager.debouncedUpdateHomePageForAuth(user, this.app.currentUserData);
            }

            // Post-auth navigation and data loading
            if (user && this.app.ui.currentPage === 'user-dashboard-page') {
                this.app.ui.dashboardManager.updateDashboard(this.app.currentUserData);
            } else if (user && this.app.ui.currentPage === 'library-page') {
                this.app.libraryHandler.loadLibraryContent();
            }

        } catch (error) {
            console.error("Auth state change error:", error);
        }
    }

    async loadUserData(uid) {
        try {
            const userDoc = await getDoc(doc(this.app.db, "users", uid));
            if (userDoc.exists()) {
                this.app.currentUserData = userDoc.data();
            } else {
                this.app.currentUserData = null;
            }
        } catch (error) {
            console.error("Error loading user data:", error);
            this.app.currentUserData = null;
        }
    }

    setupLoginForm() {
        this.app.ui.passwordManager.setupLoginPasswordToggle();
        this.app.ui.addSubmitListener('login-form', async (e) => {
            e.preventDefault();
            const formData = this.app.ui.getFormData('login-form');
            this.hideLoginMessage();
            if (!formData.email || !formData.password) {
                this.showLoginMessage("Email and password are required.", "error");
                return;
            }
            this.app.ui.showLoading('login-submit-btn', 'login-loader');
            try {
                // No longer needs import here
                await signInWithEmailAndPassword(this.app.auth, formData.email, formData.password);
            } catch (error) {
                this.showLoginMessage("Invalid email or password. Please try again.", "error");
                console.error("Login error:", error);
            } finally {
                this.app.ui.hideLoading('login-submit-btn', 'login-loader');
            }
        });
        this.setupForgotPassword();
    }

    async signOut() {
        try {
            // Clear all application state before signing out
            this.clearAllApplicationState();

            // Clear localStorage
            this.app.ui.clearLocalStorage();

            // Sign out from Firebase
            await signOut(this.app.auth);

            // Use router for navigation instead of direct page show
            if (this.app.router) {
                this.app.router.navigateTo('/', true);  // Navigate to home with history replacement
            } else {
                this.app.ui.showPage('home-page'); // Fallback to direct page navigation
            }
        } catch (error) {
            console.error('Sign out error:', error);
            console.error("Error signing out.");
        }
    }

    clearAllApplicationState() {
        // Clear main app state
        this.app.currentUser = null;
        this.app.currentUserData = null;
        this.app.selectedPlan = null;
        this.app.signupFormData = {};
        this.app.isAdmin = false;

        // Clear subscription state
        this.app.subscriptionInProgress = false;
        this.app.ui.subscriptionInProgress = false;

        // Clear subscription progress UI
        if (this.app.ui.subscriptionProgressManager) {
            this.app.ui.subscriptionProgressManager.hideSubscriptionProgress();
        }

        // Clear signup form state
        if (this.app.ui.signupFormManager) {
            this.app.ui.signupFormManager.signupStep = 1;
        }

        // Clear any form fields that might have cached data
        this.clearSignupFormFields();

        // Clear signup messages and reset polling
        if (this.app.signupHandler) {
            this.app.signupHandler.hideSignupMessage();
        }

        // Clear any UI state
        this.clearUIState();

        // Clear any admin state
        if (this.app.adminHandler) {
            this.app.adminHandler.clearAdminState();
        }

        // Clear library state
        if (this.app.libraryHandler) {
            this.app.libraryHandler.clearLibraryState();
        }

        // Clear dashboard state
        if (this.app.dashboardHandler) {
            this.app.dashboardHandler.clearDashboardState();
        }
    }

    clearUIState() {
        // Hide any open modals
        const modals = document.querySelectorAll('.modal, [id*="modal"]');
        modals.forEach(modal => {
            if (modal.style.display !== 'none') {
                modal.style.display = 'none';
                modal.classList.add('hidden');
            }
        });

        // Clear any loading states - be more specific to avoid affecting forms
        const loadingElements = document.querySelectorAll('[id$="loader"], [id$="loading"], .loading');
        loadingElements.forEach(el => {
            el.classList.add('hidden');
            el.style.display = 'none';
        });

        // Clear any error messages - be more specific to avoid affecting forms
        const errorMessages = document.querySelectorAll('.error-message, [id$="error-message"], [id$="login-message"], [id="signup-error-message"]');
        errorMessages.forEach(el => {
            el.classList.add('hidden');
            el.textContent = '';
            el.style.display = 'none';
        });

        // Reset any form button states
        const buttons = document.querySelectorAll('button[type="submit"]');
        buttons.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        });
    }

    setupForgotPassword() {
        this.app.ui.addClickListener('forgot-password-btn', async () => {
            const emailInput = document.getElementById('email-login');
            const email = emailInput?.value?.trim();
            this.hideLoginMessage();
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                this.showLoginMessage("Please enter a valid email address.", "error");
                return;
            }
            this.app.ui.showLoading('forgot-password-btn', 'forgot-password-loader-placeholder');
            try {
                // No longer needs import here
                await sendPasswordResetEmail(this.app.auth, email);
                this.showLoginMessage(`Password reset link sent to ${email}.`, "success");
            } catch (error) {
                this.showLoginMessage("Failed to send reset email. Please try again.", "error");
            } finally {
                 this.app.ui.hideLoading('forgot-password-btn', 'forgot-password-loader-placeholder');
            }
        });
    }

    showLoginMessage(message, type) {
        const messageEl = document.getElementById('login-message');
        if (!messageEl) return;
        messageEl.textContent = message;
        messageEl.className = `text-sm mt-4 text-center ${type === 'error' ? 'text-red-600' : 'text-green-600'}`;
        messageEl.classList.remove('hidden');
    }

    hideLoginMessage() {
        const messageEl = document.getElementById('login-message');
        if (messageEl) messageEl.classList.add('hidden');
    }

    clearSignupFormFields() {
        // Clear all signup form fields
        const formIds = ['step-1-form', 'step-2-form', 'step-3-form'];
        formIds.forEach(formId => {
            const form = document.getElementById(formId);
            if (form) {
                form.reset();
                // Clear any error states
                const errorElements = form.querySelectorAll('.error-message');
                errorElements.forEach(el => el.classList.add('hidden'));
                const errorBorders = form.querySelectorAll('.border-red-500');
                errorBorders.forEach(el => el.classList.remove('border-red-500'));
            }
        });
    }
}