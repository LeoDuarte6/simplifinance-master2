const admin = require('firebase-admin');
const fs = require('fs');

// Initialize only the target project with service account
const targetApp = admin.initializeApp({
  projectId: 'simplifinancellc-a6795',
  credential: admin.credential.cert('./target-service-account.json')
}, 'target');

const targetDb = admin.firestore(targetApp);

// We'll export data from source using Firebase CLI, then import here
async function importFromExportedData() {
  try {
    // Read the exported data file
    const exportedData = JSON.parse(fs.readFileSync('./firestore-export.json', 'utf8'));
    
    console.log('📥 Importing data to new project...');
    
    for (const [collectionName, documents] of Object.entries(exportedData)) {
      console.log(`Importing collection: ${collectionName}`);
      
      const batch = targetDb.batch();
      let batchCount = 0;
      
      for (const [docId, docData] of Object.entries(documents)) {
        const docRef = targetDb.collection(collectionName).doc(docId);
        batch.set(docRef, docData);
        batchCount++;
        
        // Firestore batch limit is 500 operations
        if (batchCount === 500) {
          await batch.commit();
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
      }
      
      console.log(`✅ Imported ${Object.keys(documents).length} documents to ${collectionName}`);
    }
    
    console.log('🎉 Data import completed!');
  } catch (error) {
    console.error('❌ Import failed:', error);
  }
}

// Export authentication users to be imported manually
async function importAuthUsers() {
  try {
    const users = JSON.parse(fs.readFileSync('./users-export.json', 'utf8'));
    console.log(`📥 Found ${users.length} users to import`);
    
    // Note: You'll need to import these manually via Firebase Console
    // Auth import requires special permissions
    console.log('ℹ️  Import these users manually via Firebase Console → Authentication → Users → Import');
    
  } catch (error) {
    console.error('❌ Auth users file not found:', error);
  }
}

importFromExportedData();
importAuthUsers();