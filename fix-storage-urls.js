#!/usr/bin/env node

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./target-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'simplifinance-65ac9.firebasestorage.app'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function regenerateStorageUrls() {
  try {
    console.log('🔍 Fetching all library content...');

    const contentSnapshot = await db.collection('library').get();

    if (contentSnapshot.empty) {
      console.log('❌ No library content found in Firestore');
      return;
    }

    console.log(`📚 Found ${contentSnapshot.size} library items to update`);

    const batch = db.batch();
    let updatedCount = 0;

    for (const doc of contentSnapshot.docs) {
      const data = doc.data();
      const contentId = doc.id;

      console.log(`🔄 Processing: ${data.title || contentId}`);

      // Check if storage paths exist
      if (!data.storagePaths || !data.storagePaths.content) {
        console.log(`⚠️  Skipping ${contentId} - no storage paths found`);
        continue;
      }

      try {
        // Generate new signed URLs
        const contentPath = data.storagePaths.content;
        const thumbnailPath = data.storagePaths.thumbnail;

        // Get new signed URLs with far future expiration
        const [contentDownloadUrl] = await bucket.file(contentPath).getSignedUrl({
          action: 'read',
          expires: '03-09-2491' // Far future date
        });

        let thumbnailDownloadUrl = '';
        if (thumbnailPath) {
          try {
            const [url] = await bucket.file(thumbnailPath).getSignedUrl({
              action: 'read',
              expires: '03-09-2491'
            });
            thumbnailDownloadUrl = url;
          } catch (thumbError) {
            console.log(`⚠️  Could not generate thumbnail URL for ${contentId}: ${thumbError.message}`);
          }
        }

        // Update the document with new URLs
        const updates = {
          downloadUrl: contentDownloadUrl,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (thumbnailDownloadUrl) {
          updates.thumbnailUrl = thumbnailDownloadUrl;
        }

        batch.update(doc.ref, updates);
        updatedCount++;

        console.log(`✅ Prepared update for: ${data.title || contentId}`);

      } catch (fileError) {
        console.error(`❌ Error processing ${contentId}: ${fileError.message}`);
      }
    }

    if (updatedCount > 0) {
      console.log(`\n💾 Committing ${updatedCount} updates to Firestore...`);
      await batch.commit();
      console.log(`🎉 Successfully updated ${updatedCount} library items!`);
    } else {
      console.log('❌ No items were updated');
    }

  } catch (error) {
    console.error('❌ Error regenerating storage URLs:', error);
    process.exit(1);
  }
}

// Run the script
regenerateStorageUrls()
  .then(() => {
    console.log('✨ Storage URL regeneration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });