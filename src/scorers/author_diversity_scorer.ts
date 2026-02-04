import { Scorer } from '../candidate_pipeline/candidate_pipeline';
import { PostCandidate } from '../types';
import { redisService } from '../services/redis';

export class AuthorDiversityScorer implements Scorer {
  private get redis() {
    return redisService.getClient();
  }

  async score(candidates: PostCandidate[]): Promise<PostCandidate[]> {
    // Sort by current score first
    const sortedCandidates = [...candidates].sort((a, b) => 
      (b.weightedScore || 0) - (a.weightedScore || 0)
    );

    const scoredCandidates = [];
    
    for (const candidate of sortedCandidates) {
      // Get current author count from Redis
      const count = await this.redis.hGet('author_counts', candidate.authorId);
      const currentCount = count ? parseInt(count) : 0;
      
      // Increment count for this request
      await this.redis.hIncrBy('author_counts', candidate.authorId, 1);
      
      // Apply diversity multiplier
      const multiplier = this.getMultiplier(currentCount);
      const currentScore = candidate.weightedScore || 0;
      
      scoredCandidates.push({ 
        ...candidate, 
        score: currentScore * multiplier 
      });
    }

    return scoredCandidates;
  }

  private getMultiplier(position: number): number {
    // Reduce score for repeated authors
    switch (position) {
      case 0: return 1.0;      // First post from author
      case 1: return 0.8;      // Second post
      case 2: return 0.6;      // Third post
      default: return 0.4;     // Fourth+ post
    }
  }
}
