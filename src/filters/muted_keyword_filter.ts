import { Filter } from '../candidate_pipeline/candidate_pipeline';
import { PostCandidate, ScoredPostsQuery } from '../types';

export class MutedKeywordFilter implements Filter {
  filter(candidates: PostCandidate[], query: ScoredPostsQuery): PostCandidate[] {
    const mutedKeywords = query.userFeatures.mutedKeywords;
    if (mutedKeywords.length === 0) return candidates;

    return candidates.filter(candidate => {
      const text = candidate.tweetText?.toLowerCase() || '';
      return !mutedKeywords.some(keyword => 
        text.includes(keyword.toLowerCase())
      );
    });
  }
}
