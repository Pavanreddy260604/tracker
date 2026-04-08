const axios = require('axios');
require('dotenv').config();

async function testGitHub() {
    const owner = 'Pavanreddy260604';
    const repo = 'tracker';
    const token = process.env.GITHUB_TOKEN;
    
    console.log('Using Token:', token ? 'HIDDEN' : 'MISSING');
    
    const headers = { 
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Learning-OS-Diagnostic'
    };
    if (token) headers['Authorization'] = `token ${token}`;

    try {
        console.log(`Fetching: https://api.github.com/repos/${owner}/${repo}`);
        const res = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers });
        console.log('SUCCESS: Repo Info Fetched');
        console.log('Default Branch:', res.data.default_branch);
        
        const branch = res.data.default_branch;
        console.log(`Fetching Tree: https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
        const treeRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers });
        console.log('SUCCESS: Recursive Tree Fetched');
        console.log('Tree nodes count:', treeRes.data.tree.length);
    } catch (error) {
        console.error('ERROR:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data));
            console.error('Headers:', JSON.stringify(error.response.headers));
        }
    }
}

testGitHub();
