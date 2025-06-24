// Quick manual fix for Paul's data
const admin = require('firebase-admin');

// Initialize Firebase Admin (use your existing project)
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'simplifinance-65ac9'
    });
}

const db = admin.firestore();

async function fixPaulData() {
    try {
        console.log('🔍 Finding Paul Williams...');
        
        // Find Paul's document
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', 'paul.williams@wrcollc.com').get();
        
        if (snapshot.empty) {
            console.log('❌ Paul not found');
            return;
        }
        
        const paulDoc = snapshot.docs[0];
        console.log('✅ Found Paul:', paulDoc.data().name);
        
        // Update Paul's data with corrected billing info
        await paulDoc.ref.update({
            billingDate: '2026-06-20',
            subscriptionStatus: 'active',
            notes: 'Billing date corrected for client demo',
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ Paul\'s billing date updated to June 20, 2026');
        console.log('🎉 Ready for client meeting!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
    
    process.exit(0);
}

fixPaulData();