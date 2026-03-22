const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/learning-os').then(async () => {
    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    console.log("Users in DB:", users.length);
    console.log("Users:", users.map(u => u.email));
    process.exit(0);
}).catch(console.error);
