// Main Home Mixer service
import { ScoredPostsQuery, PipelineResult, User, UserAction, UserFeatures } from '../types';
import { CandidatePipeline } from '../candidate_pipeline/candidate_pipeline';
import { TopKScoreSelector } from '../selectors/top_k_score_selector';
import { ThunderSource } from '../sources/thunder_source';
import { PhoenixSource } from '../sources/phoenix_source';
import { 
  DuplicateFilter, 
  SeenPostsFilter, 
  ServedPostsFilter,
  AgeFilter, 
  SelfPostFilter,
  MutedKeywordFilter,
  AuthorSocialgraphFilter,
  RetweetDeduplicationFilter,
  CoreDataHydrationFilter,
  IneligibleSubscriptionFilter,
  VFFilter,
  DedupConversationFilter
} from '../filters/mod';
import { 
  PhoenixScorer, 
  WeightedScorer, 
  AuthorDiversityScorer,
  OONScorer 
} from '../scorers/mod';
import { 
  CoreDataCandidateHydrator,
  GizmoduckCandidateHydrator,
  VideoDurationCandidateHydrator,
  SubscriptionHydrator,
  VFCandidateHydrator,
  InNetworkCandidateHydrator
} from '../candidate_hydrators/mod';
import { 
  UserFeaturesQueryHydrator,
  UserActionSequenceQueryHydrator 
} from '../query_hydrators/mod';
import { CacheRequestInfoSideEffect } from '../side_effects/cache_request_info_side_effect';
import { ThunderService } from './thunder';
import { PhoenixClient } from './phoenix';
import { redisService } from './redis';

export class HomeMixerService {
  private pipeline: CandidatePipeline;

  private get redis() {
    return redisService.getClient();
  }

  constructor(
    private thunderService: ThunderService,
    private phoenixClient: PhoenixClient
  ) {
    // Initialize query hydrators
    const queryHydrators = [
      new UserFeaturesQueryHydrator((userId) => this.getUserFeatures(userId)),
      new UserActionSequenceQueryHydrator((userId) => this.getUserHistory(userId))
    ];

    // Initialize sources
    const sources = [
      new ThunderSource(thunderService, (userId) => this.getUserFollowing(userId)),
      new PhoenixSource(phoenixClient, (userId) => this.getUserHistory(userId))
    ];

    // Initialize hydrators
    const hydrators = [
      new CoreDataCandidateHydrator(),
      new GizmoduckCandidateHydrator(),
      new VideoDurationCandidateHydrator(),
      new InNetworkCandidateHydrator()
    ];

    // Initialize pre-scoring filters
    const filters = [
      new DuplicateFilter(),
      new CoreDataHydrationFilter(),
      new AgeFilter(24), // 24 hours
      new SelfPostFilter(),
      new RetweetDeduplicationFilter(),
      new IneligibleSubscriptionFilter(),
      new SeenPostsFilter(),
      new ServedPostsFilter(),
      new MutedKeywordFilter(),
      new AuthorSocialgraphFilter()
    ];

    // Initialize scorers
    const scorers = [
      new PhoenixScorer(phoenixClient, (userId) => this.getUserHistory(userId)),
      new WeightedScorer(),
      new AuthorDiversityScorer(),
      new OONScorer()
    ];

    // Initialize selector
    const selector = new TopKScoreSelector();

    // Initialize post-selection hydrators
    const postSelectionHydrators = [
      new VFCandidateHydrator(),
      new SubscriptionHydrator()
    ];

    // Initialize post-selection filters
    const postSelectionFilters = [
      new VFFilter(),
      new DedupConversationFilter()
    ];

    // Initialize side effects
    const sideEffects = [
      new CacheRequestInfoSideEffect()
    ];

    this.pipeline = new CandidatePipeline(
      queryHydrators,
      sources,
      hydrators,
      filters,
      scorers,
      selector,
      postSelectionHydrators,
      postSelectionFilters,
      sideEffects
    );

    // Start Thunder auto-cleanup
    this.thunderService.startAutoTrim(2); // Every 2 minutes
  }

  async getScoredPosts(query: ScoredPostsQuery): Promise<PipelineResult> {
    // Generate request ID if not provided
    if (!query.requestId) {
      query.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Set default user features if not provided
    if (!query.userFeatures) {
      query.userFeatures = await this.getUserFeatures(query.userId);
    }

    return this.pipeline.execute(query);
  }

  // User management
  async addUser(user: User) {
    await this.redis.hSet('users', user.id, JSON.stringify(user));
  }

  async updateUser(userId: string, updates: Partial<User>) {
    const userData = await this.redis.hGet('users', userId);
    if (userData) {
      const user = JSON.parse(userData) as User;
      const updatedUser = { ...user, ...updates };
      await this.redis.hSet('users', userId, JSON.stringify(updatedUser));
    }
  }

  private async getUserFollowing(userId: string): Promise<string[]> {
    const userData = await this.redis.hGet('users', userId);
    if (userData) {
      const user = JSON.parse(userData) as User;
      return user.followingIds || [];
    }
    return [];
  }

  private async getUserHistory(userId: string): Promise<UserAction[]> {
    const userData = await this.redis.hGet('users', userId);
    if (userData) {
      const user = JSON.parse(userData) as User;
      return user.engagementHistory || [];
    }
    return [];
  }

  private async getUserFeatures(userId: string): Promise<UserFeatures> {
    const userData = await this.redis.hGet('users', userId);
    if (userData) {
      const user = JSON.parse(userData) as User;
      return {
        followedUserIds: user.followingIds || [],
        mutedKeywords: user.mutedKeywords || [],
        blockedUserIds: user.blockedUserIds || [],
        mutedUserIds: user.mutedUserIds || []
      };
    }
    return {
      followedUserIds: [],
      mutedKeywords: [],
      blockedUserIds: [],
      mutedUserIds: []
    };
  }

  // Analytics and monitoring
  getThunderStats() {
    return this.thunderService.getStats();
  }

  // Add engagement action
  async addUserAction(userId: string, action: UserAction) {
    const userData = await this.redis.hGet('users', userId);
    if (userData) {
      const user = JSON.parse(userData) as User;
      user.engagementHistory.push(action);
      
      // Keep only recent actions (last 1000)
      if (user.engagementHistory.length > 1000) {
        user.engagementHistory.sort((a, b) => b.timestamp - a.timestamp);
        user.engagementHistory = user.engagementHistory.slice(0, 1000);
      }
      
      await this.redis.hSet('users', userId, JSON.stringify(user));
    }
  }
}
