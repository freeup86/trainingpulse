const redis = require('redis');
const logger = require('../utils/logger');

let client;
let publisher;
let subscriber;

const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD || undefined,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: 3,
  retryDelayOnClusterDown: 300,
  enableOfflineQueue: false,
  lazyConnect: true,
  connectTimeout: 5000,
  commandTimeout: 5000
};

let redisAvailable = false;

async function connectRedis() {
  try {
    // Skip Redis connection if running without Redis service
    if (process.env.SKIP_REDIS === 'true') {
      logger.info('Skipping Redis connection (SKIP_REDIS=true)');
      redisAvailable = false;
      return null;
    }

    // Main Redis client for general operations
    client = redis.createClient(redisConfig);
    
    client.on('error', (err) => {
      logger.warn('Redis client error (running without Redis):', err.message);
      redisAvailable = false;
      // Don't try to reconnect on initial connection failure
      if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
        client.disconnect().catch(() => {});
      }
    });
    
    client.on('connect', () => {
      logger.info('Redis client connected');
      redisAvailable = true;
    });
    
    client.on('ready', () => {
      logger.info('Redis client ready');
      redisAvailable = true;
    });
    
    await client.connect();
    
    // Test the connection
    await client.ping();
    logger.info('Redis connection test successful');
    redisAvailable = true;
    
    // Create separate clients for pub/sub
    publisher = client.duplicate();
    subscriber = client.duplicate();
    
    await publisher.connect();
    await subscriber.connect();
    
    logger.info('Redis pub/sub clients connected');
    
    return client;
  } catch (error) {
    logger.warn('Failed to connect to Redis - running without caching:', error.message);
    redisAvailable = false;
    // Clean up any partially created clients
    if (client) {
      try { await client.disconnect(); } catch {}
    }
    if (publisher) {
      try { await publisher.disconnect(); } catch {}
    }
    if (subscriber) {
      try { await subscriber.disconnect(); } catch {}
    }
    client = null;
    publisher = null;
    subscriber = null;
    return null;
  }
}

// Cache operations
async function get(key) {
  if (!redisAvailable || !client) return null;
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Redis GET error:', error);
    return null;
  }
}

async function set(key, value, ttl = 3600) {
  if (!redisAvailable || !client) return false;
  try {
    const serialized = JSON.stringify(value);
    if (ttl > 0) {
      await client.setEx(key, ttl, serialized);
    } else {
      await client.set(key, serialized);
    }
    return true;
  } catch (error) {
    logger.error('Redis SET error:', error);
    return false;
  }
}

async function del(key) {
  try {
    return await client.del(key);
  } catch (error) {
    logger.error('Redis DEL error:', error);
    return 0;
  }
}

async function exists(key) {
  if (!redisAvailable || !client) return 0;
  try {
    return await client.exists(key);
  } catch (error) {
    logger.error('Redis EXISTS error:', error);
    return 0;
  }
}

// Hash operations for complex data
async function hget(key, field) {
  try {
    const value = await client.hGet(key, field);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Redis HGET error:', error);
    return null;
  }
}

async function hset(key, field, value) {
  try {
    const serialized = JSON.stringify(value);
    return await client.hSet(key, field, serialized);
  } catch (error) {
    logger.error('Redis HSET error:', error);
    return 0;
  }
}

async function hgetall(key) {
  try {
    const hash = await client.hGetAll(key);
    const result = {};
    Object.entries(hash).forEach(([field, value]) => {
      try {
        result[field] = JSON.parse(value);
      } catch {
        result[field] = value;
      }
    });
    return result;
  } catch (error) {
    logger.error('Redis HGETALL error:', error);
    return {};
  }
}

// List operations for queues
async function lpush(key, ...values) {
  try {
    const serialized = values.map(v => JSON.stringify(v));
    return await client.lPush(key, ...serialized);
  } catch (error) {
    logger.error('Redis LPUSH error:', error);
    return 0;
  }
}

async function rpop(key) {
  try {
    const value = await client.rPop(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Redis RPOP error:', error);
    return null;
  }
}

async function llen(key) {
  try {
    return await client.lLen(key);
  } catch (error) {
    logger.error('Redis LLEN error:', error);
    return 0;
  }
}

// Set operations for unique collections
async function sadd(key, ...members) {
  try {
    return await client.sAdd(key, ...members);
  } catch (error) {
    logger.error('Redis SADD error:', error);
    return 0;
  }
}

async function srem(key, ...members) {
  try {
    return await client.sRem(key, ...members);
  } catch (error) {
    logger.error('Redis SREM error:', error);
    return 0;
  }
}

async function smembers(key) {
  try {
    return await client.sMembers(key);
  } catch (error) {
    logger.error('Redis SMEMBERS error:', error);
    return [];
  }
}

// Pub/Sub operations
async function publish(channel, message) {
  if (!redisAvailable || !publisher) return 0;
  try {
    return await publisher.publish(channel, JSON.stringify(message));
  } catch (error) {
    logger.error('Redis PUBLISH error:', error);
    return 0;
  }
}

async function subscribe(channel, callback) {
  try {
    await subscriber.subscribe(channel, (message) => {
      try {
        const parsed = JSON.parse(message);
        callback(parsed);
      } catch {
        callback(message);
      }
    });
  } catch (error) {
    logger.error('Redis SUBSCRIBE error:', error);
  }
}

async function unsubscribe(channel) {
  try {
    return await subscriber.unsubscribe(channel);
  } catch (error) {
    logger.error('Redis UNSUBSCRIBE error:', error);
  }
}

// Session management
async function setSession(sessionId, data, ttl = 86400) {
  return await set(`session:${sessionId}`, data, ttl);
}

async function getSession(sessionId) {
  return await get(`session:${sessionId}`);
}

async function deleteSession(sessionId) {
  return await del(`session:${sessionId}`);
}

// Token blacklist management
async function blacklistToken(token, ttl) {
  return await set(`blacklist:${token}`, true, ttl);
}

async function isTokenBlacklisted(token) {
  return await exists(`blacklist:${token}`);
}

// Cache invalidation patterns
async function invalidatePattern(pattern) {
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      return await client.del(keys);
    }
    return 0;
  } catch (error) {
    logger.error('Redis pattern invalidation error:', error);
    return 0;
  }
}

async function closeRedis() {
  try {
    if (client) await client.quit();
    if (publisher) await publisher.quit();
    if (subscriber) await subscriber.quit();
    logger.info('Redis connections closed');
  } catch (error) {
    logger.error('Error closing Redis connections:', error);
  }
}

module.exports = {
  connectRedis,
  closeRedis,
  
  // Basic operations
  get,
  set,
  del,
  exists,
  
  // Hash operations
  hget,
  hset,
  hgetall,
  
  // List operations
  lpush,
  rpop,
  llen,
  
  // Set operations
  sadd,
  srem,
  smembers,
  
  // Pub/Sub
  publish,
  subscribe,
  unsubscribe,
  
  // Session management
  setSession,
  getSession,
  deleteSession,
  
  // Token management
  blacklistToken,
  isTokenBlacklisted,
  
  // Cache invalidation
  invalidatePattern,
  
  // Direct client access
  client: () => client,
  publisher: () => publisher,
  subscriber: () => subscriber
};