
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, Query, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.websockets import WebSocketState
import json
import asyncio
from typing import Dict, Any, Optional, Set, List, Callable, List
import uuid
import time
import os
import logging
import traceback
import shutil
import base64
from pydantic import BaseModel
from contextlib import asynccontextmanager
from fastapi import APIRouter, HTTPException

# Set a flag to check data analysis capabilities later
data_analysis_available = True

from mcp_agent.core.fastagent import FastAgent
from mcp_agent.llm.augmented_llm import RequestParams
# Import FastAgent
try:
    from mcp_agent.core.fastagent import FastAgent
except ImportError:
    print("ERROR: mcp_agent module not found. Make sure to install it with: pip install mcp-agent")
    raise

# Import OBD2 analysis agent
try:
    from obd2_analysis_agent import analyze_obd2_data
    obd2_analysis_available = True
except ImportError as e:
    print(f"WARNING: OBD2 analysis agent not available: {e}")
    obd2_analysis_available = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Store active WebSocket connections
active_connections: Dict[str, WebSocket] = {}
# Store websocket tasks
websocket_tasks: Dict[str, Set[asyncio.Task]] = {}
# Store research jobs
research_jobs: Dict[str, Dict[str, Any]] = {}
# Simple in-memory store for demo purposes
job_manager = {}

class Job:
    def __init__(self, job_id: str):
        self.id = job_id
        self.status = "pending"
        self.message = None
        self.result = None

    def complete(self, content):
        self.status = "complete"
        self.result = content

    def fail(self, reason):
        self.status = "error"
        self.message = reason

class ResearchRequest(BaseModel):
    prompt: str
    output_file: Optional[str] = None

class AnalysisRequest(BaseModel):
    analysis_type: str = "general"  # Type of analysis to perform
    options: Dict[str, Any] = {}    # Additional options for analysis
async def run_research_workflow(job_id: str, prompt: str):
    job = job_manager.get(job_id)
    try:
        result = await actual_deep_research(prompt)
        job.complete(result)
    except Exception as e:
        job.fail(str(e))

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # Initialize the FastAgent
        logger.info("Initializing FastAgent...")
        app.state.agents = FastAgent(name="Research and Analysis Server")

        # Check data analysis availability
        app.state.data_analysis_available = False
        app.state.data_analysis_error = None

        try:
            # Try importing but will catch errors
            import importlib.util
            for lib in ["pandas", "numpy", "matplotlib", "seaborn"]:
                if importlib.util.find_spec(lib) is None:
                    raise ImportError(f"Library {lib} not found")
            app.state.data_analysis_available = True
        except ImportError as e:
            app.state.data_analysis_available = False
            app.state.data_analysis_error = str(e)
            logger.warning(f"Data analysis libraries not available: {e}")
            logger.warning("To fix this, run: pip install numpy==1.24.3 pandas==2.0.3 matplotlib==3.7.2 seaborn==0.12.2")

        # Register the researcher agent
        @app.state.agents.agent(
            "Researcher",
            instruction="""
You are a research assistant, with access to internet search (via Brave),
website fetch, a python interpreter (you can install packages with uv) and a filesystem.
Use the current working directory to save and create files with both the Interpreter and Filesystem tools.
The interpreter has numpy, pandas, matplotlib and seaborn already installed.
When researching, create a comprehensive markdown report with your findings.
Your goal is to provide a comprehensive report with the goal of assisting the Automotive Technician diagnose, repair, and solve problems with the vehicle.
            """,
            servers=["brave", "interpreter", "filesystem", "fetch"],
        )
        async def run_research_agent(prompt: str) -> str:
            """The actual research agent function registered with FastAgent."""
            logger.info(f"Agent received prompt: {prompt[:50]}...")
            return await prompt

        logger.info("Research agent registered successfully")

        # Register the data analysis agent if dependencies are available
        if app.state.data_analysis_available:
            @app.state.agents.agent(
                name="data_analysis",
                instruction="""
You have access to a Python 3.12 interpreter and you can use this to analyse and process data.
Common analysis packages such as Pandas, Seaborn and Matplotlib are already installed.
You can add further packages if needed.
Data files are accessible from the /tmp/data/ directory.
Visualisations should be saved as .png files in the /tmp/output/ directory.
Each visualization should have a clear, descriptive filename.
Provide detailed statistical analysis and insights about the data.
""",
                servers=["interpreter"],
                request_params=RequestParams(maxTokens=8192),
            )
            async def run_analysis_agent(prompt: str) -> str:
                """The data analysis agent function registered with FastAgent."""
                logger.info(f"Analysis agent received prompt: {prompt[:50]}...")
                return await prompt

            logger.info("Data analysis agent registered successfully")
        else:
            logger.warning("Data analysis agent not registered due to missing dependencies")

        # Try alternative definition if the above doesn't work well
        try:
            # A simpler definition as a backup
            @app.state.agents.agent(
                "SimpleResearcher",
                instruction="""
                You are a research assistant, with access to internet search (via Brave),
As an automotive expert, you are tasked with researching automotive repair and maintenance topics.
                """,
                servers=["brave", "interpreter", "filesystem", "fetch"]
            )
            async def run_simple_research_agent(prompt: str) -> str:
                logger.info(f"SimpleResearcher agent received prompt: {prompt[:50]}...")
                return await prompt

            logger.info("Simple researcher agent registered as backup")
        except Exception as e:
            logger.warning(f"Could not register simple researcher agent: {str(e)}")

        # Store available servers
        app.state.available_servers = []
        try:
            # Try to get the available servers
            if hasattr(app.state.agents, 'server_registry'):
                app.state.available_servers = list(app.state.agents.server_registry.servers.keys())
                logger.info(f"Available servers: {app.state.available_servers}")
        except Exception as e:
            logger.warning(f"Could not get available servers: {str(e)}")

        # Add completed research storage
        app.state.completed_research = {}

        # Add completed analysis storage
        app.state.completed_analysis = {}

        # Create necessary directories for analysis
        os.makedirs("/tmp/data", exist_ok=True)
        os.makedirs("/tmp/output", exist_ok=True)

        yield

    except Exception as e:
        logger.error(f"Error initializing the application: {str(e)}")
        logger.error(traceback.format_exc())
        raise
    finally:
        # Cleanup on shutdown
        logger.info("Shutting down research and analysis server...")

        # Cancel all active tasks
        for client_id, tasks in websocket_tasks.items():
            for task in tasks:
                if not task.done():
                    task.cancel()

