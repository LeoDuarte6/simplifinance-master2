// This script will help us find the exact SCRYPT parameters
const https = require('https');
const { execSync } = require('child_process');

async function getProjectConfig() {
    try {
        // Get access token
        const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
        
        // Try different API endpoints to get the config
        const urls = [
            `https://firebase.googleapis.com/v1beta1/projects/simplifinance-65ac9/config`,
            `https://identitytoolkit.googleapis.com/v1/projects/simplifinance-65ac9/getProjectConfig`,
            `https://identitytoolkit.googleapis.com/v1/projects/simplifinance-65ac9/config`
        ];
        
        for (const url of urls) {
            console.log(`Trying: ${url}`);
            try {
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('SUCCESS! Config found:');
                    console.log(JSON.stringify(data, null, 2));
                    return;
                }
                console.log(`Failed: ${response.status} ${response.statusText}`);
            } catch (error) {
                console.log(`Error: ${error.message}`);
            }
        }
        
        console.log('No config endpoints worked. Trying manual approach...');
        
        // Manual approach - common Firebase SCRYPT parameters
        const commonParams = [
            {
                name: "Default Firebase",
                hashKey: "jxOxKtm09FvCZPDKh6vVUJTu82JDbHfJjnhMhNZmIg==",
                saltSeparator: "Bw==",
                rounds: 8,
                memCost: 14
            },
            {
                name: "Alternative 1", 
                hashKey: "base64key",
                saltSeparator: "Bw==",
                rounds: 8,
                memCost: 14
            }
        ];
        
        console.log('Try these SCRYPT parameters:');
        commonParams.forEach(param => {
            console.log(`\n${param.name}:`);
            console.log(`firebase auth:import auth-users.json --hash-algo=scrypt --hash-key=${param.hashKey} --salt-separator=${param.saltSeparator} --rounds=${param.rounds} --mem-cost=${param.memCost} --project simplifinancellc-a6795`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

getProjectConfig();