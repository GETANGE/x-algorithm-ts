import { Source } from '../candidate_pipeline/candidate_pipeline';
import { PostCandidate, ScoredPostsQuery, ServedType } from '../types';
import { PhoenixClient } from '../services/phoenix';

export class PhoenixSource implements Source {
  constructor(
    private phoenixClient: PhoenixClient,
    private getUserHistory: (userId: string) => Promise<any[]>
  ) {}

  async getCandidates(query: ScoredPostsQuery): Promise<PostCandidate[]> {
    if (query.inNetworkOnly) return [];
    
    const userHistory = await this.getUserHistory(query.userId);
    const candidates = await this.phoenixClient.retrieveCandidates(query.userId, userHistory, 50);
    
    return candidates.map(candidate => ({
      ...candidate,
      servedType: ServedType.FOR_YOU_PHOENIX_RETRIEVAL,
      inNetwork: false
    }));
  }
}
