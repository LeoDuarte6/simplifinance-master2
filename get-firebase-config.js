const admin = require('firebase-admin');

// Initialize admin for the old project
admin.initializeApp({
  projectId: 'simplifinance-65ac9'
});

async function getHashConfig() {
  try {
    // Try to get the project config to find SCRYPT parameters
    const projectConfig = await admin.projectManagement().getProjectConfig();
    console.log('Project config:', JSON.stringify(projectConfig, null, 2));
  } catch (error) {
    console.error('Error getting config:', error);
  }
}

getHashConfig();