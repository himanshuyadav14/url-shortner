const redis = require("redis");

const redisClient = redis.createClient({
  url: process.env.REDIS_URI,
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));
redisClient.connect();

module.exports = redisClient;
