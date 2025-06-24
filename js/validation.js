// Client-side Form Validation Utilities
export class FormValidator {
    static validateEmail(email) {
        return validator.isEmail(email);
    }

    static validatePassword(password) {
        const minLength = password.length >= 8;
        const hasNumber = /\d/.test(password);
        const hasLetter = /[a-zA-Z]/.test(password);
        return {
            valid: minLength && hasNumber && hasLetter,
            errors: [
                !minLength ? 'Password must be at least 8 characters' : null,
                !hasNumber ? 'Password must contain at least one number' : null,
                !hasLetter ? 'Password must contain at least one letter' : null
            ].filter(Boolean)
        };
    }

    static validateCardNumber(cardNumber) {
        const clean = cardNumber.replace(/\s/g, '');
        return validator.isCreditCard(clean);
    }

    static validateExpiry(expiry) {
        const match = expiry.match(/^(\d{2})\/(\d{2})$/);
        if (!match) return false;

        const month = parseInt(match[1]);
        const year = parseInt('20' + match[2]);
        const now = new Date();
        const expDate = new Date(year, month - 1);

        return month >= 1 && month <= 12 && expDate > now;
    }

    static validateCVV(cvv) {
        return /^\d{3,4}$/.test(cvv);
    }

    static validateZip(zip) {
        return /^\d{5}(-\d{4})?$/.test(zip) || /^[A-Z]\d[A-Z] \d[A-Z]\d$/.test(zip);
    }

    static validatePhone(phone) {
        // Basic phone validation - can be enhanced based on requirements
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.length >= 10;
    }

    static showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        // For checkboxes, look for error message in the parent container
        let errorDiv = field.parentNode.querySelector('.error-message');
        if (!errorDiv && field.type === 'checkbox') {
            errorDiv = field.closest('div').querySelector('.error-message');
        }

        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
        }

        // Don't add border styling to checkboxes, but do for other fields
        if (field.type !== 'checkbox') {
            field.classList.add('border-red-500');
            field.focus();
        }
    }

    static clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        // For checkboxes, look for error message in the parent container
        let errorDiv = field.parentNode.querySelector('.error-message');
        if (!errorDiv && field.type === 'checkbox') {
            errorDiv = field.closest('div').querySelector('.error-message');
        }

        if (errorDiv) {
            errorDiv.classList.add('hidden');
        }

        // Only remove border styling from non-checkbox fields
        if (field.type !== 'checkbox') {
            field.classList.remove('border-red-500');
        }
    }

    static clearAllErrors(fieldIds) {
        fieldIds.forEach(id => this.clearFieldError(id));
    }

    static validateStep1(formData) {
        const errors = [];
        const { firstName, lastName, email, password, agreeToTerms } = formData;

        if (!firstName || firstName.trim().length < 2) {
            errors.push({ field: 'first-name', message: 'First name must be at least 2 characters' });
        }

        if (!lastName || lastName.trim().length < 2) {
            errors.push({ field: 'last-name', message: 'Last name must be at least 2 characters' });
        }

        if (!email) {
            errors.push({ field: 'email-signup', message: 'Email is required' });
        } else if (!this.validateEmail(email)) {
            errors.push({ field: 'email-signup', message: 'Please enter a valid email address' });
        }

        const passwordValidation = this.validatePassword(password);
        if (!passwordValidation.valid) {
            errors.push({ field: 'password-signup', message: passwordValidation.errors.join(', ') });
        }

        if (!agreeToTerms) {
            errors.push({ field: 'agree-to-terms', message: 'You must agree to the Terms and Conditions to continue' });
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static validateStep2(formData) {
        const errors = [];
        const { addressLine1, city, state, zipCode, country } = formData;

        // Address line validation
        if (!addressLine1 || addressLine1.trim().length < 5) {
            errors.push({ field: 'billing-address-1', message: 'Address must be at least 5 characters' });
        }

        // City validation with character restrictions
        if (!city || city.trim().length < 2) {
            errors.push({ field: 'billing-city', message: 'City is required' });
        } else if (!/^[a-zA-Z\s\-']+$/.test(city)) {
            errors.push({ field: 'billing-city', message: 'City contains invalid characters' });
        }

        // State validation (now required to be a valid state code)
        if (!state) {
            errors.push({ field: 'billing-state', message: 'State is required' });
        }

        // ZIP code validation (US format only)
        if (!zipCode) {
            errors.push({ field: 'billing-zip', message: 'ZIP code is required' });
        } else if (!/^\d{5}$/.test(zipCode)) {
            errors.push({ field: 'billing-zip', message: 'ZIP code must be 5 digits' });
        }

        // Country validation (must be US)
        if (!country || country !== 'US') {
            errors.push({ field: 'billing-country', message: 'Only US addresses are supported' });
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static validateStep3(formData) {
        const errors = [];
        const { cardNumber, expiry, cvv } = formData;

        if (!cardNumber) {
            errors.push({ field: 'cardNumber', message: 'Card number is required' });
        } else if (!this.validateCardNumber(cardNumber)) {
            errors.push({ field: 'cardNumber', message: 'Please enter a valid card number' });
        }

        if (!expiry) {
            errors.push({ field: 'expiry', message: 'Expiry date is required' });
        } else if (!this.validateExpiry(expiry)) {
            errors.push({ field: 'expiry', message: 'Please enter a valid expiry date' });
        }

        if (!cvv) {
            errors.push({ field: 'cvv', message: 'CVV is required' });
        } else if (!this.validateCVV(cvv)) {
            errors.push({ field: 'cvv', message: 'Please enter a valid CVV' });
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static displayValidationErrors(errors) {
        // Clear all previous errors
        errors.forEach(error => this.clearFieldError(error.field));

        // Show new errors
        errors.forEach(error => {
            this.showFieldError(error.field, error.message);
        });
    }

    static setupRealTimeValidation(fieldId, validator) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        field.addEventListener('blur', () => {
            const isValid = validator(field.value);
            if (isValid) {
                this.clearFieldError(fieldId);
            }
        });

        field.addEventListener('input', () => {
            if (field.classList.contains('border-red-500')) {
                this.clearFieldError(fieldId);
            }
        });
    }

    static initializeValidationListeners() {
        // Email validation
        this.setupRealTimeValidation('email-signup', this.validateEmail);

        // Password validation
        this.setupRealTimeValidation('password-signup', (password) => {
            return this.validatePassword(password).valid;
        });

        // Card number validation
        this.setupRealTimeValidation('cardNumber', this.validateCardNumber);

        // Expiry validation
        this.setupRealTimeValidation('expiry', this.validateExpiry);

        // CVV validation
        this.setupRealTimeValidation('cvv', this.validateCVV);

        // ZIP validation
        this.setupRealTimeValidation('billing-zip', this.validateZip);

        // Dashboard payment update validation
        this.setupRealTimeValidation('update-card-number', this.validateCardNumber);
        this.setupRealTimeValidation('update-expiry', this.validateExpiry);
        this.setupRealTimeValidation('update-cvv', this.validateCVV);
    }
}