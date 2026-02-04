import { Source } from '../candidate_pipeline/candidate_pipeline';
import { PostCandidate, ScoredPostsQuery, ServedType } from '../types';
import { ThunderService } from '../services/thunder';

export class ThunderSource implements Source {
  constructor(
    private thunderService: ThunderService,
    private getUserFollowing: (userId: string) => Promise<string[]>
  ) {}

  async getCandidates(query: ScoredPostsQuery): Promise<PostCandidate[]> {
    const followingIds = await this.getUserFollowing(query.userId);
    const posts = await this.thunderService.getInNetworkPosts(followingIds, 50);
    
    return posts.map(post => ({
      tweetId: post.id,
      authorId: post.authorId,
      tweetText: post.content,
      inNetwork: true,
      source: 'thunder' as const,
      servedType: ServedType.FOR_YOU_IN_NETWORK,
      inReplyToTweetId: post.inReplyToPostId,
      retweetedTweetId: post.retweetedPostId,
      retweetedUserId: post.retweetedUserId,
      conversationId: post.conversationId,
      videoDurationMs: post.videoDurationMs
    }));
  }
}
