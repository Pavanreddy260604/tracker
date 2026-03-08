const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/learning-os');
  const db = mongoose.connection.db;
  const script = await db.collection("masterscripts").findOne({ title: /PK/i });
  if (!script) {
      console.log("No script PK");
      process.exit(1);
  }
  console.log("--- SAMPLED RAW SCRIPT (First 1500 chars) ---");
  console.log(script.rawContent?.substring(0, 1500));
  
  console.log("--- MIDDLE OF SCRIPT ---");
  console.log(script.rawContent?.substring(5000, 6500));
  process.exit(0);
}
run();
