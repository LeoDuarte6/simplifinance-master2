#!/usr/bin/env node

// This restores the library collection to how it should work originally
// WITHOUT touching any migration work

const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'simplifinance-65ac9',
  storageBucket: 'simplifinance-65ac9.firebasestorage.app'
});

const db = admin.firestore();

async function restoreOriginalLibrary() {
  try {
    console.log('🔄 Deleting corrupted library collection...');

    // Delete all documents in library collection
    const libraryRef = db.collection('library');
    const snapshot = await libraryRef.get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    if (!snapshot.empty) {
      await batch.commit();
      console.log(`✅ Deleted ${snapshot.size} corrupted library documents`);
    }

    console.log('✅ Library collection cleared - ready for original working data');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

restoreOriginalLibrary().catch(console.error);