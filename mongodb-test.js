import mongoose from 'mongoose';

const uri = 'mongodb://192.168.1.124:27017/';
console.log('Attempting to connect to MongoDB at:', uri);

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to MongoDB successfully!');
    
    // Get list of databases
    const admin = mongoose.connection.db.admin();
    const dbs = await admin.listDatabases();
    console.log('Available databases:');
    dbs.databases.forEach(db => {
      console.log(`- ${db.name}`);
    });
    
    // Perform a simple query
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections in the database:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
  })
  .finally(() => {
    // Close the connection after 2 seconds
    setTimeout(() => {
      mongoose.connection.close();
      console.log('Connection closed');
    }, 2000);
  }); 