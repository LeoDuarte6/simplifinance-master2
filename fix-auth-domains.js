const admin = require('firebase-admin');

async function fixAuthDomains() {
    try {
        admin.initializeApp({
            projectId: 'simplifinance-65ac9'
        });

        console.log('Checking current auth domain configuration...');

        // Get current project config
        const projectConfig = await admin.projectConfig();
        console.log('Current project config:', JSON.stringify(projectConfig, null, 2));

        // This is likely the issue - we need to add simplifinancellc.com to authorized domains
        console.log('Setting authorized domains to include simplifinancellc.com...');

        // Use Firebase Admin to update auth domains
        const updatedConfig = await admin.projectConfig().updateConfig({
            authorizedDomains: [
                'simplifinance-65ac9.firebaseapp.com',
                'simplifinance-65ac9.web.app',
                'simplifinancellc.com',
                'localhost'
            ]
        });

        console.log('✅ Auth domains updated successfully');
        console.log('Updated config:', JSON.stringify(updatedConfig, null, 2));

    } catch (error) {
        console.error('Error updating auth domains:', error);

        // Alternative method using REST API
        console.log('Trying alternative method...');
        const { execSync } = require('child_process');
        const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();

        const fetch = require('node-fetch');
        const response = await fetch(`https://firebase.googleapis.com/v1beta1/projects/simplifinance-65ac9:patch`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                authorizedDomains: [
                    'simplifinance-65ac9.firebaseapp.com',
                    'simplifinance-65ac9.web.app',
                    'simplifinancellc.com',
                    'localhost'
                ]
            })
        });

        if (response.ok) {
            console.log('✅ Auth domains updated via REST API');
        } else {
            console.error('❌ Failed to update auth domains:', await response.text());
        }
    }
}

fixAuthDomains();