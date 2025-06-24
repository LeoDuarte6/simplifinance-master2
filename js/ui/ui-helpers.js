// js/ui/ui-helpers.js

export class UIHelpers {
    static getFormData(formId) {
        const form = document.getElementById(formId);
        if (!form) return {};
        const formData = new FormData(form);
        const data = {};
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        return data;
    }

    static populateForm(formId, data) {
        const form = document.getElementById(formId);
        if (!form) return;
        Object.keys(data).forEach(key => {
            const field = form.querySelector(`[name="${key}"]`);
            if (field) {
                if (field.type === 'checkbox') {
                    field.checked = !!data[key];
                } else {
                    field.value = data[key] || '';
                }
            }
        });
    }

    static showLoading(buttonId, loaderId) {
        const button = document.getElementById(buttonId);
        const loader = document.getElementById(loaderId);
        if (button) {
            button.disabled = true;
            button.classList.add('opacity-75');
        }
        if (loader) {
            loader.classList.remove('hidden');
        }
    }

    static hideLoading(buttonId, loaderId) {
        const button = document.getElementById(buttonId);
        const loader = document.getElementById(loaderId);
        if (button) {
            button.disabled = false;
            button.classList.remove('opacity-75');
        }
        if (loader) {
            loader.classList.add('hidden');
        }
    }

    static addClickListener(elementId, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener('click', handler);
        }
    }

    static addSubmitListener(formId, handler) {
        const form = document.getElementById(formId);
        if (form) {
            form.addEventListener('submit', handler);
        }
    }

    static updateElementText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        } else {
             console.warn(`Element with ID '${elementId}' not found in DOM`);
        }
    }

    static updateElementValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) element.value = value;
    }

    static setFocus(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.focus();
        }
    }

    static announceToScreenReader(message) {
        let liveRegion = document.getElementById('sr-live-region');
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.id = 'sr-live-region';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.className = 'sr-only';
            document.body.appendChild(liveRegion);
        }
        liveRegion.textContent = message;
    }

    static clearLocalStorage() {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('simplifinance_')) {
                localStorage.removeItem(key);
            }
        }
        const planDetailsCheckout = document.getElementById('plan-details-checkout');
        if (planDetailsCheckout) {
            planDetailsCheckout.innerHTML = '<p class="text-gray-500">Loading selected plan...</p>';
        }
        const signupForms = ['step-1-form', 'step-2-form', 'step-3-form'];
        signupForms.forEach(formId => {
            const form = document.getElementById(formId);
            if (form) form.reset();
        });
    }
}