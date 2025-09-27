const admin = require('firebase-admin');

// Initialize Firebase Admin SDK for the new project
admin.initializeApp({
  projectId: 'simplifinancellc-a6795'
});

const auth = admin.auth();
const db = admin.firestore();

async function createTestAdmin() {
  try {
    console.log('Creating test admin user...');
    
    // Create the authentication user
    const userRecord = await auth.createUser({
      email: 'test-admin@simplifinance.com',
      password: 'TestPassword123!',
      displayName: 'Test Admin User',
      emailVerified: true
    });
    
    console.log('✅ Auth user created:', userRecord.uid);
    
    // Create the Firestore user document with admin privileges
    const userData = {
      email: 'test-admin@simplifinance.com',
      displayName: 'Test Admin User',
      isAdmin: true,
      plan: 'premium',
      subscriptionStatus: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('users').doc(userRecord.uid).set(userData);
    
    console.log('✅ Firestore user document created with admin privileges');
    console.log('');
    console.log('🎉 TEST ADMIN ACCOUNT CREATED:');
    console.log('Email: test-admin@simplifinance.com');
    console.log('Password: TestPassword123!');
    console.log('');
    console.log('You can now test login at: https://simplifinancellc-a6795.web.app/login');
    
  } catch (error) {
    console.error('❌ Error creating test admin:', error);
  }
}

createTestAdmin();