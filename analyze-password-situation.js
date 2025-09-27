const fs = require('fs');

// Read current auth status
const currentUsers = JSON.parse(fs.readFileSync('current-auth-status.json', 'utf8')).users;

// Read backup
const backupUsers = JSON.parse(fs.readFileSync('auth-users-with-hash.json', 'utf8')).users;

console.log('=== PASSWORD ANALYSIS ===\n');

console.log('USERS WITH PASSWORDS (current):');
currentUsers.forEach(user => {
    if (user.passwordHash) {
        console.log(`✅ ${user.email} - HAS password`);
    }
});

console.log('\nUSERS WITHOUT PASSWORDS (current):');
currentUsers.forEach(user => {
    if (!user.passwordHash && !user.disabled) {
        console.log(`❌ ${user.email} - MISSING password`);
    }
});

console.log('\nUSERS IN BACKUP WITH PASSWORDS:');
backupUsers.forEach(user => {
    if (user.passwordHash) {
        console.log(`📁 ${user.email} - backup available`);
    }
});

console.log('\nUSERS MISSING FROM BACKUP (created after June):');
currentUsers.forEach(user => {
    if (!user.passwordHash && !user.disabled) {
        const inBackup = backupUsers.find(bu => bu.email === user.email);
        if (!inBackup) {
            console.log(`🆕 ${user.email} - CREATED AFTER JUNE, no backup`);
        }
    }
});

console.log('\nSUMMARY:');
console.log(`Total users: ${currentUsers.length}`);
console.log(`Users with passwords: ${currentUsers.filter(u => u.passwordHash).length}`);
console.log(`Users missing passwords: ${currentUsers.filter(u => !u.passwordHash && !u.disabled).length}`);
console.log(`Users in backup: ${backupUsers.length}`);