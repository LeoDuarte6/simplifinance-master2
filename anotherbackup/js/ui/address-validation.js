// js/ui/address-validation.js
export class AddressValidation {
    constructor() {
        this.setupInputFormatting();
    }

    setupInputFormatting() {
        // Format ZIP code as user types (digits only, max 5 characters)
        document.addEventListener('input', (e) => {
            if (e.target.id === 'billing-zip') {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length > 5) {
                    value = value.slice(0, 5);
                }
                e.target.value = value;
            }
        });
    }

}