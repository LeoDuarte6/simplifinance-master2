// Direct approach to fix authorized domains
const https = require('https');
const { execSync } = require('child_process');

async function urgentFixDomains() {
    try {
        const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();

        console.log('🚨 EMERGENCY: Adding simplifinancellc.com to authorized domains...');

        // Method 1: Try Firebase Management API
        const configData = {
            "authorizedDomains": [
                "simplifinance-65ac9.firebaseapp.com",
                "simplifinance-65ac9.web.app",
                "simplifinancellc.com",
                "localhost"
            ]
        };

        const postData = JSON.stringify(configData);

        const options = {
            hostname: 'firebase.googleapis.com',
            port: 443,
            path: '/v1beta1/projects/simplifinance-65ac9:patch',
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            console.log(`Status: ${res.statusCode}`);
            console.log(`Headers: ${JSON.stringify(res.headers)}`);

            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log('Response:', data);
                if (res.statusCode === 200) {
                    console.log('✅ Authorized domains updated successfully!');
                } else {
                    console.log('❌ Failed to update authorized domains');
                }
            });
        });

        req.on('error', (e) => {
            console.error(`Request error: ${e.message}`);
        });

        req.write(postData);
        req.end();

    } catch (error) {
        console.error('Error:', error);
    }
}

urgentFixDomains();