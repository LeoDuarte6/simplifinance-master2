// js/app/plan-handler.js

export class PlanHandler {
    constructor(appInstance) {
        this.app = appInstance;
    }

    setupPlanSelection() {
        document.addEventListener('click', (e) => {
            if (!e.target.classList.contains('select-plan-btn')) return;

            if (this.app.currentUser && this.app.currentUserData?.subscriptionStatus === 'active') {
                return;
            }

            const button = e.target;
            this.app.selectedPlan = {
                name: button.dataset.planName,
                type: button.dataset.planType,
                price: button.dataset.planPrice,
                priceDisplay: button.dataset.planPriceDisplay
            };

            this.navigateToSignup();
        });
    }

    navigateToSignup() {
        // More robust check for authenticated user with valid subscription data
        const isLoggedInUser = this.app.currentUser && 
                              this.app.currentUserData && 
                              this.app.currentUserData.subscriptionStatus !== 'active';
        
        if (isLoggedInUser) {
            // Logged-in user with valid data, skip to payment - navigate first, then set step
            if (this.app.router) {
                this.app.router.navigateTo('/signup');
            } else {
                this.app.ui.showPage('signup-billing-page');
            }
            // Set step after navigation with a small delay to ensure page is loaded
            setTimeout(() => {
                this.app.ui.signupFormManager.showSignupStep(3);
            }, 300);
        } else {
            // New user or logged out user, start from step 1
            this.app.signupFormData = {};
            if (this.app.router) {
                this.app.router.navigateTo('/signup');
            } else {
                this.app.ui.showPage('signup-billing-page');
            }
            // Set step after navigation with a small delay to ensure page is loaded
            setTimeout(() => {
                this.app.ui.signupFormManager.showSignupStep(1);
            }, 100);
        }
    }
}