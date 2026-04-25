const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

dotenv.config();

const seedRootUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for seeding...');

    // Check if official root user already exists
    const rootExists = await User.findOne({ username: 'admin' });
    if (rootExists) {
      console.log('Root user already exists. ID:', rootExists.referralCode);
      process.exit();
    }

    // Create Official Root User
    const rootUser = new User({
      fullName: 'OrbitFX Official',
      email: 'admin@orbitfx.org',
      phone: '1234567890',
      username: 'admin',
      password: 'adminPassword123', 
      referralCode: 'OFX8888', 
      isActive: true,
      activationDate: new Date()
    });

    await rootUser.save();

    console.log('Official Root User Created Successfully!');
    console.log('Username: admin');
    console.log('Sponsor ID to use: OFX8888');
    
    process.exit();
  } catch (error) {
    console.error('Error seeding root user:', error);
    process.exit(1);
  }
};

seedRootUser();
