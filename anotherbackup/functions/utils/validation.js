const { logger } = require("firebase-functions");

class ValidationUtils {
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    static validateCardNumber(cardNumber) {
        // Remove spaces and check if it's a valid credit card number
        const cleaned = cardNumber.replace(/\s/g, '');

        // Basic length check (13-19 digits for most cards)
        if (!/^\d{13,19}$/.test(cleaned)) {
            return false;
        }

        // Luhn algorithm validation
        let sum = 0;
        let alternate = false;

        for (let i = cleaned.length - 1; i >= 0; i--) {
            let n = parseInt(cleaned.charAt(i), 10);

            if (alternate) {
                n *= 2;
                if (n > 9) {
                    n = (n % 10) + 1;
                }
            }

            sum += n;
            alternate = !alternate;
        }

        return (sum % 10) === 0;
    }

    static validateExpiryDate(expiryDate) {
        const match = expiryDate.match(/^(\d{2})\/(\d{2})$/);
        if (!match) return false;

        const month = parseInt(match[1], 10);
        const year = parseInt('20' + match[2], 10);

        if (month < 1 || month > 12) return false;

        const now = new Date();
        const expiry = new Date(year, month - 1);

        return expiry > now;
    }

    static validateCVV(cvv) {
        return /^\d{3,4}$/.test(cvv);
    }

    static validatePlanPrice(price) {
        const numPrice = parseFloat(price);
        return !isNaN(numPrice) && numPrice > 0 && numPrice <= 10000; // Reasonable limits
    }

    static validateSubscriptionData(data) {
        const errors = [];

        if (!data.planName || typeof data.planName !== 'string') {
            errors.push('Plan name is required and must be a string');
        }

        if (!data.planPrice || !this.validatePlanPrice(data.planPrice)) {
            errors.push('Valid plan price is required');
        }

        if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
            errors.push('Name is required and must be at least 2 characters');
        }

        if (!data.paymentDetails) {
            errors.push('Payment details are required');
        } else {
            const { cardNumber, expiryDate, cardCode } = data.paymentDetails;

            if (!cardNumber || !this.validateCardNumber(cardNumber)) {
                errors.push('Valid card number is required');
            }

            if (!expiryDate || !this.validateExpiryDate(expiryDate)) {
                errors.push('Valid expiry date is required (MM/YY format)');
            }

            if (!cardCode || !this.validateCVV(cardCode)) {
                errors.push('Valid CVV is required');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    static validateBillingAddress(billingAddress) {
        if (!billingAddress) return { isValid: true, errors: [] }; // Optional

        const errors = [];

        if (!billingAddress.addressLine1 || billingAddress.addressLine1.trim().length < 5) {
            errors.push('Address line 1 is required and must be at least 5 characters');
        }

        if (!billingAddress.city || billingAddress.city.trim().length < 2) {
            errors.push('City is required and must be at least 2 characters');
        }

        if (!billingAddress.state || billingAddress.state.trim().length < 2) {
            errors.push('State is required and must be at least 2 characters');
        }

        if (!billingAddress.zipCode || !/^\d{5}(-\d{4})?$/.test(billingAddress.zipCode)) {
            errors.push('Valid ZIP code is required (e.g., 12345 or 12345-6789)');
        }

        if (!billingAddress.country || billingAddress.country.trim().length < 2) {
            errors.push('Country is required');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    static validateAuth(auth) {
        if (!auth) {
            return { isValid: false, error: 'Authentication required' };
        }

        if (!auth.uid) {
            return { isValid: false, error: 'Valid user ID required' };
        }

        if (!auth.token || !auth.token.email) {
            return { isValid: false, error: 'Valid authentication token required' };
        }

        return { isValid: true };
    }

    static sanitizeInput(input) {
        if (typeof input === 'string') {
            return input.trim();
        }
        return input;
    }

    static logValidationError(functionName, errors) {
        logger.error(`Validation failed in ${functionName}:`, errors);
    }
}

module.exports = ValidationUtils;