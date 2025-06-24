/**
 * Script to find a user named Paul in the Firebase database
 * This script provides multiple methods to search for users by name
 * 
 * Usage:
 * 1. Via Admin Dashboard (Web Interface)
 * 2. Via Firebase Functions (Server-side)
 * 3. Via Firebase CLI (Command line)
 * 4. Via Firebase Admin SDK (Node.js script)
 */

// Method 1: Web Interface Search (for use in browser console)
const findPaulViaWebInterface = async () => {
    console.log("Method 1: Using Web Interface Admin Functions");
    
    try {
        // This assumes you're logged in as an admin user on the web interface
        if (typeof firebase === 'undefined' || !window.simpliFinanceApp) {
            throw new Error("Firebase not initialized or not logged in to admin interface");
        }
        
        const { httpsCallable } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js");
        const adminGetAllUsers = httpsCallable(window.simpliFinanceApp.functions, 'adminGetAllUsers');
        
        const result = await adminGetAllUsers();
        
        if (result.data.status === 'success') {
            const users = result.data.users;
            
            // Search for users named Paul (case-insensitive)
            const paulUsers = users.filter(user => 
                user.name && user.name.toLowerCase().includes('paul')
            );
            
            console.log(`Found ${paulUsers.length} user(s) with 'Paul' in their name:`);
            paulUsers.forEach(user => {
                console.log(`
                User ID: ${user.id}
                Name: ${user.name}
                Email: ${user.email}
                Plan: ${user.plan}
                Subscription Status: ${user.subscriptionStatus}
                Subscription ID: ${user.authNetSubscriptionId}
                Is Admin: ${user.isAdmin}
                Is Advisor: ${user.isAdvisor}
                Created: ${user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                `);
            });
            
            return paulUsers;
        } else {
            throw new Error("Failed to retrieve users");
        }
    } catch (error) {
        console.error("Error finding Paul via web interface:", error);
        return null;
    }
};

// Method 2: Firebase Admin SDK Script (for Node.js)
const createNodeSearchScript = () => {
    return `
// Firebase Admin SDK Search Script
// Save this as search-paul.js and run with: node search-paul.js

const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
const serviceAccount = require("./path/to/your/serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "simplifinance-65ac9"
});

const db = admin.firestore();

async function findPaulUsers() {
    try {
        console.log("Searching for users named Paul...");
        
        // Get all users from Firestore
        const usersSnapshot = await db.collection('users').get();
        
        const allUsers = [];
        usersSnapshot.forEach(doc => {
            allUsers.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Filter for Paul
        const paulUsers = allUsers.filter(user => 
            user.name && user.name.toLowerCase().includes('paul')
        );
        
        console.log(\`Found \${paulUsers.length} user(s) with 'Paul' in their name:\`);
        
        paulUsers.forEach(user => {
            console.log(\`
            User ID: \${user.id}
            Name: \${user.name}
            Email: \${user.email}
            Plan: \${user.plan}
            Subscription Status: \${user.subscriptionStatus}
            Auth.Net Subscription ID: \${user.authNetSubscriptionId}
            Customer Profile ID: \${user.customerProfileId}
            Is Admin: \${user.isAdmin}
            Is Advisor: \${user.isAdvisor}
            Created: \${user.createdAt ? user.createdAt.toDate() : 'N/A'}
            Billing Address: \${JSON.stringify(user.billingAddress, null, 2)}
            \`);
        });
        
        return paulUsers;
    } catch (error) {
        console.error("Error searching for Paul:", error);
    }
}

// Run the search
findPaulUsers().then(() => {
    console.log("Search completed");
    process.exit(0);
}).catch(error => {
    console.error("Script failed:", error);
    process.exit(1);
});
`;
};

// Method 3: Firebase CLI Commands
const getFirebaseCliCommands = () => {
    return `
# Firebase CLI Commands to find Paul

# 1. First, login and set project
firebase login
firebase use simplifinance-65ac9

# 2. Export all users data to JSON
firebase firestore:export ./firestore-export

# 3. Use firestore emulator to query (requires emulator setup)
firebase emulators:start --only firestore

# 4. Direct firestore query (if you have access)
# Create a temporary script and run via firebase functions:shell

# 5. Alternative: Use Firebase Console
# Go to: https://console.firebase.google.com/project/simplifinance-65ac9/firestore/data
# Navigate to users collection and search manually
`;
};

