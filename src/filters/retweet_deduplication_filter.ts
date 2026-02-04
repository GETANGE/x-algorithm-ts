import { Filter } from '../candidate_pipeline/candidate_pipeline';
import { PostCandidate } from '../types';

export class RetweetDeduplicationFilter implements Filter {
  filter(candidates: PostCandidate[]): PostCandidate[] {
    const seenTweetIds = new Set<string>();
    const kept: PostCandidate[] = [];

    for (const candidate of candidates) {
      if (candidate.retweetedTweetId) {
        // This is a retweet - check if we've seen the original
        if (seenTweetIds.has(candidate.retweetedTweetId)) {
          continue; // Skip this retweet
        }
        seenTweetIds.add(candidate.retweetedTweetId);
      } else {
        // This is an original tweet - mark it as seen
        seenTweetIds.add(candidate.tweetId);
      }
      kept.push(candidate);
    }

    return kept;
  }
}
