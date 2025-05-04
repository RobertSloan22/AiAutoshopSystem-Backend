import mongoose from 'mongoose';

const uri = 'mongodb://192.168.1.124:27017/admin';
console.log('Connecting to MongoDB to check all databases...');

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    try {
      // Get list of all databases
      const admin = mongoose.connection.db.admin();
      const dbList = await admin.listDatabases();
      console.log('\nAvailable databases:');
      
      // Check each database for collections and data
      for (const dbInfo of dbList.databases) {
        const dbName = dbInfo.name;
        console.log(`\n--------- Database: ${dbName} ---------`);
        
        if (dbName === 'READ__ME_TO_RECOVER_YOUR_DATA') {
          console.log('Skipping suspicious database');
          continue;
        }
        
        try {
          // Switch to this database
          const db = mongoose.connection.client.db(dbName);
          
          // Get collections in this database
          const collections = await db.listCollections().toArray();
          console.log(`Collections (${collections.length}):`);
          
          if (collections.length === 0) {
            console.log('  No collections found');
            continue;
          }
          
          // Check each collection
          for (const collInfo of collections) {
            const collName = collInfo.name;
            try {
              const count = await db.collection(collName).countDocuments();
              console.log(`  - ${collName}: ${count} documents`);
              
              // Sample one document if available
              if (count > 0) {
                const sample = await db.collection(collName).findOne({});
                const keys = Object.keys(sample).join(', ');
                console.log(`    Fields: ${keys}`);
              }
            } catch (err) {
              console.log(`  - ${collName}: Error counting - ${err.message}`);
            }
          }
        } catch (err) {
          console.log(`Error accessing database ${dbName}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error('Error retrieving database information:', err.message);
    }
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
  })
  .finally(() => {
    setTimeout(() => {
      mongoose.connection.close();
      console.log('\nConnection closed');
    }, 2000);
  }); 