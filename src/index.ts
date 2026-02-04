// Main Express server
import express from 'express';
import { HomeMixerService } from './services/homeMixer';
import { ThunderService } from './services/thunder';
import { PhoenixClient } from './services/phoenix';
import { redisService } from './services/redis';
import { HomeMixerController } from './controllers/homeMixerController';
import { createRoutes } from './routes';
import { Post, User, ActionType } from './types';

const app = express();
app.use(express.json());

async function initializeServices() {
  // Connect to Redis first
  await redisService.connect();
  
  // Initialize services
  const thunderService = new ThunderService();
  const phoenixClient = new PhoenixClient();
  const homeMixer = new HomeMixerService(thunderService, phoenixClient);

  // Initialize controller
  const controller = new HomeMixerController(homeMixer, thunderService);

  // Setup routes
  app.use('/', createRoutes(controller));

  // Add sample data
  const samplePosts: Post[] = [
    {
      id: '1',
      authorId: 'user1',
      content: 'Hello world! This is my first post.',
      createdAt: Date.now() - 1000 * 60 * 30,
      isReply: false,
      isRetweet: false,
      hasVideo: false
    },
    {
      id: '2',
      authorId: 'user2',
      content: 'Great weather today! Perfect for a walk in the park.',
      createdAt: Date.now() - 1000 * 60 * 60,
      isReply: false,
      isRetweet: false,
      hasVideo: false
    },
    {
      id: '3',
      authorId: 'user3',
      content: 'Check out this amazing video!',
      createdAt: Date.now() - 1000 * 60 * 45,
      isReply: false,
      isRetweet: false,
      hasVideo: true,
      videoDurationMs: 30000
    }
  ];

  const sampleUsers: User[] = [
    {
      id: 'viewer',
      followingIds: ['user1', 'user2', 'user3'],
      engagementHistory: [
        {
          postId: '1',
          actionType: ActionType.FAVORITE,
          timestamp: Date.now() - 1000 * 60 * 15
        }
      ],
      mutedKeywords: ['spam'],
      blockedUserIds: [],
      mutedUserIds: [],
      screenName: 'viewer_user',
      followersCount: 150
    }
  ];

  // Add sample data
  for (const post of samplePosts) {
    await thunderService.addPost(post);
  }
  for (const user of sampleUsers) {
    await homeMixer.addUser(user);
  }

  return { homeMixer, thunderService };
}

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await redisService.disconnect();
  process.exit(0);
});

const PORT = process.env.PORT || 3000;

// Start server
initializeServices().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Home Mixer server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔥 For You feed: POST http://localhost:${PORT}/scored-posts`);
    console.log(`📝 Add posts: POST http://localhost:${PORT}/posts`);
    console.log(`📈 Stats: GET http://localhost:${PORT}/stats`);
    console.log('');
    console.log('Sample request:');
    console.log(`curl -X POST http://localhost:${PORT}/scored-posts -H "Content-Type: application/json" -d '{"userId": "viewer", "maxResults": 5}'`);
  });
}).catch((error) => {
  console.error('Failed to initialize services:', error);
  process.exit(1);
});

export default app;
