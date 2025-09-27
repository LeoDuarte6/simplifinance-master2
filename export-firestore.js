const admin = require('firebase-admin');
const fs = require('fs');

// Initialize with Application Default Credentials (your logged-in Firebase CLI)
admin.initializeApp({
  projectId: 'simplifinance-65ac9'
});

const db = admin.firestore();

async function exportAllData() {
  console.log('🚀 Starting Firestore export...');
  
  const exportData = {};
  
  try {
    // Get all collections
    const collections = await db.listCollections();
    
    for (const collection of collections) {
      console.log(`📦 Exporting collection: ${collection.id}`);
      
      const snapshot = await collection.get();
      exportData[collection.id] = {};
      
      snapshot.docs.forEach(doc => {
        exportData[collection.id][doc.id] = doc.data();
      });
      
      console.log(`✅ Exported ${snapshot.size} documents from ${collection.id}`);
    }
    
    // Save to file
    fs.writeFileSync('./firestore-export.json', JSON.stringify(exportData, null, 2));
    console.log('💾 Export saved to firestore-export.json');
    
    // Export users (this might fail due to permissions)
    try {
      const listUsers = await admin.auth().listUsers();
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
      console.log(`👥 Exported ${users.length} users to users-export.json`);
    } catch (authError) {
      console.log('⚠️  Could not export users (permissions), will handle manually');
    }
    
    console.log('🎉 Export completed successfully!');
    
  } catch (error) {
    console.error('❌ Export failed:', error);
  }
}

exportAllData();