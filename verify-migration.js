#!/usr/bin/env node

const admin = require('firebase-admin');

// Initialize NEW project to verify migration
admin.initializeApp({
  projectId: 'simplifinancellc-a6795',
  credential: admin.credential.cert('./target-service-account.json')
});

const db = admin.firestore();

async function verifyMigration() {
  try {
    console.log('🔍 Verifying migration to NEW project (a6795)...\n');

    // Check Firestore collections
    console.log('📚 Checking Firestore collections:');

    const collections = ['users', 'content', 'categories'];

    for (const collection of collections) {
      const snapshot = await db.collection(collection).get();
      console.log(`  ✅ ${collection}: ${snapshot.size} documents`);
    }

    // Check users specifically
    console.log('\n👥 Checking user details:');
    const usersSnapshot = await db.collection('users').get();

    usersSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.email || 'No email'}: ${data.subscriptionStatus || 'no subscription'}`);
    });

    // Check Firebase Auth
    console.log('\n🔐 Checking Firebase Authentication:');
    try {
      const listUsersResult = await admin.auth().listUsers();
      console.log(`  ✅ Authentication: ${listUsersResult.users.length} users imported`);

      listUsersResult.users.forEach(user => {
        console.log(`  - ${user.email || 'No email'}: ${user.disabled ? 'disabled' : 'enabled'}`);
      });
    } catch (authError) {
      console.log('  ⚠️  Auth check failed:', authError.message);
    }

    console.log('\n🎉 Migration verification complete!');

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verifyMigration().catch(console.error);