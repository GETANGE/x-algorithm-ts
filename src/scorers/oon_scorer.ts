import { Scorer } from '../candidate_pipeline/candidate_pipeline';
import { PostCandidate } from '../types';

export class OONScorer implements Scorer {
  private readonly OON_WEIGHT_FACTOR = 0.8; // Reduce out-of-network scores slightly

  async score(candidates: PostCandidate[]): Promise<PostCandidate[]> {
    return candidates.map(candidate => {
      const currentScore = candidate.score || 0;
      
      // Apply OON weight factor to out-of-network posts
      const adjustedScore = candidate.inNetwork === false 
        ? currentScore * this.OON_WEIGHT_FACTOR 
        : currentScore;

      return { 
        ...candidate, 
        score: adjustedScore 
      };
    });
  }
}
