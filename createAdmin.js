require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');

const makeAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected...');

        const email = 'admin@aven.com';
        const password = 'admin1234';

        await Admin.deleteOne({ email });

        const newAdmin = new Admin({
            name: 'Demo Admin',
            email: email,
            password: password,
            phone: '01700000000',

        });

        await newAdmin.save();
        console.log(' Demo Admin created successfully with password: admin1234');
        process.exit(0);
    } catch (err) {
        console.error('Error creating admin:', err.message);
        process.exit(1);
    }
};

makeAdmin();