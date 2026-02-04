import { Filter } from '../candidate_pipeline/candidate_pipeline';
import { PostCandidate } from '../types';

export class DedupConversationFilter implements Filter {
  filter(candidates: PostCandidate[]): PostCandidate[] {
    const seenConversations = new Set<string>();
    const kept: PostCandidate[] = [];

    for (const candidate of candidates) {
      const conversationId = this.getConversationId(candidate);
      if (conversationId && seenConversations.has(conversationId)) {
        continue; // Skip duplicate conversation
      }
      
      if (conversationId) {
        seenConversations.add(conversationId);
      }
      kept.push(candidate);
    }

    return kept;
  }

  private getConversationId(candidate: PostCandidate): string | null {
    return candidate.conversationId || 
           candidate.inReplyToTweetId || 
           null;
  }
}
