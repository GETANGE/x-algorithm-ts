import { createClient, RedisClientType } from 'redis';

export class RedisService {
  private client: RedisClientType;
  private connected = false;

  constructor(url = process.env.REDIS_URL || 'redis://localhost:6379') {
    this.client = createClient({ url });
    
    this.client.on('error', (err) => console.error('Redis Client Error', err));
    this.client.on('connect', () => {
      this.connected = true;
      console.log('✅ Redis connected');
    });
  }

  async connect() {
    if (!this.connected) {
      await this.client.connect();
    }
  }

  async disconnect() {
    if (this.connected) {
      await this.client.disconnect();
      this.connected = false;
    }
  }

  getClient(): RedisClientType {
    return this.client;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Singleton instance
export const redisService = new RedisService();
