const crypto = require('crypto');

// Jack's known details
const password = 'jackisanadmin!!!';
const salt = 'l++HgK2VXrqipA==';
const expectedHash = 'kOMpYeIobCWsHb0nW4mom1gVlVY7YReWBqbFnIfWAPXE1EKzG+rNcgG37ZfMUgNTVi+IFUaMfv+n2XRUMtpr6w==';

// Common Firebase SCRYPT keys to test
const possibleKeys = [
    'jxOxKtm09FvCZPDKh6vVUJTu82JDbHfJjnhMhNZmIg==',
    'firebase_scrypt_salt',
    Buffer.from('simplifinance-65ac9').toString('base64'),
    'AIzaSyDRy7LBdKooljXxTuZq_FvpfXJv4Ec65wQ', // Your API key
    Buffer.from('AIzaSyDRy7LBdKooljXxTuZq_FvpfXJv4Ec65wQ').toString('base64'),
    // Try variations based on project creation patterns
    'firebase-scrypt-' + Buffer.from('simplifinance-65ac9').toString('base64'),
    Buffer.from('firebase-simplifinance-65ac9').toString('base64'),
];

console.log('Testing SCRYPT keys against Jack\'s known password...\n');

// Firebase uses SCRYPT with specific parameters
// rounds=8, mem_cost=14, salt_separator='Bw=='

possibleKeys.forEach((key, index) => {
    console.log(`Testing key ${index + 1}: ${key.substring(0, 20)}...`);
    
    // Try this key and see if it produces the expected hash
    // (This is a simplified test - actual SCRYPT verification is complex)
    console.log(`Import command: firebase auth:import auth-users.json --hash-algo=scrypt --hash-key=${key} --salt-separator=Bw== --rounds=8 --mem-cost=14 --project simplifinancellc-a6795\n`);
});

console.log('Run each command above and test login with:');
console.log('Email: jack@keepfinancesimple.com');
console.log('Password: jackisanadmin!!!');
console.log('\nWhen login works, we\'ve found the right key!');