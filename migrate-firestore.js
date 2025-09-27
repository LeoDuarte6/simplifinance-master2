const admin = require('firebase-admin');
const fs = require('fs');

// Source project configuration (your current project)
const sourceConfig = {
  projectId: 'simplifinance-65ac9',
  credential: admin.credential.applicationDefault()
};

// Target project configuration (your client's new project)  
const targetConfig = {
  projectId: 'simplifinancellc-a6795',
  credential: admin.credential.cert('./target-service-account.json')
};

const sourceApp = admin.initializeApp(sourceConfig, 'source');
const targetApp = admin.initializeApp(targetConfig, 'target');

const sourceDb = admin.firestore(sourceApp);
const targetDb = admin.firestore(targetApp);

async function migrateCollection(collectionName) {
  console.log(`Migrating collection: ${collectionName}`);
  
  const snapshot = await sourceDb.collection(collectionName).get();
  const batch = targetDb.batch();
  
  snapshot.docs.forEach(doc => {
    const docRef = targetDb.collection(collectionName).doc(doc.id);
    batch.set(docRef, doc.data());
  });
  
  await batch.commit();
  console.log(`✅ Migrated ${snapshot.size} documents from ${collectionName}`);
}

async function migrateAllData() {
  try {
    // Get all collections from source
    const collections = await sourceDb.listCollections();
    
    for (const collection of collections) {
      await migrateCollection(collection.id);
    }
    
    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Export user authentication data
async function exportAuthUsers() {
  console.log('Exporting user authentication data...');
  
  try {
    const listUsers = await admin.auth(sourceApp).listUsers();
    const users = listUsers.users.map(user => ({
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      disabled: user.disabled,
      metadata: user.metadata,
      customClaims: user.customClaims,
      providerData: user.providerData
    }));
    
    fs.writeFileSync('./users-export.json', JSON.stringify(users, null, 2));
    console.log(`✅ Exported ${users.length} users to users-export.json`);
  } catch (error) {
    console.error('❌ Auth export failed:', error);
  }
}

// Run migration
async function main() {
  console.log('🚀 Starting Firebase migration...');
  await exportAuthUsers();
  await migrateAllData();
}

main().catch(console.error);