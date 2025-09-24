const redis = require('redis');

let redisClient;

const connectRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    redisClient.on('error', (err) => {
      console.log('Redis Client Error', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis Connected');
    });

    // For development without Redis server, we'll use a mock
    try {
      await redisClient.connect();
    } catch (error) {
      console.log('Redis not available, using mock notifications');
      redisClient = {
        publish: () => Promise.resolve(),
        subscribe: () => Promise.resolve(),
        get: () => Promise.resolve(null),
        set: () => Promise.resolve(),
        del: () => Promise.resolve()
      };
    }
  } catch (error) {
    console.error('Redis connection failed:', error);
    // Create mock client for development
    redisClient = {
      publish: () => Promise.resolve(),
      subscribe: () => Promise.resolve(),
      get: () => Promise.resolve(null),
      set: () => Promise.resolve(),
      del: () => Promise.resolve()
    };
  }
};

const getRedisClient = () => redisClient;

module.exports = { connectRedis, getRedisClient };