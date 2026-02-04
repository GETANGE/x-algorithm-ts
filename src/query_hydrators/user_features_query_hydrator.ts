import { QueryHydrator } from '../candidate_pipeline/candidate_pipeline';
import { ScoredPostsQuery, UserFeatures } from '../types';

export class UserFeaturesQueryHydrator implements QueryHydrator {
  constructor(
    private getUserFeatures: (userId: string) => Promise<UserFeatures>
  ) {}

  async hydrate(query: ScoredPostsQuery): Promise<ScoredPostsQuery> {
    try {
      const userFeatures = await this.getUserFeatures(query.userId);
      return {
        ...query,
        userFeatures
      };
    } catch (error) {
      console.error('Failed to hydrate user features:', error);
      // Return query with empty features as fallback
      return {
        ...query,
        userFeatures: {
          followedUserIds: [],
          mutedKeywords: [],
          blockedUserIds: [],
          mutedUserIds: []
        }
      };
    }
  }
}
