#!/usr/bin/env python3
"""
ELM327 OBD2 MCP Server
Provides Model Context Protocol interface for ELM327 OBD2 adapters
"""

import asyncio
import json
import logging
import time
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import sys
import os
from datetime import datetime

# MCP Server imports
try:
    from mcp.server import Server
    from mcp.server.models import InitializeResult
    from mcp.types import (
        TextContent,
        Tool,
        CallToolResult,
    )
except ImportError:
    print("MCP SDK not installed. Install with: pip install mcp", file=sys.stderr)
    sys.exit(1)

# OBD2 imports - using python-OBD library
try:
    import obd
    from obd import OBD, commands
    from obd.protocols import ECU
except ImportError:
    print("python-OBD not installed. Install with: pip install obd", file=sys.stderr)
    print("Note: This is a lightweight OBD2 library for Python", file=sys.stderr)
    obd = None

@dataclass
class OBD2Reading:
    """Represents a single OBD2 data reading"""
    pid: str
    value: Any
    unit: str
    timestamp: float
    raw_value: Optional[bytes] = None
    error: Optional[str] = None

class ELM327MCPServer:
    """MCP Server for ELM327 OBD2 adapter communication"""
    
    def __init__(self, config_path: Optional[str] = None):
        self.server = Server("elm327-obd2-server")
        self.connection: Optional[OBD] = None
        self.config = self.load_config(config_path)
        self.last_connection_test = 0
        self.connection_cache_duration = 30  # seconds
        
        # Setup logging
        logging.basicConfig(
            level=getattr(logging, self.config.get('log_level', 'INFO')),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
        
        # Register tools
        self.register_tools()
        
    def load_config(self, config_path: Optional[str] = None) -> Dict:
        """Load configuration from file or use defaults"""
        default_config = {
            "device_path": "/dev/ttyUSB0",
            "baud_rate": 38400,
            "timeout": 10,
            "protocol": "AUTO",
            "log_level": "INFO",
            "max_retries": 3,
            "retry_delay": 1.0
        }
        
        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    config = json.load(f)
                    # Merge with defaults
                    default_config.update(config.get('elm327_config', {}))
            except Exception as e:
                self.logger.warning(f"Failed to load config from {config_path}: {e}")
        
        return default_config
    
    def register_tools(self):
        """Register MCP tools for OBD2 operations"""
        
        @self.server.call_tool()
        async def read_realtime_pids(
            pids: List[str],
            duration_seconds: float = 10.0,
            sampling_rate_hz: float = 1.0,
            protocol: str = "AUTO"
        ) -> List[CallToolResult]:
            """Read real-time OBD2 PIDs for specified duration"""
            
            try:
                # Validate parameters
                if duration_seconds > 300:
                    duration_seconds = 300
                if sampling_rate_hz > 10:
                    sampling_rate_hz = 10
                    
                # Connect to ELM327
                await self.ensure_connection(protocol)
                
                if not self.connection:
                    raise Exception("Failed to connect to ELM327 adapter")
                
                # Collect data
                readings = []
                interval = 1.0 / sampling_rate_hz
                end_time = time.time() + duration_seconds
                
                self.logger.info(f"Starting data collection for {duration_seconds}s at {sampling_rate_hz}Hz")
                
                while time.time() < end_time:
                    reading_batch = {}
                    timestamp = time.time()
                    
                    # Read each requested PID
                    for pid_str in pids:
                        try:
                            reading = await self.read_pid(pid_str)
                            if reading and not reading.error:
                                reading_batch[pid_str] = reading.value
                        except Exception as e:
                            self.logger.warning(f"Failed to read PID {pid_str}: {e}")
                            reading_batch[pid_str] = None
                    
                    if reading_batch:
                        readings.append({
                            "timestamp": datetime.fromtimestamp(timestamp).isoformat(),
                            "data": reading_batch,
                            "raw_timestamp": timestamp
                        })
                    
                    # Wait for next sample
                    await asyncio.sleep(interval)
                
                result = {
                    "success": True,
                    "readings": readings,
                    "metadata": {
                        "duration": duration_seconds,
                        "sampling_rate": sampling_rate_hz,
                        "total_samples": len(readings),
                        "pids": pids
                    }
                }
                
                return [CallToolResult(content=[TextContent(type="text", text=json.dumps(result))])]
                
            except Exception as e:
                self.logger.error(f"Real-time data collection failed: {e}")
                error_result = {
                    "success": False,
                    "error": str(e),
                    "readings": []
                }
                return [CallToolResult(content=[TextContent(type="text", text=json.dumps(error_result))])]
        
        @self.server.call_tool()
        async def read_dtcs(dtc_type: str = "stored") -> List[CallToolResult]:
            """Read diagnostic trouble codes"""
            
            try:
                await self.ensure_connection()
                
                if not self.connection:
                    raise Exception("Not connected to ELM327 adapter")
                
                # Read DTCs based on type
                if dtc_type == "stored":
                    dtcs = self.connection.query(commands.GET_DTC)
                elif dtc_type == "pending":
                    dtcs = self.connection.query(commands.GET_PENDING_DTC) 
                elif dtc_type == "permanent":
                    # Note: Not all vehicles support permanent DTCs
                    dtcs = []  # Would need specific implementation
                else:
                    raise ValueError(f"Unknown DTC type: {dtc_type}")
                
                # Format DTCs
                dtc_list = []
                if dtcs and dtcs.value:
                    for dtc in dtcs.value:
                        dtc_list.append({
                            "code": str(dtc[0]) if dtc else "UNKNOWN",
                            "description": str(dtc[1]) if len(dtc) > 1 else "No description available"
                        })
                
                result = {
                    "success": True,
                    "dtc_type": dtc_type,
                    "dtcs": dtc_list,
                    "count": len(dtc_list),
                    "timestamp": datetime.now().isoformat()
                }
                
                return [CallToolResult(content=[TextContent(type="text", text=json.dumps(result))])]
                
            except Exception as e:
                self.logger.error(f"DTC reading failed: {e}")
                error_result = {
                    "success": False,
                    "error": str(e),
                    "dtc_type": dtc_type,
                    "dtcs": []
                }
                return [CallToolResult(content=[TextContent(type="text", text=json.dumps(error_result))])]
        
        @self.server.call_tool()
        async def clear_dtcs(confirm: bool = False) -> List[CallToolResult]:
            """Clear diagnostic trouble codes"""
            
            try:
                if not confirm:
                    raise ValueError("DTC clearing requires explicit confirmation")
                
                await self.ensure_connection()
                
                if not self.connection:
                    raise Exception("Not connected to ELM327 adapter")
                
                # Clear DTCs
                response = self.connection.query(commands.CLEAR_DTC)
                
                result = {
                    "success": True,
                    "cleared": True,
                    "response": str(response) if response else "No response",
                    "timestamp": datetime.now().isoformat()
                }
                
                return [CallToolResult(content=[TextContent(type="text", text=json.dumps(result))])]
                
            except Exception as e:
                self.logger.error(f"DTC clearing failed: {e}")
                error_result = {
                    "success": False,
                    "error": str(e),
                    "cleared": False
                }
                return [CallToolResult(content=[TextContent(type="text", text=json.dumps(error_result))])]
        
        @self.server.call_tool() 
        async def test_connection() -> List[CallToolResult]:
            """Test ELM327 connection and get adapter info"""
            
            try:
                start_time = time.time()
                await self.ensure_connection()
                response_time = (time.time() - start_time) * 1000  # ms
                
                if not self.connection:
                    raise Exception("Failed to establish connection")
                
                # Get adapter information
                elm_version = "Unknown"
                protocol = "Unknown" 
                voltage = None
                
                try:
                    # Try to get ELM327 version
                    if hasattr(self.connection, 'interface') and hasattr(self.connection.interface, 'elm_version'):
                        elm_version = self.connection.interface.elm_version
                    
                    # Get current protocol
                    if hasattr(self.connection, 'protocol'):
                        protocol = str(self.connection.protocol)
                    
                    # Try to read voltage
                    voltage_cmd = self.connection.query(commands.ELM_VOLTAGE)
                    if voltage_cmd and voltage_cmd.value:
                        voltage = float(voltage_cmd.value.magnitude)
                        
                except Exception as info_error:
                    self.logger.warning(f"Could not get adapter info: {info_error}")
                
                result = {
                    "success": True,
                    "connected": True,
                    "response_time_ms": round(response_time, 2),
                    "elm327_version": elm_version,
                    "protocol": protocol,
                    "voltage": voltage,
                    "timestamp": datetime.now().isoformat()
                }
                
                return [CallToolResult(content=[TextContent(type="text", text=json.dumps(result))])]
                
            except Exception as e:
                self.logger.error(f"Connection test failed: {e}")
                error_result = {
                    "success": False,
                    "connected": False,
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                }
                return [CallToolResult(content=[TextContent(type="text", text=json.dumps(error_result))])]
        
        @self.server.call_tool()
        async def get_vehicle_vin() -> List[CallToolResult]:
            """Get vehicle identification number"""
            
            try:
                await self.ensure_connection()
                
                if not self.connection:
                    raise Exception("Not connected to ELM327 adapter")
                
                vin_response = self.connection.query(commands.VIN)
                
                if vin_response and vin_response.value:
                    vin = str(vin_response.value)
                else:
                    vin = None
                
                result = {
                    "success": True,
                    "vin": vin,
                    "available": vin is not None,
                    "timestamp": datetime.now().isoformat()
                }
                
                return [CallToolResult(content=[TextContent(type="text", text=json.dumps(result))])]
                
            except Exception as e:
                self.logger.error(f"VIN reading failed: {e}")
                error_result = {
                    "success": False,
                    "error": str(e),
                    "vin": None
                }
                return [CallToolResult(content=[TextContent(type="text", text=json.dumps(error_result))])]

    async def ensure_connection(self, protocol: str = "AUTO"):
        """Ensure ELM327 connection is established"""
        current_time = time.time()
        
        # Check if we have a recent connection test
        if (self.connection and 
            current_time - self.last_connection_test < self.connection_cache_duration):
            return
        
        self.last_connection_test = current_time
        
        # Close existing connection if any
        if self.connection:
            try:
                self.connection.close()
            except:
                pass
            self.connection = None
        
        # Establish new connection
        try:
            if obd is None:
                raise Exception("python-OBD library not available")
                
            self.logger.info(f"Connecting to ELM327 on {self.config['device_path']}")
            
            # Create connection with retry logic
            for attempt in range(self.config.get('max_retries', 3)):
                try:
                    self.connection = obd.OBD(
                        portstr=self.config['device_path'],
                        baudrate=self.config.get('baud_rate', 38400),
                        protocol=protocol if protocol != "AUTO" else None,
                        fast=False,  # More reliable connection
                        timeout=self.config.get('timeout', 10)
                    )
                    
                    if self.connection and self.connection.is_connected():
                        self.logger.info("Successfully connected to ELM327")
                        break
                    else:
                        raise Exception("Connection established but not operational")
                        
                except Exception as e:
                    self.logger.warning(f"Connection attempt {attempt + 1} failed: {e}")
                    if attempt < self.config.get('max_retries', 3) - 1:
                        await asyncio.sleep(self.config.get('retry_delay', 1.0))
                    else:
                        raise
                        
        except Exception as e:
            self.logger.error(f"Failed to connect to ELM327: {e}")
            self.connection = None
            raise
    
    async def read_pid(self, pid_str: str) -> Optional[OBD2Reading]:
        """Read a single PID from the vehicle"""
        try:
            if not self.connection:
                raise Exception("Not connected to ELM327")
            
            # Map PID string to OBD command
            pid_map = {
                "01 0C": commands.RPM,
                "01 0D": commands.SPEED, 
                "01 05": commands.COOLANT_TEMP,
                "01 0F": commands.INTAKE_TEMP,
                "01 11": commands.THROTTLE_POS,
                "01 04": commands.ENGINE_LOAD,
                "01 06": commands.SHORT_FUEL_TRIM_1,
                "01 07": commands.LONG_FUEL_TRIM_1,
                "01 0B": commands.INTAKE_PRESSURE,
                "01 42": commands.CONTROL_MODULE_VOLTAGE
            }
            
            cmd = pid_map.get(pid_str)
            if not cmd:
                return OBD2Reading(
                    pid=pid_str,
                    value=None,
                    unit="unknown",
                    timestamp=time.time(),
                    error=f"Unsupported PID: {pid_str}"
                )
            
            response = self.connection.query(cmd)
            
            if response and response.value is not None:
                # Extract value and unit
                if hasattr(response.value, 'magnitude'):
                    value = response.value.magnitude
                    unit = str(response.value.units) if hasattr(response.value, 'units') else ""
                else:
                    value = float(response.value)
                    unit = ""
                
                return OBD2Reading(
                    pid=pid_str,
                    value=value,
                    unit=unit,
                    timestamp=time.time(),
                    raw_value=getattr(response, 'raw', None)
                )
            else:
                return OBD2Reading(
                    pid=pid_str,
                    value=None,
                    unit="unknown",
                    timestamp=time.time(),
                    error="No data received"
                )
                
        except Exception as e:
            return OBD2Reading(
                pid=pid_str,
                value=None,
                unit="unknown", 
                timestamp=time.time(),
                error=str(e)
            )
    
    async def run(self):
        """Run the MCP server"""
        # Setup server handlers
        @self.server.list_tools()
        async def handle_list_tools() -> List[Tool]:
            """List available tools"""
            return [
                Tool(
                    name="read_realtime_pids",
                    description="Read real-time OBD2 PIDs for specified duration",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "pids": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "List of PID codes to read (e.g. ['01 0C', '01 0D'])"
                            },
                            "duration_seconds": {
                                "type": "number",
                                "description": "Duration to collect data",
                                "default": 10.0
                            },
                            "sampling_rate_hz": {
                                "type": "number", 
                                "description": "Data sampling rate in Hz",
                                "default": 1.0
                            },
                            "protocol": {
                                "type": "string",
                                "description": "OBD2 protocol to use",
                                "default": "AUTO"
                            }
                        },
                        "required": ["pids"]
                    }
                ),
                Tool(
                    name="read_dtcs",
                    description="Read diagnostic trouble codes",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "dtc_type": {
                                "type": "string",
                                "enum": ["stored", "pending", "permanent"],
                                "default": "stored"
                            }
                        }
                    }
                ),
                Tool(
                    name="clear_dtcs",
                    description="Clear diagnostic trouble codes",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "confirm": {
                                "type": "boolean",
                                "description": "Confirmation required for safety"
                            }
                        },
                        "required": ["confirm"]
                    }
                ),
                Tool(
                    name="test_connection",
                    description="Test ELM327 connection and get adapter info",
                    inputSchema={"type": "object", "properties": {}}
                ),
                Tool(
                    name="get_vehicle_vin",
                    description="Get vehicle identification number",
                    inputSchema={"type": "object", "properties": {}}
                )
            ]
        
        # Run the server
        async with self.server:
            await self.server.serve()

async def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="ELM327 OBD2 MCP Server")
    parser.add_argument("--config", help="Configuration file path")
    parser.add_argument("--device", help="ELM327 device path", default="/dev/ttyUSB0")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    
    args = parser.parse_args()
    
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Create and run server
    server = ELM327MCPServer(config_path=args.config)
    
    if args.device:
        server.config['device_path'] = args.device
    
    try:
        await server.run()
    except KeyboardInterrupt:
        logging.info("Server shutdown requested")
    except Exception as e:
        logging.error(f"Server error: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))