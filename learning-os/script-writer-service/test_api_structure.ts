
import axios from 'axios';

async function testApi() {
    const baseUrl = 'http://localhost:5003/api/script';
    // We need a valid token to test, but let's see if we can get a 404/401 with standard structure
    try {
        console.log('Testing /scene/:id/commit-edit structure...');
        const resp = await axios.post(`${baseUrl}/scene/69ae66ba85aea41c4a93b9af/commit-edit`, {}, {
            validateStatus: () => true
        });
        console.log('Status:', resp.status);
        console.log('Body:', JSON.stringify(resp.data, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    }
}

testApi();
