// One-time script to fix Paul's billing date
// Run with: node fix-paul-billing.js

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'simplifinance-65ac9'
    });
}

const db = getFirestore();

async function fixPaulBilling() {
    try {
        console.log('🔍 Looking for Paul Williams...');
        
        // Find Paul's user document
        const usersSnapshot = await db.collection('users')
            .where('email', '==', 'paul.williams@wrcollc.com')
            .get();
        
        if (usersSnapshot.empty) {
            console.log('❌ Paul Williams not found');
            return;
        }
        
        const paulDoc = usersSnapshot.docs[0];
        const paulData = paulDoc.data();
        
        console.log('✅ Found Paul:', paulData.name);
        console.log('📅 Current billing info:', {
            currentBillingDate: paulData.billingDate,
            subscriptionId: paulData.subscriptionId
        });
        
        // Update billing date
        await paulDoc.ref.update({
            billingDate: '2026-06-20',
            updatedAt: new Date().toISOString()
        });
        
        console.log('✅ Paul\'s billing date updated to June 20, 2026');
        console.log('🎉 Done! Paul is ready for your client meeting.');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

fixPaulBilling();