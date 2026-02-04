import { Selector } from '../candidate_pipeline/candidate_pipeline';
import { PostCandidate, ScoredPostsQuery } from '../types';

export class TopKScoreSelector implements Selector {
  select(candidates: PostCandidate[], query: ScoredPostsQuery): PostCandidate[] {
    return candidates
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, query.maxResults);
  }
}
