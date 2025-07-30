// services/OBD2RealtimeService.js - Real-time OBD2 data service without WebSockets

import Redis from 'ioredis';
import mongoose from 'mongoose';

class OBD2RealtimeService {
    constructor() {
        this.redis = null;
        this.redisPub = null;
        this.redisSub = null;
        this.activeStreams = new Map();
        this.dataCache = new Map();
        this.isInitialized = false;
        
        // Configuration
        this.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
        this.CACHE_TTL = 300; // 5 minutes
        this.MAX_CACHE_SIZE = 1000;
        this.CLEANUP_INTERVAL = 60000; // 1 minute
        
        this.initialize();
    }

    async initialize() {
        try {
            // Create Redis connections
            this.redis = new Redis(this.REDIS_URL, {
                retryDelayOnFailover: 100,
                maxRetriesPerRequest: 3,
                lazyConnect: true
            });

            this.redisPub = new Redis(this.REDIS_URL, {
                retryDelayOnFailover: 100,
                maxRetriesPerRequest: 3,
                lazyConnect: true
            });

            this.redisSub = new Redis(this.REDIS_URL, {
                retryDelayOnFailover: 100,
                maxRetriesPerRequest: 3,
                lazyConnect: true
            });

            // Test connections
            await this.redis.ping();
            await this.redisPub.ping();
            await this.redisSub.ping();

            // Start cleanup job
            setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);

            this.isInitialized = true;
            console.log('✅ OBD2 Realtime Service initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize OBD2 Realtime Service:', error);
            this.isInitialized = false;
        }
    }

    // Store live data point in Redis with TTL
    async storeDataPoint(sessionId, dataPoint) {
        if (!this.isInitialized) return false;

        try {
            const timestamp = Date.now();
            const key = `session:${sessionId}:live`;
            const cacheKey = `session:${sessionId}:recent`;
            
            // Store in sorted set with timestamp as score
            await this.redis.zadd(key, timestamp, JSON.stringify(dataPoint));
            
            // Keep only last 1000 points per session
            await this.redis.zremrangebyrank(key, 0, -1001);
            
            // Set TTL on the key
            await this.redis.expire(key, this.CACHE_TTL);
            
            // Store in recent data list for polling
            await this.redis.lpush(cacheKey, JSON.stringify({
                ...dataPoint,
                timestamp
            }));
            await this.redis.ltrim(cacheKey, 0, 99); // Keep last 100
            await this.redis.expire(cacheKey, this.CACHE_TTL);
            
            // Publish to subscribers
            await this.redisPub.publish(`session:${sessionId}:updates`, JSON.stringify({
                ...dataPoint,
                timestamp
            }));
            
            return true;
        } catch (error) {
            console.error('❌ Failed to store data point:', error);
            return false;
        }
    }

    // Get data by time range
    async getDataByTimeRange(sessionId, startTime, endTime = Date.now(), limit = 1000) {
        if (!this.isInitialized) return [];

        try {
            const key = `session:${sessionId}:live`;
            const data = await this.redis.zrangebyscore(
                key, 
                startTime, 
                endTime, 
                'LIMIT', 0, limit
            );
            
            return data.map(item => JSON.parse(item));
        } catch (error) {
            console.error('❌ Failed to get data by time range:', error);
            return [];
        }
    }

    // Get recent updates for polling
    async getRecentUpdates(sessionId, since = 0, limit = 50) {
        if (!this.isInitialized) return [];

        try {
            const cacheKey = `session:${sessionId}:recent`;
            const updates = await this.redis.lrange(cacheKey, 0, limit - 1);
            
            const parsed = updates.map(u => JSON.parse(u));
            
            // Filter by timestamp if 'since' is provided
            if (since > 0) {
                return parsed.filter(item => item.timestamp > since);
            }
            
            return parsed;
        } catch (error) {
            console.error('❌ Failed to get recent updates:', error);
            return [];
        }
    }

    // Subscribe to session updates for SSE
    async subscribeToSession(sessionId, callback) {
        if (!this.isInitialized) return null;

        try {
            const channel = `session:${sessionId}:updates`;
            
            // Create new subscriber for this connection
            const subscriber = new Redis(this.REDIS_URL);
            
            subscriber.subscribe(channel);
            subscriber.on('message', (receivedChannel, message) => {
                if (receivedChannel === channel) {
                    try {
                        const data = JSON.parse(message);
                        callback(data);
                    } catch (error) {
                        console.error('❌ Failed to parse Redis message:', error);
                    }
                }
            });

            return subscriber;
        } catch (error) {
            console.error('❌ Failed to subscribe to session:', error);
            return null;
        }
    }

    // Get aggregated data for charts
    async getAggregatedData(sessionId, interval = 'minute', limit = 100) {
        if (!this.isInitialized) return [];

        try {
            const key = `session:${sessionId}:live`;
            const data = await this.redis.zrange(key, -limit, -1);
            
            if (data.length === 0) return [];

            const parsed = data.map(item => JSON.parse(item));
            
            // Simple aggregation by time intervals
            const intervalMs = interval === 'second' ? 1000 : 
                             interval === 'minute' ? 60000 : 
                             300000; // 5 minutes default
            
            const aggregated = {};
            
            parsed.forEach(item => {
                const bucket = Math.floor(item.timestamp / intervalMs) * intervalMs;
                
                if (!aggregated[bucket]) {
                    aggregated[bucket] = {
                        timestamp: bucket,
                        count: 0,
                        rpm: { sum: 0, count: 0 },
                        speed: { sum: 0, count: 0 },
                        engineTemp: { sum: 0, count: 0 },
                        throttlePosition: { sum: 0, count: 0 },
                        engineLoad: { sum: 0, count: 0 }
                    };
                }
                
                const bucket_data = aggregated[bucket];
                bucket_data.count++;
                
                // Aggregate numeric values
                ['rpm', 'speed', 'engineTemp', 'throttlePosition', 'engineLoad'].forEach(field => {
                    if (typeof item[field] === 'number') {
                        bucket_data[field].sum += item[field];
                        bucket_data[field].count++;
                    }
                });
            });
            
            // Calculate averages
            return Object.values(aggregated).map(bucket => ({
                timestamp: bucket.timestamp,
                count: bucket.count,
                rpm: bucket.rpm.count > 0 ? bucket.rpm.sum / bucket.rpm.count : null,
                speed: bucket.speed.count > 0 ? bucket.speed.sum / bucket.speed.count : null,
                engineTemp: bucket.engineTemp.count > 0 ? bucket.engineTemp.sum / bucket.engineTemp.count : null,
                throttlePosition: bucket.throttlePosition.count > 0 ? bucket.throttlePosition.sum / bucket.throttlePosition.count : null,
                engineLoad: bucket.engineLoad.count > 0 ? bucket.engineLoad.sum / bucket.engineLoad.count : null
            })).sort((a, b) => a.timestamp - b.timestamp);
            
        } catch (error) {
            console.error('❌ Failed to get aggregated data:', error);
            return [];
        }
    }

    // Clean up old data and inactive connections
    async cleanup() {
        try {
            // Remove expired cache entries
            const cacheKeys = Array.from(this.dataCache.keys());
            const now = Date.now();
            
            for (const key of cacheKeys) {
                const entry = this.dataCache.get(key);
                if (entry && (now - entry.timestamp) > (this.CACHE_TTL * 1000)) {
                    this.dataCache.delete(key);
                }
            }

            // Limit cache size
            if (this.dataCache.size > this.MAX_CACHE_SIZE) {
                const entries = Array.from(this.dataCache.entries());
                entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
                
                const toDelete = entries.slice(0, this.dataCache.size - this.MAX_CACHE_SIZE);
                toDelete.forEach(([key]) => this.dataCache.delete(key));
            }

        } catch (error) {
            console.error('❌ Cleanup error:', error);
        }
    }

    // Get session statistics
    async getSessionStats(sessionId) {
        if (!this.isInitialized) return null;

        try {
            const key = `session:${sessionId}:live`;
            const count = await this.redis.zcard(key);
            const range = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
            const lastRange = await this.redis.zrange(key, -1, -1, 'WITHSCORES');
            
            const startTime = range.length > 0 ? parseInt(range[1]) : null;
            const endTime = lastRange.length > 0 ? parseInt(lastRange[1]) : null;
            
            return {
                sessionId,
                dataPointCount: count,
                startTime,
                endTime,
                duration: startTime && endTime ? endTime - startTime : null
            };
        } catch (error) {
            console.error('❌ Failed to get session stats:', error);
            return null;
        }
    }

    // Health check
    async healthCheck() {
        try {
            if (!this.isInitialized) return { status: 'down', error: 'Not initialized' };
            
            await this.redis.ping();
            await this.redisPub.ping();
            await this.redisSub.ping();
            
            return { 
                status: 'up', 
                cacheSize: this.dataCache.size,
                activeStreams: this.activeStreams.size,
                redisConnected: true
            };
        } catch (error) {
            return { status: 'down', error: error.message, redisConnected: false };
        }
    }

    // Graceful shutdown
    async shutdown() {
        try {
            if (this.redis) await this.redis.quit();
            if (this.redisPub) await this.redisPub.quit();
            if (this.redisSub) await this.redisSub.quit();
            
            this.dataCache.clear();
            this.activeStreams.clear();
            
            console.log('✅ OBD2 Realtime Service shut down gracefully');
        } catch (error) {
            console.error('❌ Error during shutdown:', error);
        }
    }
}

// Create singleton instance
const obd2RealtimeService = new OBD2RealtimeService();

export default obd2RealtimeService;