import { Filter } from '../candidate_pipeline/candidate_pipeline';
import { PostCandidate } from '../types';

export class AgeFilter implements Filter {
  constructor(private maxAgeHours = 24) {}

  filter(candidates: PostCandidate[]): PostCandidate[] {
    const cutoff = Date.now() - (this.maxAgeHours * 60 * 60 * 1000);
    return candidates.filter(candidate => {
      const createdAt = this.extractCreatedAtFromId(candidate.tweetId);
      return createdAt > cutoff;
    });
  }

  private extractCreatedAtFromId(tweetId: string): number {
    // Simple mock - in reality would extract timestamp from Twitter snowflake ID
    return Date.now() - Math.random() * 24 * 60 * 60 * 1000;
  }
}
