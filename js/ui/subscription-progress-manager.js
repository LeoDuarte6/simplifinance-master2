// js/ui/subscription-progress-manager.js

export class SubscriptionProgressManager {
    constructor(uiManager) {
        this.uiManager = uiManager;
    }

    showSubscriptionProgress(message) {
        this.uiManager.subscriptionInProgress = true;
        const step3Form = document.getElementById('signup-step-3');
        const inlineProgress = document.getElementById('subscription-progress-inline');
        if (step3Form && inlineProgress) {
            const formElement = step3Form.querySelector('form');
            if (formElement) formElement.style.display = 'none';
            inlineProgress.classList.remove('hidden');
            this.updateSubscriptionProgress(message);
            inlineProgress.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    updateSubscriptionProgress(message) {
        const messageElement = document.getElementById('subscription-progress-message-inline');
        if (messageElement) messageElement.textContent = message;
        this.updateProgressSteps(message);
    }

    updateProgressSteps(message) {
        const steps = ['progress-step-1', 'progress-step-2', 'progress-step-3', 'progress-step-4'];
        const stepText = document.getElementById('progress-step-text');
        let activeStep = 0;
        let stepMessage = 'Validating payment information...';

        if (message.includes('payment') || message.includes('Processing')) {
            activeStep = 0;
            stepMessage = 'Validating payment information...';
        } else if (message.includes('subscription') || message.includes('Creating')) {
            activeStep = 1;
            stepMessage = 'Creating subscription...';
        } else if (message.includes('profile') || message.includes('Setting up')) {
            activeStep = 2;
            stepMessage = 'Setting up your account...';
        } else if (message.includes('complete') || message.includes('Finalizing')) {
            activeStep = 3;
            stepMessage = 'Finalizing subscription...';
        }

        steps.forEach((stepId, index) => {
            const stepElement = document.getElementById(stepId);
            if (stepElement) {
                stepElement.className = index <= activeStep ? 'w-2 h-2 bg-teal-500 rounded-full' : 'w-2 h-2 bg-gray-300 rounded-full';
            }
        });
        if (stepText) stepText.textContent = stepMessage;
    }

    showSubscriptionSuccess(message) {
        const inlineProgress = document.getElementById('subscription-progress-inline');
        if (inlineProgress) {
            inlineProgress.innerHTML = `
                <div class="text-center">
                    <div class="flex justify-center mb-4">
                        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                    </div>
                    <h3 class="text-lg font-semibold text-green-800 mb-2">Subscription Created Successfully!</h3>
                    <p class="text-green-700 text-sm mb-3">${message}</p>
                    <div class="text-xs text-green-600 mb-4">Redirecting you to your dashboard...</div>
                    <div class="mt-4">
                        <div class="flex justify-center space-x-2">
                            <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                            <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                            <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                            <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                        </div>
                        <div class="text-xs text-green-600 mt-2"><span>Subscription completed successfully!</span></div>
                    </div>
                </div>`;
            inlineProgress.className = 'mt-6 p-6 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200';
        }
    }

    hideSubscriptionProgress() {
        this.uiManager.subscriptionInProgress = false;
        const inlineProgress = document.getElementById('subscription-progress-inline');
        const step3Form = document.getElementById('signup-step-3');
        if (inlineProgress) {
            inlineProgress.classList.add('hidden');
            // Reset the content to original state
            inlineProgress.innerHTML = `
                <div class="text-center">
                    <div class="flex justify-center mb-4">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                    </div>
                    <h3 class="text-lg font-semibold text-teal-800 mb-2">Creating Your Subscription</h3>
                    <p id="subscription-progress-message-inline" class="text-teal-700 text-sm mb-3">Processing your subscription...</p>
                    <div class="text-xs text-teal-600">
                        This may take a few moments. Please don't close this page.
                    </div>

                    <!-- Progress Steps Indicator -->
                    <div class="mt-4">
                        <div class="flex justify-center space-x-2">
                            <div id="progress-step-1" class="w-2 h-2 bg-teal-500 rounded-full"></div>
                            <div id="progress-step-2" class="w-2 h-2 bg-gray-300 rounded-full"></div>
                            <div id="progress-step-3" class="w-2 h-2 bg-gray-300 rounded-full"></div>
                            <div id="progress-step-4" class="w-2 h-2 bg-gray-300 rounded-full"></div>
                        </div>
                        <div class="text-xs text-teal-600 mt-2">
                            <span id="progress-step-text">Validating payment information...</span>
                        </div>
                    </div>
                </div>`;
            inlineProgress.className = 'hidden mt-6 p-6 bg-gradient-to-r from-teal-50 to-teal-100 rounded-lg border border-teal-200';
        }
        if (step3Form) {
            const formElement = step3Form.querySelector('form');
            if (formElement) formElement.style.display = '';
        }
    }
}