# Create FastAPI app with lifespan
app = FastAPI(title="Research and Analysis Server", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Let Node.js proxy handle origin validation
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add specific configuration for ngrok connections
@app.middleware("http")
async def add_ws_headers(request, call_next):
    response = await call_next(request)
    # Let the Node.js proxy handle CORS - don't set headers here
    # We just need to ensure WebSocket-specific headers pass through
    return response

# Helper function to send stream updates to the client
async def stream_to_client(client_id: str, job_id: str, message: str, message_type: str = "stream"):
    """Send streaming updates to the client websocket if connected."""
    if client_id in active_connections:
        websocket = active_connections[client_id]
        if websocket.client_state == WebSocketState.CONNECTED:
            try:
                await websocket.send_text(json.dumps({
                    "type": message_type,
                    "job_id": job_id,
                    "content": message,
                    "timestamp": time.time()
                }))
                return True
            except Exception as e:
                logger.error(f"Failed to send stream update to client {client_id}: {str(e)}")
                return False
    return False

async def run_research(prompt: str, client_id: str, output_file: Optional[str] = None) -> str:
    """Run the research agent with the given prompt and return the result."""
    job_id = f"job_{int(time.time())}_{uuid.uuid4()}"

    # Generate output filename if not provided
    if not output_file:
        output_file = f"research_report_{int(time.time())}.md"

    try:
        # Track job in research_jobs
        research_jobs[job_id] = {
            "status": "processing",
            "progress": 0,
            "output_file": output_file,
            "start_time": time.time(),
            "client_id": client_id,
            "streaming_enabled": False  # Will be set to True if streaming works
        }

        logger.info(f"Starting research job {job_id} for client {client_id} with prompt: {prompt[:50]}...")

        # Notify client that research has started
        if client_id in active_connections:
            websocket = active_connections[client_id]
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_text(json.dumps({
                    "type": "research_status",
                    "job_id": job_id,
                    "status": "started",
                    "message": "Research started, analyzing your request..."
                }))

        # Create storage for streaming content
        full_content = []

        try:
            # Setup continuous progress updates during research
            async def send_progress_updates():
                # Start at 40% (where we currently are) and go up to 65%
                current_progress = 40
                max_progress = 65
                update_interval = 3  # seconds between updates

                try:
                    while research_jobs[job_id]["status"] == "processing" and current_progress < max_progress:
                        await asyncio.sleep(update_interval)
                        # Only proceed if job is still processing
                        if job_id in research_jobs and research_jobs[job_id]["status"] == "processing":
                            current_progress += 3  # Increment by 3%
                            research_jobs[job_id]["progress"] = current_progress

                            # Send update to client
                            if client_id in active_connections:
                                client_ws = active_connections[client_id]
                                if client_ws.client_state == WebSocketState.CONNECTED:
                                    progress_message = "Analyzing information and generating insights..." if current_progress < 55 else "Compiling research findings..."
                                    await client_ws.send_text(json.dumps({
                                        "type": "research_status",
                                        "job_id": job_id,
                                        "status": "processing",
                                        "progress": current_progress,
                                        "message": progress_message
                                    }))
                        else:
                            # Job is no longer processing, exit loop
                            break
                except Exception as e:
                    logger.error(f"Error in progress updates: {str(e)}")

            # Start the progress update task
            progress_task = asyncio.create_task(send_progress_updates())

            # Add to client tasks so it gets cancelled properly if needed
            if client_id in websocket_tasks:
                websocket_tasks[client_id].add(progress_task)

            # Define stream callback to capture and forward streaming output
            streaming_working = False  # Flag to track if streaming is working

            async def handle_stream(content: str):
                """Handle streaming content from the agent."""
                nonlocal streaming_working
                full_content.append(content)
                # Stream the content to the client
                success = await stream_to_client(client_id, job_id, content)
                if success and not streaming_working:
                    streaming_working = True
                    research_jobs[job_id]["streaming_enabled"] = True
                    logger.info(f"Streaming successfully established for job {job_id}")

            # Run the agent with the correct API method
            async with app.state.agents.run() as agent:
                logger.info("Agent session created successfully")

                # Update progress
                research_jobs[job_id]["progress"] = 40

                if client_id in active_connections:
                    websocket = active_connections[client_id]
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_text(json.dumps({
                            "type": "research_status",
                            "job_id": job_id,
                            "status": "processing",
                            "progress": 40,
                            "message": "Running research query and analyzing information..."
                        }))

                # Add additional debugging info
                logger.info(f"Agent type: {type(agent)}")
                logger.info(f"Available agent methods: {dir(agent)}")

                # Send the prompt directly to the agent
                logger.info(f"Sending prompt: {prompt[:100]}...")

                response_text = ""  # Initialize response_text to empty string

                try:
                    # Check if the agent supports streaming by looking at its method signatures
                    supports_streaming = hasattr(agent, 'prompt') and callable(agent.prompt)
                    logger.info(f"Agent supports streaming API: {supports_streaming}")

                    # Try different approaches for streaming support
                    if supports_streaming:
                        try:
                            # First try with stream_handler parameter if it exists
                            responses = await agent.prompt(prompt, stream_handler=handle_stream)
                            logger.info("Successfully used streaming with agent.prompt(stream_handler)")
                        except (TypeError, ValueError) as streaming_error:
                            # Log streaming error
                            logger.warning(f"stream_handler not supported: {str(streaming_error)}")

                            # Next try with stream and callback parameters
                            try:
                                responses = await agent.prompt(prompt, stream=True, callback=handle_stream)
                                logger.info("Successfully used streaming with agent.prompt(stream=True, callback)")
                            except (TypeError, ValueError) as stream_callback_error:
                                logger.warning(f"stream/callback not supported: {str(stream_callback_error)}")

                                # Next try with on_content parameter
                                try:
                                    responses = await agent.prompt(prompt, on_content=handle_stream)
                                    logger.info("Successfully used streaming with agent.prompt(on_content)")
                                except (TypeError, ValueError):
                                    # If all streaming options fail, fall back to non-streaming
                                    logger.warning("Falling back to non-streaming approach")
                                    responses = await agent.prompt(prompt)
                                    logger.info("Used agent.prompt() without streaming")
                    else:
                        # Simply use the API without streaming
                        responses = await agent.prompt(prompt)
                        logger.info("Used agent.prompt() without streaming capability")

                except Exception as e:
                    logger.error(f"Error in primary agent.prompt() call: {str(e)}")
                    logger.error(traceback.format_exc())

                    # Try different fallback approaches

                    # 1. Try with a formatted prompt
                    logger.info("Trying fallback with formatted prompt...")
                    formatted_prompt = f"""
RESEARCH TASK:
{prompt}

Please conduct thorough research on this topic and provide a comprehensive report.
"""
                    try:
                        # Try with the formatted prompt, without streaming for safety
                        responses = await agent.prompt(formatted_prompt)
                        logger.info("Fallback with formatted prompt succeeded")
                    except Exception as e2:
                        logger.error(f"Error in formatted prompt fallback: {str(e2)}")

                        # 2. Try using the send method if available
                        try:
                            logger.info("Attempting to use agent.send method...")
                            responses = await agent.send(prompt)
                            logger.info("Successfully used agent.send() method")
                        except Exception as e3:
                            logger.error(f"Error using agent.send: {str(e3)}")

                            # 3. Try SimpleResearcher agent if it's registered
                            try:
                                logger.info("Attempting to use SimpleResearcher agent...")
                                # Try to re-run with explicit agent name
                                async with app.state.agents.run("SimpleResearcher") as backup_agent:
                                    responses = await backup_agent.prompt(prompt)
                                    logger.info("Successfully used SimpleResearcher agent")
                            except Exception as e4:
                                logger.error(f"Error using SimpleResearcher agent: {str(e4)}")

                                # Final fallback: return a message explaining the issue
                                error_response = f"""
# Research Failed

Unfortunately, there was an error running the research task. The system encountered the following issues:

1. Primary research error: {str(e)}
2. Formatted prompt error: {str(e2)}
3. Agent.send error: {str(e3)}
4. Backup agent error: {str(e4)}

Please try again with a more specific research question or contact support.
"""
                                full_content.append(error_response)
                                await stream_to_client(client_id, job_id, error_response)
                                responses = error_response

                # Log more details about the response
                logger.info(f"Response type: {type(responses)}")
                logger.info(f"Response sample: {str(responses)[:200] if responses else 'None'}")

                # Update progress
                research_jobs[job_id]["progress"] = 70

                # Notify client of data collection complete
                if client_id in active_connections:
                    websocket = active_connections[client_id]
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_text(json.dumps({
                            "type": "research_status",
                            "job_id": job_id,
                            "status": "processing",
                            "progress": 70,
                            "message": "Research data collected, formatting results..."
                        }))

                # Determine the final content
                if full_content:
                    # If we got streaming content, join it all together
                    response_text = "".join(full_content)
                    logger.info(f"Using streamed content: {len(response_text)} characters")
                else:
                    # Otherwise, extract content from the responses object
                    logger.info(f"Response type: {type(responses)}")

                    if isinstance(responses, dict) and "response" in responses:
                        response_text = responses["response"]
                    elif isinstance(responses, dict) and "text" in responses:
                        response_text = responses["text"]
                    elif isinstance(responses, dict) and "content" in responses:
                        response_text = responses["content"]
                    elif isinstance(responses, list):
                        response_text = "\n\n".join([str(r) for r in responses])
                    else:
                        response_text = str(responses)

                    logger.info(f"Extracted non-streamed content: {len(response_text)} characters")

                # Make sure we have some content
                if not response_text.strip():
                    response_text = "# Research Report\n\nNo results were returned from the research agent. Please try another query."
                    logger.warning("Empty response from agent, using default message")

                # Update progress for formatting results
                research_jobs[job_id]["progress"] = 80

                # Notify client of results formatting
                if client_id in active_connections:
                    websocket = active_connections[client_id]
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_text(json.dumps({
                            "type": "research_status",
                            "job_id": job_id,
                            "status": "processing",
                            "progress": 80,
                            "message": "Finalizing research report..."
                        }))

                # Write the responses to the output file
                with open(output_file, "w", encoding="utf-8") as f:
                    f.write(response_text)

                logger.info(f"Research results saved to {output_file}")

                # The research is complete at this point
                research_jobs[job_id]["progress"] = 100
                research_jobs[job_id]["status"] = "completed"
                research_jobs[job_id]["end_time"] = time.time()

                # Store completed research for retrieval even after client disconnection
                app.state.completed_research[job_id] = {
                    "output_file": output_file,
                    "output_path": os.path.abspath(output_file),
                    "prompt": prompt,
                    "client_id": client_id,
                    "completion_time": time.time(),
                    "content": response_text  # Store the actual content in memory
                }

                # Keep only the last 100 completed research jobs
                if len(app.state.completed_research) > 100:
                    oldest_job = min(app.state.completed_research.items(), key=lambda x: x[1]["completion_time"])
                    del app.state.completed_research[oldest_job[0]]

                # Notify client of completion and send the results directly
                if client_id in active_connections:
                    websocket = active_connections[client_id]
                    if websocket.client_state == WebSocketState.CONNECTED:
                        # First send completion status
                        await websocket.send_text(json.dumps({
                            "type": "research_status",
                            "job_id": job_id,
                            "status": "completed",
                            "progress": 100,
                            "output_file": output_file,
                            "message": f"Research complete! Results have been prepared."
                        }))

                        # Then immediately send the actual research results
                        await websocket.send_text(json.dumps({
                            "type": "research_result",
                            "job_id": job_id,
                            "status": "completed",
                            "output_file": output_file,
                            "content": response_text,
                            "prompt": prompt
                        }))

                # Return the path to the output file
                output_path = os.path.abspath(output_file)
                return output_path

        except Exception as e:
            logger.error(f"Error running research agent: {str(e)}")
            logger.error(traceback.format_exc())

            # Update job status
            research_jobs[job_id]["status"] = "failed"
            research_jobs[job_id]["error"] = str(e)
            research_jobs[job_id]["end_time"] = time.time()

            # Notify client of failure
            if client_id in active_connections:
                websocket = active_connections[client_id]
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_text(json.dumps({
                        "type": "research_status",
                        "job_id": job_id,
                        "status": "failed",
                        "error": str(e),
                        "message": f"Research failed: {str(e)}"
                    }))

            raise

    except Exception as e:
        logger.error(f"Research job {job_id} failed: {str(e)}")
        logger.error(traceback.format_exc())

        # Update job status
        if job_id in research_jobs:
            research_jobs[job_id]["status"] = "failed"
            research_jobs[job_id]["error"] = str(e)
            research_jobs[job_id]["end_time"] = time.time()

        # Notify client of failure
        if client_id in active_connections:
            websocket = active_connections[client_id]
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_text(json.dumps({
                    "type": "research_status",
                    "job_id": job_id,
                    "status": "failed",
                    "error": str(e),
                    "message": f"Research failed: {str(e)}"
                }))

        raise e

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    client_id: Optional[str] = Query(None)
):
    # If client_id is provided, use it (for reconnection)
    # Otherwise generate a new one
    if not client_id:
        client_id = str(uuid.uuid4())

    # Initialize task tracking for this client if it doesn't exist
    if client_id not in websocket_tasks:
        websocket_tasks[client_id] = set()

    logger.info(f"WebSocket connection attempt from client {client_id} {'(reconnection)' if client_id in active_connections else '(new)'}")

    try:
        # Accept connection with proper origins handling for ngrok/Vercel
        await websocket.accept()
        logger.info(f"WebSocket connection accepted for client {client_id}")

        # Handle ping/pong manually to keep connection alive through ngrok
        ping_task = None

        async def send_ping():
            """Send regular ping messages to keep the connection alive."""
            try:
                while True:
                    await asyncio.sleep(30)  # Send ping every 30 seconds
                    if websocket.client_state == WebSocketState.CONNECTED:
                        try:
                            await websocket.send_text(json.dumps({
                                "type": "ping",
                                "timestamp": time.time()
                            }))
                        except Exception as e:
                            logger.error(f"Error sending ping: {str(e)}")
                            break
                    else:
                        break  # Stop if disconnected
            except asyncio.CancelledError:
                # Task was cancelled, clean up
                pass
            except Exception as e:
                logger.error(f"Ping task error: {str(e)}")

        # Start ping task to keep connection alive
        ping_task = asyncio.create_task(send_ping())
        if client_id in websocket_tasks:
            websocket_tasks[client_id].add(ping_task)

        # Update the active connection with this WebSocket
        # This allows a client to reconnect with the same ID
        active_connections[client_id] = websocket

        # Send connection ready message with streaming capability indication
        await websocket.send_text(json.dumps({
            "type": "connection_ready",
            "message": "WebSocket connection established",
            "client_id": client_id,
            "available_servers": app.state.available_servers,
            "streaming_supported": True,
            "via_ngrok": True  # Flag to indicate this is through ngrok
        }))

        # Check if there are any completed jobs for this client
        client_jobs = []
        for job_id, job_data in app.state.completed_research.items():
            if job_data.get("client_id") == client_id:
                client_jobs.append({
                    "job_id": job_id,
                    "output_file": job_data["output_file"],
                    "completed_at": job_data["completion_time"]
                })

        # If there are completed jobs, notify the client
        if client_jobs:
            await websocket.send_text(json.dumps({
                "type": "completed_jobs",
                "message": "You have completed research jobs",
                "jobs": client_jobs
            }))

        # Process messages from the client
        while True:
            try:
                # Receive message from frontend with longer timeout for ngrok
                data = await asyncio.wait_for(websocket.receive_text(), timeout=120)
                message = json.loads(data)

                logger.info(f"Received message from client {client_id}: {type(message)}")

                # Handle heartbeat/ping messages with high priority
                if isinstance(message, dict) and (message.get("type") == "heartbeat" or message.get("type") == "ping"):
                    # Simply respond with a heartbeat response
                    await websocket.send_text(json.dumps({
                        "type": "heartbeat_response",
                        "timestamp": time.time()
                    }))
                    continue

                # Handle research requests
                if isinstance(message, dict) and message.get("type") == "research_request":
                    prompt = message.get("prompt", "")
                    output_file = message.get("output_file")

                    if not prompt:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "Research prompt cannot be empty"
                        }))
                        continue

                    # Notify client that we're about to start processing
                    await websocket.send_text(json.dumps({
                        "type": "research_status",
                        "status": "initializing",
                        "message": "Initializing research agent..."
                    }))

                    # Start the research in the background
                    research_task = asyncio.create_task(
                        run_research(prompt, client_id, output_file)
                    )
                    websocket_tasks[client_id].add(research_task)

                # Handle heartbeat messages
                elif isinstance(message, dict) and message.get("type") == "heartbeat":
                    # Simply respond with a heartbeat response
                    await websocket.send_text(json.dumps({
                        "type": "heartbeat_response",
                        "timestamp": time.time()
                    }))
                    continue

                # Handle result retrieval requests
                elif isinstance(message, dict) and message.get("type") == "get_result":
                    job_id = message.get("job_id")
                    if not job_id:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "Job ID is required to retrieve results"
                        }))
                        continue

                    # Check if the job is in completed research
                    if job_id in app.state.completed_research:
                        completed_job = app.state.completed_research[job_id]
                        output_path = completed_job["output_path"]

                        # Check if the file exists
                        if os.path.exists(output_path):
                            try:
                                with open(output_path, "r", encoding="utf-8") as f:
                                    content = f.read()

                                await websocket.send_text(json.dumps({
                                    "type": "research_result",
                                    "job_id": job_id,
                                    "status": "completed",
                                    "output_file": completed_job["output_file"],
                                    "content": content,
                                    "prompt": completed_job["prompt"],
                                    "completion_time": completed_job["completion_time"]
                                }))
                            except Exception as e:
                                await websocket.send_text(json.dumps({
                                    "type": "error",
                                    "message": f"Error reading research results: {str(e)}"
                                }))
                        else:
                            await websocket.send_text(json.dumps({
                                "type": "error",
                                "message": f"Research output file not found"
                            }))

                    # Check if it's in the active research jobs
                    elif job_id in research_jobs:
                        job = research_jobs[job_id]
                        await websocket.send_text(json.dumps({
                            "type": "research_status",
                            "job_id": job_id,
                            "status": job["status"],
                            "progress": job["progress"],
                            "output_file": job.get("output_file"),
                            "message": f"Research is {job['status']}"
                        }))

                    # Job not found
                    else:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": f"Research job with ID {job_id} not found"
                        }))

                # Handle list jobs request
                elif isinstance(message, dict) and message.get("type") == "list_jobs":
                    # Get active jobs for this client
                    active_jobs = []
                    for job_id, job_data in research_jobs.items():
                        if job_data.get("client_id") == client_id:
                            active_jobs.append({
                                "job_id": job_id,
                                "status": job_data["status"],
                                "progress": job_data["progress"],
                                "output_file": job_data.get("output_file")
                            })

                    # Get completed jobs for this client
                    completed_jobs = []
                    for job_id, job_data in app.state.completed_research.items():
                        if job_data.get("client_id") == client_id:
                            completed_jobs.append({
                                "job_id": job_id,
                                "output_file": job_data["output_file"],
                                "completed_at": job_data["completion_time"]
                            })

                    await websocket.send_text(json.dumps({
                        "type": "job_list",
                        "active_jobs": active_jobs,
                        "completed_jobs": completed_jobs
                    }))

                # Handle terminal output request (for live streaming terminal view)
                elif isinstance(message, dict) and message.get("type") == "enable_terminal_view":
                    job_id = message.get("job_id")
                    if job_id and job_id in research_jobs:
                        # Just acknowledge the request - actual streaming happens in run_research
                        await websocket.send_text(json.dumps({
                            "type": "terminal_view_enabled",
                            "job_id": job_id,
                            "message": "Terminal view enabled for this research job"
                        }))
                    else:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "Invalid job ID for terminal view"
                        }))

                # Handle simple message as research request
                elif isinstance(message, dict) and (message.get("type") == "message" or "content" in message):
                    # Extract the prompt from either message.content or message.text
                    prompt = message.get("content", message.get("text", ""))

                    if not prompt:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "Message content cannot be empty"
                        }))
                        continue

                    # Notify client that we're about to start processing
                    await websocket.send_text(json.dumps({
                        "type": "research_status",
                        "status": "initializing",
                        "message": "Initializing research agent..."
                    }))

                    # Start the research in the background
                    research_task = asyncio.create_task(
                        run_research(prompt, client_id)
                    )
                    websocket_tasks[client_id].add(research_task)

                # If it's a string, treat it as a prompt directly
                elif isinstance(message, str) and message.strip():
                    prompt = message.strip()

                    # Notify client that we're about to start processing
                    await websocket.send_text(json.dumps({
                        "type": "research_status",
                        "status": "initializing",
                        "message": "Initializing research agent..."
                    }))

                    # Start the research in the background
                    research_task = asyncio.create_task(
                        run_research(prompt, client_id)
                    )
                    websocket_tasks[client_id].add(research_task)

                # Otherwise, try to extract a prompt from the message
                elif isinstance(message, dict):
                    # Skip processing if this appears to be a heartbeat or ping message
                    if "ping" in message or "heartbeat" in message or message.get("type") in ["ping", "heartbeat"]:
                        await websocket.send_text(json.dumps({
                            "type": "pong",
                            "timestamp": time.time()
                        }))
                        continue

                    prompt = message.get("prompt", "")

                    if not prompt:
                        # Try the first key that might be a question or message
                        for key in message:
                            if isinstance(message[key], str) and len(message[key]) > 5:
                                prompt = message[key]
                                break

                    if not prompt:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "Could not find a valid research prompt in the message"
                        }))
                        continue

                    # Notify client that we're about to start processing
                    await websocket.send_text(json.dumps({
                        "type": "research_status",
                        "status": "initializing",
                        "message": "Initializing research agent..."
                    }))

                    # Start the research in the background
                    research_task = asyncio.create_task(
                        run_research(prompt, client_id)
                    )
                    websocket_tasks[client_id].add(research_task)

                # Handle analysis requests
                elif isinstance(message, dict) and message.get("type") == "analysis_request":
                    # Check if data analysis is available
                    if not app.state.data_analysis_available:
                        error_message = f"Data analysis functionality is not available: {app.state.data_analysis_error}"
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": error_message,
                            "details": "Please install required dependencies: pip install numpy==1.24.3 pandas==2.0.3 matplotlib==3.7.2 seaborn==0.12.2"
                        }))
                        continue

                    analysis_type = message.get("analysis_type", "general")
                    options = message.get("options", {})

                    # Check if the client has uploaded a file already
                    if not message.get("file_id"):
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "No file ID provided. Upload a file first using the /upload endpoint."
                        }))
                        continue

                    file_id = message.get("file_id")
                    file_path = f"/tmp/data/{file_id}"

                    if not os.path.exists(file_path):
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": f"File with ID {file_id} not found. Upload the file first."
                        }))
                        continue

                    # Notify client that we're starting the analysis
                    await websocket.send_text(json.dumps({
                        "type": "analysis_status",
                        "status": "initializing",
                        "message": "Initializing data analysis..."
                    }))

                    # Start the analysis in the background
                    analysis_task = asyncio.create_task(
                        run_analysis(file_path, client_id, analysis_type, options)
                    )
                    websocket_tasks[client_id].add(analysis_task)

                else:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": "Unsupported message format. Please send a research_request, message or string prompt."
                    }))

            except asyncio.TimeoutError:
                # Timeout on receive - send a ping to check connection
                try:
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_text(json.dumps({
                            "type": "ping",
                            "timestamp": time.time()
                        }))
                except Exception as ping_error:
                    logger.error(f"Connection seems lost: {str(ping_error)}")
                    break

            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected for client {client_id}")
                break

            # ... rest of your existing error handling ...

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for client {client_id}")
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {str(e)}")
        logger.error(traceback.format_exc())
    finally:
        # Clean up resources
        if client_id in active_connections:
            del active_connections[client_id]

        # Cancel any tasks associated with this client
        if client_id in websocket_tasks:
            for task in websocket_tasks[client_id]:
                if not task.done():
                    task.cancel()
            del websocket_tasks[client_id]
