const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions");

// Import our services
const PaymentService = require("./services/payment");
const DatabaseService = require("./services/database");
const ValidationUtils = require("./utils/validation");

setGlobalOptions({
    region: "us-central1"
});

// Initialize admin with explicit configuration for v2 functions
admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT,
    storageBucket: 'simplifinance-65ac9.firebasestorage.app'
});

// Initialize services
const paymentService = new PaymentService();
const dbService = new DatabaseService();

// ===== MAIN SUBSCRIPTION CREATION FUNCTION =====
exports.createSubscription = onCall(async (request) => {
    const { data, auth } = request;

    try {
        logger.info("=== CREATE SUBSCRIPTION START ===");

        // Validate authentication
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        // Validate subscription data
        const dataValidation = ValidationUtils.validateSubscriptionData(data);
        if (!dataValidation.isValid) {
            ValidationUtils.logValidationError('createSubscription', dataValidation.errors);
            throw new HttpsError('invalid-argument', `Validation failed: ${dataValidation.errors.join(', ')}`, {
                code: 'VALIDATION_ERROR',
                fields: dataValidation.errors
            });
        }

        // Validate billing address if provided
        if (data.billingAddress) {
            const billingValidation = ValidationUtils.validateBillingAddress(data.billingAddress);
            if (!billingValidation.isValid) {
                ValidationUtils.logValidationError('createSubscription', billingValidation.errors);
                throw new HttpsError('invalid-argument', `Billing address validation failed: ${billingValidation.errors.join(', ')}`, {
                    code: 'BILLING_ADDRESS_INVALID',
                    fields: billingValidation.errors
                });
            }
        }

        const { planName, planPrice, paymentDetails, name, isAdvisor, billingAddress } = data;
        const email = auth.token.email;
        const uid = auth.uid;

        logger.info('Processing subscription for user:', { uid, email, planName, planPrice });

        // Check if user already has customer profile data (for resubscription)
        let existingCustomerProfile = null;
        try {
            const profileResult = await dbService.getCustomerProfile(uid);
            if (profileResult.success) {
                existingCustomerProfile = profileResult.profileData;
                logger.info('Existing customer profile found:', {
                    customerProfileId: existingCustomerProfile.customerProfileId,
                    planName: existingCustomerProfile.planName,
                    isActive: existingCustomerProfile.isActive
                });
            } else {
                logger.info('No customer profile found for user (new user)');
            }
        } catch (error) {
            logger.info('Error checking for existing customer profile:', error.message);
        }

        // Create subscription with Authorize.Net
        const subscriptionData = {
            planName,
            planPrice,
            paymentDetails,
            name: ValidationUtils.sanitizeInput(name),
            email,
            isAdvisor: !!isAdvisor,
            billingAddress,
            // Pass existing customer profile data if available
            existingCustomerProfile: existingCustomerProfile ? {
                customerProfileId: existingCustomerProfile.customerProfileId,
                customerPaymentProfileId: existingCustomerProfile.customerPaymentProfileId,
                customerAddressId: existingCustomerProfile.customerAddressId
            } : null
        };

        const paymentResult = await paymentService.createSubscription(subscriptionData);

        if (!paymentResult.success) {
            // Extract more specific error information if available
            const errorMessage = paymentResult.message || 'Payment processing failed';
            const errorDetails = paymentResult.details || {};

            // Determine specific error code and Firebase error type based on the message
            let firebaseErrorCode = 'failed-precondition';
            let customErrorCode = 'PAYMENT_FAILED';

            // Check for specific payment error types
            const lowerMessage = errorMessage.toLowerCase();
            if (lowerMessage.includes('declined') || lowerMessage.includes('insufficient funds')) {
                customErrorCode = 'PAYMENT_DECLINED';
            } else if (lowerMessage.includes('invalid card') || lowerMessage.includes('invalid credit card')) {
                firebaseErrorCode = 'invalid-argument';
                customErrorCode = 'INVALID_CARD_NUMBER';
            } else if (lowerMessage.includes('address') && lowerMessage.includes('match')) {
                customErrorCode = 'ADDRESS_MISMATCH';
            } else if (lowerMessage.includes('expired')) {
                firebaseErrorCode = 'invalid-argument';
                customErrorCode = 'CARD_EXPIRED';
            } else if (lowerMessage.includes('maintenance') || lowerMessage.includes('busy') || lowerMessage.includes('unavailable')) {
                firebaseErrorCode = 'unavailable';
                customErrorCode = 'PAYMENT_SERVICE_UNAVAILABLE';
            } else if (lowerMessage.includes('profile') && lowerMessage.includes('not found')) {
                firebaseErrorCode = 'not-found';
                customErrorCode = 'PAYMENT_PROFILE_NOT_FOUND';
            }

            throw new HttpsError(firebaseErrorCode, errorMessage, {
                code: customErrorCode,
                details: errorDetails,
                originalError: paymentResult.originalMessage || errorMessage
            });
        }

        // Save user data to Firestore
        const userData = {
            name: ValidationUtils.sanitizeInput(name),
            email,
            plan: planName,
            subscriptionId: paymentResult.subscriptionId,
            isAdvisor: !!isAdvisor,
            billingAddress
        };

        await dbService.createUser(uid, userData);

        // Store customer profile for future subscription restarts
        if (paymentResult.customerProfileId) {
            const billingCycle = paymentService.determineBillingCycle(planName, planPrice);

            await dbService.storeCustomerProfile(uid, {
                customerProfileId: paymentResult.customerProfileId,
                customerPaymentProfileId: paymentResult.customerPaymentProfileId,
                customerAddressId: paymentResult.customerAddressId,
                planName: planName,
                billingCycle: billingCycle
            });

            logger.info("Customer profile stored for future subscription restarts");
        }

        logger.info(`SUCCESS: Payment processed and subscription created for user ${uid}:`, {
            transactionId: paymentResult.transactionId,
            subscriptionId: paymentResult.subscriptionId
        });

        return {
            status: 'success',
            transactionId: paymentResult.transactionId,
            subscriptionId: paymentResult.subscriptionId,
            message: 'Payment processed and subscription created successfully'
        };

    } catch (error) {
        logger.error("Error in createSubscription:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        // Preserve the specific error message from payment processing
        let errorMessage = error.message;

        // If it's a generic message, provide a fallback
        if (!errorMessage || errorMessage === 'Payment processing failed') {
            errorMessage = 'An error occurred while processing your payment. Please try again or contact support.';
        }

        throw new HttpsError('internal', errorMessage, {
            code: 'SUBSCRIPTION_CREATION_FAILED',
            details: error.message || 'Unknown error occurred during subscription creation'
        });
    }
});

// ===== SUBSCRIPTION MANAGEMENT FUNCTIONS =====
exports.getSubscription = onCall(async (request) => {
    const { data, auth } = request;

    try {
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        const { subscriptionId } = data;
        if (!subscriptionId) {
            throw new HttpsError('invalid-argument', 'Subscription ID is required', {
                code: 'MISSING_SUBSCRIPTION_ID'
            });
        }

        // Get user data to verify ownership
        const userResult = await dbService.getUser(auth.uid);
        if (!userResult.success) {
            throw new HttpsError('not-found', 'User not found', {
                code: 'USER_NOT_FOUND'
            });
        }

        // Verify user owns this subscription
        if (userResult.userData.authNetSubscriptionId !== subscriptionId) {
            throw new HttpsError('permission-denied', 'Unauthorized: You can only view your own subscription', {
                code: 'SUBSCRIPTION_ACCESS_DENIED'
            });
        }

        const subscriptionDetails = await paymentService.getSubscription(subscriptionId);

        return {
            status: 'success',
            subscription: subscriptionDetails.subscription,
            userData: userResult.userData
        };

    } catch (error) {
        logger.error("Error in getSubscription:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to retrieve subscription details', {
            code: 'SUBSCRIPTION_RETRIEVAL_FAILED'
        });
    }
});

