// js/app/signup-handler.js
import { FormValidator } from '../validation.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

export class SignupHandler {
    constructor(appInstance) {
        this.app = appInstance;
        this.formSubmitHandler = (e) => this.handleFinalSubmission(e);
    }

    setupMultiStepSignup() {
        // Only prevent duplicate document-level click listeners
        if (!this.clickListenerSetup) {
            document.addEventListener('click', (e) => {
                if (e.target.id === 'step-1-next') this.handleStep1Next();
                if (e.target.id === 'step-2-back') this.app.ui.signupFormManager.showSignupStep(1);
                if (e.target.id === 'step-2-next') this.handleStep2Next();
                if (e.target.id === 'step-3-back') this.app.ui.signupFormManager.showSignupStep(this.app.currentUser ? 1 : 2);
            });
            this.clickListenerSetup = true;
        }
        this.app.ui.addSubmitListener('step-3-form', this.formSubmitHandler);
    }

    removeFormListener() {
        const form = document.getElementById('step-3-form');
        if (form && this.formSubmitHandler) {
            form.removeEventListener('submit', this.formSubmitHandler);
        }
    }

    handleStep1Next() {
        const formData = this.app.ui.getFormData('step-1-form');
        const validation = FormValidator.validateStep1(formData);
        FormValidator.clearAllErrors(['first-name', 'last-name', 'email-signup', 'password-signup', 'agree-to-terms']);
        if (!validation.valid) {
            FormValidator.displayValidationErrors(validation.errors);
            return;
        }
        this.app.signupFormData = { ...this.app.signupFormData, ...formData };
        this.app.ui.signupFormManager.showSignupStep(2);
    }

    handleStep2Next() {
        const formData = this.app.ui.getFormData('step-2-form');
        const validation = FormValidator.validateStep2(formData);
        FormValidator.clearAllErrors(['billing-address-1', 'billing-city', 'billing-state', 'billing-zip']);
        if (!validation.valid) {
            FormValidator.displayValidationErrors(validation.errors);
            return;
        }
        this.app.signupFormData.billingAddress = { ...formData };
        this.app.ui.signupFormManager.showSignupStep(3);
    }

    async handleFinalSubmission(event) {
        event.preventDefault();
        if (!this.app.selectedPlan) {
            this.showSignupMessage("Please select a plan first.", "error");
            return;
        }

        // Set flag to prevent auth state change from redirecting during subscription creation
        this.app.subscriptionInProgress = true;
        const formData = this.app.ui.getFormData('step-3-form');
        const validation = FormValidator.validateStep3(formData);
        FormValidator.clearAllErrors(['cardNumber', 'expiry', 'cvv']);
        if (!validation.valid) {
            FormValidator.displayValidationErrors(validation.errors);
            return;
        }

        this.app.ui.showLoading('signup-billing-submit-btn', 'signup-billing-loader');
        this.app.ui.subscriptionProgressManager.showSubscriptionProgress('Initializing...');

        try {
            let user = this.app.currentUser;
            if (!user) {
                this.app.ui.subscriptionProgressManager.updateSubscriptionProgress('Creating account...');
                const cred = await createUserWithEmailAndPassword(this.app.auth, this.app.signupFormData.email, this.app.signupFormData.password);
                user = cred.user;
            }

            this.app.ui.subscriptionProgressManager.updateSubscriptionProgress('Processing payment...');
            const createSubscription = httpsCallable(this.app.functions, 'createSubscription');

            // For existing users (resubscribing), use their existing profile data
            const isExistingUser = this.app.currentUser && this.app.currentUserData;
            const userName = isExistingUser && this.app.currentUserData.name
                ? this.app.currentUserData.name
                : `${this.app.signupFormData.firstName} ${this.app.signupFormData.lastName}`;
            const userIsAdvisor = isExistingUser
                ? this.app.currentUserData.isAdvisor
                : !!this.app.signupFormData.isAdvisor;
            const userBillingAddress = isExistingUser && this.app.currentUserData.billingAddress
                ? this.app.currentUserData.billingAddress
                : this.app.signupFormData.billingAddress;

            const result = await createSubscription({
                planName: this.app.selectedPlan.name,
                planPrice: this.app.selectedPlan.price,
                paymentDetails: {
                    cardNumber: formData.cardNumber.replace(/\s/g, ''),
                    expiryDate: formData.expiry,
                    cardCode: formData.cvv,
                },
                name: userName,
                isAdvisor: userIsAdvisor,
                billingAddress: userBillingAddress
            });

            if (result.data.status === 'success') {
                await this.app.authManager.loadUserData(user.uid);

                this.app.ui.subscriptionProgressManager.showSubscriptionSuccess(
                    `Payment processed successfully! Transaction ID: ${result.data.transactionId}`
                );

                // Remove the form listener to prevent duplicates on future signups
                this.removeFormListener();

                setTimeout(async () => {
                    this.app.subscriptionInProgress = false;
                    await this.app.authManager.loadUserData(user.uid);

                    if (this.app.router) {
                        this.app.router.navigateTo('/dashboard');
                    } else {
                        this.app.ui.showPage('user-dashboard-page');
                        setTimeout(() => {
                            this.app.ui.dashboardManager.updateDashboard(this.app.currentUserData);
                        }, 500);
                    }
                }, 3000);
            } else {
                this.app.subscriptionInProgress = false;
                this.app.ui.subscriptionProgressManager.hideSubscriptionProgress();
                this.showSignupMessage(result.data.message || "An error occurred.", "error");
            }
        } catch (error) {
            this.app.subscriptionInProgress = false;
            this.app.ui.subscriptionProgressManager.hideSubscriptionProgress();

            // Extract error details from HttpsError format
            const errorCode = error.code || 'unknown';
            let errorMessage = error.message || 'Subscription failed.';
            const errorDetails = error.details || {};

            // Ensure error message is a clean string (safety measure)
            if (typeof errorMessage !== 'string') {
                errorMessage = 'An error occurred during subscription. Please try again.';
            }

            // Log detailed error information for debugging
            console.error("Subscription error:", {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            // Show user-friendly error message
            this.showSignupMessage(errorMessage, "error");
        } finally {
            this.app.ui.hideLoading('signup-billing-submit-btn', 'signup-billing-loader');
        }
    }

    showSignupMessage(message, type) {
        let messageEl = document.getElementById('signup-error-message');
        if (!messageEl) {
            // Create message element if it doesn't exist
            messageEl = document.createElement('div');
            messageEl.id = 'signup-error-message';
            messageEl.className = 'mt-4 p-3 rounded-md text-sm';

            const form = document.getElementById('step-3-form');
            if (form) {
                // Insert before the submit button
                const submitBtn = form.querySelector('button[type="submit"]').parentElement;
                form.insertBefore(messageEl, submitBtn);
            }
        }

        messageEl.textContent = message;
        messageEl.className = `mt-4 p-3 rounded-md text-sm ${
            type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
        }`;
        messageEl.style.display = 'block';
    }

    hideSignupMessage() {
        const messageEl = document.getElementById('signup-error-message');
        if (messageEl) {
            messageEl.style.display = 'none';
        }
    }


}