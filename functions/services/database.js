const admin = require("firebase-admin");
const { logger } = require("firebase-functions");

class DatabaseService {
    constructor() {
        this.firestore = admin.firestore();
    }

    async createUser(userId, userData) {
        try {
            logger.info(`Creating user document for UID: ${userId}`);

            const userDoc = {
                name: userData.name,
                email: userData.email,
                plan: userData.plan,
                authNetSubscriptionId: userData.subscriptionId,
                subscriptionStatus: "active",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                isAdvisor: userData.isAdvisor || false,
                isAdmin: (userData.email === "admin@simplifinance.com"),
                billingAddress: userData.billingAddress || null
            };

            await this.firestore.collection("users").doc(userId).set(userDoc);
            logger.info(`SUCCESS: User data saved to Firestore for UID: ${userId}`);

            return { success: true };
        } catch (error) {
            logger.error('Error creating user document:', error);
            throw new Error('Failed to save user data to database');
        }
    }

    async storeCustomerProfile(userId, profileData) {
        try {
            const { customerProfileId, customerPaymentProfileId, customerAddressId, planName, billingCycle } = profileData;

            // Store customer profile info directly in the user document
            // Ensure all IDs are strings to prevent Firestore validation errors
            const customerProfileInfo = {
                customerProfileId: String(customerProfileId),
                customerPaymentProfileId: String(customerPaymentProfileId),
                customerAddressId: String(customerAddressId),
                billingCycle: String(billingCycle || 'monthly'),
                customerProfileCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
                customerProfileIsActive: true
            };

            logger.info('Storing customer profile with data:', {
                customerProfileId: customerProfileInfo.customerProfileId,
                customerPaymentProfileId: customerProfileInfo.customerPaymentProfileId,
                customerAddressId: customerProfileInfo.customerAddressId,
                planName: planName,
                billingCycle: customerProfileInfo.billingCycle
            });

            // Update the user document with customer profile information
            await this.firestore.collection("users").doc(userId).update(customerProfileInfo);
            logger.info(`Customer profile stored in user document for user ${userId}`);

            return { success: true };
        } catch (error) {
            logger.error('Error storing customer profile:', error);
            throw new Error('Failed to store customer profile');
        }
    }

    async getCustomerProfile(userId) {
        try {
            const userDoc = await this.firestore.collection("users").doc(userId).get();

            if (userDoc.exists) {
                const userData = userDoc.data();

                // Check if customer profile data exists in the user document
                if (userData.customerProfileId && userData.customerPaymentProfileId && userData.customerAddressId) {
                    const profileData = {
                        customerProfileId: userData.customerProfileId,
                        customerPaymentProfileId: userData.customerPaymentProfileId,
                        customerAddressId: userData.customerAddressId,
                        billingCycle: userData.billingCycle || 'monthly',
                        planName: userData.plan,
                        createdAt: userData.customerProfileCreatedAt,
                        isActive: userData.customerProfileIsActive
                    };

                    logger.info(`Customer profile retrieved from user document for user ${userId}`);
                    return {
                        success: true,
                        profileData: profileData
                    };
                } else {
                    logger.info(`No customer profile found in user document for user ${userId}`);
                    return {
                        success: false,
                        message: 'No customer profile found'
                    };
                }
            } else {
                logger.info(`User document not found for user ${userId}`);
                return {
                    success: false,
                    message: 'User not found'
                };
            }
        } catch (error) {
            logger.error('Error retrieving customer profile:', error);
            throw new Error('Failed to retrieve customer profile');
        }
    }

