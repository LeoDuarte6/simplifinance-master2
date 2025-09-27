const admin = require('firebase-admin');

// Initialize admin for the OLD project 
admin.initializeApp({
  projectId: 'simplifinance-65ac9'
});

async function createTestUserInOldProject() {
  try {
    console.log('Creating test user in OLD project to extract SCRYPT key...');
    
    const testUser = await admin.auth().createUser({
      email: 'scrypt-test@temp.com',
      password: 'TestPassword123',
      displayName: 'SCRYPT Test User'
    });
    
    console.log('✅ Test user created in OLD project:', testUser.uid);
    console.log('Email: scrypt-test@temp.com');
    console.log('Password: TestPassword123');
    console.log('');
    console.log('Now export this user and we can analyze the exact hash parameters!');
    console.log('Run: firebase auth:export scrypt-test-export.json --project simplifinance-65ac9');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createTestUserInOldProject();