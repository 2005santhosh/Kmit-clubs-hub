const redis = require('redis');

let redisClient;

const connectRedis = async () => {
  try {
    // Try to connect to Redis with the provided URL or default to localhost
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    console.log(`Attempting to connect to Redis at: ${redisUrl}`);
    
    redisClient = redis.createClient({
      url: redisUrl,
      // Add socket timeout to fail fast if connection issues
      socket: {
        reconnectStrategy: (retries) => {
          // Stop reconnecting after 3 attempts
          if (retries > 3) {
            console.log('Redis reconnection attempts exhausted, using mock client');
            throw new Error('Redis connection failed');
          }
          return Math.min(retries * 50, 500);
        }
      }
    });

    redisClient.on('error', (err) => {
      console.log('Redis Client Error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('Redis Connected Successfully');
    });

    // Try to connect
    await redisClient.connect();
    console.log('Redis connection established');
    
  } catch (error) {
    console.error('Redis connection failed:', error.message);
    console.log('Using mock Redis client for development');
    
    // Create mock client for development when Redis is not available
    redisClient = {
      publish: (channel, message) => {
        console.log(`[MOCK REDIS] Published to ${channel}:`, message);
        return Promise.resolve();
      },
      subscribe: (channel, callback) => {
        console.log(`[MOCK REDIS] Subscribed to ${channel}`);
        return Promise.resolve();
      },
      get: (key) => {
        console.log(`[MOCK REDIS] Get key: ${key}`);
        return Promise.resolve(null);
      },
      set: (key, value, options) => {
        console.log(`[MOCK REDIS] Set key: ${key} = ${value}`);
        return Promise.resolve();
      },
      del: (key) => {
        console.log(`[MOCK REDIS] Delete key: ${key}`);
        return Promise.resolve();
      },
      connect: () => Promise.resolve(),
      quit: () => Promise.resolve(),
      on: (event, callback) => {
        // Mock event handler
        return redisClient;
      }
    };
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    console.warn('Redis client not initialized. Returning mock client.');
    // Return a mock client if not initialized
    return {
      publish: (channel, message) => {
        console.log(`[MOCK REDIS] Published to ${channel}:`, message);
        return Promise.resolve();
      },
      subscribe: (channel, callback) => {
        console.log(`[MOCK REDIS] Subscribed to ${channel}`);
        return Promise.resolve();
      },
      get: (key) => {
        console.log(`[MOCK REDIS] Get key: ${key}`);
        return Promise.resolve(null);
      },
      set: (key, value) => {
        console.log(`[MOCK REDIS] Set key: ${key} = ${value}`);
        return Promise.resolve();
      },
      del: (key) => {
        console.log(`[MOCK REDIS] Delete key: ${key}`);
        return Promise.resolve();
      }
    };
  }
  return redisClient;
};

module.exports = { connectRedis, getRedisClient };