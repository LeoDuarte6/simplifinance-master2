#!/usr/bin/env node

const admin = require('firebase-admin');

// Initialize Firebase Admin for OLD project (current production)
admin.initializeApp({
  projectId: 'simplifinance-65ac9',
  storageBucket: 'simplifinance-65ac9.firebasestorage.app'
});

const db = admin.firestore();

async function checkData() {
  try {
    console.log('🔍 Checking OLD production project (65ac9) data...');

    // Check library collection
    console.log('\n📚 Checking library collection:');
    const librarySnapshot = await db.collection('library').limit(5).get();
    console.log(`Found ${librarySnapshot.size} library items`);

    if (!librarySnapshot.empty) {
      librarySnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- ${doc.id}: ${data.title || 'No title'} (${data.downloadUrl ? 'has URL' : 'NO URL'})`);
      });
    }

    // Check users collection
    console.log('\n👥 Checking users collection:');
    const usersSnapshot = await db.collection('users').limit(3).get();
    console.log(`Found ${usersSnapshot.size} users`);

    if (!usersSnapshot.empty) {
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- ${doc.id}: ${data.email || 'No email'} (sub: ${data.subscriptionStatus || 'none'})`);
      });
    }

    console.log('\n✅ Data check complete');

  } catch (error) {
    console.error('❌ Error checking data:', error);
  }
}

checkData().catch(console.error);