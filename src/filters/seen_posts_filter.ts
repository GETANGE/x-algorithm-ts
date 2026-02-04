import { Filter } from '../candidate_pipeline/candidate_pipeline';
import { PostCandidate, ScoredPostsQuery } from '../types';

export class SeenPostsFilter implements Filter {
  filter(candidates: PostCandidate[], query: ScoredPostsQuery): PostCandidate[] {
    const seenIds = new Set(query.seenPostIds);
    return candidates.filter(candidate => !seenIds.has(candidate.tweetId));
  }
}
