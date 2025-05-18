#!/usr/bin/env python
"""
Integrated Server for Research and Automotive Diagnostic System

This script runs both the research server and the automotive diagnostic server
in separate processes, allowing the complete system to operate as a unified platform.
"""

import subprocess
import sys
import os
import time
import signal
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("logs/integrated_server.log"),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

# Define server commands
RESEARCH_SERVER_CMD = ["python", "robust_server.py"]
AUTOMOTIVE_SERVER_CMD = ["python", "automotive/server.py"]

# Process tracking
processes = []

def start_server(cmd, name):
    """Start a server process with the given command."""
    try:
        logger.info(f"Starting {name}...")

        # Create log file with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_filename = f"logs/{name.lower().replace(' ', '_')}_{timestamp}.log"

        # Ensure logs directory exists
        os.makedirs("logs", exist_ok=True)

        # Open log file
        log_file = open(log_filename, 'w')

        # Start process
        process = subprocess.Popen(
            cmd,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True
        )

        logger.info(f"{name} started with PID {process.pid}")
        return process, log_file
    except Exception as e:
        logger.error(f"Failed to start {name}: {str(e)}")
        return None, None

def cleanup(signum=None, frame=None):
    """Clean up resources and terminate processes."""
    logger.info("Cleaning up resources...")

    for process, log_file, name in processes:
        try:
            if process.poll() is None:  # Process is still running
                logger.info(f"Terminating {name} (PID: {process.pid})...")
                process.terminate()
                process.wait(timeout=5)  # Wait up to 5 seconds for graceful termination
        except subprocess.TimeoutExpired:
            logger.warning(f"{name} did not terminate gracefully, forcefully killing...")
            process.kill()
        except Exception as e:
            logger.error(f"Error terminating {name}: {str(e)}")

        # Close log file
        if log_file:
            log_file.close()

    logger.info("All processes terminated")
    sys.exit(0)

def check_processes():
    """Check if all processes are still running."""
    for process, log_file, name in processes:
        if process.poll() is not None:  # Process has terminated
            logger.error(f"{name} terminated unexpectedly with return code {process.returncode}")
            cleanup()
            return False
    return True

if __name__ == "__main__":
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, cleanup)   # Handle Ctrl+C
    signal.signal(signal.SIGTERM, cleanup)  # Handle termination signal

    try:
        # Start research server
        research_process, research_log = start_server(RESEARCH_SERVER_CMD, "Research Server")
        if research_process:
            processes.append((research_process, research_log, "Research Server"))

        # Wait for research server to initialize
        time.sleep(3)

        # Start automotive server
        automotive_process, automotive_log = start_server(AUTOMOTIVE_SERVER_CMD, "Automotive Server")
        if automotive_process:
            processes.append((automotive_process, automotive_log, "Automotive Server"))

        logger.info("All servers started successfully!")
        logger.info("Research Server running on http://localhost:8001")
        logger.info("Automotive Server running on http://localhost:8002")
        logger.info("Web interface available at automotive/index.html")
        logger.info("Press Ctrl+C to shut down all servers")

        # Keep the script running and monitor processes
        while check_processes():
            time.sleep(1)

    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt. Shutting down...")
        cleanup()
    except Exception as e:
        logger.error(f"Error in main process: {str(e)}")
        cleanup()
    finally:
        cleanup()