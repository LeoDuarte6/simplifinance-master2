// js/ui.js
import { PageManager } from './ui/page-manager.js';
import { SignupFormManager } from './ui/signup-form-manager.js';
import { SubscriptionProgressManager } from './ui/subscription-progress-manager.js';
import { InputFormatter } from './ui/input-formatter.js';
import { PasswordManager } from './ui/password-manager.js';
import { DashboardManager } from './ui/dashboard-manager.js';
import { LibraryManager } from './ui/library-manager.js';
import { UIHelpers } from './ui/ui-helpers.js';
import { AdminManager } from './ui/admin-manager.js';

export class UIManager {
    constructor() {
        this.pageManager = new PageManager();
        this.signupFormManager = new SignupFormManager();
        this.subscriptionProgressManager = new SubscriptionProgressManager(this);
        this.inputFormatter = new InputFormatter();
        this.passwordManager = new PasswordManager();
        this.dashboardManager = new DashboardManager();
        this.libraryManager = new LibraryManager();
        this.adminManager = new AdminManager();

        // Expose helpers statically or on the instance
        this.helpers = UIHelpers;

        // Shared state
        this.subscriptionInProgress = false;
    }

    // Proxy methods to sub-managers for convenience
    showPage(pageId) { this.pageManager.showPage(pageId); }
    getFormData(formId) { return UIHelpers.getFormData(formId); }
    showLoading(btnId, loaderId) { UIHelpers.showLoading(btnId, loaderId); }
    hideLoading(btnId, loaderId) { UIHelpers.hideLoading(btnId, loaderId); }
    addClickListener(elId, handler) { UIHelpers.addClickListener(elId, handler); }
    addSubmitListener(formId, handler) { UIHelpers.addSubmitListener(formId, handler); }
    updateNavigationForUser(user, userData, isAdmin) { this.pageManager.updateNavigationForUser(user, userData, isAdmin); }
    clearLocalStorage() { UIHelpers.clearLocalStorage(); }

    get currentPage() {
        return this.pageManager.currentPage;
    }

    initializeInputFormatters() {
        this.inputFormatter.initializeInputFormatters();
        this.passwordManager.setupPasswordFeatures();
    }

    setupLoginPasswordToggle() {
        this.passwordManager.setupLoginPasswordToggle();
    }
}