// Method 4: Enhanced Database Service Function
const createEnhancedDatabaseService = () => {
    return `
// Enhanced Database Service with User Search
// Add this method to functions/services/database.js

async getUsersByName(searchTerm, adminUserId) {
    try {
        // Verify admin user
        const adminDoc = await this.firestore.collection("users").doc(adminUserId).get();
        if (!adminDoc.exists || !adminDoc.data().isAdmin) {
            throw new Error('Unauthorized: Admin access required');
        }

        const usersSnapshot = await this.firestore.collection("users").get();
        const users = [];

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            // Case-insensitive search in name field
            if (userData.name && userData.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                users.push({
                    id: doc.id,
                    ...userData
                });
            }
        });

        return {
            success: true,
            users: users,
            count: users.length
        };
    } catch (error) {
        logger.error('Error searching users by name:', error);
        throw error;
    }
}

async getUserByEmail(email, adminUserId) {
    try {
        // Verify admin user
        const adminDoc = await this.firestore.collection("users").doc(adminUserId).get();
        if (!adminDoc.exists || !adminDoc.data().isAdmin) {
            throw new Error('Unauthorized: Admin access required');
        }

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
`;
};

// Method 5: New Cloud Function to Search Users
const createSearchUserFunction = () => {
    return `
// Add this to functions/index.js

exports.adminSearchUsers = onCall(async (request) => {
    const { data, auth } = request;

    try {
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

        const { searchTerm, searchType } = data;

        if (!searchTerm) {
            throw new HttpsError('invalid-argument', 'Search term is required', {
                code: 'MISSING_SEARCH_TERM'
            });
        }

        const usersSnapshot = await admin.firestore().collection('users').get();
        const users = [];

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            let isMatch = false;

            switch (searchType) {
                case 'name':
                    isMatch = userData.name && userData.name.toLowerCase().includes(searchTerm.toLowerCase());
                    break;
                case 'email':
                    isMatch = userData.email && userData.email.toLowerCase().includes(searchTerm.toLowerCase());
                    break;
                case 'any':
                default:
                    isMatch = (userData.name && userData.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                             (userData.email && userData.email.toLowerCase().includes(searchTerm.toLowerCase()));
                    break;
            }

            if (isMatch) {
                users.push({
                    id: doc.id,
                    ...userData
                });
            }
        });

        logger.info(\`Admin \${auth.uid} searched for users with term: \${searchTerm}\`);

        return {
            status: 'success',
            users: users,
            count: users.length,
            searchTerm: searchTerm,
            searchType: searchType || 'any'
        };

    } catch (error) {
        logger.error("Error in adminSearchUsers:", error);

        if (error.code && error.message) {
            throw error;
        }

        throw new HttpsError('internal', error.message || 'Failed to search users', {
            code: 'USER_SEARCH_FAILED'
        });
    }
});
`;
};

// Main execution and instructions
console.log(`
=== FINDING USER PAUL IN FIREBASE DATABASE ===

Based on the SimpliFinance codebase analysis, here are multiple methods to find Paul:

PROJECT DETAILS:
- Firebase Project ID: simplifinance-65ac9
- Admin Email: admin@simplifinance.com
- Database: Cloud Firestore
- Functions: Firebase Cloud Functions

METHODS TO FIND PAUL:

1. ADMIN WEB INTERFACE (Easiest if you have admin access):
   - Login to https://simplifinance-65ac9.web.app/admin
   - Use admin credentials
   - Go to "User Management" tab
   - All users are loaded automatically - search for Paul in the list

2. BROWSER CONSOLE (If logged in as admin):
   - Press F12 to open developer tools
   - Go to Console tab
   - Run: findPaulViaWebInterface()

3. FIREBASE CONSOLE (Direct database access):
   - Go to: https://console.firebase.google.com/project/simplifinance-65ac9/firestore/data
   - Navigate to 'users' collection
   - Manually browse or use filters

4. FIREBASE CLI (Command line):
   ${getFirebaseCliCommands()}

5. NODE.JS SCRIPT (Most comprehensive):
   ${createNodeSearchScript()}

6. ADD SEARCH FUNCTION (Enhancement):
   ${createSearchUserFunction()}

EXISTING ADMIN FUNCTIONS YOU CAN USE:
- adminGetAllUsers: Gets all users (requires admin auth)
- getUserProfile: Gets specific user data
- adminCreateUser: Create new users
- adminUpdateUserRole: Update user permissions

CURRENT ADMIN SETUP:
- Admin users are identified by isAdmin: true in user document
- Admin email is set to: admin@simplifinance.com
- Admin functions are protected by authentication checks

SUBSCRIPTION & BILLING DATA LOCATION:
Users have these relevant fields:
- authNetSubscriptionId: Authorize.Net subscription ID
- subscriptionStatus: active/cancelled/etc
- plan: user's subscription plan
- customerProfileId: Authorize.Net customer profile
- billingAddress: billing information
- isAdvisor: advisor status
`);

// Export for use in browser
if (typeof window !== 'undefined') {
    window.findPaulViaWebInterface = findPaulViaWebInterface;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        findPaulViaWebInterface,
        createNodeSearchScript,
        getFirebaseCliCommands,
        createEnhancedDatabaseService,
        createSearchUserFunction
    };
}