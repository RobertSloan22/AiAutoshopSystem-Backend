module.exports = {
  apps: [{
    name: "autoshop-backend",
    script: "./server.js",
    cwd: "/home/robert/AiAutoshopSystem-Backend",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "development",  // Changed to development so Python uses venv
      PORT: 5000,
      // Ensure Python uses virtual environment
      VIRTUAL_ENV: "/home/robert/AiAutoshopSystem-Backend/venv",
      PATH: "/home/robert/AiAutoshopSystem-Backend/venv/bin:" + process.env.PATH
    }
  }]
};
