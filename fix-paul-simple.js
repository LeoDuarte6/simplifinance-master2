// Quick fix for Paul using Firebase CLI
const { exec } = require('child_process');

const fixPaulCommand = `firebase firestore:update users --project simplifinance-65ac9 --force --data '{"billingDate": "2026-06-20", "updatedAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}'`;

console.log('🔧 Fixing Paul\'s billing date...');
console.log('This might take a moment...');

exec('firebase firestore:get users --project simplifinance-65ac9 --where "email==paul.williams@wrcollc.com" --pretty', (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Error finding Paul:', error);
        return;
    }
    
    console.log('📊 Paul\'s current data:');
    console.log(stdout);
    
    // If you see Paul's data above, we can proceed with the update
    console.log('\n🎯 To update Paul\'s billing date, run this command:');
    console.log('\nfirebase firestore:update users/[PAUL_DOC_ID] --project simplifinance-65ac9 --data \'{"billingDate": "2026-06-20"}\'\n');
    console.log('Replace [PAUL_DOC_ID] with Paul\'s document ID from the output above.');
});