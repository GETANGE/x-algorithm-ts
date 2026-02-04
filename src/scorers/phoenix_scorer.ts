import { Scorer } from '../candidate_pipeline/candidate_pipeline';
import { PostCandidate, ScoredPostsQuery } from '../types';
import { PhoenixClient } from '../services/phoenix';

export class PhoenixScorer implements Scorer {
  constructor(
    private phoenixClient: PhoenixClient,
    private getUserHistory: (userId: string) => Promise<any[]>
  ) {}

  async score(candidates: PostCandidate[], query: ScoredPostsQuery): Promise<PostCandidate[]> {
    const userHistory = await this.getUserHistory(query.userId);
    return this.phoenixClient.rankCandidates(query.userId, candidates, userHistory);
  }
}
