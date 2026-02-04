import { Filter } from '../candidate_pipeline/candidate_pipeline';
import { PostCandidate } from '../types';

export class IneligibleSubscriptionFilter implements Filter {
  filter(candidates: PostCandidate[]): PostCandidate[] {
    // Mock implementation - in reality would check subscription eligibility
    return candidates.filter(candidate => {
      // For now, assume all content is accessible
      return true;
    });
  }
}
