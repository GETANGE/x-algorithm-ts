import { Filter } from '../candidate_pipeline/candidate_pipeline';
import { PostCandidate } from '../types';

export class DuplicateFilter implements Filter {
  filter(candidates: PostCandidate[]): PostCandidate[] {
    const seen = new Set<string>();
    return candidates.filter(candidate => {
      if (seen.has(candidate.tweetId)) return false;
      seen.add(candidate.tweetId);
      return true;
    });
  }
}