    async updateCustomerProfile(userId, updates) {
        try {
            // Prefix customer profile fields to avoid conflicts with user fields
            const customerProfileUpdates = {};
            Object.keys(updates).forEach(key => {
                if (['customerProfileId', 'customerPaymentProfileId', 'customerAddressId', 'billingCycle', 'customerProfileIsActive'].includes(key)) {
                    customerProfileUpdates[key] = updates[key];
                }
            });

            customerProfileUpdates.customerProfileUpdatedAt = admin.firestore.FieldValue.serverTimestamp();

            await this.firestore.collection("users").doc(userId).update(customerProfileUpdates);
            logger.info(`Customer profile updated in user document for user ${userId}`);

            return { success: true };
        } catch (error) {
            logger.error('Error updating customer profile:', error);
            throw new Error('Failed to update customer profile');
        }
    }

    async getUser(userId) {
        try {
            const userDoc = await this.firestore.collection("users").doc(userId).get();

            if (userDoc.exists) {
                return {
                    success: true,
                    userData: userDoc.data()
                };
            } else {
                return {
                    success: false,
                    message: 'User not found'
                };
            }
        } catch (error) {
            logger.error('Error getting user:', error);
            throw new Error('Failed to retrieve user data');
        }
    }

    async updateUser(userId, updates) {
        try {
            // Sanitize updates to prevent modification of protected fields
            const allowedFields = ['name', 'isAdvisor', 'billingAddress'];
            const sanitizedUpdates = {};

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    sanitizedUpdates[key] = value;
                }
            }

            if (Object.keys(sanitizedUpdates).length === 0) {
                throw new Error('No valid fields to update');
            }

            sanitizedUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            await this.firestore.collection("users").doc(userId).update(sanitizedUpdates);
            logger.info(`User ${userId} updated successfully`);

            return { success: true };
        } catch (error) {
            logger.error('Error updating user:', error);
            throw new Error('Failed to update user data');
        }
    }

    async updateUserDirectly(userId, updates) {
        try {
            // Direct update method for internal use (like restart subscription)
            // Does not sanitize fields, so use carefully
            updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            await this.firestore.collection("users").doc(userId).update(updates);
            logger.info(`User ${userId} updated directly`);

            return { success: true };
        } catch (error) {
            logger.error('Error updating user directly:', error);
            throw new Error('Failed to update user data');
        }
    }

    async cancelUserSubscription(userId) {
        try {
            const updates = {
                subscriptionStatus: "cancelled",
                cancelledAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await this.firestore.collection("users").doc(userId).update(updates);
            logger.info(`User ${userId} subscription cancelled in database`);

            return { success: true };
        } catch (error) {
            logger.error('Error cancelling user subscription:', error);
            throw new Error('Failed to update subscription status');
        }
    }

    async getAllUsers(adminUserId) {
        try {
            // Verify admin user
            const adminDoc = await this.firestore.collection("users").doc(adminUserId).get();
            if (!adminDoc.exists || !adminDoc.data().isAdmin) {
                throw new Error('Unauthorized: Admin access required');
            }

            const usersSnapshot = await this.firestore.collection("users").get();
            const users = [];

            usersSnapshot.forEach(doc => {
                users.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return {
                success: true,
                users: users
            };
        } catch (error) {
            logger.error('Error getting all users:', error);
            throw error;
        }
    }

    async createUserDirectly(userId, userData) {
        try {
            logger.info(`Creating user document directly for UID: ${userId}`);

            const userDoc = {
                ...userData,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await this.firestore.collection("users").doc(userId).set(userDoc);
            logger.info(`SUCCESS: User data saved directly to Firestore for UID: ${userId}`);

            return { success: true };
        } catch (error) {
            logger.error('Error creating user document directly:', error);
            throw new Error('Failed to save user data to database');
        }
    }

    async getUserByEmail(email) {
        try {
            const usersSnapshot = await this.firestore.collection("users")
                .where("email", "==", email)
                .limit(1)
                .get();

            if (usersSnapshot.empty) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }

            const userDoc = usersSnapshot.docs[0];
            return {
                success: true,
                userData: {
                    id: userDoc.id,
                    ...userDoc.data()
                }
            };
        } catch (error) {
            logger.error('Error getting user by email:', error);
            throw new Error('Failed to retrieve user data');
        }
    }
}

module.exports = DatabaseService;