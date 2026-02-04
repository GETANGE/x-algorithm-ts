import { Filter } from '../candidate_pipeline/candidate_pipeline';
import { PostCandidate, VisibilityReason } from '../types';

export class VFFilter implements Filter {
  filter(candidates: PostCandidate[]): PostCandidate[] {
    return candidates.filter(candidate => {
      return !this.shouldDrop(candidate.visibilityReason);
    });
  }

  private shouldDrop(visibilityReason?: VisibilityReason): boolean {
    if (!visibilityReason) return false;
    
    return [
      VisibilityReason.DELETED,
      VisibilityReason.SPAM,
      VisibilityReason.VIOLENCE,
      VisibilityReason.GORE
    ].includes(visibilityReason);
  }
}
