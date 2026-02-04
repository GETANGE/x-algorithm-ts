import { Filter } from '../candidate_pipeline/candidate_pipeline';
import { PostCandidate, ScoredPostsQuery } from '../types';

export class ServedPostsFilter implements Filter {
  filter(candidates: PostCandidate[], query: ScoredPostsQuery): PostCandidate[] {
    const servedIds = new Set(query.servedPostIds);
    return candidates.filter(candidate => !servedIds.has(candidate.tweetId));
  }
}
