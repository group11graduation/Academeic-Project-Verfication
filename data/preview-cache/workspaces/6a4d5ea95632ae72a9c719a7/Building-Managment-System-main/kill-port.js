// Quick script to kill process on port 5000 (Windows)
// Run: node kill-port.js

const { exec } = require('child_process');
const os = require('os');

const port = 5000;

if (os.platform() === 'win32') {
  // Windows
  exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
    if (error) {
      console.log(`No process found on port ${port}`);
      return;
    }
    
    const lines = stdout.trim().split('\n');
    const pids = new Set();
    
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length > 0) {
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid)) {
          pids.add(pid);
        }
      }
    });
    
    if (pids.size === 0) {
      console.log(`No process found on port ${port}`);
      return;
    }
    
    pids.forEach(pid => {
      console.log(`Killing process ${pid}...`);
      exec(`taskkill /PID ${pid} /F`, (err) => {
        if (err) {
          console.error(`Failed to kill process ${pid}:`, err.message);
        } else {
          console.log(`✓ Process ${pid} killed successfully`);
        }
      });
    });
  });
} else {
  // Mac/Linux
  exec(`lsof -ti:${port}`, (error, stdout) => {
    if (error) {
      console.log(`No process found on port ${port}`);
      return;
    }
    
    const pids = stdout.trim().split('\n').filter(Boolean);
    
    if (pids.length === 0) {
      console.log(`No process found on port ${port}`);
      return;
    }
    
    pids.forEach(pid => {
      console.log(`Killing process ${pid}...`);
      exec(`kill -9 ${pid}`, (err) => {
        if (err) {
          console.error(`Failed to kill process ${pid}:`, err.message);
        } else {
          console.log(`✓ Process ${pid} killed successfully`);
        }
      });
    });
  });
}
