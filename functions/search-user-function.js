/**
 * Additional Firebase Function to search users
 * Add this to functions/index.js or create as a separate function
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions");

// Add this function to your functions/index.js
exports.adminSearchUsers = onCall(async (request) => {
    const { data, auth } = request;

    try {
        logger.info("=== ADMIN SEARCH USERS START ===");

        // Validate authentication
        if (!auth || !auth.uid) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        // Verify admin status
        const adminDoc = await admin.firestore().collection('users').doc(auth.uid).get();
        if (!adminDoc.exists || !adminDoc.data().isAdmin) {
            throw new HttpsError('permission-denied', 'Unauthorized: Admin access required', {
                code: 'ADMIN_ACCESS_REQUIRED'
            });
        }

        const { searchTerm, searchType = 'any' } = data;

        if (!searchTerm || searchTerm.trim().length === 0) {
            throw new HttpsError('invalid-argument', 'Search term is required', {
                code: 'MISSING_SEARCH_TERM'
            });
        }

        logger.info(`Admin ${auth.uid} searching for: "${searchTerm}" (type: ${searchType})`);

        // Get all users from Firestore
        const usersSnapshot = await admin.firestore().collection('users').get();
        const users = [];
        const searchTermLower = searchTerm.toLowerCase().trim();

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            let isMatch = false;

            switch (searchType) {
                case 'name':
                    isMatch = userData.name && userData.name.toLowerCase().includes(searchTermLower);
                    break;
                case 'email':
                    isMatch = userData.email && userData.email.toLowerCase().includes(searchTermLower);
                    break;
                case 'exact_email':
                    isMatch = userData.email && userData.email.toLowerCase() === searchTermLower;
                    break;
                case 'subscription_id':
                    isMatch = userData.authNetSubscriptionId && 
                             userData.authNetSubscriptionId.toString().includes(searchTerm);
                    break;
                case 'user_id':
                    isMatch = doc.id.includes(searchTerm);
                    break;
                case 'any':
                default:
                    isMatch = (userData.name && userData.name.toLowerCase().includes(searchTermLower)) ||
                             (userData.email && userData.email.toLowerCase().includes(searchTermLower)) ||
                             (userData.authNetSubscriptionId && userData.authNetSubscriptionId.toString().includes(searchTerm)) ||
                             (doc.id.includes(searchTerm));
                    break;
            }

            if (isMatch) {
                users.push({
                    id: doc.id,
                    name: userData.name,
                    email: userData.email,
                    plan: userData.plan,
                    subscriptionStatus: userData.subscriptionStatus,
                    authNetSubscriptionId: userData.authNetSubscriptionId,
                    customerProfileId: userData.customerProfileId,
                    customerPaymentProfileId: userData.customerPaymentProfileId,
                    isAdmin: userData.isAdmin,
                    isAdvisor: userData.isAdvisor,
                    createdAt: userData.createdAt,
                    billingAddress: userData.billingAddress,
                    // Include other relevant fields as needed
                    lastLoginAt: userData.lastLoginAt,
                    updatedAt: userData.updatedAt
                });
            }
        });

        logger.info(`Search completed: found ${users.length} matching users`);

        return {
            status: 'success',
            users: users,
            count: users.length,
            searchTerm: searchTerm,
            searchType: searchType,
            totalUsers: usersSnapshot.size
        };

    } catch (error) {
        logger.error("Error in adminSearchUsers:", error);

        // If it's already an HttpsError, re-throw it
        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to search users', {
            code: 'USER_SEARCH_FAILED'
        });
    }
});

// Function to get detailed user information including payment data
exports.adminGetUserDetails = onCall(async (request) => {
    const { data, auth } = request;

    try {
        logger.info("=== ADMIN GET USER DETAILS START ===");

        // Validate authentication
        if (!auth || !auth.uid) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        // Verify admin status
        const adminDoc = await admin.firestore().collection('users').doc(auth.uid).get();
        if (!adminDoc.exists || !adminDoc.data().isAdmin) {
            throw new HttpsError('permission-denied', 'Unauthorized: Admin access required');
        }

        const { userId } = data;

        if (!userId) {
            throw new HttpsError('invalid-argument', 'User ID is required');
        }

        // Get user document
        const userDoc = await admin.firestore().collection('users').doc(userId).get();

        if (!userDoc.exists) {
            throw new HttpsError('not-found', 'User not found');
        }

        const userData = userDoc.data();

        // Get user from Firebase Auth for additional details
        let authUserData = null;
        try {
            authUserData = await admin.auth().getUser(userId);
        } catch (authError) {
            logger.warn(`Could not retrieve auth data for user ${userId}:`, authError.message);
        }

        const detailedUserData = {
            id: userId,
            firestoreData: userData,
            authData: authUserData ? {
                uid: authUserData.uid,
                email: authUserData.email,
                emailVerified: authUserData.emailVerified,
                displayName: authUserData.displayName,
                photoURL: authUserData.photoURL,
                phoneNumber: authUserData.phoneNumber,
                disabled: authUserData.disabled,
                creationTime: authUserData.metadata.creationTime,
                lastSignInTime: authUserData.metadata.lastSignInTime,
                lastRefreshTime: authUserData.metadata.lastRefreshTime
            } : null
        };

        logger.info(`Admin ${auth.uid} retrieved details for user ${userId}`);

        return {
            status: 'success',
            user: detailedUserData
        };

    } catch (error) {
        logger.error("Error in adminGetUserDetails:", error);

        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to get user details');
    }
});

// Usage example in client-side code:
/*
// Search for users named Paul
const searchUsers = httpsCallable(functions, 'adminSearchUsers');
const result = await searchUsers({
    searchTerm: 'paul',
    searchType: 'name'  // or 'email', 'any', 'exact_email', 'subscription_id', 'user_id'
});

if (result.data.status === 'success') {
    console.log(`Found ${result.data.count} users:`, result.data.users);
    
    // Get detailed info for each user
    for (const user of result.data.users) {
        const getUserDetails = httpsCallable(functions, 'adminGetUserDetails');
        const details = await getUserDetails({ userId: user.id });
        console.log('Detailed user data:', details.data.user);
    }
}
*/