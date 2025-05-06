import mongoose from 'mongoose';

const uri = 'mongodb://192.168.1.124:27017/READ__ME_TO_RECOVER_YOUR_DATA';
console.log('Connecting to suspicious database to check contents...');

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to database');
    
    // Check collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections in the suspicious database:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
    // Try to read data from any collection found
    for (const collection of collections) {
      console.log(`Reading from collection: ${collection.name}`);
      const data = await mongoose.connection.db.collection(collection.name).find({}).limit(3).toArray();
      console.log(JSON.stringify(data, null, 2));
    }
  })
  .catch(err => {
    console.error('Failed to connect or query:', err.message);
  })
  .finally(() => {
    setTimeout(() => {
      mongoose.connection.close();
      console.log('Connection closed');
    }, 2000);
  }); 