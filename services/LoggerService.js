// services/LoggerService.js
import { io } from '../socket/socket.js';

export class LoggerService {
  static eventPrefix = 'crawl:';
  
  static info(message, data = {}) {
    console.log(message);
    io.emit(`${this.eventPrefix}log`, { 
      type: 'info', 
      message, 
      data,
      timestamp: new Date().toISOString()
    });
  }
  
  static progress(stage, current, total, details = {}) {
    const message = `${stage}: ${current}/${total} (${Math.round(current/total*100)}%)`;
    console.log(message);
    io.emit(`${this.eventPrefix}progress`, { 
      type: 'progress', 
      message,
      stage,
      current,
      total,
      percentage: Math.round(current/total*100),
      details,
      timestamp: new Date().toISOString()
    });
  }
  
  static warning(message, data = {}) {
    console.warn(message);
    io.emit(`${this.eventPrefix}log`, { 
      type: 'warning', 
      message, 
      data,
      timestamp: new Date().toISOString()
    });
  }
  
  static error(message, error = null) {
    console.error(message, error);
    io.emit(`${this.eventPrefix}log`, { 
      type: 'error', 
      message, 
      error: error?.message || null,
      stack: error?.stack || null,
      timestamp: new Date().toISOString()
    });
  }
  
  static startProcess(processName, totalSteps = null) {
    io.emit(`${this.eventPrefix}start`, { 
      processName, 
      totalSteps,
      timestamp: new Date().toISOString()
    });
  }
  
  static completeProcess(processName, summary = {}) {
    io.emit(`${this.eventPrefix}complete`, { 
      processName, 
      summary,
      timestamp: new Date().toISOString()
    });
  }
}