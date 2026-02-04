// In-network candidate hydrator
import { PostCandidate, ScoredPostsQuery } from '../types';

export class InNetworkCandidateHydrator {
  async hydrate(candidates: PostCandidate[], query: ScoredPostsQuery): Promise<PostCandidate[]> {
    const followingIds = new Set(query.userFeatures.followedUserIds);
    
    return candidates.map(candidate => ({
      ...candidate,
      inNetwork: followingIds.has(candidate.authorId)
    }));
  }

  update(candidate: PostCandidate, hydrated: PostCandidate) {
    candidate.inNetwork = hydrated.inNetwork;
  }
}
