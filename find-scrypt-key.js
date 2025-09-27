const { execSync } = require('child_process');

// Common Firebase SCRYPT keys to try
const scryptKeys = [
    "jxOxKtm09FvCZPDKh6vVUJTu82JDbHfJjnhMhNZmIg==", // Standard Firebase
    "firebase_scrypt_salt", // Alternative
    "simplifinance-65ac9", // Project-based
    "AIzaSyDRy7LBdKooljXxTuZq_FvpfXJv4Ec65wQ", // API key based
    "base64:jxOxKtm09FvCZPDKh6vVUJTu82JDbHfJjnhMhNZmIg==",
    // Firebase's default SCRYPT configuration varies by project creation date
    "jxOxKtm09FvCZPDKh6vVUJT82JDbHfJjnhMhNZmIg==",
    "bW9iaWxlX2ZpcmViYXNlX3NjcnlwdA==", // mobile_firebase_scrypt base64
];

console.log('Trying different SCRYPT keys for password migration...\n');

scryptKeys.forEach((key, index) => {
    console.log(`Option ${index + 1}:`);
    console.log(`firebase auth:import auth-users.json --hash-algo=scrypt --hash-key=${key} --salt-separator=Bw== --rounds=8 --mem-cost=14 --project simplifinancellc-a6795\n`);
});

console.log('Try each one until login works with jack@keepfinancesimple.com');
console.log('If none work, we need to extract the exact key from the original project.');