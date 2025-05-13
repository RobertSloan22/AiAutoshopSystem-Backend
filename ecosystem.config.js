export default {
  apps: [{
    name: "vector-storage-service",
    script: "./server.js",  // Make sure this path is correct
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "500M",
    env: {
      NODE_ENV: "production",
      PORT: 5000
    }
  }]
};
