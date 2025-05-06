import mongoose from 'mongoose';

const uri = 'mongodb://192.168.1.124:27017/automotivedb';
console.log('Connecting to automotivedb to check migrated data...');

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to automotivedb database');
    
    // Get collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\nCollections in automotivedb:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
    // Check counts in each collection
    console.log('\nDocument counts per collection:');
    for (const collection of collections) {
      const count = await mongoose.connection.db.collection(collection.name).countDocuments();
      console.log(`- ${collection.name}: ${count} documents`);
    }
    
    // Sample data from each collection
    console.log('\nSample data from each collection:');
    for (const collection of collections) {
      console.log(`\n[Collection: ${collection.name}]`);
      const data = await mongoose.connection.db.collection(collection.name).find({}).limit(1).toArray();
      if (data.length > 0) {
        // Print a simplified version of the document (just keys)
        const keys = Object.keys(data[0]);
        console.log(`Schema keys: ${keys.join(', ')}`);
        // Print first document with limitation on string length
        const simplifiedData = JSON.stringify(data[0], (key, value) => {
          if (typeof value === 'string' && value.length > 50) {
            return value.substring(0, 50) + '...';
          }
          return value;
        }, 2);
        console.log(`Sample: ${simplifiedData}`);
      } else {
        console.log('No documents found');
      }
    }
  })
  .catch(err => {
    console.error('Failed to connect or query:', err.message);
  })
  .finally(() => {
    setTimeout(() => {
      mongoose.connection.close();
      console.log('\nConnection closed');
    }, 2000);
  }); 