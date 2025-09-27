// js/app/event-listeners.js

export class EventListeners {
    constructor(appInstance) {
        this.app = appInstance;
    }

    setup() {
        const ui = this.app.ui;
        // Navigation
        ui.addClickListener('nav-home-logo', () => this.handleNav('home-page'));
        ui.addClickListener('nav-home', () => this.handleNav('home-page'));
        ui.addClickListener('nav-about-us', () => this.handleNav('about-us-page'));
        ui.addClickListener('nav-services', () => this.handleNav('services-page'));
        ui.addClickListener('login-nav-item', () => this.handleNav('login-page'));
        ui.addClickListener('admin-nav-item', () => this.handleNav('admin-page'));

        // Mobile navigation
        ui.addClickListener('nav-home-mobile', () => this.handleNavMobile('home-page'));
        ui.addClickListener('nav-about-us-mobile', () => this.handleNavMobile('about-us-page'));
        ui.addClickListener('nav-services-mobile', () => this.handleNavMobile('services-page'));
        ui.addClickListener('login-nav-item-mobile', () => this.handleNavMobile('login-page'));
        ui.addClickListener('admin-nav-item-mobile', () => this.handleNavMobile('admin-page'));

        // Mobile menu toggle
        ui.addClickListener('mobile-menu-toggle', () => this.toggleMobileMenu());

        ui.addClickListener('library-nav-item', () => {
            if (this.app.currentUser) {
                this.handleNav('library-page');
                this.app.libraryHandler.loadLibraryContent();
            } else {
                this.handleNav('login-page');
            }
        });

        ui.addClickListener('library-nav-item-mobile', () => {
            if (this.app.currentUser) {
                this.handleNavMobile('library-page');
                this.app.libraryHandler.loadLibraryContent();
            } else {
                this.handleNavMobile('login-page');
            }
        });

        ui.addClickListener('dashboard-nav-item', () => {
            if (this.app.currentUser) {
                if (this.app.isAdmin) {
                    this.handleNav('admin-page');
                } else {
                    this.handleNav('user-dashboard-page');
                    if (this.app.currentUserData) {
                        setTimeout(() => ui.dashboardManager.updateDashboard(this.app.currentUserData), 200);
                    }
                }
            } else {
                this.handleNav('login-page');
            }
        });

        ui.addClickListener('dashboard-nav-item-mobile', () => {
            if (this.app.currentUser) {
                if (this.app.isAdmin) {
                    this.handleNavMobile('admin-page');
                } else {
                    this.handleNavMobile('user-dashboard-page');
                    if (this.app.currentUserData) {
                        setTimeout(() => ui.dashboardManager.updateDashboard(this.app.currentUserData), 200);
                    }
                }
            } else {
                this.handleNavMobile('login-page');
            }
        });

        // Links
        ui.addClickListener('login-signup-link', () => {
            this.handleNav('home-page');
            setTimeout(() => document.getElementById('plans-container')?.scrollIntoView({ behavior: 'smooth' }), 100);
        });

        // Initialize handlers
        this.app.planHandler.setupPlanSelection();
        this.app.signupHandler.setupMultiStepSignup();
        this.app.authManager.setupLoginForm();
        this.app.dashboardHandler.setupDashboard();
    }

    handleNav(pageId) {
        // Use router if available, otherwise fallback to direct page navigation
        if (this.app.router) {
            this.app.router.showPage(pageId);
        } else {
            this.app.ui.showPage(pageId);
            this.app.updateGetInTouchVisibility(pageId);
        }
    }

    handleNavMobile(pageId) {
        // Close mobile menu and navigate
        this.closeMobileMenu();
        this.handleNav(pageId);
    }

    toggleMobileMenu() {
        const mobileMenu = document.getElementById('mobile-menu');
        const menuOpenIcon = document.getElementById('menu-open-icon');
        const menuClosedIcon = document.getElementById('menu-closed-icon');
        const menuToggle = document.getElementById('mobile-menu-toggle');

        if (mobileMenu.classList.contains('hidden')) {
            // Open menu
            mobileMenu.classList.remove('hidden');
            menuOpenIcon.classList.remove('hidden');
            menuClosedIcon.classList.add('hidden');
            menuToggle.setAttribute('aria-expanded', 'true');
        } else {
            // Close menu
            this.closeMobileMenu();
        }
    }

    closeMobileMenu() {
        const mobileMenu = document.getElementById('mobile-menu');
        const menuOpenIcon = document.getElementById('menu-open-icon');
        const menuClosedIcon = document.getElementById('menu-closed-icon');
        const menuToggle = document.getElementById('mobile-menu-toggle');

        if (!mobileMenu.classList.contains('hidden')) {
            mobileMenu.classList.add('hidden');
            menuOpenIcon.classList.add('hidden');
            menuClosedIcon.classList.remove('hidden');
            menuToggle.setAttribute('aria-expanded', 'false');
        }
    }
}