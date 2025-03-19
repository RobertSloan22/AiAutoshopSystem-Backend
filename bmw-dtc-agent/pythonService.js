import { spawn } from "child_process";

let pythonProcess = null;

// Start the Python backend service
export function startPythonBackend() {
  pythonProcess = spawn("python3", ["crawl.py"]);

  pythonProcess.stdout.on("data", (data) => {
    console.log(`[Python] ${data}`);
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error(`[Python Error] ${data}`);
  });

  pythonProcess.on("close", (code) => {
    console.log(`[Python] Process exited with code ${code}`);
  });
}

// Stop the Python backend service
export function stopPythonBackend() {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
}
