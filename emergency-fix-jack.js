const admin = require('firebase-admin');

async function emergencyFixJack() {
    try {
        admin.initializeApp({
            projectId: 'simplifinance-65ac9'
        });

        console.log('Setting temporary password for jack@keepfinancesimple.com...');

        await admin.auth().updateUser('hpn0zWge2cT5QCUj68fhoAF6GvJ2', {
            password: 'jackisanadmin!!!'
        });

        console.log('✅ Jack can now login with password: jackisanadmin!!!');
        console.log('🔗 Test at: https://simplifinancellc.com/login');

    } catch (error) {
        console.error('Error:', error);
    }
}

emergencyFixJack();