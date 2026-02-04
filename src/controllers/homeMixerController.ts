// Controllers for handling HTTP requests
import { Request, Response } from 'express';
import { HomeMixerService } from '../services/homeMixer';
import { ThunderService } from '../services/thunder';
import { Post, UserAction, ActionType } from '../types';

export class HomeMixerController {
  constructor(
    private homeMixer: HomeMixerService,
    private thunderService: ThunderService
  ) {}

  async getHealth(req: Request, res: Response) {
    const thunderStats = await this.thunderService.getStats();
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      services: {
        thunder: thunderStats,
        phoenix: 'connected'
      }
    });
  }

  async getScoredPosts(req: Request, res: Response) {
    try {
      const query = {
        userId: req.body.userId || 'viewer',
        maxResults: req.body.maxResults || 10,
        seenPostIds: req.body.seenPostIds || [],
        servedPostIds: req.body.servedPostIds || [],
        inNetworkOnly: req.body.inNetworkOnly || false,
        userFeatures: req.body.userFeatures,
        requestId: req.body.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      console.log(`📥 Received scored posts request for user ${query.userId}`);
      const startTime = Date.now();
      
      const result = await this.homeMixer.getScoredPosts(query);
      
      const duration = Date.now() - startTime;
      console.log(`📤 Returning ${result.selectedCandidates.length} posts (${duration}ms)`);
      
      res.json({
        posts: result.selectedCandidates.map(candidate => ({
          id: candidate.tweetId,
          content: candidate.tweetText,
          authorId: candidate.authorId,
          authorScreenName: candidate.authorScreenName,
          score: candidate.score,
          phoenixScores: candidate.phoenixScores,
          inNetwork: candidate.inNetwork,
          source: candidate.source,
          servedType: candidate.servedType,
          videoDurationMs: candidate.videoDurationMs,
          inReplyToTweetId: candidate.inReplyToTweetId,
          retweetedTweetId: candidate.retweetedTweetId
        })),
        metadata: {
          totalRetrieved: result.retrievedCandidates.length,
          totalFiltered: result.filteredCandidates.length,
          totalSelected: result.selectedCandidates.length,
          requestId: result.query.requestId,
          processingTimeMs: duration
        }
      });
    } catch (error) {
      console.error('Error getting scored posts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async createPost(req: Request, res: Response) {
    const post: Post = {
      id: req.body.id || Date.now().toString(),
      authorId: req.body.authorId,
      content: req.body.content,
      createdAt: Date.now(),
      isReply: req.body.isReply || false,
      isRetweet: req.body.isRetweet || false,
      hasVideo: req.body.hasVideo || false,
      inReplyToPostId: req.body.inReplyToPostId,
      retweetedPostId: req.body.retweetedPostId,
      retweetedUserId: req.body.retweetedUserId,
      conversationId: req.body.conversationId,
      videoDurationMs: req.body.videoDurationMs
    };

    await this.thunderService.addPost(post);
    console.log(`📝 Added new post: ${post.id} by ${post.authorId}`);
    
    res.json({ success: true, postId: post.id });
  }

  async addUserAction(req: Request, res: Response) {
    const userId = req.params.userId;
    const action: UserAction = {
      postId: req.body.postId,
      actionType: req.body.actionType,
      timestamp: Date.now()
    };

    await this.homeMixer.addUserAction(userId, action);
    console.log(`👤 Added user action: ${userId} ${action.actionType} on ${action.postId}`);
    
    res.json({ success: true });
  }

  async getStats(req: Request, res: Response) {
    const thunderStats = await this.thunderService.getStats();
    res.json({
      thunder: thunderStats,
      timestamp: new Date().toISOString()
    });
  }
}
