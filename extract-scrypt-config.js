const admin = require('firebase-admin');
const { execSync } = require('child_process');

async function getExactScryptConfig() {
    try {
        // Initialize admin for the OLD project 
        admin.initializeApp({
            projectId: 'simplifinance-65ac9'
        });
        
        console.log('Attempting to extract SCRYPT configuration from simplifinance-65ac9...');
        
        // Method 1: Try to get project config through admin API
        try {
            const projectConfig = await admin.projectManagement().getProjectConfig();
            console.log('Project Config:', JSON.stringify(projectConfig, null, 2));
        } catch (error) {
            console.log('Method 1 failed:', error.message);
        }
        
        // Method 2: Use Google Cloud Identity Toolkit API directly
        const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
        
        const endpoints = [
            `https://identitytoolkit.googleapis.com/v1/projects/simplifinance-65ac9/getConfig`,
            `https://identitytoolkit.googleapis.com/v1/projects/simplifinance-65ac9/config`,
            `https://firebase.googleapis.com/v1beta1/projects/simplifinance-65ac9`,
            `https://firebase.googleapis.com/v1beta1/projects/simplifinance-65ac9/config`
        ];
        
        for (const url of endpoints) {
            try {
                console.log(`\nTrying: ${url}`);
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('✅ SUCCESS! Found config:');
                    console.log(JSON.stringify(data, null, 2));
                    
                    // Look for SCRYPT parameters in the response
                    if (data.signInConfig && data.signInConfig.hashConfig) {
                        console.log('\n🔑 SCRYPT CONFIG FOUND:');
                        console.log(JSON.stringify(data.signInConfig.hashConfig, null, 2));
                    }
                    return;
                } else {
                    const errorText = await response.text();
                    console.log(`Failed: ${response.status} - ${errorText.substring(0, 100)}...`);
                }
            } catch (error) {
                console.log(`Error: ${error.message}`);
            }
        }
        
        console.log('\n❌ Could not extract SCRYPT config through API');
        console.log('\n💡 Alternative: Let me try creating a test user in the old project and analyzing the hash...');
        
    } catch (error) {
        console.error('Critical error:', error);
    }
}

getExactScryptConfig();