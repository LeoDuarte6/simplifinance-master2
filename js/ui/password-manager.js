// js/ui/password-manager.js

export class PasswordManager {
    setupPasswordFeatures() {
        this.setupPasswordToggle();
        this.setupLoginPasswordToggle();
        this.setupPasswordValidation();
    }

    setupLoginPasswordToggle() {
        const passwordInput = document.getElementById('password-login');
        const toggleButton = document.getElementById('login-password-toggle');
        if (!passwordInput || !toggleButton) {
             setTimeout(() => this.setupLoginPasswordToggle(), 500);
             return;
        }
        if (toggleButton.dataset.toggleInitialized) return;
        this._attachToggleHandler(passwordInput, toggleButton, 'login-password-hide-icon', 'login-password-show-icon');
        toggleButton.dataset.toggleInitialized = 'true';
    }

    setupPasswordToggle() {
        const passwordInput = document.getElementById('password-signup');
        const toggleButton = document.getElementById('password-toggle');
        if (!passwordInput || !toggleButton) return;
        if (toggleButton.dataset.toggleInitialized) return;
        this._attachToggleHandler(passwordInput, toggleButton, 'password-hide-icon', 'password-show-icon');
        toggleButton.dataset.toggleInitialized = 'true';
    }

    _attachToggleHandler(passwordInput, toggleButton, hideIconId, showIconId) {
        const hideIcon = document.getElementById(hideIconId);
        const showIcon = document.getElementById(showIconId);

        toggleButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            if (hideIcon) hideIcon.classList.toggle('hidden', isPassword);
            if (showIcon) showIcon.classList.toggle('hidden', !isPassword);
        });
    }

    setupPasswordValidation() {
        const passwordInput = document.getElementById('password-signup');
        if (!passwordInput) {
            setTimeout(() => this.setupPasswordValidation(), 300);
            return;
        }
        if (passwordInput.dataset.validationInitialized) return;
        passwordInput.addEventListener('input', (e) => {
            this.validatePasswordRequirements(e.target.value);
        });
        passwordInput.dataset.validationInitialized = 'true';
        this.validatePasswordRequirements('');
    }

    validatePasswordRequirements(password) {
        this.updateRequirementIndicator(document.getElementById('length-check'), password.length >= 8);
        this.updateRequirementIndicator(document.getElementById('number-check'), /\d/.test(password));
        this.updateRequirementIndicator(document.getElementById('letter-check'), /[a-zA-Z]/.test(password));
    }

    updateRequirementIndicator(element, isValid) {
        if (!element) return;
        const icon = element.querySelector('span');
        if (!icon) return;
        if (isValid) {
            element.className = 'mr-2 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center';
            icon.textContent = '✓';
            icon.className = 'text-white text-xs font-bold';
        } else {
            element.className = 'mr-2 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center';
            icon.textContent = '✗';
            icon.className = 'text-white text-xs font-bold';
        }
    }
}