exports.cancelSubscription = onCall(async (request) => {
    const { data, auth } = request;

    try {
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        const { subscriptionId } = data;
        if (!subscriptionId) {
            throw new HttpsError('invalid-argument', 'Subscription ID is required', {
                code: 'MISSING_SUBSCRIPTION_ID'
            });
        }

        // Get user data to verify ownership
        const userResult = await dbService.getUser(auth.uid);
        if (!userResult.success) {
            throw new HttpsError('not-found', 'User not found', {
                code: 'USER_NOT_FOUND'
            });
        }

        // Verify user owns this subscription
        if (userResult.userData.authNetSubscriptionId !== subscriptionId) {
            throw new HttpsError('permission-denied', 'Unauthorized: You can only cancel your own subscription', {
                code: 'SUBSCRIPTION_ACCESS_DENIED'
            });
        }

        // Cancel with Authorize.Net
        await paymentService.cancelSubscription(subscriptionId);

        // Update database
        await dbService.cancelUserSubscription(auth.uid);

        logger.info(`Subscription ${subscriptionId} cancelled for user ${auth.uid}`);

        return {
            status: 'success',
            message: 'Subscription cancelled successfully'
        };

    } catch (error) {
        logger.error("Error in cancelSubscription:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to cancel subscription', {
            code: 'SUBSCRIPTION_CANCELLATION_FAILED'
        });
    }
});

// ===== USER MANAGEMENT FUNCTIONS =====
exports.updateUserProfile = onCall(async (request) => {
    const { data, auth } = request;

    try {
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        const { updates } = data;
        if (!updates || typeof updates !== 'object') {
            throw new HttpsError('invalid-argument', 'Updates object is required', {
                code: 'MISSING_UPDATES'
            });
        }

        await dbService.updateUser(auth.uid, updates);

        logger.info(`Profile updated for user ${auth.uid}`);

        return {
            status: 'success',
            message: 'Profile updated successfully'
        };

    } catch (error) {
        logger.error("Error in updateUserProfile:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to update profile', {
            code: 'PROFILE_UPDATE_FAILED'
        });
    }
});

exports.getUserProfile = onCall(async (request) => {
    const { auth } = request;

    try {
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        const userResult = await dbService.getUser(auth.uid);
        if (!userResult.success) {
            throw new HttpsError('not-found', 'User not found', {
                code: 'USER_NOT_FOUND'
            });
        }

        return {
            status: 'success',
            userData: userResult.userData
        };

    } catch (error) {
        logger.error("Error in getUserProfile:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to retrieve user profile', {
            code: 'PROFILE_RETRIEVAL_FAILED'
        });
    }
});

// ===== ADMIN FUNCTIONS =====
exports.adminGetAllUsers = onCall(async (request) => {
    const { auth } = request;

    try {
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        const usersResult = await dbService.getAllUsers(auth.uid);

        return {
            status: 'success',
            users: usersResult.users
        };

    } catch (error) {
        logger.error("Error in adminGetAllUsers:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to retrieve users', {
            code: 'ADMIN_GET_USERS_FAILED'
        });
    }
});

