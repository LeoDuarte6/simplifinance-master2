const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'simplifinancellc-a6795'
});

async function deleteAllUsers() {
  try {
    console.log('🗑️  Deleting all users from new project...');
    
    const listUsers = await admin.auth().listUsers();
    
    for (const user of listUsers.users) {
      await admin.auth().deleteUser(user.uid);
      console.log(`Deleted: ${user.email || user.uid}`);
    }
    
    console.log('✅ All users deleted');
    console.log('Now run: firebase auth:import auth-users.json --hash-algo=scrypt --hash-key=jxOxKtm09FvCZPDKh6vVUJTu82JDbHfJjnhMhNZmIg== --salt-separator=Bw== --rounds=8 --mem-cost=14 --project simplifinancellc-a6795');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

deleteAllUsers();