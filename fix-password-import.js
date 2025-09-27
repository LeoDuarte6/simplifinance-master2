#!/usr/bin/env node

const admin = require('firebase-admin');

// Initialize NEW project
admin.initializeApp({
  credential: admin.credential.cert('./target-service-account.json')
});

async function deleteAllUsers() {
  try {
    console.log('🗑️  Deleting all existing users from NEW project...');

    const listUsersResult = await admin.auth().listUsers();
    console.log(`Found ${listUsersResult.users.length} users to delete`);

    for (const user of listUsersResult.users) {
      await admin.auth().deleteUser(user.uid);
      console.log(`  ✅ Deleted: ${user.email || user.uid}`);
    }

    console.log('✅ All users deleted. Ready for re-import with correct parameters.');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

deleteAllUsers().catch(console.error);