// ===== UPDATE PAYMENT PROFILE FUNCTION =====
exports.updatePaymentProfile = onCall(async (request) => {
    const { data, auth } = request;

    try {
        logger.info("=== UPDATE PAYMENT PROFILE START ===");

        // Validate authentication
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        const { paymentDetails, billingAddress } = data;

        if (!paymentDetails || !paymentDetails.cardNumber || !paymentDetails.expiryDate || !paymentDetails.cardCode) {
            throw new HttpsError('invalid-argument', 'Complete payment details are required (card number, expiry date, and CVV)', {
                code: 'MISSING_PAYMENT_DETAILS'
            });
        }

        if (!billingAddress || !billingAddress.addressLine1 || !billingAddress.city || !billingAddress.state || !billingAddress.zipCode) {
            throw new HttpsError('invalid-argument', 'Complete billing address is required', {
                code: 'MISSING_BILLING_ADDRESS'
            });
        }

        // Get user data to verify they have an active subscription
        const userResult = await dbService.getUser(auth.uid);
        if (!userResult.success) {
            throw new HttpsError('not-found', 'User not found', {
                code: 'USER_NOT_FOUND'
            });
        }

        const userData = userResult.userData;

        if (!userData.subscriptionStatus || userData.subscriptionStatus !== 'active') {
            throw new HttpsError('failed-precondition', 'Can only update payment information for active subscriptions', {
                code: 'INACTIVE_SUBSCRIPTION'
            });
        }

        // Get stored customer profile
        const profileResult = await dbService.getCustomerProfile(auth.uid);
        if (!profileResult.success) {
            throw new HttpsError('not-found', 'No payment profile found', {
                code: 'PAYMENT_PROFILE_NOT_FOUND'
            });
        }

        const customerProfile = profileResult.profileData;

        logger.info('Updating payment profile for user:', {
            userId: auth.uid,
            email: userData.email,
            customerProfileId: customerProfile.customerProfileId,
            paymentProfileId: customerProfile.customerPaymentProfileId
        });

        // Update the customer payment profile in Authorize.Net
        const updateResult = await paymentService.updateCustomerPaymentProfile(
            customerProfile.customerProfileId,
            customerProfile.customerPaymentProfileId,
            {
                cardNumber: paymentDetails.cardNumber.replace(/\s/g, ''),
                expiryDate: paymentDetails.expiryDate,
                cardCode: paymentDetails.cardCode
            },
            billingAddress
        );

        if (!updateResult.success) {
            // Extract more specific error information if available
            const errorMessage = updateResult.message || 'Failed to update payment method';
            const errorDetails = updateResult.details || {};

            // Determine specific error code and Firebase error type based on the message
            let firebaseErrorCode = 'failed-precondition';
            let customErrorCode = 'PAYMENT_UPDATE_FAILED';

            // Check for specific payment error types
            const lowerMessage = errorMessage.toLowerCase();
            if (lowerMessage.includes('invalid card') || lowerMessage.includes('invalid credit card')) {
                firebaseErrorCode = 'invalid-argument';
                customErrorCode = 'INVALID_CARD_NUMBER';
            } else if (lowerMessage.includes('expired')) {
                firebaseErrorCode = 'invalid-argument';
                customErrorCode = 'CARD_EXPIRED';
            } else if (lowerMessage.includes('address') && lowerMessage.includes('match')) {
                customErrorCode = 'ADDRESS_MISMATCH';
            } else if (lowerMessage.includes('profile') && lowerMessage.includes('not found')) {
                firebaseErrorCode = 'not-found';
                customErrorCode = 'PAYMENT_PROFILE_NOT_FOUND';
            } else if (lowerMessage.includes('maintenance') || lowerMessage.includes('busy') || lowerMessage.includes('unavailable')) {
                firebaseErrorCode = 'unavailable';
                customErrorCode = 'PAYMENT_SERVICE_UNAVAILABLE';
            }

            throw new HttpsError(firebaseErrorCode, errorMessage, {
                code: customErrorCode,
                details: errorDetails,
                originalError: updateResult.originalMessage || errorMessage
            });
        }

        // Update user's billing address in the database
        await dbService.updateUser(auth.uid, {
            billingAddress: billingAddress,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update customer profile record with last updated timestamp
        await dbService.updateCustomerProfile(auth.uid, {
            lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            paymentMethodUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        logger.info(`SUCCESS: Payment profile updated for user ${auth.uid}`);

        return {
            status: 'success',
            message: 'Payment method updated successfully'
        };

    } catch (error) {
        logger.error("Error in updatePaymentProfile:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to update payment method. Please try again.', {
            code: 'PAYMENT_PROFILE_UPDATE_FAILED'
        });
    }
});

// ===== ADMIN USER MANAGEMENT FUNCTIONS =====

// Create new user with admin-set password
exports.adminCreateUser = onCall(async (request) => {
    const { data, auth } = request;

    try {
        logger.info("=== ADMIN CREATE USER START ===");

        // Validate authentication and admin status
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        // Verify admin status
        const adminResult = await dbService.getUser(auth.uid);
        if (!adminResult.success || !adminResult.userData.isAdmin) {
            throw new HttpsError('permission-denied', 'Unauthorized: Admin access required', {
                code: 'ADMIN_ACCESS_REQUIRED'
            });
        }

        const { email, password, name, isAdmin, isAdvisor, plan } = data;

        // Validate required fields
        if (!email || !password || !name || !plan) {
            throw new HttpsError('invalid-argument', 'Email, password, name, and plan are required', {
                code: 'MISSING_REQUIRED_FIELDS'
            });
        }

        // Create user in Firebase Auth
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: name
        });

        // Determine plan level
        const planLevel = plan.toLowerCase().includes('premium') ? 'premium' : 'essentials';

        // Create user document in Firestore
        const userData = {
            name: name,
            email: email,
            plan: plan,
            planLevel: planLevel,
            subscriptionStatus: "active",
            isAdmin: !!isAdmin,
            isAdvisor: !!isAdvisor,
            accessibleContent: [], // Initialize empty content access
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: auth.uid // Track which admin created this user
        };

        await dbService.createUserDirectly(userRecord.uid, userData);

        logger.info(`SUCCESS: User ${userRecord.uid} created by admin ${auth.uid}`);

        return {
            status: 'success',
            message: 'User created successfully',
            userId: userRecord.uid
        };

    } catch (error) {
        logger.error("Error in adminCreateUser:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to create user', {
            code: 'ADMIN_CREATE_USER_FAILED'
        });
    }
});

// Update user password by admin
exports.adminUpdateUserPassword = onCall(async (request) => {
    const { data, auth } = request;

    try {
        logger.info("=== ADMIN UPDATE USER PASSWORD START ===");

        // Validate authentication and admin status
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        // Verify admin status
        const adminResult = await dbService.getUser(auth.uid);
        if (!adminResult.success || !adminResult.userData.isAdmin) {
            throw new HttpsError('permission-denied', 'Unauthorized: Admin access required', {
                code: 'ADMIN_ACCESS_REQUIRED'
            });
        }

        const { userId, newPassword } = data;

        if (!userId || !newPassword) {
            throw new HttpsError('invalid-argument', 'User ID and new password are required', {
                code: 'MISSING_REQUIRED_FIELDS'
            });
        }

        // Update password in Firebase Auth
        await admin.auth().updateUser(userId, {
            password: newPassword
        });

        // Log the password update
        await dbService.updateUserDirectly(userId, {
            passwordUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            passwordUpdatedBy: auth.uid
        });

        logger.info(`SUCCESS: Password updated for user ${userId} by admin ${auth.uid}`);

        return {
            status: 'success',
            message: 'Password updated successfully'
        };

    } catch (error) {
        logger.error("Error in adminUpdateUserPassword:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to update password', {
            code: 'ADMIN_UPDATE_PASSWORD_FAILED'
        });
    }
});

// Update user role (admin/regular user)
exports.adminUpdateUserRole = onCall(async (request) => {
    const { data, auth } = request;

    try {
        logger.info("=== ADMIN UPDATE USER ROLE START ===");

        // Validate authentication and admin status
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        // Verify admin status
        const adminResult = await dbService.getUser(auth.uid);
        if (!adminResult.success || !adminResult.userData.isAdmin) {
            throw new HttpsError('permission-denied', 'Unauthorized: Admin access required', {
                code: 'ADMIN_ACCESS_REQUIRED'
            });
        }

        const { userId, isAdmin, isAdvisor } = data;

        if (!userId) {
            throw new HttpsError('invalid-argument', 'User ID is required', {
                code: 'MISSING_USER_ID'
            });
        }

        // Prevent admin from removing their own admin status
        if (userId === auth.uid && !isAdmin) {
            throw new HttpsError('failed-precondition', 'Cannot remove your own admin privileges', {
                code: 'CANNOT_MODIFY_OWN_PRIVILEGES'
            });
        }

        // Update user role
        const updates = {
            isAdmin: !!isAdmin,
            isAdvisor: !!isAdvisor,
            roleUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            roleUpdatedBy: auth.uid
        };

        await dbService.updateUserDirectly(userId, updates);

        logger.info(`SUCCESS: Role updated for user ${userId} by admin ${auth.uid}`);

        return {
            status: 'success',
            message: 'User role updated successfully'
        };

    } catch (error) {
        logger.error("Error in adminUpdateUserRole:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to update user role', {
            code: 'ADMIN_UPDATE_ROLE_FAILED'
        });
    }
});

