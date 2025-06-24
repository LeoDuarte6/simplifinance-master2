// js/ui/signup-form-manager.js
import { AddressValidation } from './address-validation.js';

export class SignupFormManager {
    constructor() {
        this.signupStep = 1;
        this.addressValidation = new AddressValidation();
    }

    updateStepIndicator(step) {
        this.signupStep = step;
        const isLoggedIn = window.simpliFinanceApp && window.simpliFinanceApp.currentUser;

        for (let i = 1; i <= 3; i++) {
            const indicator = document.getElementById(`step-${i}-indicator`);
            if (!indicator) continue;

            const isActive = i === step;
            const isCompleted = i < step || (isLoggedIn && i <= 2 && step === 3);

            if (isCompleted) {
                indicator.className = 'w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-semibold';
                indicator.innerHTML = '✓';
            } else if (isActive) {
                indicator.className = 'w-8 h-8 bg-teal-600 text-white rounded-full flex items-center justify-center text-sm font-semibold';
                indicator.textContent = i;
            } else {
                indicator.className = 'w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm font-semibold';
                indicator.textContent = i;
            }
        }

        const progress12 = document.getElementById('progress-1-2');
        const progress23 = document.getElementById('progress-2-3');

        if (progress12) {
            progress12.className = (step > 1 || (isLoggedIn && step === 3)) ? 'h-1 bg-teal-600 rounded transition-all duration-300' : 'h-1 bg-gray-200 rounded transition-all duration-300';
        }
        if (progress23) {
            progress23.className = step > 2 ? 'h-1 bg-teal-600 rounded transition-all duration-300' : 'h-1 bg-gray-200 rounded transition-all duration-300';
        }
    }

    showSignupStep(step) {
        // Safety check: if trying to show step 3 without proper form data or user data, redirect to step 1
        if (step === 3) {
            const app = window.simpliFinanceApp;
            const hasValidUserData = app && app.currentUser && app.currentUserData;
            const hasValidFormData = app && app.signupFormData && 
                                   app.signupFormData.firstName && 
                                   app.signupFormData.email;
            
            if (!hasValidUserData && !hasValidFormData) {
                console.warn('Attempting to show step 3 without valid data, redirecting to step 1');
                step = 1;
            }
        }
        
        this.updateStepIndicator(step);
        document.querySelectorAll('.signup-step').forEach(stepEl => stepEl.classList.add('hidden'));
        const currentStep = document.getElementById(`signup-step-${step}`);
        if (currentStep) {
            currentStep.classList.remove('hidden');
            
            // If this is step 3, ensure the form is visible (fix any display: none from state clearing)
            if (step === 3) {
                const form = document.getElementById('step-3-form');
                if (form && form.style.display === 'none') {
                    form.style.display = '';
                }
            }
        }
    }

    setupSignupFormElements() {
        if (window.simpliFinanceApp.ui.passwordManager) {
            window.simpliFinanceApp.ui.passwordManager.setupPasswordToggle();
            window.simpliFinanceApp.ui.passwordManager.setupPasswordValidation();
        }
        if (window.simpliFinanceApp && window.simpliFinanceApp.selectedPlan) {
            this.updatePlanDisplay(window.simpliFinanceApp.selectedPlan);
        }
        // Address validation is handled automatically via constructor
    }

    updatePlanDisplay(planData) {
        const planDetailsEl = document.getElementById('plan-details-checkout');
        if (!planDetailsEl || !planData) return;
        planDetailsEl.innerHTML = `
            <h3 class="text-xl font-semibold text-gray-700">${planData.name} - ${planData.type}</h3>
            <p class="text-2xl font-bold text-gray-800">${planData.priceDisplay}</p>
            <p class="text-sm text-gray-600 mt-2">
                ${planData.type === 'Annual' ? 'Billed annually' : 'Billed monthly'} • Cancel anytime
            </p>`;
    }
}