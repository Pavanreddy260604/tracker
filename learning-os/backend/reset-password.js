const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

mongoose.connect('mongodb://localhost:27017/learning-os', {
}).then(async () => {
    try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        const hasUsers = collections.some(c => c.name === 'users');
        if (!hasUsers) {
            console.log("No users collection.");
            process.exit(0);
        }

        const email = 'pavanreddynallaaa@gmail.com';
        const user = await mongoose.connection.db.collection('users').findOne({email});
        
        if (!user) {
            console.log("User not found!");
            process.exit(0);
        }

        const newPassword = 'Password123!';
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        await mongoose.connection.db.collection('users').updateOne(
            { _id: user._id },
            { $set: { passwordHash: passwordHash } }
        );

        console.log("Password reset successfully to:", newPassword);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}).catch(console.error);
