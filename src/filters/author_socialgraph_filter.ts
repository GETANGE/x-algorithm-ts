import { Filter } from '../candidate_pipeline/candidate_pipeline';
import { PostCandidate, ScoredPostsQuery } from '../types';

export class AuthorSocialgraphFilter implements Filter {
  filter(candidates: PostCandidate[], query: ScoredPostsQuery): PostCandidate[] {
    const blockedIds = new Set(query.userFeatures.blockedUserIds);
    const mutedIds = new Set(query.userFeatures.mutedUserIds);

    return candidates.filter(candidate => {
      const isBlocked = blockedIds.has(candidate.authorId);
      const isMuted = mutedIds.has(candidate.authorId);
      return !isBlocked && !isMuted;
    });
  }
}
