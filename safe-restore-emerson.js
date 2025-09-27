const fs = require('fs');

// Create a single-user import file for just Emerson
const backupUsers = JSON.parse(fs.readFileSync('auth-users-with-hash.json', 'utf8')).users;

const emersonBackup = backupUsers.find(user => user.email === 'emerson@keepfinancesimple.com');

if (emersonBackup) {
    const emersonOnly = {
        users: [emersonBackup]
    };

    fs.writeFileSync('emerson-restore.json', JSON.stringify(emersonOnly, null, 2));
    console.log('✅ Created emerson-restore.json with Emerson\'s password hash');
    console.log('Password hash:', emersonBackup.passwordHash.substring(0, 20) + '...');
    console.log('Salt:', emersonBackup.salt);
} else {
    console.log('❌ Emerson not found in backup');
}