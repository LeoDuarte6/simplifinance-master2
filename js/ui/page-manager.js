// js/ui/page-manager.js

export class PageManager {
    constructor() {
        this.currentPage = 'home-page';
        this.homePageUpdateTimeout = null;
        this.subscriptionInProgress = false;
        this.router = null;
    }

    setRouter(router) {
        this.router = router;
    }

    showPage(pageId) {
        this.cleanupAllOverlays();
        document.querySelectorAll('.page-section').forEach(section => {
            section.classList.add('hidden');
        });

        const page = document.getElementById(pageId);
        if (page) {
            page.classList.remove('hidden');
            this.currentPage = pageId;
        } else {
            document.getElementById('home-page').classList.remove('hidden');
            this.currentPage = 'home-page';
        }

        window.scrollTo(0, 0);
        this.updateNavigationState();
        this.updateHeroVisibility(pageId);

        if (window.simpliFinanceApp) {
            setTimeout(() => {
                window.simpliFinanceApp.updateGetInTouchVisibility(pageId);
            }, 150);
        }

        if (pageId === 'home-page' && window.simpliFinanceApp) {
            this.debouncedUpdateHomePageForAuth(
                window.simpliFinanceApp.currentUser,
                window.simpliFinanceApp.currentUserData
            );
        }
    }

