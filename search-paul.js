/**
 * Direct Node.js script to find Paul in Firebase database
 * Run with: node search-paul.js
 * 
 * Prerequisites:
 * 1. Install firebase-admin: npm install firebase-admin
 * 2. Get service account key from Firebase Console
 * 3. Update the path to your service account key below
 */

const admin = require("firebase-admin");

// Option 1: Use service account key file (recommended for production)
// Download from: https://console.firebase.google.com/project/simplifinance-65ac9/settings/serviceaccounts/adminsdk
// const serviceAccount = require("./serviceAccountKey.json");

// Option 2: Use application default credentials (if running on Google Cloud)
// const serviceAccount = null;

// Option 3: Use environment variable
const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS ? 
    JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS) : null;

if (!serviceAccount && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error(`
ERROR: No Firebase Admin credentials provided.

To use this script, you need to:

1. Download service account key:
   - Go to: https://console.firebase.google.com/project/simplifinance-65ac9/settings/serviceaccounts/adminsdk
   - Click "Generate new private key"
   - Save as 'serviceAccountKey.json' in this directory

2. Uncomment the serviceAccount line in this script

3. Or set environment variable:
   export GOOGLE_APPLICATION_CREDENTIALS='{"type":"service_account",...}'

4. Run: node search-paul.js
    `);
    process.exit(1);
}

// Initialize Firebase Admin SDK
try {
    admin.initializeApp({
        credential: serviceAccount ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault(),
        projectId: "simplifinance-65ac9"
    });
    console.log("✅ Firebase Admin SDK initialized successfully");
} catch (error) {
    console.error("❌ Failed to initialize Firebase Admin SDK:", error.message);
    process.exit(1);
}

const db = admin.firestore();

async function searchUsers(searchTerm = 'paul', searchFields = ['name', 'email']) {
    try {
        console.log(`🔍 Searching for users with term: "${searchTerm}"`);
        console.log(`📋 Searching in fields: ${searchFields.join(', ')}`);
        console.log("───────────────────────────────────────");
        
        // Get all users from Firestore
        const usersSnapshot = await db.collection('users').get();
        
        if (usersSnapshot.empty) {
            console.log("⚠️  No users found in database");
            return [];
        }
        
        console.log(`📊 Total users in database: ${usersSnapshot.size}`);
        
        const allUsers = [];
        const matchingUsers = [];
        
        usersSnapshot.forEach(doc => {
            const userData = {
                id: doc.id,
                ...doc.data()
            };
            allUsers.push(userData);
            
            // Check if user matches search criteria
            const isMatch = searchFields.some(field => {
                const fieldValue = userData[field];
                return fieldValue && fieldValue.toLowerCase().includes(searchTerm.toLowerCase());
            });
            
            if (isMatch) {
                matchingUsers.push(userData);
            }
        });
        
        console.log(`🎯 Found ${matchingUsers.length} matching user(s):`);
        console.log("═══════════════════════════════════════");
        
        if (matchingUsers.length === 0) {
            console.log("❌ No users found matching the search criteria");
            
            // Show similar names for debugging
            console.log("\n🔤 All user names in database:");
            allUsers.forEach((user, index) => {
                if (user.name) {
                    console.log(`${index + 1}. ${user.name} (${user.email})`);
                }
            });
        } else {
            matchingUsers.forEach((user, index) => {
                console.log(`\n👤 USER ${index + 1}:`);
                console.log(`   ID: ${user.id}`);
                console.log(`   Name: ${user.name || 'N/A'}`);
                console.log(`   Email: ${user.email || 'N/A'}`);
                console.log(`   Plan: ${user.plan || 'N/A'}`);
                console.log(`   Subscription Status: ${user.subscriptionStatus || 'N/A'}`);
                console.log(`   Auth.Net Subscription ID: ${user.authNetSubscriptionId || 'N/A'}`);
                console.log(`   Customer Profile ID: ${user.customerProfileId || 'N/A'}`);
                console.log(`   Customer Payment Profile ID: ${user.customerPaymentProfileId || 'N/A'}`);
                console.log(`   Is Admin: ${user.isAdmin ? 'Yes' : 'No'}`);
                console.log(`   Is Advisor: ${user.isAdvisor ? 'Yes' : 'No'}`);
                console.log(`   Created: ${user.createdAt ? formatFirestoreDate(user.createdAt) : 'N/A'}`);
                
                if (user.billingAddress) {
                    console.log(`   Billing Address:`);
                    console.log(`     Address: ${user.billingAddress.addressLine1 || ''} ${user.billingAddress.addressLine2 || ''}`.trim());
                    console.log(`     City: ${user.billingAddress.city || 'N/A'}`);
                    console.log(`     State: ${user.billingAddress.state || 'N/A'}`);
                    console.log(`     ZIP: ${user.billingAddress.zipCode || 'N/A'}`);
                    console.log(`     Country: ${user.billingAddress.country || 'N/A'}`);
                }
                
                console.log("───────────────────────────────────────");
            });
        }
        
        return matchingUsers;
        
    } catch (error) {
        console.error("❌ Error searching for users:", error);
        throw error;
    }
}

function formatFirestoreDate(timestamp) {
    if (timestamp && timestamp.seconds) {
        return new Date(timestamp.seconds * 1000).toLocaleString();
    } else if (timestamp && timestamp.toDate) {
        return timestamp.toDate().toLocaleString();
    }
    return 'Invalid Date';
}

async function searchByEmail(email) {
    try {
        console.log(`📧 Searching for user by email: ${email}`);
        
        const userQuery = await db.collection('users')
            .where('email', '==', email)
            .limit(1)
            .get();
            
        if (userQuery.empty) {
            console.log("❌ No user found with that email");
            return null;
        }
        
        const userDoc = userQuery.docs[0];
        const userData = {
            id: userDoc.id,
            ...userDoc.data()
        };
        
        console.log("✅ User found:");
        console.log(JSON.stringify(userData, null, 2));
        
        return userData;
        
    } catch (error) {
        console.error("❌ Error searching by email:", error);
        throw error;
    }
}

// Main execution
async function main() {
    try {
        const args = process.argv.slice(2);
        
        if (args.length > 0 && args[0].includes('@')) {
            // Search by email if argument contains @
            await searchByEmail(args[0]);
        } else {
            // Search by name (default: paul)
            const searchTerm = args[0] || 'paul';
            await searchUsers(searchTerm);
        }
        
    } catch (error) {
        console.error("💥 Script failed:", error);
        process.exit(1);
    } finally {
        console.log("\n🏁 Search completed");
        process.exit(0);
    }
}

// Usage instructions
if (process.argv.length === 2) {
    console.log(`
🔍 FIREBASE USER SEARCH TOOL
═══════════════════════════

Usage:
  node search-paul.js                    # Search for users named "paul"
  node search-paul.js john               # Search for users named "john"  
  node search-paul.js paul@example.com   # Search by exact email

The script will search both name and email fields by default.
`);
}

// Run the script
main();