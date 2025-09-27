#!/usr/bin/env node

const admin = require('firebase-admin');

// Initialize Firebase Admin for OLD project (production) - no service account needed
admin.initializeApp({
  projectId: 'simplifinance-65ac9',
  storageBucket: 'simplifinance-65ac9.firebasestorage.app'
});

const db = admin.firestore();

async function fixDownloadUrls() {
  try {
    console.log('🔧 Fixing download URLs to work with current authentication...');

    // Get all library documents
    const librarySnapshot = await db.collection('library').get();

    if (librarySnapshot.empty) {
      console.log('❌ No library items found');
      return;
    }

    console.log(`📚 Found ${librarySnapshot.size} library items to fix`);

    const batch = db.batch();
    let fixedCount = 0;

    librarySnapshot.forEach(doc => {
      const data = doc.data();

      if (data.storagePaths && data.storagePaths.content) {
        // Create Firebase Storage download URLs that work with auth
        const contentPath = data.storagePaths.content;
        const thumbnailPath = data.storagePaths.thumbnail;

        // Use Firebase's download URL format that respects security rules
        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/simplifinance-65ac9.firebasestorage.app/o/${encodeURIComponent(contentPath)}?alt=media&token=download`;

        let thumbnailUrl = data.thumbnailUrl || '';
        if (thumbnailPath) {
          thumbnailUrl = `https://firebasestorage.googleapis.com/v0/b/simplifinance-65ac9.firebasestorage.app/o/${encodeURIComponent(thumbnailPath)}?alt=media&token=download`;
        }

        // Update with new URLs
        batch.update(doc.ref, {
          downloadUrl: downloadUrl,
          thumbnailUrl: thumbnailUrl,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        fixedCount++;
        console.log(`✅ Fixed: ${data.title || doc.id}`);
      } else {
        console.log(`⚠️  Skipping ${doc.id} - no storage paths`);
      }
    });

    if (fixedCount > 0) {
      console.log(`\n💾 Committing ${fixedCount} URL fixes...`);
      await batch.commit();
      console.log(`🎉 FIXED ${fixedCount} download URLs!`);
    } else {
      console.log('❌ No URLs were fixed');
    }

  } catch (error) {
    console.error('💥 Fix failed:', error);
    process.exit(1);
  }
}

// Run the fix
fixDownloadUrls()
  .then(() => {
    console.log('✨ Download URL fix complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });