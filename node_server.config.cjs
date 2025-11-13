module.exports = {
  apps: [{
    name: "autoshop-backend",
    script: "server.js",
    cwd: "/home/robert/AiAutoshopSystem-Backend",
    watch: false,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "production",
      PORT: 5000
    }
  }]
};