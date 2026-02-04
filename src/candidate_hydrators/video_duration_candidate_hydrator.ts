// Video duration hydrator - fetches video metadata
import { PostCandidate, ScoredPostsQuery } from '../types';

export class VideoDurationCandidateHydrator {
  async hydrate(candidates: PostCandidate[]): Promise<PostCandidate[]> {
    // Mock implementation - in reality would fetch from TES media entities
    return candidates.map(candidate => ({
      ...candidate,
      videoDurationMs: Math.random() > 0.7 ? Math.floor(Math.random() * 120000) : undefined // 0-2 minutes
    }));
  }

  update(candidate: PostCandidate, hydrated: PostCandidate) {
    candidate.videoDurationMs = hydrated.videoDurationMs;
  }
}
