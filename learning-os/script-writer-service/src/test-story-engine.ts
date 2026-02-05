import axios from 'axios';

const LOGLINE = "A retired legendary hitman is forced back into action by a young upstart.";
const BIBLE_ID = "67a2168936efac1d5e549da7"; // Use a real ID from your DB if known, or this placeholder
const BASE_URL = 'http://localhost:5001/api/treatment';

async function testStoryEngine() {
    console.log("--- 1. Testing Treatment Generation ---");
    try {
        const genRes = await axios.post(`${BASE_URL}/generate`, { logline: LOGLINE });
        console.log("Generation Success!");
        console.log("Acts Found:", genRes.data.data.acts.length);

        const acts = genRes.data.data.acts;

        console.log("\n--- 2. Testing Treatment Save ---");
        const saveRes = await axios.post(`${BASE_URL}/save`, {
            bibleId: BIBLE_ID,
            logline: LOGLINE,
            acts: acts
        });
        console.log("Save Success! ID:", saveRes.data.data._id);
        const treatmentId = saveRes.data.data._id;

        console.log("\n--- 3. Testing Conversion to Scenes ---");
        const convRes = await axios.post(`${BASE_URL}/convert`, { treatmentId });
        console.log("Conversion Success!");
        console.log("Scenes Created:", convRes.data.data.count);

    } catch (error) {
        const err = error as any;
        console.error("Test Failed:", err?.response?.data || err?.message || String(error));
    }
}

testStoryEngine();
