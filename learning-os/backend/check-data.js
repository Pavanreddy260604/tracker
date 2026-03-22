const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/learning-os').then(async () => {
    const user = await mongoose.connection.db.collection('users').findOne({email: 'pavanreddynallaaa@gmail.com'});
    if (!user) { console.log("User not found!"); process.exit(0); }
    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const c of collections) {
        const countId = await mongoose.connection.db.collection(c.name).countDocuments({userId: user._id});
        const countObj = await mongoose.connection.db.collection(c.name).countDocuments({userId: String(user._id)});
        if (countId > 0 || countObj > 0) {
            console.log(c.name, countId + countObj);
        }
    }
    console.log("Done");
    process.exit(0);
}).catch(console.error);
