#!/usr/bin/env node

const admin = require('firebase-admin');

// Initialize Firebase Admin for OLD project (production)
admin.initializeApp({
  projectId: 'simplifinance-65ac9',
  storageBucket: 'simplifinance-65ac9.firebasestorage.app'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function emergencyRestoreLibrarySimple() {
  try {
    console.log('🚨 EMERGENCY: Creating library collection with direct URLs...');

    // Get all folders in the library directory
    const [files] = await bucket.getFiles({ prefix: 'library/' });

    // Group files by folder (content ID)
    const contentMap = {};

    files.forEach(file => {
      const pathParts = file.name.split('/');
      if (pathParts.length >= 3) { // library/contentId/filename
        const contentId = pathParts[1];
        const filename = pathParts[2];

        if (!contentMap[contentId]) {
          contentMap[contentId] = { files: [] };
        }
        contentMap[contentId].files.push({
          name: filename,
          fullPath: file.name
        });
      }
    });

    console.log(`📁 Found ${Object.keys(contentMap).length} content folders`);

    const batch = db.batch();
    let processedCount = 0;

    for (const [contentId, content] of Object.entries(contentMap)) {
      try {
        console.log(`🔄 Processing ${contentId}...`);

        // Find main content file and thumbnail
        const contentFile = content.files.find(f =>
          f.name.includes('.zip') || f.name.includes('.pdf') || f.name.includes('.mp4')
        );
        const thumbnailFile = content.files.find(f =>
          f.name.includes('thumbnail') || f.name.includes('.jpg') || f.name.includes('.png')
        );

        if (!contentFile) {
          console.log(`⚠️  No main content file found for ${contentId}`);
          continue;
        }

        // Create direct Firebase Storage URLs (no signing required)
        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/simplifinance-65ac9.firebasestorage.app/o/${encodeURIComponent(contentFile.fullPath)}?alt=media`;

        let thumbnailUrl = '';
        if (thumbnailFile) {
          thumbnailUrl = `https://firebasestorage.googleapis.com/v0/b/simplifinance-65ac9.firebasestorage.app/o/${encodeURIComponent(thumbnailFile.fullPath)}?alt=media`;
        }

        // Extract title from filename (remove extension and clean up)
        const title = contentFile.name
          .replace(/\.(zip|pdf|mp4)$/i, '')
          .replace(/[_-]/g, ' ')
          .replace(/%20/g, ' ')
          .trim();

        // Create library document
        const libraryDoc = {
          contentId: contentId,
          title: title,
          description: `Educational content: ${title}`,
          category: 'Educational Materials',
          downloadUrl: downloadUrl,
          thumbnailUrl: thumbnailUrl,
          planRequirement: 'essentials', // Default to essentials
          storagePaths: {
            content: contentFile.fullPath,
            thumbnail: thumbnailFile ? thumbnailFile.fullPath : ''
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = db.collection('library').doc(contentId);
        batch.set(docRef, libraryDoc);
        processedCount++;

        console.log(`✅ Prepared: ${title}`);

      } catch (error) {
        console.error(`❌ Error processing ${contentId}:`, error.message);
      }
    }

    if (processedCount > 0) {
      console.log(`\n💾 Committing ${processedCount} library items to Firestore...`);
      await batch.commit();
      console.log(`🎉 EMERGENCY RESTORE COMPLETE! Restored ${processedCount} library items!`);
    } else {
      console.log('❌ No items were processed');
    }

  } catch (error) {
    console.error('💥 EMERGENCY RESTORE FAILED:', error);
    process.exit(1);
  }
}

// Run emergency restore
emergencyRestoreLibrarySimple()
  .then(() => {
    console.log('✨ Library restoration complete! Production should be working now.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Emergency restore failed:', error);
    process.exit(1);
  });