// Delete user by admin
exports.adminDeleteUser = onCall(async (request) => {
    const { data, auth } = request;

    try {
        logger.info("=== ADMIN DELETE USER START ===");

        // Validate authentication and admin status
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        // Verify admin status
        const adminResult = await dbService.getUser(auth.uid);
        if (!adminResult.success || !adminResult.userData.isAdmin) {
            throw new HttpsError('permission-denied', 'Unauthorized: Admin access required', {
                code: 'ADMIN_ACCESS_REQUIRED'
            });
        }

        const { userId } = data;

        if (!userId) {
            throw new HttpsError('invalid-argument', 'User ID is required', {
                code: 'MISSING_USER_ID'
            });
        }

        // Prevent admin from deleting themselves
        if (userId === auth.uid) {
            throw new HttpsError('failed-precondition', 'Cannot delete your own account', {
                code: 'CANNOT_DELETE_OWN_ACCOUNT'
            });
        }

        // Delete from Firebase Auth
        await admin.auth().deleteUser(userId);

        // Delete from Firestore (or mark as deleted)
        await admin.firestore().collection('users').doc(userId).delete();

        logger.info(`SUCCESS: User ${userId} deleted by admin ${auth.uid}`);

        return {
            status: 'success',
            message: 'User deleted successfully'
        };

    } catch (error) {
        logger.error("Error in adminDeleteUser:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to delete user', {
            code: 'ADMIN_DELETE_USER_FAILED'
        });
    }
});

// Update user's accessible content
exports.adminUpdateUserContent = onCall(async (request) => {
    const { data, auth } = request;

    try {
        logger.info("=== ADMIN UPDATE USER CONTENT START ===");

        // Validate authentication and admin status
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        // Verify admin status
        const adminResult = await dbService.getUser(auth.uid);
        if (!adminResult.success || !adminResult.userData.isAdmin) {
            throw new HttpsError('permission-denied', 'Unauthorized: Admin access required', {
                code: 'ADMIN_ACCESS_REQUIRED'
            });
        }

        const { userId, accessibleContent } = data;

        if (!userId || !Array.isArray(accessibleContent)) {
            throw new HttpsError('invalid-argument', 'User ID and accessible content array are required', {
                code: 'MISSING_REQUIRED_FIELDS'
            });
        }

        // Update user's accessible content
        const updates = {
            accessibleContent: accessibleContent,
            contentUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            contentUpdatedBy: auth.uid
        };

        await dbService.updateUserDirectly(userId, updates);

        logger.info(`SUCCESS: Content access updated for user ${userId} by admin ${auth.uid}`);

        return {
            status: 'success',
            message: 'User content access updated successfully'
        };

    } catch (error) {
        logger.error("Error in adminUpdateUserContent:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to update user content access', {
            code: 'ADMIN_UPDATE_CONTENT_FAILED'
        });
    }
});

// ===== CONTENT MANAGEMENT FUNCTIONS =====

// Upload new content (fixes the broken admin dashboard function)
exports.uploadContent = onCall(async (request) => {
    const { data, auth } = request;

    try {
        logger.info("=== UPLOAD CONTENT START ===");

        // Validate authentication and admin status
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        // Verify admin status
        const adminResult = await dbService.getUser(auth.uid);
        if (!adminResult.success || !adminResult.userData.isAdmin) {
            throw new HttpsError('permission-denied', 'Unauthorized: Admin access required', {
                code: 'ADMIN_ACCESS_REQUIRED'
            });
        }

        const { title, description, category, planRequirement, specificUsers, fileSize, contentFile, thumbnailFile } = data;

        // Validate required fields
        if (!title || !description || !category || !planRequirement) {
            throw new HttpsError('invalid-argument', 'Title, description, category, and plan requirement are required', {
                code: 'MISSING_REQUIRED_FIELDS'
            });
        }

        // Validate file data
        if (!contentFile || !thumbnailFile) {
            throw new HttpsError('invalid-argument', 'Both content file and thumbnail file are required', {
                code: 'MISSING_FILES'
            });
        }

        // Validate file sizes (already validated on client, but double-check)
        if (fileSize > 50 * 1024 * 1024) {
            throw new HttpsError('invalid-argument', 'Content file must be less than 50MB', {
                code: 'FILE_TOO_LARGE'
            });
        }

        // Validate plan requirement
        if (!['essentials', 'premium', 'custom'].includes(planRequirement)) {
            throw new HttpsError('invalid-argument', 'Plan requirement must be essentials, premium, or custom', {
                code: 'INVALID_PLAN_REQUIREMENT'
            });
        }

        // If custom plan, specific users are required
        if (planRequirement === 'custom' && (!specificUsers || !Array.isArray(specificUsers) || specificUsers.length === 0)) {
            throw new HttpsError('invalid-argument', 'Specific users are required for custom content', {
                code: 'MISSING_CUSTOM_USERS'
            });
        }

        // Get original filenames or use defaults
        const contentFilename = contentFile.originalFilename || 'content.zip';
        const thumbnailFilename = thumbnailFile.originalFilename || 'thumbnail.png';

        // Extract file extensions
        const contentExt = contentFilename.split('.').pop().toLowerCase();
        const thumbnailExt = thumbnailFilename.split('.').pop().toLowerCase();

        // Validate file extensions
        if (contentExt !== 'zip') {
            throw new HttpsError('invalid-argument', 'Content file must be a ZIP file', {
                code: 'INVALID_CONTENT_FILE_TYPE'
            });
        }

        if (!['png', 'jpg', 'jpeg', 'webp'].includes(thumbnailExt)) {
            throw new HttpsError('invalid-argument', 'Thumbnail must be PNG, JPG, or WebP format', {
                code: 'INVALID_THUMBNAIL_FILE_TYPE'
            });
        }

        // Create content document
        const contentData = {
            title: title,
            description: description,
            category: category,
            planRequirement: planRequirement,
            specificUsers: specificUsers || [],
            uploadedBy: auth.uid,
            uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            fileSize: fileSize || 0,
            downloadCount: 0,
            isActive: true,
            originalContentFilename: contentFilename, // Store original filename
            originalThumbnailFilename: thumbnailFilename, // Store original filename
            // URLs will be updated after file upload
            thumbnailUrl: '',
            downloadUrl: ''
        };

        // Add to content collection (without URLs initially)
        const contentRef = await admin.firestore().collection('content').add(contentData);
        const contentId = contentRef.id;

        try {
            // Upload files to Firebase Storage
            const bucket = admin.storage().bucket();

            // Parse base64 files
            const contentFileBuffer = Buffer.from(contentFile.data, 'base64');
            const thumbnailFileBuffer = Buffer.from(thumbnailFile.data, 'base64');

            // Define file paths with original filenames
            const contentFilePath = `library/${contentId}/${contentFilename}`;
            const thumbnailFilePath = `library/${contentId}/${thumbnailFilename}`;

            // Upload content file
            const contentFileRef = bucket.file(contentFilePath);
            await contentFileRef.save(contentFileBuffer, {
                metadata: {
                    contentType: 'application/zip',
                    metadata: {
                        uploadedBy: auth.uid,
                        originalName: contentFilename
                    }
                }
            });

            // Upload thumbnail file
            const thumbnailFileRef = bucket.file(thumbnailFilePath);
            await thumbnailFileRef.save(thumbnailFileBuffer, {
                metadata: {
                    contentType: thumbnailFile.type || `image/${thumbnailExt}`,
                    metadata: {
                        uploadedBy: auth.uid,
                        originalName: thumbnailFilename
                    }
                }
            });

            // Get download URLs
            const [contentDownloadUrl] = await contentFileRef.getSignedUrl({
                action: 'read',
                expires: '03-09-2491' // Far future date
            });

            const [thumbnailDownloadUrl] = await thumbnailFileRef.getSignedUrl({
                action: 'read',
                expires: '03-09-2491' // Far future date
            });

            // Update the document with the generated content ID and storage URLs
            const storageUrls = {
                contentId: contentId,
                thumbnailUrl: thumbnailDownloadUrl,
                downloadUrl: contentDownloadUrl,
                storagePaths: {
                    content: contentFilePath,
                    thumbnail: thumbnailFilePath
                }
            };

            await contentRef.update(storageUrls);

            logger.info(`Files uploaded successfully for content ${contentId}`);
        } catch (uploadError) {
            logger.error('File upload error:', uploadError);
            // Clean up: delete the content document if file upload failed
            await contentRef.delete();
            throw new HttpsError('internal', 'Failed to upload files to storage: ' + uploadError.message, {
                code: 'FILE_UPLOAD_FAILED',
                details: uploadError.message
            });
        }

        // Update category count (create category if it doesn't exist)
        await updateCategoryCount(category, auth.uid, 1);

        logger.info(`SUCCESS: Content ${contentId} uploaded by admin ${auth.uid}`);

        return {
            status: 'success',
            message: 'Content and files uploaded successfully',
            contentId: contentId,
            uploadPaths: {
                thumbnail: `library/${contentId}/${thumbnailFilename}`,
                content: `library/${contentId}/${contentFilename}`
            }
        };

    } catch (error) {
        logger.error("Error in uploadContent:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to upload content', {
            code: 'CONTENT_UPLOAD_FAILED'
        });
    }
});

// Update content metadata
exports.updateContent = onCall(async (request) => {
    const { data, auth } = request;

    try {
        logger.info("=== UPDATE CONTENT START ===");

        // Validate authentication and admin status
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error, {
                code: 'AUTH_VALIDATION_FAILED'
            });
        }

        // Verify admin status
        const adminResult = await dbService.getUser(auth.uid);
        if (!adminResult.success || !adminResult.userData.isAdmin) {
            throw new HttpsError('permission-denied', 'Unauthorized: Admin access required', {
                code: 'ADMIN_ACCESS_REQUIRED'
            });
        }

        const { contentId, updates } = data;

        if (!contentId) {
            throw new HttpsError('invalid-argument', 'Content ID is required', {
                code: 'MISSING_CONTENT_ID'
            });
        }

        if (!updates || typeof updates !== 'object') {
            throw new HttpsError('invalid-argument', 'Updates object is required', {
                code: 'MISSING_UPDATES'
            });
        }

        // Validate required fields
        if (updates.title === '' || updates.description === '' || updates.category === '') {
            throw new HttpsError('invalid-argument', 'Title, description, and category cannot be empty', {
                code: 'EMPTY_REQUIRED_FIELDS'
            });
        }

        // Get current content
        const contentRef = admin.firestore().collection('content').doc(contentId);
        const contentSnap = await contentRef.get();

        if (!contentSnap.exists) {
            throw new HttpsError('not-found', 'Content not found', {
                code: 'CONTENT_NOT_FOUND'
            });
        }

        const currentContent = contentSnap.data();

        // Build update object
        const contentUpdates = {
            ...updates,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: auth.uid
        };

        // Handle category change
        if (updates.category && updates.category !== currentContent.category) {
            // Decrement old category count if it exists
            if (currentContent.category) {
                await updateCategoryCount(currentContent.category, auth.uid, -1);
            }

            // Increment new category count
            await updateCategoryCount(updates.category, auth.uid, 1);
        }

        // Update content document
        await contentRef.update(contentUpdates);

        logger.info(`SUCCESS: Content ${contentId} updated by admin ${auth.uid}`);

        return {
            status: 'success',
            message: 'Content updated successfully'
        };

    } catch (error) {
        logger.error("Error in updateContent:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to update content', {
            code: 'CONTENT_UPDATE_FAILED'
        });
    }
});

// Update content access settings
exports.setContentAccess = onCall(async (request) => {
    const { data, auth } = request;

    try {
        logger.info("=== SET CONTENT ACCESS START ===");

        // Validate authentication and admin status
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error, {
                code: 'AUTH_VALIDATION_FAILED'
            });
        }

        // Verify admin status
        const adminResult = await dbService.getUser(auth.uid);
        if (!adminResult.success || !adminResult.userData.isAdmin) {
            throw new HttpsError('permission-denied', 'Unauthorized: Admin access required', {
                code: 'ADMIN_ACCESS_REQUIRED'
            });
        }

        const { contentId, planRequirement, specificUsers } = data;

        if (!contentId) {
            throw new HttpsError('invalid-argument', 'Content ID is required', {
                code: 'MISSING_CONTENT_ID'
            });
        }

        // Validate plan requirement
        if (!['essentials', 'premium', 'custom'].includes(planRequirement)) {
            throw new HttpsError('invalid-argument', 'Invalid plan requirement', {
                code: 'INVALID_PLAN_REQUIREMENT'
            });
        }

        // If custom plan, specific users are required
        if (planRequirement === 'custom' && (!specificUsers || !Array.isArray(specificUsers) || specificUsers.length === 0)) {
            throw new HttpsError('invalid-argument', 'Specific users are required for custom content', {
                code: 'MISSING_CUSTOM_USERS'
            });
        }

        // Get content document
        const contentRef = admin.firestore().collection('content').doc(contentId);
        const contentSnap = await contentRef.get();

        if (!contentSnap.exists) {
            throw new HttpsError('not-found', 'Content not found', {
                code: 'CONTENT_NOT_FOUND'
            });
        }

        // Update content access settings
        const contentUpdates = {
            planRequirement: planRequirement,
            specificUsers: planRequirement === 'custom' ? specificUsers : [],
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            accessUpdatedBy: auth.uid
        };

        await contentRef.update(contentUpdates);

        // For custom access, update user documents as well
        if (planRequirement === 'custom' && specificUsers.length > 0) {
            for (const userEmail of specificUsers) {
                try {
                    if (userEmail && userEmail.includes('@')) {
                        const userId = await getUserIdByEmail(userEmail);
                        if (userId) {
                            const userRef = admin.firestore().collection('users').doc(userId);
                            await userRef.update({
                                accessibleContent: admin.firestore.FieldValue.arrayUnion(contentId)
                            });
                        }
                    }
                } catch (userError) {
                    logger.warn(`Error updating user access for ${userEmail}:`, userError);
                }
            }
        }

        logger.info(`SUCCESS: Content access set for ${contentId} by admin ${auth.uid}`);

        return {
            status: 'success',
            message: 'Content access settings updated successfully'
        };

    } catch (error) {
        logger.error("Error in setContentAccess:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to update content access settings', {
            code: 'CONTENT_ACCESS_UPDATE_FAILED'
        });
    }
});

