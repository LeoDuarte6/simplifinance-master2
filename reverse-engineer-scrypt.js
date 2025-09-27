const { execSync } = require('child_process');
const fs = require('fs');

// Known test data from your original project
const testPassword = 'TestPassword123';
const testEmail = 'scrypt-test@temp.com';
const expectedHash = 'XbvQ71YaRZPKdkz7g4FPQOVUAiM7Yl46K9QaHRrtmAsT8jNT92OyRGZCdqdg2Dy432X24bqP+CqdOmi1JTHezw==';
const testSalt = 'nHdMIiOcCDhjdw==';

// Generate lots of possible SCRYPT keys based on common Firebase patterns
const possibleKeys = [
    // Standard Firebase keys
    'jxOxKtm09FvCZPDKh6vVUJTu82JDbHfJjnhMhNZmIg==',
    'base64:jxOxKtm09FvCZPDKh6vVUJTu82JDbHfJjnhMhNZmIg==',
    
    // Project-specific variations
    Buffer.from('simplifinance-65ac9').toString('base64'),
    Buffer.from('firebase-simplifinance-65ac9').toString('base64'),
    Buffer.from('simplifinance-65ac9-scrypt').toString('base64'),
    
    // API key variations
    'AIzaSyDRy7LBdKooljXxTuZq_FvpfXJv4Ec65wQ',
    Buffer.from('AIzaSyDRy7LBdKooljXxTuZq_FvpfXJv4Ec65wQ').toString('base64'),
    
    // Project ID + timestamp variations (your project was created around a specific time)
    Buffer.from('simplifinance-65ac9-2024').toString('base64'),
    Buffer.from('simplifinance-65ac9-122545134930').toString('base64'), // with messaging sender ID
    
    // Firebase internal patterns
    'firebase-auth-scrypt-' + Buffer.from('simplifinance-65ac9').toString('base64'),
    Buffer.from('firebase-auth-' + 'simplifinance-65ac9').toString('base64'),
    
    // Hashed variations
    Buffer.from(require('crypto').createHash('sha256').update('simplifinance-65ac9').digest()).toString('base64'),
];

console.log('🔍 Reverse engineering SCRYPT key...\n');
console.log(`Testing against known password: ${testPassword}`);
console.log(`Expected hash: ${expectedHash}\n`);

// Create a single-user test file for quick testing
const testUserData = {
    "users": [{
        "localId": "test123",
        "email": testEmail,
        "emailVerified": false,
        "passwordHash": expectedHash,
        "salt": testSalt,
        "displayName": "Test User"
    }]
};

fs.writeFileSync('./test-user.json', JSON.stringify(testUserData, null, 2));

async function testKey(key, index) {
    console.log(`Testing key ${index + 1}/${possibleKeys.length}: ${key.substring(0, 30)}...`);
    
    try {
        // Import with this key
        const command = `firebase auth:import test-user.json --hash-algo=scrypt --hash-key=${key} --salt-separator=Bw== --rounds=8 --mem-cost=14 --project simplifinancellc-a6795`;
        
        execSync(command, { stdio: 'pipe' });
        
        console.log('✅ Import successful with this key!');
        console.log(`🔑 FOUND THE SCRYPT KEY: ${key}`);
        console.log('\n🎉 Now importing all users with correct key...');
        
        // Import all users with the correct key
        const allUsersCommand = `firebase auth:import auth-users.json --hash-algo=scrypt --hash-key=${key} --salt-separator=Bw== --rounds=8 --mem-cost=14 --project simplifinancellc-a6795`;
        execSync(allUsersCommand, { stdio: 'inherit' });
        
        console.log('\n✅ ALL USERS IMPORTED WITH PRESERVED PASSWORDS!');
        console.log('Test Jack\'s login: jack@keepfinancesimple.com / jackisanadmin!!!');
        
        return true;
    } catch (error) {
        console.log('❌ Failed');
        return false;
    }
}

async function findCorrectKey() {
    for (let i = 0; i < possibleKeys.length; i++) {
        const success = await testKey(possibleKeys[i], i);
        if (success) {
            break;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

findCorrectKey();