import { Filter } from '../candidate_pipeline/candidate_pipeline';
import { PostCandidate, ScoredPostsQuery } from '../types';

export class SelfPostFilter implements Filter {
  filter(candidates: PostCandidate[], query: ScoredPostsQuery): PostCandidate[] {
    return candidates.filter(candidate => candidate.authorId !== query.userId);
  }
}
