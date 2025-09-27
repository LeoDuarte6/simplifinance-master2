const responseCodes = require('./responseCodes.json');

class ErrorMapper {
    constructor() {
        // Create a map for quick lookups
        this.errorCodeMap = new Map();
        this.initializeErrorCodeMap();
    }

    initializeErrorCodeMap() {
        responseCodes.forEach(codeObj => {
            this.errorCodeMap.set(codeObj.code, {
                text: codeObj.text,
                description: codeObj.description,
                integrationSuggestions: codeObj.integration_suggestions,
                otherSuggestions: codeObj.other_suggestions
            });
        });
    }

    /**
     * Extract error code from various error message formats
     * @param {string} errorMessage - The error message from Authorize.Net
     * @returns {string|null} - The extracted error code or null
     */
    extractErrorCode(errorMessage) {
        if (!errorMessage || typeof errorMessage !== 'string') {
            return null;
        }

        // Common patterns for error codes in Authorize.Net responses
        const patterns = [
            /Code\s+([EI]\d{5})/i,           // "Code E00040", "Code I00001"
            /Error\s+code\s*:?\s*([EI]\d{5})/i, // "Error code: E00040"
            /([EI]\d{5})/i                    // Direct match like "E00040"
        ];

        for (const pattern of patterns) {
            const match = errorMessage.match(pattern);
            if (match) {
                return match[1].toUpperCase();
            }
        }

        return null;
    }

    /**
     * Get user-friendly error message from error code or raw message
     * @param {string} errorMessage - The raw error message
     * @returns {object} - Object with userMessage and technicalDetails
     */
    getUserFriendlyError(errorMessage) {
        const errorCode = this.extractErrorCode(errorMessage);
        
        if (errorCode && this.errorCodeMap.has(errorCode)) {
            const codeInfo = this.errorCodeMap.get(errorCode);
            return {
                userMessage: this.getContextualUserMessage(errorCode, codeInfo.text),
                technicalDetails: codeInfo.description,
                errorCode: errorCode,
                originalMessage: errorMessage
            };
        }

        // Handle common error patterns without specific codes
        return {
            userMessage: this.parseGenericError(errorMessage),
            technicalDetails: errorMessage,
            errorCode: null,
            originalMessage: errorMessage
        };
    }

    /**
     * Get contextual user-friendly messages for specific error codes
     * @param {string} errorCode - The error code
     * @param {string} defaultText - Default text from response codes
     * @returns {string} - User-friendly message
     */
    getContextualUserMessage(errorCode, defaultText) {
        // Map specific error codes to user-friendly messages
        const userFriendlyMessages = {
            'E00027': 'Your payment was declined. Please check your card details and try again, or use a different payment method.',
            'E00040': 'We could not find your payment profile. Please try again or contact support if this continues.',
            'E00003': 'There was an issue processing your request. Please try again.',
            'E00104': 'Our payment system is temporarily under maintenance. Please try again in a few minutes.',
            'E00053': 'Our servers are currently busy. Please wait a moment and try again.',
            'E00001': 'An unexpected error occurred. Please try again.',
            'E00007': 'There was an authentication issue with the payment processor. Please try again.',
            'E00012': 'A subscription with these details already exists.',
            'E00035': 'The subscription could not be found.',
            'E00037': 'This subscription cannot be updated.',
            'E00038': 'This subscription cannot be canceled.',
            'E00044': 'Payment profiles are not enabled for this account.',
            'E00039': 'This payment profile already exists.',
            'E00005': 'Invalid payment gateway credentials.',
            'E00006': 'Invalid API credentials.',
            'E00008': 'This payment account is currently inactive.',
            'E00025': 'Recurring billing is not enabled for this account.',
            'E00029': 'Payment information is required.',
            'E00041': 'Please fill in all required fields.',
            'E00013': 'One or more fields contain invalid information.',
            'E00014': 'A required field is missing.',
            'E00015': 'One or more fields exceed the maximum length.',
            'E00018': 'Your credit card expires before the subscription start date.'
        };

        return userFriendlyMessages[errorCode] || defaultText || 'An error occurred while processing your request.';
    }

    /**
     * Parse generic error messages without specific codes
     * @param {string} errorMessage - The raw error message
     * @returns {string} - User-friendly message
     */
    parseGenericError(errorMessage) {
        const lowerMessage = errorMessage.toLowerCase();

        // Common error patterns
        if (lowerMessage.includes('declined')) {
            return 'Your payment was declined. Please check your card details and try again.';
        }
        
        if (lowerMessage.includes('avs mismatch') || lowerMessage.includes('address') && lowerMessage.includes('match')) {
            return 'The billing address you provided does not match your card\'s billing address. Please verify and try again.';
        }
        
        if (lowerMessage.includes('expired')) {
            return 'Your payment method appears to be expired. Please check your expiry date.';
        }
        
        if (lowerMessage.includes('insufficient funds')) {
            return 'Your payment was declined due to insufficient funds.';
        }
        
        if (lowerMessage.includes('invalid card') || lowerMessage.includes('invalid credit card')) {
            return 'The card number appears to be invalid. Please check and try again.';
        }
        
        if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
            return 'The request timed out. Please try again.';
        }
        
        if (lowerMessage.includes('maintenance')) {
            return 'Our payment system is temporarily under maintenance. Please try again in a few minutes.';
        }
        
        if (lowerMessage.includes('server') && (lowerMessage.includes('busy') || lowerMessage.includes('unavailable'))) {
            return 'Our servers are currently busy. Please wait a moment and try again.';
        }

        // Default fallback
        return 'An error occurred while processing your payment. Please try again or contact support.';
    }

    /**
     * Determine if error is retryable
     * @param {string} errorCode - The error code
     * @returns {boolean} - Whether the error is likely retryable
     */
    isRetryableError(errorCode) {
        const retryableErrors = [
            'E00001', // Generic system error
            'E00049', // Operation timed out
            'E00053', // Server too busy
            'E00104'  // Server in maintenance
        ];
        
        return retryableErrors.includes(errorCode);
    }

    /**
     * Get retry delay recommendation in milliseconds
     * @param {string} errorCode - The error code
     * @returns {number} - Recommended retry delay
     */
    getRetryDelay(errorCode) {
        const retryDelays = {
            'E00053': 5000,  // Server busy - wait 5 seconds
            'E00104': 30000, // Maintenance - wait 30 seconds
            'E00049': 3000,  // Timeout - wait 3 seconds
            'E00001': 2000   // Generic error - wait 2 seconds
        };
        
        return retryDelays[errorCode] || 2000;
    }
}

module.exports = ErrorMapper;