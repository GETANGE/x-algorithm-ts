import { Filter } from '../candidate_pipeline/candidate_pipeline';
import { PostCandidate } from '../types';

export class CoreDataHydrationFilter implements Filter {
  filter(candidates: PostCandidate[]): PostCandidate[] {
    // Remove candidates that failed to hydrate core data
    return candidates.filter(candidate => 
      candidate.tweetText !== undefined && 
      candidate.authorId !== undefined
    );
  }
}
