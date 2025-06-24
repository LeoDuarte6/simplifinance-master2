// js/ui/dashboard-manager.js
import { UIHelpers } from './ui-helpers.js';
import { FormValidator } from '../validation.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

export class DashboardManager {
    constructor() {
        this.paymentUpdateListenersSetup = false;
    }

    updateDashboard(userData) {
        if (!userData) return;

        // Check if dashboard elements exist in DOM, if not, skip update
        if (!document.getElementById('dashboard-current-plan')) {
            return;
        }

        const isCancelled = userData.subscriptionStatus === 'cancelled';

        if (isCancelled) {
            this.updateForCancelled(userData);
        } else {
            this.updateForActive(userData);
        }

        this.updateSubscriptionManagementSection(isCancelled);
        this.updatePaymentSection(isCancelled);
        this.updateProfileForm(userData);
        this.setupLogoutButton();
    }

    updateForCancelled(userData) {
        UIHelpers.updateElementText('dashboard-current-plan', 'Cancelled');
        UIHelpers.updateElementText('dashboard-subscription-id', userData.authNetSubscriptionId || 'N/A');
        UIHelpers.updateElementText('dashboard-plan-status', 'Cancelled');
        const cancelledDate = userData.cancelledAt?.toDate ? userData.cancelledAt.toDate() : new Date(userData.cancelledAt);
        const formattedCancelledDate = cancelledDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        UIHelpers.updateElementText('dashboard-next-billing', `Cancelled on ${formattedCancelledDate}`);
        this.updateDashboardStyling(true);
    }

    updateForActive(userData) {
        console.log('🔍 DEBUG: User email being checked:', userData.email);
        console.log('🔍 DEBUG: Expected email: paul.williams@wrwcollc.com');
        console.log('🔍 DEBUG: Email match?', userData.email === 'paul.williams@wrwcollc.com');
        if (userData.email === 'paul.williams@wrwcollc.com') {
            console.log('🎯 PAUL DETECTED - Hardcoding billing date');
            UIHelpers.updateElementText('dashboard-current-plan', userData.plan || 'Premium Plan');
            UIHelpers.updateElementText('dashboard-subscription-id', userData.authNetSubscriptionId || 'N/A');
            UIHelpers.updateElementText('dashboard-plan-status', 'Active');
            
            // Hardcode the exact date string with a slight delay to overcome overrides
            setTimeout(() => {
                const billingEl = document.getElementById('dashboard-next-billing');
                if (billingEl) {
                    billingEl.textContent = 'June 20th, 2026'; // Direct string assignment
                    console.log('💥 PAUL BILLING SET TO: June 20th, 2026');
                    
                    // Hide the "Automatic renewal" text for Paul
                    const renewalText = document.querySelector('.text-blue-100.text-sm.mt-1');
                    if (renewalText) {
                        renewalText.style.display = 'none';
                        console.log('🕒 Automatic renewal text hidden for Paul');
                    }
                    
                    // Add CSS to increase spacing below billing date for Paul
                    const style = document.createElement('style');
                    style.innerHTML = `
                        #dashboard-next-billing {
                            margin-bottom: 1rem !important; /* Adds space below the date */
                        }
                    `;
                    document.head.appendChild(style);
                }
            }, 100); // 100ms delay to ensure it runs after other updates
            
            this.updateDashboardStyling(false);
            return; // EXIT EARLY FOR PAUL
        }
        
        // NORMAL LOGIC FOR EVERYONE ELSE
        UIHelpers.updateElementText('dashboard-current-plan', userData.plan || 'No Plan');
        UIHelpers.updateElementText('dashboard-subscription-id', userData.authNetSubscriptionId || 'N/A');
        UIHelpers.updateElementText('dashboard-plan-status', 'Active');
        
        if (userData.createdAt) {
            const createdDate = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
            const nextBilling = new Date(createdDate);
            nextBilling.setMonth(nextBilling.getMonth() + 1);
            const formattedNextBilling = nextBilling.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            UIHelpers.updateElementText('dashboard-next-billing', formattedNextBilling);
        }
        
        this.updateDashboardStyling(false);
    }

    updateDashboardStyling(isCancelled) {
        const planCard = document.querySelector('.bg-gradient-to-r.from-teal-500, .bg-gradient-to-r.from-red-500');
        const billingCard = document.querySelector('.bg-gradient-to-r.from-blue-500, .bg-gradient-to-r.from-gray-500');
        if(planCard) planCard.className = isCancelled ? 'bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-lg' : 'bg-gradient-to-r from-teal-500 to-teal-600 text-white p-6 rounded-lg';
        if(billingCard) billingCard.className = isCancelled ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white p-6 rounded-lg' : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg';
    }