@app.get("/research/status/{job_id}")
async def get_research_status(job_id: str):
    job = job_manager.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {
        "job_id": job_id,
        "status": job.status,  # e.g. "pending", "running", "complete", "error"
        "message": job.message or None
    }
@app.websocket("/research-ws")
async def research_websocket_endpoint(
    websocket: WebSocket,
    client_id: Optional[str] = Query(None)
):
    # If client_id is provided, use it (for reconnection)
    # Otherwise generate a new one
    if not client_id:
        client_id = str(uuid.uuid4())

    # Initialize task tracking for this client if it doesn't exist
    if client_id not in websocket_tasks:
        websocket_tasks[client_id] = set()

    logger.info(f"Research WebSocket connection attempt from client {client_id} {'(reconnection)' if client_id in active_connections else '(new)'}")

    try:
        # Accept connection with proper origins handling for ngrok/Vercel
        await websocket.accept()
        logger.info(f"Research WebSocket connection accepted for client {client_id}")

        # Handle ping/pong manually to keep connection alive through ngrok
        ping_task = None

        async def send_ping():
            """Send regular ping messages to keep the connection alive."""
            try:
                while True:
                    await asyncio.sleep(30)  # Send ping every 30 seconds
                    if websocket.client_state == WebSocketState.CONNECTED:
                        try:
                            await websocket.send_text(json.dumps({
                                "type": "ping",
                                "timestamp": time.time()
                            }))
                        except Exception as e:
                            logger.error(f"Error sending ping: {str(e)}")
                            break
                    else:
                        break  # Stop if disconnected
            except asyncio.CancelledError:
                # Task was cancelled, clean up
                pass
            except Exception as e:
                logger.error(f"Ping task error: {str(e)}")

        # Start ping task to keep connection alive
        ping_task = asyncio.create_task(send_ping())
        if client_id in websocket_tasks:
            websocket_tasks[client_id].add(ping_task)

        # Update the active connection with this WebSocket
        # This allows a client to reconnect with the same ID
        active_connections[client_id] = websocket

        # Send connection ready message with streaming capability indication
        await websocket.send_text(json.dumps({
            "type": "connection_ready",
            "message": "WebSocket connection established",
            "client_id": client_id,
            "available_servers": app.state.available_servers,
            "streaming_supported": True,
            "via_ngrok": True  # Flag to indicate this is through ngrok
        }))

        # Check if there are any completed jobs for this client
        client_jobs = []
        for job_id, job_data in app.state.completed_research.items():
            if job_data.get("client_id") == client_id:
                client_jobs.append({
                    "job_id": job_id,
                    "output_file": job_data["output_file"],
                    "completed_at": job_data["completion_time"]
                })

        # If there are completed jobs, notify the client
        if client_jobs:
            await websocket.send_text(json.dumps({
                "type": "completed_jobs",
                "message": "You have completed research jobs",
                "jobs": client_jobs
            }))

        # Process messages from the client
        while True:
            try:
                # Receive message from frontend with longer timeout for ngrok
                data = await asyncio.wait_for(websocket.receive_text(), timeout=120)
                message = json.loads(data)

                logger.info(f"Received message from client {client_id} on research-ws: {type(message)}")

                # Handle heartbeat/ping messages with high priority
                if isinstance(message, dict) and (message.get("type") == "heartbeat" or message.get("type") == "ping"):
                    # Simply respond with a heartbeat response
                    await websocket.send_text(json.dumps({
                        "type": "heartbeat_response",
                        "timestamp": time.time()
                    }))
                    continue

                # Handle research requests
                if isinstance(message, dict) and message.get("type") == "research_request":
                    prompt = message.get("prompt", "")
                    output_file = message.get("output_file")

                    if not prompt:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "Research prompt cannot be empty"
                        }))
                        continue

                    # Notify client that we're about to start processing
                    await websocket.send_text(json.dumps({
                        "type": "research_status",
                        "status": "initializing",
                        "message": "Initializing research agent..."
                    }))

                    # Start the research in the background
                    research_task = asyncio.create_task(
                        run_research(prompt, client_id, output_file)
                    )
                    websocket_tasks[client_id].add(research_task)

                # Handle heartbeat messages
                elif isinstance(message, dict) and message.get("type") == "heartbeat":
                    # Simply respond with a heartbeat response
                    await websocket.send_text(json.dumps({
                        "type": "heartbeat_response",
                        "timestamp": time.time()
                    }))
                    continue

                # Handle result retrieval requests
                elif isinstance(message, dict) and message.get("type") == "get_result":
                    job_id = message.get("job_id")
                    if not job_id:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "Job ID is required to retrieve results"
                        }))
                        continue

                    # Check if the job is in completed research
                    if job_id in app.state.completed_research:
                        completed_job = app.state.completed_research[job_id]
                        output_path = completed_job["output_path"]

                        # Check if the file exists
                        if os.path.exists(output_path):
                            try:
                                with open(output_path, "r", encoding="utf-8") as f:
                                    content = f.read()

                                await websocket.send_text(json.dumps({
                                    "type": "research_result",
                                    "job_id": job_id,
                                    "status": "completed",
                                    "output_file": completed_job["output_file"],
                                    "content": content,
                                    "prompt": completed_job["prompt"],
                                    "completion_time": completed_job["completion_time"]
                                }))
                            except Exception as e:
                                await websocket.send_text(json.dumps({
                                    "type": "error",
                                    "message": f"Error reading research results: {str(e)}"
                                }))
                        else:
                            await websocket.send_text(json.dumps({
                                "type": "error",
                                "message": f"Research output file not found"
                            }))

                    # Check if it's in the active research jobs
                    elif job_id in research_jobs:
                        job = research_jobs[job_id]
                        await websocket.send_text(json.dumps({
                            "type": "research_status",
                            "job_id": job_id,
                            "status": job["status"],
                            "progress": job["progress"],
                            "output_file": job.get("output_file"),
                            "message": f"Research is {job['status']}"
                        }))

                    # Job not found
                    else:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": f"Research job with ID {job_id} not found"
                        }))

                # Handle list jobs request
                elif isinstance(message, dict) and message.get("type") == "list_jobs":
                    # Get active jobs for this client
                    active_jobs = []
                    for job_id, job_data in research_jobs.items():
                        if job_data.get("client_id") == client_id:
                            active_jobs.append({
                                "job_id": job_id,
                                "status": job_data["status"],
                                "progress": job_data["progress"],
                                "output_file": job_data.get("output_file")
                            })

                    # Get completed jobs for this client
                    completed_jobs = []
                    for job_id, job_data in app.state.completed_research.items():
                        if job_data.get("client_id") == client_id:
                            completed_jobs.append({
                                "job_id": job_id,
                                "output_file": job_data["output_file"],
                                "completed_at": job_data["completion_time"]
                            })

                    await websocket.send_text(json.dumps({
                        "type": "job_list",
                        "active_jobs": active_jobs,
                        "completed_jobs": completed_jobs
                    }))

                # Handle terminal output request (for live streaming terminal view)
                elif isinstance(message, dict) and message.get("type") == "enable_terminal_view":
                    job_id = message.get("job_id")
                    if job_id and job_id in research_jobs:
                        # Just acknowledge the request - actual streaming happens in run_research
                        await websocket.send_text(json.dumps({
                            "type": "terminal_view_enabled",
                            "job_id": job_id,
                            "message": "Terminal view enabled for this research job"
                        }))
                    else:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "Invalid job ID for terminal view"
                        }))

                # Handle simple message as research request
                elif isinstance(message, dict) and (message.get("type") == "message" or "content" in message):
                    # Extract the prompt from either message.content or message.text
                    prompt = message.get("content", message.get("text", ""))

                    if not prompt:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "Message content cannot be empty"
                        }))
                        continue

                    # Notify client that we're about to start processing
                    await websocket.send_text(json.dumps({
                        "type": "research_status",
                        "status": "initializing",
                        "message": "Initializing research agent..."
                    }))

                    # Start the research in the background
                    research_task = asyncio.create_task(
                        run_research(prompt, client_id)
                    )
                    websocket_tasks[client_id].add(research_task)

                # If it's a string, treat it as a prompt directly
                elif isinstance(message, str) and message.strip():
                    prompt = message.strip()

                    # Notify client that we're about to start processing
                    await websocket.send_text(json.dumps({
                        "type": "research_status",
                        "status": "initializing",
                        "message": "Initializing research agent..."
                    }))

                    # Start the research in the background
                    research_task = asyncio.create_task(
                        run_research(prompt, client_id)
                    )
                    websocket_tasks[client_id].add(research_task)

                # Otherwise, try to extract a prompt from the message
                elif isinstance(message, dict):
                    # Skip processing if this appears to be a heartbeat or ping message
                    if "ping" in message or "heartbeat" in message or message.get("type") in ["ping", "heartbeat"]:
                        await websocket.send_text(json.dumps({
                            "type": "pong",
                            "timestamp": time.time()
                        }))
                        continue

                    prompt = message.get("prompt", "")

                    if not prompt:
                        # Try the first key that might be a question or message
                        for key in message:
                            if isinstance(message[key], str) and len(message[key]) > 5:
                                prompt = message[key]
                                break

                    if not prompt:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "Could not find a valid research prompt in the message"
                        }))
                        continue

                    # Notify client that we're about to start processing
                    await websocket.send_text(json.dumps({
                        "type": "research_status",
                        "status": "initializing",
                        "message": "Initializing research agent..."
                    }))

                    # Start the research in the background
                    research_task = asyncio.create_task(
                        run_research(prompt, client_id)
                    )
                    websocket_tasks[client_id].add(research_task)

                # Handle analysis requests
                elif isinstance(message, dict) and message.get("type") == "analysis_request":
                    # Check if data analysis is available
                    if not app.state.data_analysis_available:
                        error_message = f"Data analysis functionality is not available: {app.state.data_analysis_error}"
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": error_message,
                            "details": "Please install required dependencies: pip install numpy==1.24.3 pandas==2.0.3 matplotlib==3.7.2 seaborn==0.12.2"
                        }))
                        continue

                    analysis_type = message.get("analysis_type", "general")
                    options = message.get("options", {})

                    # Check if the client has uploaded a file already
                    if not message.get("file_id"):
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "No file ID provided. Upload a file first using the /upload endpoint."
                        }))
                        continue

                    file_id = message.get("file_id")
                    file_path = f"/tmp/data/{file_id}"

                    if not os.path.exists(file_path):
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": f"File with ID {file_id} not found. Upload the file first."
                        }))
                        continue

                    # Notify client that we're starting the analysis
                    await websocket.send_text(json.dumps({
                        "type": "analysis_status",
                        "status": "initializing",
                        "message": "Initializing data analysis..."
                    }))

                    # Start the analysis in the background
                    analysis_task = asyncio.create_task(
                        run_analysis(file_path, client_id, analysis_type, options)
                    )
                    websocket_tasks[client_id].add(analysis_task)

                else:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": "Unsupported message format. Please send a research_request, message or string prompt."
                    }))

            except asyncio.TimeoutError:
                # Timeout on receive - send a ping to check connection
                try:
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_text(json.dumps({
                            "type": "ping",
                            "timestamp": time.time()
                        }))
                except Exception as ping_error:
                    logger.error(f"Connection seems lost: {str(ping_error)}")
                    break

            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected for client {client_id}")
                break

            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON received from client {client_id}: {str(e)}")
                try:
                    # Try to process as plain text
                    data = data.strip()
                    if data:
                        # Notify client that we're about to start processing
                        await websocket.send_text(json.dumps({
                            "type": "research_status",
                            "status": "initializing",
                            "message": "Initializing research agent..."
                        }))

                        research_task = asyncio.create_task(
                            run_research(data, client_id)
                        )
                        websocket_tasks[client_id].add(research_task)
                    else:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "Invalid JSON format and empty plain text"
                        }))
                except Exception:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": "Invalid message format"
                    }))
            except Exception as e:
                logger.error(f"Error processing message from client {client_id}: {str(e)}")
                logger.error(traceback.format_exc())

                try:
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": f"Error processing message: {str(e)}"
                        }))
                except Exception:
                    # Client likely disconnected
                    break

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for client {client_id}")
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {str(e)}")
        logger.error(traceback.format_exc())
    finally:
        # Clean up resources
        if client_id in active_connections:
            del active_connections[client_id]

        # Cancel any tasks associated with this client
        if client_id in websocket_tasks:
            for task in websocket_tasks[client_id]:
                if not task.done():
                    task.cancel()
            del websocket_tasks[client_id]