// Delete content
exports.deleteContent = onCall(async (request) => {
    const { data, auth } = request;

    try {
        logger.info("=== DELETE CONTENT START ===");

        // Validate authentication and admin status
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        // Verify admin status
        const adminResult = await dbService.getUser(auth.uid);
        if (!adminResult.success || !adminResult.userData.isAdmin) {
            throw new HttpsError('permission-denied', 'Unauthorized: Admin access required', {
                code: 'ADMIN_ACCESS_REQUIRED'
            });
        }

        const { contentId } = data;

        if (!contentId) {
            throw new HttpsError('invalid-argument', 'Content ID is required', {
                code: 'MISSING_CONTENT_ID'
            });
        }

        // Get content document
        const contentRef = admin.firestore().collection('content').doc(contentId);
        const contentSnap = await contentRef.get();

        if (!contentSnap.exists) {
            throw new HttpsError('not-found', 'Content not found', {
                code: 'CONTENT_NOT_FOUND'
            });
        }

        const contentData = contentSnap.data();

        // Update category count
        if (contentData.category) {
            await updateCategoryCount(contentData.category, auth.uid, -1);
        }

        // Delete storage files
        if (contentData.storagePaths) {
            try {
                const bucket = admin.storage().bucket();

                if (contentData.storagePaths.content) {
                    await bucket.file(contentData.storagePaths.content).delete();
                }

                if (contentData.storagePaths.thumbnail) {
                    await bucket.file(contentData.storagePaths.thumbnail).delete();
                }

                // Optionally, delete the entire folder
                const folderPath = `library/${contentId}/`;
                const [files] = await bucket.getFiles({ prefix: folderPath });

                for (const file of files) {
                    await file.delete();
                }

                logger.info(`Storage files deleted for content ${contentId}`);
            } catch (storageError) {
                logger.error('Error deleting storage files:', storageError);
                // Continue with document deletion even if storage deletion fails
            }
        }

        // Delete content document
        await contentRef.delete();

        logger.info(`SUCCESS: Content ${contentId} deleted by admin ${auth.uid}`);

        return {
            status: 'success',
            message: 'Content deleted successfully'
        };

    } catch (error) {
        logger.error("Error in deleteContent:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to delete content', {
            code: 'CONTENT_DELETE_FAILED'
        });
    }
});

