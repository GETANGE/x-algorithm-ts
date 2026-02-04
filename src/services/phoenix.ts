// Phoenix client - ML-based retrieval and ranking
import axios from 'axios';
import { PostCandidate, UserAction, PhoenixScores } from '../types';

export class PhoenixClient {
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:8001') {
    this.baseUrl = baseUrl;
  }

  async retrieveCandidates(
    userId: string, 
    userHistory: UserAction[], 
    maxResults: number
  ): Promise<PostCandidate[]> {
    try {
      const response = await axios.post(`${this.baseUrl}/retrieve`, {
        user_id: userId,
        user_history: userHistory,
        max_results: maxResults
      });
      
      return response.data.candidates.map((candidate: any) => ({
        tweetId: candidate.post.id,
        authorId: candidate.post.authorId,
        tweetText: candidate.post.content,
        inNetwork: false,
        source: 'phoenix' as const,
        inReplyToTweetId: candidate.post.inReplyToPostId,
        retweetedTweetId: candidate.post.retweetedPostId,
        retweetedUserId: candidate.post.retweetedUserId,
        conversationId: candidate.post.conversationId,
        videoDurationMs: candidate.post.videoDurationMs
      }));
    } catch (error) {
      console.error('Phoenix retrieval failed:', error);
      return [];
    }
  }

  async rankCandidates(
    userId: string,
    candidates: PostCandidate[],
    userHistory: UserAction[]
  ): Promise<PostCandidate[]> {
    try {
      const candidatesForRanking = candidates.map(c => ({
        id: c.tweetId,
        authorId: c.authorId,
        content: c.tweetText || '',
        createdAt: Date.now(), // Mock timestamp
        isReply: !!c.inReplyToTweetId,
        isRetweet: !!c.retweetedTweetId,
        hasVideo: !!c.videoDurationMs
      }));

      const response = await axios.post(`${this.baseUrl}/rank`, {
        user_id: userId,
        candidates: candidatesForRanking,
        user_history: userHistory
      });
      
      // Apply Phoenix scores to candidates
      return candidates.map((candidate, index) => {
        const scores = response.data.scores[index];
        return {
          ...candidate,
          phoenixScores: {
            favoriteScore: scores.favorite || 0,
            replyScore: scores.reply || 0,
            retweetScore: scores.retweet || 0,
            clickScore: scores.click || 0,
            shareScore: scores.share || 0,
            followScore: scores.follow || 0,
            blockScore: scores.block || 0,
            muteScore: scores.mute || 0,
            profileClickScore: scores.profile_click || 0,
            videoViewScore: scores.video_view || 0,
            photoExpandScore: scores.photo_expand || 0,
            dwellScore: scores.dwell || 0,
            quoteScore: scores.quote || 0,
            notInterestedScore: scores.not_interested || 0,
            reportScore: scores.report || 0,
            dwellTime: scores.dwell_time || 0
          },
          lastScoredAt: Date.now(),
          predictionRequestId: `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
      });
    } catch (error) {
      console.error('Phoenix ranking failed:', error);
      return candidates;
    }
  }
}
