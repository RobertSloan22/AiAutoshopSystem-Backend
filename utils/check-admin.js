import mongoose from 'mongoose';

const uri = 'mongodb://192.168.1.124:27017/admin';
console.log('Connecting to admin database to check MongoDB status...');

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to admin database');
    
    try {
      // Get server information
      const admin = mongoose.connection.db.admin();
      const serverInfo = await admin.serverInfo();
      console.log('\nServer Information:');
      console.log(`MongoDB version: ${serverInfo.version}`);
      console.log(`Storage engine: ${serverInfo.storageEngines}`);
      
      // List all databases with sizes
      const dbInfo = await admin.listDatabases({ nameOnly: false });
      console.log('\nDatabase Information:');
      dbInfo.databases.forEach(db => {
        console.log(`- ${db.name}: ${(db.sizeOnDisk / (1024 * 1024)).toFixed(2)} MB`);
      });
      
      // Check database stats
      const stats = await mongoose.connection.db.stats();
      console.log('\nAdmin Database Stats:');
      console.log(`Collections: ${stats.collections}`);
      console.log(`Objects: ${stats.objects}`);
      console.log(`Storage size: ${(stats.storageSize / (1024 * 1024)).toFixed(2)} MB`);
      
      // Check MongoDB users (if accessible)
      try {
        const users = await mongoose.connection.db.collection('system.users').find({}).toArray();
        console.log('\nMongoDB Users:');
        users.forEach(user => {
          console.log(`- ${user.user} (${user.db})`);
        });
      } catch (err) {
        console.log('\nCould not access user information:', err.message);
      }
    } catch (err) {
      console.error('\nError retrieving admin information:', err.message);
    }
  })
  .catch(err => {
    console.error('Failed to connect to admin database:', err.message);
  })
  .finally(() => {
    setTimeout(() => {
      mongoose.connection.close();
      console.log('\nConnection closed');
    }, 2000);
  }); 