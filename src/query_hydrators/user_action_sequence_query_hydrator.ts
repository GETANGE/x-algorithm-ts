import { QueryHydrator } from '../candidate_pipeline/candidate_pipeline';
import { ScoredPostsQuery, UserAction } from '../types';

export class UserActionSequenceQueryHydrator implements QueryHydrator {
  constructor(
    private getUserActionSequence: (userId: string) => Promise<UserAction[]>
  ) {}

  async hydrate(query: ScoredPostsQuery): Promise<ScoredPostsQuery> {
    try {
      const userActionSequence = await this.getUserActionSequence(query.userId);
      
      // Aggregate and filter user actions
      const aggregatedSequence = this.aggregateUserActionSequence(userActionSequence);
      
      return {
        ...query,
        userActionSequence: aggregatedSequence
      };
    } catch (error) {
      console.error('Failed to hydrate user action sequence:', error);
      return {
        ...query,
        userActionSequence: []
      };
    }
  }

  private aggregateUserActionSequence(actions: UserAction[]): UserAction[] {
    const MAX_SEQUENCE_LENGTH = 32;
    const WINDOW_TIME_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    const now = Date.now();
    const cutoff = now - WINDOW_TIME_MS;
    
    // Filter recent actions
    const recentActions = actions.filter(action => action.timestamp > cutoff);
    
    // Sort by timestamp (most recent first) and limit
    const sortedActions = recentActions
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_SEQUENCE_LENGTH);
    
    return sortedActions;
  }
}
