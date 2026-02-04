// Routes configuration
import { Router } from 'express';
import { HomeMixerController } from '../controllers/homeMixerController';

export function createRoutes(controller: HomeMixerController): Router {
  const router = Router();

  // Health check
  router.get('/health', (req, res) => controller.getHealth(req, res));

  // For You feed
  router.post('/scored-posts', (req, res) => controller.getScoredPosts(req, res));

  // Post management
  router.post('/posts', (req, res) => controller.createPost(req, res));

  // User actions
  router.post('/users/:userId/actions', (req, res) => controller.addUserAction(req, res));

  // Statistics
  router.get('/stats', (req, res) => controller.getStats(req, res));

  return router;
}