    updateSubscriptionManagementSection(isCancelled) {
        const cancelButton = document.getElementById('cancel-subscription');
        if (!cancelButton) return;

        if (isCancelled) {
            // Hide the cancel subscription button and show cancelled message
            cancelButton.style.display = 'none';
            // Find the subscription actions container and add cancelled message
            const actionsContainer = cancelButton.parentElement;
            if (actionsContainer) {
                const existingMessage = actionsContainer.querySelector('.cancelled-message');
                if (!existingMessage) {
                    const cancelledDiv = document.createElement('div');
                    cancelledDiv.className = 'cancelled-message w-full p-4 bg-gray-100 rounded-md text-center';
                    cancelledDiv.innerHTML = `
                        <p class="text-sm text-gray-600 mb-2">Your subscription has been cancelled.</p>
                        <p class="text-xs text-gray-500">To resubscribe, please visit the home page and select a plan.</p>
                    `;
                    actionsContainer.insertBefore(cancelledDiv, cancelButton);
                }
            }
        } else {
            // Show the cancel subscription button and remove cancelled message
            cancelButton.style.display = 'flex';
            const actionsContainer = cancelButton.parentElement;
            if (actionsContainer) {
                const existingMessage = actionsContainer.querySelector('.cancelled-message');
                if (existingMessage) {
                    existingMessage.remove();
                }
            }
            // Set up the click listener if not already set
            if (!cancelButton.dataset.listenerAttached) {
                cancelButton.addEventListener('click', () => {
                    if (confirm('Are you sure you want to cancel your subscription? This action cannot be undone.')) {
                        window.simpliFinanceApp.dashboardHandler.cancelSubscriptionHandler();
                    }
                });
                cancelButton.dataset.listenerAttached = 'true';
            }
        }
    }

    updatePaymentSection(isCancelled) {
        // Use the current payment display and update payment button sections
        const currentPaymentDisplay = document.getElementById('current-payment-display');
        const updatePaymentBtn = document.getElementById('update-payment-btn');

        if (currentPaymentDisplay) {
            currentPaymentDisplay.style.display = isCancelled ? 'none' : 'block';
        }
        if (updatePaymentBtn) {
            updatePaymentBtn.style.display = isCancelled ? 'none' : 'block';
        }

        if (!isCancelled) {
            this.setupPaymentUpdateListeners();
        }
    }

    updateProfileForm(userData) {
        UIHelpers.updateElementValue('profile-name', userData.name || '');
        UIHelpers.updateElementValue('profile-email', userData.email || '');
        const advisorCheckbox = document.getElementById('profile-is-advisor');
        if (advisorCheckbox) advisorCheckbox.checked = userData.isAdvisor || false;
    }

    setupLogoutButton() {
        const logoutButton = document.getElementById('dashboard-logout-button');
        if (logoutButton && !logoutButton.dataset.listenerAttached) {
            logoutButton.addEventListener('click', () => window.simpliFinanceApp?.authManager.signOut());
            logoutButton.dataset.listenerAttached = 'true';
        }
    }

    setupPaymentUpdateListeners() {
        if (this.paymentUpdateListenersSetup) return;
        this.paymentUpdateListenersSetup = true;

        const updatePaymentBtn = document.getElementById('update-payment-btn');
        const cancelPaymentBtn = document.getElementById('cancel-payment-update');
        const updatePaymentForm = document.getElementById('update-payment-form');

        if (updatePaymentBtn && !updatePaymentBtn.dataset.listenerAttached) {
            updatePaymentBtn.addEventListener('click', () => this.showPaymentUpdateForm());
            updatePaymentBtn.dataset.listenerAttached = 'true';
        }

        if (cancelPaymentBtn && !cancelPaymentBtn.dataset.listenerAttached) {
            cancelPaymentBtn.addEventListener('click', () => this.hidePaymentUpdateForm());
            cancelPaymentBtn.dataset.listenerAttached = 'true';
        }

        if (updatePaymentForm && !updatePaymentForm.dataset.listenerAttached) {
            updatePaymentForm.addEventListener('submit', (e) => {
                this.handlePaymentUpdateSubmission(e);
            });
            updatePaymentForm.dataset.listenerAttached = 'true';
        }
    }

    showPaymentUpdateForm() {
        document.getElementById('update-payment-btn').style.display = 'none';
        document.getElementById('current-payment-display').style.display = 'none';
        document.getElementById('update-payment-form').classList.remove('hidden');

        // Populate billing address with current user data
        this.populateBillingAddress();

        window.simpliFinanceApp.ui.inputFormatter.initializeInputFormatters();
        UIHelpers.setFocus('update-card-number');
    }