// Helper function to update category count
async function updateCategoryCount(categoryName, adminId, increment) {
    try {
        const categoriesRef = admin.firestore().collection('categories');
        const categoryQuery = await categoriesRef.where('name', '==', categoryName).limit(1).get();

        if (categoryQuery.empty) {
            // Create new category
            await categoriesRef.add({
                name: categoryName,
                description: `Category for ${categoryName} content`,
                createdBy: adminId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                contentCount: Math.max(0, increment),
                isActive: true
            });
        } else {
            // Update existing category count
            const categoryDoc = categoryQuery.docs[0];
            const currentCount = categoryDoc.data().contentCount || 0;
            await categoryDoc.ref.update({
                contentCount: Math.max(0, currentCount + increment),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (error) {
        logger.error("Error updating category count:", error);
        // Don't throw error, just log it as this is a non-critical operation
    }
}

// Helper function to get user ID from email
async function getUserIdByEmail(email) {
    try {
        // First try to find the user in Auth
        try {
            const userRecord = await admin.auth().getUserByEmail(email);
            if (userRecord) {
                return userRecord.uid;
            }
        } catch (authError) {
            logger.warn(`Unable to find user in Auth by email: ${email}`, authError);
        }

        // If not found in Auth, try to find in Firestore
        const usersRef = admin.firestore().collection('users');
        const userQuery = await usersRef.where('email', '==', email).limit(1).get();

        if (!userQuery.empty) {
            return userQuery.docs[0].id;
        }

        return null;
    } catch (error) {
        logger.error(`Error getting user ID by email (${email}):`, error);
        return null;
    }
}

// Get content accessible to user
exports.getUserAccessibleContent = onCall(async (request) => {
    const { auth, data } = request;

    try {
        logger.info("=== GET USER ACCESSIBLE CONTENT START ===");

        // Validate authentication
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        // For admin users, show all content if requested
        let isAdminView = data && data.getAllContent;
        let userId = auth.uid;
        let userEmail = auth.token.email;

        // Get user data
        const userResult = await dbService.getUser(userId);
        if (!userResult.success) {
            throw new HttpsError('not-found', 'User not found', {
                code: 'USER_NOT_FOUND'
            });
        }

        const userData = userResult.userData;
        const isAdmin = userData.isAdmin === true;

        // Check if admin is requesting all content
        if (isAdmin && isAdminView) {
            logger.info(`Admin user ${userId} requested all content`);

            // Get all content for admin
            const contentRef = admin.firestore().collection('content');
            const contentQuery = contentRef.where('isActive', '==', true);
            const contentSnap = await contentQuery.get();

            const allContent = [];
            contentSnap.forEach(doc => {
                allContent.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            logger.info(`SUCCESS: Retrieved ${allContent.length} content items (admin view) for user ${userId}`);

            return {
                status: 'success',
                content: allContent,
                userPlan: 'admin'
            };
        }

        // Regular content access check
        // Check subscription status for non-admin users
        if (!isAdmin && userData.subscriptionStatus !== 'active') {
            return {
                status: 'success',
                content: [],
                message: 'No active subscription'
            };
        }

        // Get user's plan level
        const planLevel = userData.planLevel || (userData.plan && userData.plan.toLowerCase().includes('premium') ? 'premium' : 'essentials');

        // Build query for accessible content
        const contentRef = admin.firestore().collection('content');
        let query = contentRef.where('isActive', '==', true);

        // Get all content and filter based on access rules
        const allContentSnap = await query.get();
        const accessibleContent = [];

        allContentSnap.forEach(doc => {
            const contentData = doc.data();
            const contentId = doc.id;

            // Admin users can see all content when not in admin view
            if (isAdmin) {
                accessibleContent.push({
                    id: contentId,
                    ...contentData
                });
                return; // Skip other checks for admin
            }

            // Check access based on plan requirement
            if (contentData.planRequirement === 'essentials' ||
                (contentData.planRequirement === 'premium' && planLevel === 'premium')) {
                accessibleContent.push({
                    id: contentId,
                    ...contentData
                });
            }
            // Check custom content access by email
            else if (contentData.planRequirement === 'custom' &&
                     contentData.specificUsers &&
                     contentData.specificUsers.length > 0) {
                // Check if user's email is included
                if (userEmail && contentData.specificUsers.includes(userEmail)) {
                    accessibleContent.push({
                        id: contentId,
                        ...contentData
                    });
                }
                // Also check if user's ID is included (legacy support)
                else if (contentData.specificUsers.includes(userId)) {
                    accessibleContent.push({
                        id: contentId,
                        ...contentData
                    });
                }
            }
            // Check user's specific accessible content list
            else if (userData.accessibleContent &&
                     userData.accessibleContent.includes(contentId)) {
                accessibleContent.push({
                    id: contentId,
                    ...contentData
                });
            }
        });

        logger.info(`SUCCESS: Retrieved ${accessibleContent.length} content items for user ${userId}`);

        return {
            status: 'success',
            content: accessibleContent,
            userPlan: planLevel
        };

    } catch (error) {
        logger.error("Error in getUserAccessibleContent:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to retrieve accessible content', {
            code: 'GET_ACCESSIBLE_CONTENT_FAILED'
        });
    }
});

// ===== SUBSCRIPTION DATE MANAGEMENT =====

// Search for user by name (admin only)
exports.adminSearchUser = onCall(async (request) => {
    const { data, auth } = request;

    try {
        logger.info("=== ADMIN SEARCH USER START ===");

        // Validate authentication and admin status
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        // Verify admin status
        const adminResult = await dbService.getUser(auth.uid);
        if (!adminResult.success || !adminResult.userData.isAdmin) {
            throw new HttpsError('permission-denied', 'Unauthorized: Admin access required', {
                code: 'ADMIN_ACCESS_REQUIRED'
            });
        }

        const { searchTerm } = data;
        if (!searchTerm) {
            throw new HttpsError('invalid-argument', 'Search term is required', {
                code: 'MISSING_SEARCH_TERM'
            });
        }

        // Search users by name or email
        const usersSnapshot = await admin.firestore().collection('users').get();
        const matchingUsers = [];

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            const searchLower = searchTerm.toLowerCase();
            
            if (userData.name && userData.name.toLowerCase().includes(searchLower) ||
                userData.email && userData.email.toLowerCase().includes(searchLower)) {
                matchingUsers.push({
                    id: doc.id,
                    name: userData.name,
                    email: userData.email,
                    plan: userData.plan,
                    subscriptionStatus: userData.subscriptionStatus,
                    authNetSubscriptionId: userData.authNetSubscriptionId,
                    createdAt: userData.createdAt
                });
            }
        });

        logger.info(`Found ${matchingUsers.length} users matching search term: ${searchTerm}`);

        return {
            status: 'success',
            users: matchingUsers
        };

    } catch (error) {
        logger.error("Error in adminSearchUser:", error);

        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to search users', {
            code: 'ADMIN_SEARCH_USER_FAILED'
        });
    }
});

// Update subscription billing date (admin only)
exports.adminUpdateSubscriptionDate = onCall(async (request) => {
    const { data, auth } = request;

    try {
        logger.info("=== ADMIN UPDATE SUBSCRIPTION DATE START ===");

        // Validate authentication and admin status
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        // Verify admin status
        const adminResult = await dbService.getUser(auth.uid);
        if (!adminResult.success || !adminResult.userData.isAdmin) {
            throw new HttpsError('permission-denied', 'Unauthorized: Admin access required', {
                code: 'ADMIN_ACCESS_REQUIRED'
            });
        }

        const { userId, newStartDate } = data;
        if (!userId || !newStartDate) {
            throw new HttpsError('invalid-argument', 'User ID and new start date are required', {
                code: 'MISSING_REQUIRED_FIELDS'
            });
        }

        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(newStartDate)) {
            throw new HttpsError('invalid-argument', 'Date must be in YYYY-MM-DD format', {
                code: 'INVALID_DATE_FORMAT'
            });
        }

        // Get user data
        const userResult = await dbService.getUser(userId);
        if (!userResult.success) {
            throw new HttpsError('not-found', 'User not found', {
                code: 'USER_NOT_FOUND'
            });
        }

        const userData = userResult.userData;
        if (!userData.authNetSubscriptionId) {
            throw new HttpsError('not-found', 'No subscription found for this user', {
                code: 'NO_SUBSCRIPTION_FOUND'
            });
        }

        logger.info(`Updating subscription date for user ${userId} (${userData.email}) to ${newStartDate}`);

        // Cancel current subscription
        const cancelResult = await paymentService.cancelSubscription(userData.authNetSubscriptionId);
        if (!cancelResult.success) {
            throw new HttpsError('failed-precondition', 'Failed to cancel existing subscription', {
                code: 'CANCEL_SUBSCRIPTION_FAILED'
            });
        }

        // Get customer profile for recreation
        const profileResult = await dbService.getCustomerProfile(userId);
        if (!profileResult.success) {
            throw new HttpsError('not-found', 'Customer profile not found', {
                code: 'CUSTOMER_PROFILE_NOT_FOUND'
            });
        }

        // Create new subscription with correct start date
        const subscriptionData = {
            planName: userData.plan,
            planPrice: paymentService.getPlanPrice(userData.plan, profileResult.profileData.billingCycle),
            startDate: newStartDate,
            existingCustomerProfile: {
                customerProfileId: profileResult.profileData.customerProfileId,
                customerPaymentProfileId: profileResult.profileData.customerPaymentProfileId,
                customerAddressId: profileResult.profileData.customerAddressId
            }
        };

        const newSubscriptionResult = await paymentService.createSubscriptionWithDate(subscriptionData);
        if (!newSubscriptionResult.success) {
            throw new HttpsError('failed-precondition', 'Failed to create new subscription with updated date', {
                code: 'CREATE_SUBSCRIPTION_FAILED'
            });
        }

        // Update user record with new subscription ID
        await dbService.updateUserDirectly(userId, {
            authNetSubscriptionId: newSubscriptionResult.subscriptionId,
            subscriptionStatus: 'active',
            subscriptionDateUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            subscriptionDateUpdatedBy: auth.uid
        });

        logger.info(`SUCCESS: Subscription date updated for user ${userId}`);

        return {
            status: 'success',
            message: 'Subscription billing date updated successfully',
            oldSubscriptionId: userData.authNetSubscriptionId,
            newSubscriptionId: newSubscriptionResult.subscriptionId,
            newStartDate: newStartDate
        };

    } catch (error) {
        logger.error("Error in adminUpdateSubscriptionDate:", error);

        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to update subscription date', {
            code: 'ADMIN_UPDATE_SUBSCRIPTION_DATE_FAILED'
        });
    }
});

// ===== BILLING DATE MANAGEMENT =====