    cleanupAllOverlays() {
        const elementsToCleanup = ['payment-overlay', 'image-preview-modal'];

        if (!this.subscriptionInProgress) {
            const inlineProgress = document.getElementById('subscription-progress-inline');
            if (inlineProgress) {
                inlineProgress.classList.add('hidden');
            }
        }

        elementsToCleanup.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.add('hidden');
                element.style.display = 'none';
            }
        });

        document.querySelectorAll('[id$="-loader"]').forEach(loader => loader.classList.add('hidden'));
        document.querySelectorAll('button[disabled]').forEach(button => {
            if (button.classList.contains('opacity-75')) {
                button.disabled = false;
                button.classList.remove('opacity-75');
            }
        });
    }

    updateNavigationState() {
        const navItems = ['nav-home', 'login-nav-item', 'library-nav-item', 'dashboard-nav-item', 'admin-nav-item'];
        navItems.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.remove('bg-teal-100', 'text-teal-700');
            }
        });
    }

    updateHeroVisibility(pageId) {
        const heroContainer = document.getElementById('hero-container');
        if (!heroContainer) return;
        const pagesWithoutHero = [
            'about-us-page', 'services-page', 'terms-conditions-page', 'library-page',
            'admin-page', 'user-dashboard-page', 'login-page', 'signup-billing-page'
        ];
        heroContainer.style.display = pagesWithoutHero.includes(pageId) ? 'none' : 'block';
        this.updateGetInTouchVisibility(pageId);
    }

    updateGetInTouchVisibility(pageId) {
        const getInTouchSection = document.getElementById('get-in-touch-section');
        if (getInTouchSection) {
            getInTouchSection.style.display = pageId === 'home-page' ? 'block' : 'none';
        }
    }

    updateNavigationForUser(user, userData, isAdmin) {
        const navElements = {
            login: document.getElementById('login-nav-item'),
            library: document.getElementById('library-nav-item'),
            dashboard: document.getElementById('dashboard-nav-item'),
            admin: document.getElementById('admin-nav-item'),
            scheduleDemo: document.getElementById('schedule-demo-nav-item'),
            loginMobile: document.getElementById('login-nav-item-mobile'),
            libraryMobile: document.getElementById('library-nav-item-mobile'),
            dashboardMobile: document.getElementById('dashboard-nav-item-mobile'),
            adminMobile: document.getElementById('admin-nav-item-mobile'),
            scheduleDemoMobile: document.getElementById('schedule-demo-nav-item-mobile')
        };

        if (user) {
            if (navElements.login) navElements.login.classList.add('hidden');
            if (navElements.library) navElements.library.classList.remove('hidden');
            if (navElements.dashboard) navElements.dashboard.classList.toggle('hidden', isAdmin);
            if (navElements.admin) navElements.admin.classList.toggle('hidden', !isAdmin);
            if (navElements.scheduleDemo) {
                const hasActiveSubscription = userData && userData.subscriptionStatus === 'active';
                const shouldHide = hasActiveSubscription || isAdmin;
                navElements.scheduleDemo.style.display = shouldHide ? 'none' : '';
                if(!shouldHide) navElements.scheduleDemo.classList.remove('hidden');
            }

            if (navElements.loginMobile) navElements.loginMobile.classList.add('hidden');
            if (navElements.libraryMobile) navElements.libraryMobile.classList.remove('hidden');
            if (navElements.dashboardMobile) navElements.dashboardMobile.classList.toggle('hidden', isAdmin);
            if (navElements.adminMobile) navElements.adminMobile.classList.toggle('hidden', !isAdmin);
            if (navElements.scheduleDemoMobile) {
                const hasActiveSubscription = userData && userData.subscriptionStatus === 'active';
                const shouldHide = hasActiveSubscription || isAdmin;
                navElements.scheduleDemoMobile.style.display = shouldHide ? 'none' : '';
                if(!shouldHide) navElements.scheduleDemoMobile.classList.remove('hidden');
            }

            if (this.currentPage === 'home-page') {
                this.debouncedUpdateHomePageForAuth(user, userData);
            }
            if (this.currentPage === 'login-page') {
                if (this.router) {
                    this.router.navigateTo('/');
                } else {
                    this.showPage('home-page');
                }
            } else if (this.currentPage === 'signup-billing-page') {
                if (!window.simpliFinanceApp.subscriptionInProgress) {
                    if (isAdmin) {
                        if (this.router) {
                            this.router.navigateTo('/admin');
                        } else {
                            this.showPage('admin-page');
                        }
                    } else {
                        if (this.router) {
                            this.router.navigateTo('/dashboard');
                        } else {
                            this.showPage('user-dashboard-page');
                        }
                        if (userData) {
                            setTimeout(() => {
                                window.simpliFinanceApp.ui.dashboardManager.updateDashboard(userData);
                            }, 500);
                        }
                    }
                }
            }
            if (isAdmin && this.currentPage === 'user-dashboard-page') {
                if (this.router) {
                    this.router.navigateTo('/admin');
                } else {
                    this.showPage('admin-page');
                }
            }
        } else {
            if (navElements.login) navElements.login.classList.remove('hidden');
            if (navElements.library) navElements.library.classList.add('hidden');
            if (navElements.dashboard) navElements.dashboard.classList.add('hidden');
            if (navElements.admin) navElements.admin.classList.add('hidden');
            if (navElements.scheduleDemo) {
                navElements.scheduleDemo.style.display = '';
                navElements.scheduleDemo.classList.remove('hidden');
            }

            if (navElements.loginMobile) navElements.loginMobile.classList.remove('hidden');
            if (navElements.libraryMobile) navElements.libraryMobile.classList.add('hidden');
            if (navElements.dashboardMobile) navElements.dashboardMobile.classList.add('hidden');
            if (navElements.adminMobile) navElements.adminMobile.classList.add('hidden');
            if (navElements.scheduleDemoMobile) {
                navElements.scheduleDemoMobile.style.display = '';
                navElements.scheduleDemoMobile.classList.remove('hidden');
            }

            if (this.currentPage === 'home-page') {
                this.debouncedUpdateHomePageForAuth(null, null);
            }
            if (['library-page', 'admin-page', 'user-dashboard-page'].includes(this.currentPage)) {
                if (this.router) {
                    this.router.navigateTo('/');
                } else {
                    this.showPage('home-page');
                }
            }
        }
    }

    debouncedUpdateHomePageForAuth(user, userData) {
        if (this.homePageUpdateTimeout) clearTimeout(this.homePageUpdateTimeout);
        this.homePageUpdateTimeout = setTimeout(() => {
            requestAnimationFrame(() => this.updateHomePageForAuth(user, userData, 0));
        }, 100);
    }

    updateHomePageForAuth(user, userData, retryCount = 0) {
        const heroLearnMore = document.getElementById('hero-cta-learn-more');
        const heroAuthenticated = document.getElementById('hero-cta-authenticated');
        const plansSection = document.getElementById('plans-section');

        if (!heroLearnMore || !heroAuthenticated || !plansSection) {
            if (retryCount < 5) {
                setTimeout(() => this.updateHomePageForAuth(user, userData, retryCount + 1), 200 * (retryCount + 1));
            }
            return;
        }

        const hasActiveSubscription = user && userData && userData.subscriptionStatus === 'active';
        [heroLearnMore, heroAuthenticated, plansSection].forEach(el => el.style.transition = 'none');
        heroLearnMore.offsetHeight;

        if (hasActiveSubscription) {
            heroLearnMore.style.display = 'none';
            heroAuthenticated.style.display = 'flex';
            plansSection.style.display = 'none';
        } else {
            heroLearnMore.style.display = 'inline-block';
            heroAuthenticated.style.display = 'none';
            plansSection.style.display = 'block';
            this.resetPlanButtons();
        }

        setTimeout(() => {
            [heroLearnMore, heroAuthenticated, plansSection].forEach(el => el.style.transition = '');
        }, 10);
    }

    resetPlanButtons() {
        document.querySelectorAll('.select-plan-btn').forEach(button => {
            button.disabled = false;
            button.onclick = null;
            if (button.dataset.planType === 'Monthly') {
                button.textContent = 'GET STARTED (Monthly)';
                button.className = 'select-plan-btn w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 px-6 rounded-md transition-colors duration-300 mt-auto';
            } else {
                button.textContent = 'CHOOSE ANNUAL';
                button.className = 'select-plan-btn w-full border border-teal-600 text-teal-600 hover:bg-teal-50 font-semibold py-2.5 px-6 rounded-md transition-colors duration-300 mt-2';
            }
        });
    }
}