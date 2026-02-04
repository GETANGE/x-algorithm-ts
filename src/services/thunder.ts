// Thunder - In-network post storage and retrieval with Redis
import { Post } from '../types';
import { redisService } from './redis';

export interface LightPost {
  id: string;
  authorId: string;
  content: string;
  createdAt: number;
  isReply: boolean;
  isRetweet: boolean;
  hasVideo: boolean;
  inReplyToPostId?: string;
  retweetedPostId?: string;
  retweetedUserId?: string;
  conversationId?: string;
  videoDurationMs?: number;
}

export class ThunderService {
  private readonly MAX_POSTS_PER_USER = 100;
  private readonly MAX_ORIGINAL_POSTS_PER_AUTHOR = 20;
  private readonly MAX_REPLY_POSTS_PER_AUTHOR = 10;
  private readonly MAX_VIDEO_POSTS_PER_AUTHOR = 15;
  private readonly RETENTION_SECONDS = 24 * 60 * 60; // 24 hours

  private get redis() {
    return redisService.getClient();
  }

  async addPost(post: Post) {
    const lightPost: LightPost = {
      id: post.id,
      authorId: post.authorId,
      content: post.content,
      createdAt: post.createdAt,
      isReply: post.isReply,
      isRetweet: post.isRetweet,
      hasVideo: post.hasVideo,
      inReplyToPostId: post.inReplyToPostId,
      retweetedPostId: post.retweetedPostId,
      retweetedUserId: post.retweetedUserId,
      conversationId: post.conversationId,
      videoDurationMs: post.videoDurationMs
    };

    // Skip if already deleted
    const isDeleted = await this.redis.sIsMember('deleted_posts', post.id);
    if (isDeleted) return;

    // Store post
    await this.redis.hSet('posts', post.id, JSON.stringify(lightPost));
    
    // Add to appropriate user timelines
    const isOriginal = !post.isReply && !post.isRetweet;
    
    if (isOriginal) {
      await this.addToUserTimeline('original_posts', post.authorId, lightPost, this.MAX_ORIGINAL_POSTS_PER_AUTHOR);
    } else {
      await this.addToUserTimeline('secondary_posts', post.authorId, lightPost, this.MAX_REPLY_POSTS_PER_AUTHOR);
    }

    // Add to video timeline if eligible
    let videoEligible = post.hasVideo;
    
    // Check if retweet of video post
    if (!videoEligible && post.isRetweet && post.retweetedPostId) {
      const sourcePostData = await this.redis.hGet('posts', post.retweetedPostId);
      if (sourcePostData) {
        const sourcePost = JSON.parse(sourcePostData) as LightPost;
        if (!sourcePost.isReply && sourcePost.hasVideo) {
          videoEligible = true;
        }
      }
    }

    // Replies are not video eligible
    if (post.isReply) {
      videoEligible = false;
    }

    if (videoEligible) {
      await this.addToUserTimeline('video_posts', post.authorId, lightPost, this.MAX_VIDEO_POSTS_PER_AUTHOR);
    }

    // Add to general user timeline
    await this.addToUserTimeline('user_posts', post.authorId, lightPost, this.MAX_POSTS_PER_USER);
  }

  private async addToUserTimeline(
    timelinePrefix: string, 
    userId: string, 
    post: LightPost, 
    maxPosts: number
  ) {
    const key = `${timelinePrefix}:${userId}`;
    
    // Add post with score as timestamp for sorting
    await this.redis.zAdd(key, { score: post.createdAt, value: post.id });
    
    // Keep only recent posts
    const count = await this.redis.zCard(key);
    if (count > maxPosts) {
      await this.redis.zRemRangeByRank(key, 0, count - maxPosts - 1);
    }
  }

