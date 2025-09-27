// js/ui/input-formatter.js

export class InputFormatter {
    initializeInputFormatters() {
        this.setupCreditCardFormatting('cardNumber');
        this.setupExpiryFormatting('expiry');
        this.setupCVVFormatting('cvv');
        this.setupPhoneFormatting('billing-phone');
        this.setupCreditCardFormatting('update-card-number');
        this.setupExpiryFormatting('update-expiry');
        this.setupCVVFormatting('update-cvv');
    }

    setupCreditCardFormatting(inputId) {
        const cardInput = document.getElementById(inputId);
        if (!cardInput || cardInput.dataset.formatterInitialized) return;
        if (typeof window.cleaveZen !== 'undefined') {
            cardInput.addEventListener('input', (e) => {
                e.target.value = window.cleaveZen.formatCreditCard(e.target.value);
            });
            window.cleaveZen.registerCursorTracker?.({ input: cardInput, delimiter: window.cleaveZen.DefaultCreditCardDelimiter });
        }
        cardInput.dataset.formatterInitialized = 'true';
    }

    setupExpiryFormatting(inputId) {
        const expiryInput = document.getElementById(inputId);
        if (!expiryInput || expiryInput.dataset.formatterInitialized) return;
        if (typeof window.cleaveZen !== 'undefined' && window.cleaveZen.formatDate) {
            expiryInput.addEventListener('input', (e) => {
                e.target.value = window.cleaveZen.formatDate(e.target.value, { datePattern: ['m', 'y'] });
            });
        }
        expiryInput.dataset.formatterInitialized = 'true';
    }

    setupCVVFormatting(inputId) {
        const cvvInput = document.getElementById(inputId);
        if (!cvvInput || cvvInput.dataset.formatterInitialized) return;
        cvvInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 4) value = value.slice(0, 4);
            e.target.value = value;
        });
        cvvInput.dataset.formatterInitialized = 'true';
    }

    setupPhoneFormatting(inputId) {
        const phoneInput = document.getElementById(inputId);
        if (!phoneInput || phoneInput.dataset.formatterInitialized) return;
        if (typeof window.cleaveZen !== 'undefined' && window.cleaveZen.formatPhone) {
            phoneInput.addEventListener('input', (e) => {
                e.target.value = window.cleaveZen.formatPhone(e.target.value, { regionCode: 'US' });
            });
        }
        phoneInput.dataset.formatterInitialized = 'true';
    }
}