// Update billing date for any user by email
exports.updateUserBillingDate = onCall(async (request) => {
    const { data, auth } = request;

    try {
        logger.info("=== UPDATE USER BILLING DATE START ===");

        // Validate authentication and admin status
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        // Verify admin status
        const adminResult = await dbService.getUser(auth.uid);
        if (!adminResult.success || !adminResult.userData.isAdmin) {
            throw new HttpsError('permission-denied', 'Unauthorized: Admin access required', {
                code: 'ADMIN_ACCESS_REQUIRED'
            });
        }

        const { userEmail, newBillingDate } = data;
        if (!userEmail || !newBillingDate) {
            throw new HttpsError('invalid-argument', 'User email and new billing date are required', {
                code: 'MISSING_REQUIRED_FIELDS'
            });
        }

        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(newBillingDate)) {
            throw new HttpsError('invalid-argument', 'Date must be in YYYY-MM-DD format', {
                code: 'INVALID_DATE_FORMAT'
            });
        }

        // Find user by email
        logger.info(`Searching for user with email: ${userEmail}`);
        const userResult = await dbService.getUserByEmail(userEmail);
        if (!userResult.success) {
            throw new HttpsError('not-found', 'User not found with that email address', {
                code: 'USER_NOT_FOUND'
            });
        }

        const user = userResult.userData;
        logger.info(`Found user: ${user.name} (${user.email})`);

        if (!user.authNetSubscriptionId) {
            throw new HttpsError('not-found', 'User does not have an active subscription', {
                code: 'NO_SUBSCRIPTION_FOUND'
            });
        }

        // Get customer profile
        const profileResult = await dbService.getCustomerProfile(user.id);
        if (!profileResult.success) {
            throw new HttpsError('not-found', 'Customer profile not found', {
                code: 'CUSTOMER_PROFILE_NOT_FOUND'
            });
        }

        logger.info(`Current subscription ID: ${user.authNetSubscriptionId}`);
        logger.info('Cancelling current subscription...');

        // Cancel current subscription
        const cancelResult = await paymentService.cancelSubscription(user.authNetSubscriptionId);
        if (!cancelResult.success) {
            throw new HttpsError('failed-precondition', 'Failed to cancel existing subscription', {
                code: 'CANCEL_SUBSCRIPTION_FAILED'
            });
        }

        logger.info(`Creating new subscription with ${newBillingDate} billing date...`);

        // Create new subscription with correct start date
        const subscriptionData = {
            planName: user.plan,
            planPrice: paymentService.getPlanPrice(user.plan, profileResult.profileData.billingCycle),
            startDate: newBillingDate,
            existingCustomerProfile: {
                customerProfileId: profileResult.profileData.customerProfileId,
                customerPaymentProfileId: profileResult.profileData.customerPaymentProfileId,
                customerAddressId: profileResult.profileData.customerAddressId
            }
        };

        const newSubscriptionResult = await paymentService.createSubscriptionWithDate(subscriptionData);
        if (!newSubscriptionResult.success) {
            throw new HttpsError('failed-precondition', 'Failed to create new subscription with updated date', {
                code: 'CREATE_SUBSCRIPTION_FAILED'
            });
        }

        // Update user record with new subscription ID
        await dbService.updateUserDirectly(user.id, {
            authNetSubscriptionId: newSubscriptionResult.subscriptionId,
            subscriptionStatus: 'active',
            subscriptionDateUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            subscriptionDateUpdatedBy: auth.uid,
            oldSubscriptionId: user.authNetSubscriptionId // Keep track of old ID
        });

        logger.info(`SUCCESS: User billing date updated`);

        return {
            status: 'success',
            message: `Billing date successfully updated to ${newBillingDate}`,
            userDetails: {
                name: user.name,
                email: user.email,
                oldSubscriptionId: user.authNetSubscriptionId,
                newSubscriptionId: newSubscriptionResult.subscriptionId,
                newBillingDate: newBillingDate
            }
        };

    } catch (error) {
        logger.error("Error in updateUserBillingDate:", error);

        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to update user billing date', {
            code: 'UPDATE_BILLING_DATE_FAILED'
        });
    }
});

// ===== CATEGORY MANAGEMENT FUNCTIONS =====

// Initialize default categories (one-time setup function)
exports.initializeCategories = onCall(async (request) => {
    const { auth } = request;

    try {
        logger.info("=== INITIALIZE CATEGORIES START ===");

        // Validate authentication and admin status
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        // Verify admin status
        const adminResult = await dbService.getUser(auth.uid);
        if (!adminResult.success || !adminResult.userData.isAdmin) {
            throw new HttpsError('permission-denied', 'Unauthorized: Admin access required', {
                code: 'ADMIN_ACCESS_REQUIRED'
            });
        }

        const defaultCategories = [
            'Investments & Market Concepts',
            'Taxes and Retirement',
            'Economic & Financial Concepts',
            'Market Update',
            'Whitelabel'
        ];

        const categoriesRef = admin.firestore().collection('categories');
        let createdCount = 0;

        for (const categoryName of defaultCategories) {
            // Check if category already exists
            const existingQuery = await categoriesRef.where('name', '==', categoryName).limit(1).get();

            if (existingQuery.empty) {
                // Create new category
                await categoriesRef.add({
                    name: categoryName,
                    description: `Default category for ${categoryName} content`,
                    createdBy: auth.uid,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    contentCount: 0,
                    isActive: true,
                    isDefault: true // Mark as default category
                });
                createdCount++;
                logger.info(`Created default category: ${categoryName}`);
            }
        }

        logger.info(`SUCCESS: Initialized ${createdCount} default categories`);

        return {
            status: 'success',
            message: `Initialized ${createdCount} default categories`,
            categoriesCreated: createdCount
        };

    } catch (error) {
        logger.error("Error in initializeCategories:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to initialize categories', {
            code: 'INITIALIZE_CATEGORIES_FAILED'
        });
    }
});

// Get all categories for dropdown
exports.getCategories = onCall(async (request) => {
    const { auth } = request;

    try {
        logger.info("=== GET CATEGORIES START ===");

        // Validate authentication and admin status
        const authValidation = ValidationUtils.validateAuth(auth);
        if (!authValidation.isValid) {
            throw new HttpsError('unauthenticated', authValidation.error);
        }

        // Verify admin status
        const adminResult = await dbService.getUser(auth.uid);
        if (!adminResult.success || !adminResult.userData.isAdmin) {
            throw new HttpsError('permission-denied', 'Unauthorized: Admin access required', {
                code: 'ADMIN_ACCESS_REQUIRED'
            });
        }

        // Get all active categories (order in code to avoid index requirement)
        const categoriesSnapshot = await admin.firestore()
            .collection('categories')
            .where('isActive', '==', true)
            .get();

        const categories = [];
        categoriesSnapshot.forEach(doc => {
            categories.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Sort categories by name in code instead of using Firestore orderBy
        categories.sort((a, b) => a.name.localeCompare(b.name));

        logger.info(`SUCCESS: Retrieved ${categories.length} categories`);

        return {
            status: 'success',
            categories: categories
        };

    } catch (error) {
        logger.error("Error in getCategories:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to retrieve categories', {
            code: 'GET_CATEGORIES_FAILED'
        });
    }
});