  async getInNetworkPosts(followingIds: string[], maxResults: number): Promise<LightPost[]> {
    const candidates: LightPost[] = [];
    const excludePostIds = new Set<string>();
    
    for (const userId of followingIds) {
      // Get original posts
      const originalPosts = await this.getPostsFromTimeline(
        'original_posts', 
        [userId], 
        this.MAX_ORIGINAL_POSTS_PER_AUTHOR,
        excludePostIds
      );
      candidates.push(...originalPosts);

      // Get secondary posts (replies/retweets)
      const secondaryPosts = await this.getPostsFromTimeline(
        'secondary_posts',
        [userId],
        this.MAX_REPLY_POSTS_PER_AUTHOR,
        excludePostIds
      );
      candidates.push(...secondaryPosts);
    }
    
    // Filter deleted posts and sort by recency
    const validCandidates = [];
    for (const post of candidates) {
      const isDeleted = await this.redis.sIsMember('deleted_posts', post.id);
      if (!isDeleted) {
        validCandidates.push(post);
      }
    }
    
    return validCandidates
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, maxResults);
  }

  async getVideoPostsByUsers(userIds: string[], maxResults: number): Promise<LightPost[]> {
    const excludePostIds = new Set<string>();
    const videoPosts = await this.getPostsFromTimeline(
      'video_posts',
      userIds,
      this.MAX_VIDEO_POSTS_PER_AUTHOR,
      excludePostIds
    );

    const validPosts = [];
    for (const post of videoPosts) {
      const isDeleted = await this.redis.sIsMember('deleted_posts', post.id);
      if (!isDeleted) {
        validPosts.push(post);
      }
    }

    return validPosts
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, maxResults);
  }

  private async getPostsFromTimeline(
    timelinePrefix: string,
    userIds: string[],
    maxPerUser: number,
    excludePostIds: Set<string>
  ): Promise<LightPost[]> {
    const posts: LightPost[] = [];
    
    for (const userId of userIds) {
      const key = `${timelinePrefix}:${userId}`;
      
      // Get post IDs sorted by recency (highest score first)
      const postIds = await this.redis.zRevRange(key, 0, maxPerUser - 1);
      
      for (const postId of postIds) {
        if (excludePostIds.has(postId)) continue;
        
        const postData = await this.redis.hGet('posts', postId);
        if (postData) {
          const post = JSON.parse(postData) as LightPost;
          posts.push(post);
          excludePostIds.add(postId);
        }
      }
    }
    
    return posts;
  }

  async removePost(postId: string) {
    const postData = await this.redis.hGet('posts', postId);
    if (postData) {
      const post = JSON.parse(postData) as LightPost;
      
      // Remove from posts hash and add to deleted set
      await this.redis.hDel('posts', postId);
      await this.redis.sAdd('deleted_posts', postId);
      
      // Remove from all user timelines
      await this.removeFromUserTimeline('user_posts', post.authorId, postId);
      await this.removeFromUserTimeline('original_posts', post.authorId, postId);
      await this.removeFromUserTimeline('secondary_posts', post.authorId, postId);
      await this.removeFromUserTimeline('video_posts', post.authorId, postId);
    }
  }

  private async removeFromUserTimeline(timelinePrefix: string, userId: string, postId: string) {
    const key = `${timelinePrefix}:${userId}`;
    await this.redis.zRem(key, postId);
  }

  // Cleanup old posts
  async trimOldPosts(): Promise<number> {
    const now = Date.now() / 1000; // Convert to seconds
    const cutoff = now - this.RETENTION_SECONDS;
    let trimmed = 0;

    // Get all post IDs and check their age
    const allPostIds = await this.redis.hKeys('posts');
    
    for (const postId of allPostIds) {
      const postData = await this.redis.hGet('posts', postId);
      if (postData) {
        const post = JSON.parse(postData) as LightPost;
        if (post.createdAt <= cutoff) {
          await this.removePost(postId);
          trimmed++;
        }
      }
    }

    // Clean up empty timelines by removing posts older than cutoff from sorted sets
    const timelinePrefixes = ['user_posts', 'original_posts', 'secondary_posts', 'video_posts'];
    for (const prefix of timelinePrefixes) {
      const pattern = `${prefix}:*`;
      const keys = await this.redis.keys(pattern);
      
      for (const key of keys) {
        await this.redis.zRemRangeByScore(key, 0, cutoff);
        
        // Remove empty sets
        const count = await this.redis.zCard(key);
        if (count === 0) {
          await this.redis.del(key);
        }
      }
    }

    return trimmed;
  }

  async getStats() {
    const totalPosts = await this.redis.hLen('posts');
    const deletedPosts = await this.redis.sCard('deleted_posts');
    
    // Count unique users across different timeline types
    const timelinePrefixes = ['user_posts', 'original_posts', 'secondary_posts', 'video_posts'];
    const stats: any = { totalPosts, deletedPosts };
    
    for (const prefix of timelinePrefixes) {
      const pattern = `${prefix}:*`;
      const keys = await this.redis.keys(pattern);
      stats[`${prefix}Users`] = keys.length;
    }
    
    return stats;
  }

  // Start auto-cleanup
  startAutoTrim(intervalMinutes = 2) {
    setInterval(async () => {
      const trimmed = await this.trimOldPosts();
      if (trimmed > 0) {
        console.log(`⚡ Thunder auto-trim: removed ${trimmed} old posts`);
      }
    }, intervalMinutes * 60 * 1000);
  }
}