    populateBillingAddress() {
        const userData = window.simpliFinanceApp.currentUserData;
        if (userData && userData.billingAddress) {
            const billingAddress = userData.billingAddress;

            UIHelpers.updateElementValue('update-address-1', billingAddress.addressLine1 || '');
            UIHelpers.updateElementValue('update-address-2', billingAddress.addressLine2 || '');
            UIHelpers.updateElementValue('update-city', billingAddress.city || '');
            UIHelpers.updateElementValue('update-state', billingAddress.state || '');
            UIHelpers.updateElementValue('update-zip', billingAddress.zipCode || '');
            UIHelpers.updateElementValue('update-phone', billingAddress.phoneNumber || '');

            // Country is always "United States" (readonly field)
        } else {
            // Country is always "United States" (readonly field)
        }
    }

    hidePaymentUpdateForm() {
        document.getElementById('update-payment-btn').style.display = 'block';
        document.getElementById('current-payment-display').style.display = 'block';
        const form = document.getElementById('update-payment-form');
        form.classList.add('hidden');
        form.reset();
    }

    async handlePaymentUpdateSubmission(event) {
        event.preventDefault();
        const formData = UIHelpers.getFormData('update-payment-form');
        const paymentValidation = FormValidator.validateStep3({
            cardNumber: formData.cardNumber,
            expiry: formData.expiry,
            cvv: formData.cvv
        });

        // Validate billing address (step 2)
        const billingValidation = FormValidator.validateStep2({
            addressLine1: formData.addressLine1,
            city: formData.city,
            state: formData.state,
            zipCode: formData.zipCode,
            country: formData.country
        });

        // Combine validation results
        const validation = {
            valid: paymentValidation.valid && billingValidation.valid,
            errors: [...paymentValidation.errors, ...billingValidation.errors]
        };

        FormValidator.clearAllErrors([
            'update-card-number', 'update-expiry', 'update-cvv',
            'update-address-1', 'update-city', 'update-state', 'update-zip', 'update-country'
        ]);

        if (!validation.valid) {
            const mappedErrors = validation.errors.map(err => {
                let fieldName = err.field.toLowerCase();
                if (fieldName === 'cardnumber') fieldName = 'update-card-number';
                else if (fieldName === 'expiry') fieldName = 'update-expiry';
                else if (fieldName === 'cvv') fieldName = 'update-cvv';
                else if (fieldName === 'addressline1') fieldName = 'update-address-1';
                else if (fieldName === 'city') fieldName = 'update-city';
                else if (fieldName === 'state') fieldName = 'update-state';
                else if (fieldName === 'zipcode') fieldName = 'update-zip';
                else if (fieldName === 'country') fieldName = 'update-country';
                else fieldName = `update-${fieldName}`;

                return { ...err, field: fieldName };
            });
            FormValidator.displayValidationErrors(mappedErrors);
            return;
        }
        UIHelpers.showLoading('update-payment-submit-btn', 'update-payment-loader');
        this.hidePaymentMessage();

        try {
            const updatePaymentProfile = httpsCallable(window.simpliFinanceApp.functions, 'updatePaymentProfile');
            const paymentData = {
                paymentDetails: {
                    cardNumber: formData.cardNumber.replace(/\s/g, ''),
                    expiryDate: formData.expiry,
                    cardCode: formData.cvv
                },
                billingAddress: {
                    addressLine1: formData.addressLine1,
                    addressLine2: formData.addressLine2 || '',
                    city: formData.city,
                    state: formData.state,
                    zipCode: formData.zipCode,
                    country: 'US',
                    phoneNumber: formData.phoneNumber || ''
                }
            };
            const result = await updatePaymentProfile(paymentData);
            if (result.data.status === 'success') {
                this.showPaymentMessage('Payment method updated successfully!', 'success');
                setTimeout(() => {
                    this.hidePaymentUpdateForm();
                    this.hidePaymentMessage();
                }, 2000);
            } else {
                this.showPaymentMessage(result.data.message || 'Failed to update payment method', 'error');
            }
        } catch (error) {
            // Extract error details from HttpsError format
            const errorCode = error.code || 'unknown';
            const errorMessage = error.message || 'Failed to update payment method.';
            const errorDetails = error.details || {};

            // Log detailed error information for debugging
            console.error('Payment update error:', {
                code: errorCode,
                message: errorMessage,
                details: errorDetails,
                fullError: error
            });

            this.showPaymentMessage(errorMessage, 'error');
        } finally {
            UIHelpers.hideLoading('update-payment-submit-btn', 'update-payment-loader');
        }
    }

    showPaymentMessage(message, type) {
        let messageEl = document.getElementById('payment-update-message');
        if (!messageEl) {
            // Create message element if it doesn't exist
            messageEl = document.createElement('div');
            messageEl.id = 'payment-update-message';
            messageEl.className = 'mt-4 p-3 rounded-md text-sm';

            const form = document.getElementById('update-payment-form');
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
    }

    hidePaymentMessage() {
        const messageEl = document.getElementById('payment-update-message');
        if (messageEl) {
            messageEl.style.display = 'none';
        }
    }
}