@app.post("/research")
async def create_research(request: ResearchRequest, background_tasks: BackgroundTasks):
    """REST endpoint to start a research task."""
    client_id = f"rest_{uuid.uuid4()}"

    if not request.prompt:
        return {"status": "error", "message": "Research prompt cannot be empty"}

    output_file = request.output_file or f"research_report_{int(time.time())}.md"

    # Start the research in the background
    background_tasks.add_task(
        run_research,
        request.prompt,
        client_id,
        output_file
    )

@app.post("/analysis")
async def perform_obd2_analysis(request: AnalysisRequest):
    """REST endpoint for OBD2 data analysis."""
    try:
        if not obd2_analysis_available:
            raise HTTPException(
                status_code=503, 
                detail="OBD2 analysis service is not available. Please check system dependencies."
            )
        
        # Extract data from request
        analysis_type = request.analysis_type
        data = request.options.get('data', {})
        options = request.options
        
        if not data:
            raise HTTPException(status_code=400, detail="No OBD2 data provided for analysis")
        
        # Perform analysis
        logger.info(f"Starting OBD2 analysis: {analysis_type}")
        result = await analyze_obd2_data(analysis_type, data, options)
        
        # Store result for potential retrieval
        result_id = str(uuid.uuid4())
        app.state.completed_analysis[result_id] = {
            'result': result,
            'timestamp': time.time(),
            'analysis_type': analysis_type
        }
        
        return {
            "status": "success",
            "result_id": result_id,
            "result": result,
            "analysis_type": analysis_type,
            "processing_time": result.get('processing_time', 0)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in OBD2 analysis: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.get("/analysis/{result_id}")
async def get_analysis_result(result_id: str):
    """Get previously completed analysis result."""
    if result_id not in app.state.completed_analysis:
        raise HTTPException(status_code=404, detail="Analysis result not found")
    
    analysis_data = app.state.completed_analysis[result_id]
    return {
        "status": "success",
        "result_id": result_id,
        "result": analysis_data['result'],
        "analysis_type": analysis_data['analysis_type'],
        "timestamp": analysis_data['timestamp']
    }

    return {
        "status": "started",
        "client_id": client_id,
        "output_file": output_file,
        "message": "Research task started"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "available_servers": app.state.available_servers,
        "features": {
            "research": True,
            "data_analysis": app.state.data_analysis_available
        },
        "data_analysis_status": {
            "available": app.state.data_analysis_available,
            "error": getattr(app.state, "data_analysis_error", None) if not app.state.data_analysis_available else None,
            "fix": "pip install numpy==1.24.3 pandas==2.0.3 matplotlib==3.7.2 seaborn==0.12.2" if not app.state.data_analysis_available else None
        }
    }

@app.get("/")
async def root():
    data_analysis_status = {
        "available": app.state.data_analysis_available,
    }

    if not app.state.data_analysis_available:
        data_analysis_status["error"] = getattr(app.state, "data_analysis_error", "Dependencies missing")
        data_analysis_status["fix"] = "Visit /install-data-analysis-deps to install required dependencies automatically"
        data_analysis_status["manual_fix"] = "pip install numpy==1.24.3 pandas==2.0.3 matplotlib==3.7.2 seaborn==0.12.2"

    return {
        "message": "Research and Data Analysis Server. Connect via WebSocket at /ws or /research-ws or use the REST endpoints.",
        "available_servers": app.state.available_servers,
        "features": ["research", "data_analysis"] if app.state.data_analysis_available else ["research"],
        "data_analysis_status": data_analysis_status,
        "setup": {
            "install_dependencies": "GET /install-data-analysis-deps to install required data analysis libraries"
        },
        "example": {
            "websocket": {
                "connect": "ws://localhost:8001/ws",
                "reconnect": "ws://localhost:8001/ws?client_id=YOUR_CLIENT_ID",
                "alternative_connect": "ws://localhost:8001/research-ws",
                "research_request": {"type": "research_request", "prompt": "Your research question here"},
                "analysis_request": {"type": "analysis_request", "file_id": "YOUR_FILE_ID", "analysis_type": "general"},
                "message": {"type": "message", "content": "Your research question here"},
                "string": "Your research question here",
                "get_result": {"type": "get_result", "job_id": "job_12345"},
                "list_jobs": {"type": "list_jobs"},
                "enable_terminal_view": {"type": "enable_terminal_view", "job_id": "job_12345"}
            },
            "rest": {
                "post /research": {"prompt": "Your research question here", "output_file": "optional_filename.md"},
                "post /upload": "Upload a file for analysis",
                "post /analysis": "Upload and analyze a file",
                "get /visualization/{job_id}/{filename}": "Get a visualization image",
                "get /research/results/{job_id}": "Retrieve results by job ID",
                "get /install-data-analysis-deps": "Install required data analysis dependencies"
            }
        },
        "analysis_types": {
            "general": "Standard comprehensive analysis",
            "exploratory": "Focused on exploratory data analysis (EDA)",
            "predictive": "Focused on relationships for predictive modeling"
        }
    }

@app.get("/research/results/{job_id}")
async def get_research_results(job_id: str):
    """Get the results of a completed research job by its ID."""
    # Check if the job is in the completed research
    if job_id in app.state.completed_research:
        completed_job = app.state.completed_research[job_id]
        output_path = completed_job["output_path"]

        # Check if the file exists
        if os.path.exists(output_path):
            try:
                with open(output_path, "r", encoding="utf-8") as f:
                    content = f.read()

                return {
                    "status": "success",
                    "job_id": job_id,
                    "output_file": completed_job["output_file"],
                    "content": content,
                    "prompt": completed_job["prompt"],
                    "completion_time": completed_job["completion_time"]
                }
            except Exception as e:
                return {
                    "status": "error",
                    "message": f"Error reading research results: {str(e)}"
                }
        else:
            return {
                "status": "error",
                "message": f"Research output file not found"
            }

    # Check if it's in the active research jobs
    elif job_id in research_jobs:
        job = research_jobs[job_id]
        return {
            "status": job["status"],
            "progress": job["progress"],
            "output_file": job.get("output_file"),
            "started_at": job.get("start_time"),
            "ended_at": job.get("end_time"),
            "error": job.get("error")
        }

    # Job not found
    return {
        "status": "not_found",
        "message": f"Research job with ID {job_id} not found"
    }

# Helper function to send visualization to client
async def send_visualization(client_id: str, job_id: str, file_path: str, description: str = "", viz_id: str = None):
    """Send visualization image to client via websocket."""
    if client_id in active_connections:
        websocket = active_connections[client_id]
        if websocket.client_state == WebSocketState.CONNECTED:
            try:
                # Read image file as base64
                with open(file_path, "rb") as img_file:
                    img_base64 = base64.b64encode(img_file.read()).decode('utf-8')

                # Generate a unique ID for this visualization if not provided
                viz_id = viz_id or f"viz_{uuid.uuid4()}"

                # Send to client
                await websocket.send_text(json.dumps({
                    "type": "visualization",
                    "job_id": job_id,
                    "viz_id": viz_id,
                    "image_data": img_base64,
                    "description": description,
                    "filename": os.path.basename(file_path),
                    "timestamp": time.time()
                }))
                return True
            except Exception as e:
                logger.error(f"Failed to send visualization to client {client_id}: {str(e)}")
                return False
    return False

async def run_analysis(file_path: str, client_id: str, analysis_type: str = "general", options: Dict[str, Any] = {}):
    """Run the data analysis agent with the given file and return the result."""
    job_id = f"analysis_{int(time.time())}_{uuid.uuid4()}"

    # Try to import data analysis libraries when needed
    data_analysis_error = None
    try:
        # Only import pandas and other libraries when needed
        import pandas
        import matplotlib
        matplotlib.use('Agg')  # Use non-interactive backend for Matplotlib
        import matplotlib.pyplot as plt
        import seaborn as sns
        import numpy as np
        data_analysis_available = True
    except ImportError as e:
        data_analysis_available = False
        data_analysis_error = str(e)
        logger.error(f"Data analysis libraries not available: {e}")

    # Check if data analysis is available
    if not data_analysis_available:
        error_message = f"Data analysis libraries not available: {data_analysis_error}"
        logger.error(error_message)

        # Notify client of error if connected
        if client_id in active_connections:
            websocket = active_connections[client_id]
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_text(json.dumps({
                    "type": "analysis_status",
                    "job_id": job_id,
                    "status": "failed",
                    "error": error_message,
                    "message": f"Analysis failed: {error_message}. Please run: pip install numpy==1.24.3 pandas==2.0.3 matplotlib==3.7.2 seaborn==0.12.2"
                }))

        raise ValueError(error_message)

    # Create output directory for this analysis job
    output_dir = f"/tmp/output/{job_id}"
    os.makedirs(output_dir, exist_ok=True)

    try:
        # Track job in analysis jobs
        research_jobs[job_id] = {  # Reusing research_jobs structure for consistency
            "status": "processing",
            "progress": 0,
            "output_dir": output_dir,
            "start_time": time.time(),
            "client_id": client_id,
            "file_path": file_path,
            "analysis_type": analysis_type,
            "streaming_enabled": False  # Will be set to True if streaming works
        }

        logger.info(f"Starting analysis job {job_id} for client {client_id} with file: {file_path}")

        # Notify client that analysis has started
        if client_id in active_connections:
            websocket = active_connections[client_id]
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_text(json.dumps({
                    "type": "analysis_status",
                    "job_id": job_id,
                    "status": "started",
                    "message": "Analysis started, loading data..."
                }))

        # Storage for streaming content
        full_content = []
        visualizations = []

        # Setup progress updates during analysis
        async def send_progress_updates():
            current_progress = 10
            max_progress = 90
            update_interval = 2  # seconds between updates

            try:
                while research_jobs[job_id]["status"] == "processing" and current_progress < max_progress:
                    await asyncio.sleep(update_interval)
                    # Only proceed if job is still processing
                    if job_id in research_jobs and research_jobs[job_id]["status"] == "processing":
                        current_progress += 5  # Increment by 5%
                        research_jobs[job_id]["progress"] = current_progress

                        # Send update to client
                        if client_id in active_connections:
                            client_ws = active_connections[client_id]
                            if client_ws.client_state == WebSocketState.CONNECTED:
                                progress_message = "Loading and processing data..." if current_progress < 30 else \
                                                  "Performing statistical analysis..." if current_progress < 60 else \
                                                  "Generating visualizations..."
                                await client_ws.send_text(json.dumps({
                                    "type": "analysis_status",
                                    "job_id": job_id,
                                    "status": "processing",
                                    "progress": current_progress,
                                    "message": progress_message
                                }))
                    else:
                        # Job is no longer processing, exit loop
                        break
            except Exception as e:
                logger.error(f"Error in progress updates: {str(e)}")

        # Start the progress update task
        progress_task = asyncio.create_task(send_progress_updates())

        # Add to client tasks
        if client_id in websocket_tasks:
            websocket_tasks[client_id].add(progress_task)

        # Define stream callback to capture output
        streaming_working = False

        async def handle_stream(content: str):
            """Handle streaming content from the agent."""
            nonlocal streaming_working
            full_content.append(content)
            # Stream the content to the client
            success = await stream_to_client(client_id, job_id, content, "analysis_stream")
            if success and not streaming_working:
                streaming_working = True
                research_jobs[job_id]["streaming_enabled"] = True
                logger.info(f"Streaming successfully established for analysis job {job_id}")

        # Setup a watcher for the output directory to detect new visualizations
        async def watch_for_visualizations():
            """Monitor the output directory for new visualization files."""
            known_files = set()

            while research_jobs[job_id]["status"] == "processing":
                # Check the output directory for PNG files
                current_files = set()
                for file in os.listdir(output_dir):
                    if file.endswith('.png'):
                        file_path = os.path.join(output_dir, file)
                        current_files.add(file_path)

                        # If this is a new file, send it to the client
                        if file_path not in known_files:
                            logger.info(f"New visualization detected: {file_path}")
                            description = f"Visualization: {os.path.basename(file_path)}"
                            # Send the visualization to the client
                            await send_visualization(client_id, job_id, file_path, description)
                            visualizations.append({
                                "path": file_path,
                                "description": description,
                                "filename": os.path.basename(file_path)
                            })

                known_files = current_files
                await asyncio.sleep(1)  # Check every second

        # Start the visualization watcher task
        viz_task = asyncio.create_task(watch_for_visualizations())

        # Add to client tasks
        if client_id in websocket_tasks:
            websocket_tasks[client_id].add(viz_task)

        # Prepare the analysis prompt based on analysis_type
        base_prompt = f"""
Analyze the CSV file located at {file_path}.
Perform a thorough data analysis including:
1. Data overview and basic statistics
2. Identify patterns, correlations, and insights
3. Create meaningful visualizations saved as PNG files in {output_dir}

Save each visualization with a descriptive filename in the format: {output_dir}/visualization_name.png
"""

        # Customize prompt based on analysis_type
        if analysis_type == "exploratory":
            analysis_prompt = base_prompt + """
Focus on exploratory data analysis (EDA):
- Comprehensive summary statistics
- Distribution plots for key variables
- Correlation analysis with heatmaps
- Identify outliers and their impact
"""
        elif analysis_type == "predictive":
            analysis_prompt = base_prompt + """
Focus on relationships that could be used for predictive modeling:
- Identify key predictor variables
- Analyze target variable distributions
- Create visualizations showing relationships between features
- Perform basic feature importance analysis
"""
        else:  # general analysis
            analysis_prompt = base_prompt + """
Provide a general analysis:
- Data overview and statistics
- Key trends and patterns
- Important correlations
- Distribution of important variables
- Any anomalies or special cases
"""

        # Add any custom options from the request
        if options:
            option_text = "\nAdditional analysis requirements:\n"
            for key, value in options.items():
                option_text += f"- {key}: {value}\n"
            analysis_prompt += option_text

        # Update progress
        research_jobs[job_id]["progress"] = 20

        if client_id in active_connections:
            websocket = active_connections[client_id]
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_text(json.dumps({
                    "type": "analysis_status",
                    "job_id": job_id,
                    "status": "processing",
                    "progress": 20,
                    "message": "Running data analysis..."
                }))

        # Run the analysis agent
        try:
            # Use the data_analysis agent
            async with app.state.agents.run("data_analysis") as agent:
                logger.info("Analysis agent session created successfully")

                # Try with streaming if available
                try:
                    # First try with stream_handler
                    responses = await agent.prompt(analysis_prompt, stream_handler=handle_stream)
                    logger.info("Successfully used streaming with analysis agent")
                except (TypeError, ValueError) as streaming_error:
                    # Try other streaming approaches
                    try:
                        responses = await agent.prompt(analysis_prompt, stream=True, callback=handle_stream)
                    except (TypeError, ValueError):
                        try:
                            responses = await agent.prompt(analysis_prompt, on_content=handle_stream)
                        except (TypeError, ValueError):
                            # Fall back to non-streaming approach
                            responses = await agent.prompt(analysis_prompt)
        except Exception as e:
            logger.error(f"Error running analysis agent: {str(e)}")
            logger.error(traceback.format_exc())

            # Try with interpreter directly as fallback
            try:
                logger.info("Trying fallback with interpreter directly...")

                # Create a basic analysis script
                analysis_script = f"""
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import os

# Set the output directory
output_dir = "{output_dir}"
os.makedirs(output_dir, exist_ok=True)

# Load the data
print("Loading data...")
df = pd.read_csv("{file_path}")

# Basic info
print("\\nData Overview:")
print(f"Shape: {{df.shape}}")
print("\\nColumn Information:")
print(df.dtypes)

# Summary statistics
print("\\nSummary Statistics:")
print(df.describe())

# Missing values
print("\\nMissing Values:")
print(df.isnull().sum())

# Save basic data info
with open(f"{{output_dir}}/data_summary.txt", "w") as f:
    f.write(f"Data Shape: {{df.shape}}\\n\\n")
    f.write("Column Information:\\n")
    f.write(str(df.dtypes)+"\\n\\n")
    f.write("Summary Statistics:\\n")
    f.write(str(df.describe())+"\\n\\n")
    f.write("Missing Values:\\n")
    f.write(str(df.isnull().sum())+"\\n\\n")

# Create visualizations
print("Generating visualizations...")

# 1. Distribution of numerical columns
print("Creating distribution plots...")
num_cols = df.select_dtypes(include=np.number).columns[:5]  # Limit to first 5 numerical columns
for col in num_cols:
    plt.figure(figsize=(10, 6))
    sns.histplot(df[col], kde=True)
    plt.title(f'Distribution of {{col}}')
    plt.tight_layout()
    plt.savefig(f"{{output_dir}}/distribution_{{col}}.png")
    plt.close()

# 2. Correlation heatmap
print("Creating correlation heatmap...")
plt.figure(figsize=(12, 10))
corr_matrix = df.select_dtypes(include=np.number).corr()
sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', fmt=".2f")
plt.title('Correlation Heatmap')
plt.tight_layout()
plt.savefig(f"{{output_dir}}/correlation_heatmap.png")
plt.close()

# 3. Boxplots for numerical columns
print("Creating boxplots...")
plt.figure(figsize=(14, 8))
df.select_dtypes(include=np.number).boxplot(figsize=(14, 8))
plt.title('Boxplots of Numerical Features')
plt.xticks(rotation=90)
plt.tight_layout()
plt.savefig(f"{{output_dir}}/boxplots.png")
plt.close()

# 4. Pairplot for a few numerical columns (limited to keep performance reasonable)
print("Creating pairplot...")
sns.pairplot(df[num_cols], height=2.5)
plt.savefig(f"{{output_dir}}/pairplot.png")
plt.close()

# 5. Count plot for categorical columns (if any)
cat_cols = df.select_dtypes(include=['object', 'category']).columns[:3]  # Limit to first 3
if len(cat_cols) > 0:
    print("Creating categorical plots...")
    for col in cat_cols:
        plt.figure(figsize=(10, 6))
        value_counts = df[col].value_counts()
        if len(value_counts) > 20:  # If too many categories, show top 20
            value_counts = value_counts.head(20)
        sns.barplot(x=value_counts.index, y=value_counts.values)
        plt.title(f'Count of {{col}}')
        plt.xticks(rotation=90)
        plt.tight_layout()
        plt.savefig(f"{{output_dir}}/count_{{col}}.png")
        plt.close()

print("Analysis complete!")
print(f"All visualizations saved to {{output_dir}}")
"""

                # Use the agent to run the analysis script
                async with app.state.agents.run("Researcher") as fallback_agent:
                    # Use the interpreter to run the analysis script
                    responses = await fallback_agent.prompt(f"Run this Python script to analyze a CSV file:\n```python\n{analysis_script}\n```")

            except Exception as fallback_error:
                logger.error(f"Fallback analysis also failed: {str(fallback_error)}")
                raise fallback_error

        # Extract response text
        if full_content:
            response_text = "".join(full_content)
        else:
            if isinstance(responses, dict) and "response" in responses:
                response_text = responses["response"]
            elif isinstance(responses, dict) and "text" in responses:
                response_text = responses["text"]
            elif isinstance(responses, dict) and "content" in responses:
                response_text = responses["content"]
            elif isinstance(responses, list):
                response_text = "\n\n".join([str(r) for r in responses])
            else:
                response_text = str(responses)

        # Make sure we have some content
        if not response_text.strip():
            response_text = "# Analysis Report\n\nNo results were returned from the analysis agent. Please try again with a different file."

        # Save the analysis report
        report_file = os.path.join(output_dir, "analysis_report.md")
        with open(report_file, "w", encoding="utf-8") as f:
            f.write(response_text)

        logger.info(f"Analysis results saved to {report_file}")

        # Update job status
        research_jobs[job_id]["progress"] = 100
        research_jobs[job_id]["status"] = "completed"
        research_jobs[job_id]["end_time"] = time.time()

        # Store completed analysis
        app.state.completed_analysis[job_id] = {
            "output_dir": output_dir,
            "report_file": report_file,
            "file_path": file_path,
            "client_id": client_id,
            "completion_time": time.time(),
            "visualizations": visualizations,
            "content": response_text
        }

        # Notify client of completion
        if client_id in active_connections:
            websocket = active_connections[client_id]
            if websocket.client_state == WebSocketState.CONNECTED:
                # Send completion status
                await websocket.send_text(json.dumps({
                    "type": "analysis_status",
                    "job_id": job_id,
                    "status": "completed",
                    "progress": 100,
                    "output_dir": output_dir,
                    "message": "Analysis complete! Results and visualizations are ready."
                }))

                # Send the analysis report
                await websocket.send_text(json.dumps({
                    "type": "analysis_result",
                    "job_id": job_id,
                    "status": "completed",
                    "report_file": report_file,
                    "content": response_text,
                    "visualizations": [
                        {
                            "filename": viz["filename"],
                            "description": viz["description"]
                        } for viz in visualizations
                    ]
                }))

        return output_dir

    except Exception as e:
        logger.error(f"Analysis job {job_id} failed: {str(e)}")
        logger.error(traceback.format_exc())

        # Update job status
        if job_id in research_jobs:
            research_jobs[job_id]["status"] = "failed"
            research_jobs[job_id]["error"] = str(e)
            research_jobs[job_id]["end_time"] = time.time()

        # Notify client of failure
        if client_id in active_connections:
            websocket = active_connections[client_id]
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_text(json.dumps({
                    "type": "analysis_status",
                    "job_id": job_id,
                    "status": "failed",
                    "error": str(e),
                    "message": f"Analysis failed: {str(e)}"
                }))

        raise e

# Add file upload endpoint
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file to be analyzed."""
    try:
        # Generate a unique ID for the file
        file_id = f"{uuid.uuid4()}"
        file_path = f"/tmp/data/{file_id}"

        # Save the uploaded file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Return the file ID for future reference
        return {
            "status": "success",
            "file_id": file_id,
            "message": "File uploaded successfully",
            "filename": file.filename
        }
    except Exception as e:
        logger.error(f"File upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

# Add endpoint to get visualization
@app.get("/visualization/{job_id}/{filename}")
async def get_visualization(job_id: str, filename: str):
    """Get a visualization file by job ID and filename."""
    try:
        # Check if the job exists in completed analysis
        if job_id in app.state.completed_analysis:
            output_dir = app.state.completed_analysis[job_id]["output_dir"]
            file_path = os.path.join(output_dir, filename)

            if os.path.exists(file_path) and filename.endswith('.png'):
                return FileResponse(file_path)
            else:
                raise HTTPException(status_code=404, detail="Visualization file not found")
        else:
            # Check if it's an active job
            if job_id in research_jobs and research_jobs[job_id].get("output_dir"):
                output_dir = research_jobs[job_id]["output_dir"]
                file_path = os.path.join(output_dir, filename)

                if os.path.exists(file_path) and filename.endswith('.png'):
                    return FileResponse(file_path)
                else:
                    raise HTTPException(status_code=404, detail="Visualization file not found")

            raise HTTPException(status_code=404, detail=f"Analysis job {job_id} not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving visualization: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving visualization: {str(e)}")

# Add analysis REST endpoint
@app.post("/analysis")
async def create_analysis(file: UploadFile = File(...), analysis_type: str = "general", background_tasks: BackgroundTasks = None):
    """REST endpoint to start a data analysis task with a file upload."""
    # Check if data analysis is available
    if not data_analysis_available:
        error_message = f"Data analysis functionality is not available: {data_analysis_error}"
        raise HTTPException(
            status_code=503,
            detail={
                "error": error_message,
                "fix": "Please install required dependencies: pip install numpy==1.24.3 pandas==2.0.3 matplotlib==3.7.2 seaborn==0.12.2"
            }
        )

    client_id = f"rest_{uuid.uuid4()}"

    try:
        # Generate a unique file ID
        file_id = f"{uuid.uuid4()}"
        file_path = f"/tmp/data/{file_id}"

        # Save the uploaded file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Start the analysis in the background
        if background_tasks:
            background_tasks.add_task(
                run_analysis,
                file_path,
                client_id,
                analysis_type,
                {}
            )
        else:
            # Start a task ourselves
            asyncio.create_task(run_analysis(file_path, client_id, analysis_type, {}))

        return {
            "status": "started",
            "client_id": client_id,
            "file_id": file_id,
            "analysis_type": analysis_type,
            "message": "Analysis task started"
        }
    except Exception as e:
        logger.error(f"Analysis request failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis request failed: {str(e)}")

# Add endpoint to install data analysis dependencies
@app.get("/install-data-analysis-deps")
async def install_data_analysis_deps():
    """Endpoint to install data analysis dependencies."""
    try:
        import subprocess
        import sys

        # Create the install command with exact versions
        cmd = [
            sys.executable, "-m", "pip", "install",
            "numpy==1.24.3",
            "pandas==2.0.3",
            "matplotlib==3.7.2",
            "seaborn==0.12.2"
        ]

        # Run the install command
        result = subprocess.run(
            cmd,
            check=True,
            capture_output=True,
            text=True
        )

        # Return the installation result
        return {
            "status": "success",
            "message": "Data analysis dependencies installed successfully. Please restart the server.",
            "output": result.stdout,
            "command": " ".join(cmd)
        }
    except Exception as e:
        # If installation fails, return error
        return {
            "status": "error",
            "message": f"Failed to install dependencies: {str(e)}",
            "error": traceback.format_exc(),
            "manual_command": "pip install numpy==1.24.3 pandas==2.0.3 matplotlib==3.7.2 seaborn==0.12.2"
        }

@app.websocket("/")
async def root_websocket_endpoint(
    websocket: WebSocket,
    client_id: Optional[str] = Query(None)
):
    # Just forward to the main websocket endpoint
    return await websocket_endpoint(websocket, client_id)

@app.get("/ws-debug")
async def websocket_debug():
    """Debug endpoint for WebSocket configuration."""
    available_endpoints = [
        {"path": "/", "handler": "root_websocket_endpoint"},
        {"path": "/ws", "handler": "websocket_endpoint"},
        {"path": "/research-ws", "handler": "research_websocket_endpoint"}
    ]

    return {
        "status": "healthy",
        "websocket_endpoints": available_endpoints,
        "available_servers": app.state.available_servers,
        "healthcheck": "If you see this, HTTP requests are working properly",
        "debug_info": "If WebSocket connections are failing with code 1006, check that your proxy is forwarding the Upgrade headers correctly"
    }

if __name__ == "__main__":
    import uvicorn
    import argparse
    import signal

    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Research and Analysis Server")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8001, help="Port to bind to")
    parser.add_argument("--ngrok-ready", action="store_true", help="Configure for ngrok tunneling")
    args = parser.parse_args()

    # Setup signal handlers for graceful shutdown
    def signal_handler(sig, frame):
        logger.info(f"Received signal {sig}, shutting down...")
        # Add cleanup code here if needed
        import sys
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Run the server
    if args.ngrok_ready:
        logger.info("Configuring server for ngrok tunneling...")
        # Additional settings for ngrok tunneling
        config = uvicorn.Config(
            app=app,
            host=args.host,
            port=args.port,
            log_level="info",
            timeout_keep_alive=120,  # Longer keepalive timeout
            websocket_ping_interval=20,  # Send pings more frequently
            websocket_ping_timeout=30,  # Longer ping timeout
            ssl_keyfile=None,  # Don't use SSL - ngrok handles it
            ssl_certfile=None,
            proxy_headers=True  # Process proxy headers from ngrok
        )
        server = uvicorn.Server(config)

        # Send ready signal to Node.js parent process
        import time
        time.sleep(1)  # Small delay to ensure logging is setup
        print("Application startup complete")
        logger.info("Research server startup complete - ready for connections")

        server.run()
    else:
        # Standard server configuration
        config = uvicorn.Config(
            app=app,
            host=args.host,
            port=args.port,
            log_level="info",
        )
        server = uvicorn.Server(config)

        # Send ready signal to Node.js parent process
        import time
        time.sleep(1)  # Small delay to ensure logging is setup
        print("Application startup complete")
        logger.info("Research server startup complete - ready for connections")
