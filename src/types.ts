// Core types for the recommendation system
export interface Post {
  id: string;
  authorId: string;
  content: string;
  createdAt: number;
  isReply: boolean;
  isRetweet: boolean;
  hasVideo: boolean;
  inReplyToPostId?: string;
  retweetedPostId?: string;
  retweetedUserId?: string;
  conversationId?: string;
  videoDurationMs?: number;
}

export interface User {
  id: string;
  followingIds: string[];
  engagementHistory: UserAction[];
  mutedKeywords: string[];
  blockedUserIds: string[];
  mutedUserIds: string[];
  screenName?: string;
  followersCount?: number;
}

export interface UserAction {
  postId: string;
  actionType: ActionType;
  timestamp: number;
}

export enum ActionType {
  FAVORITE = 'favorite',
  REPLY = 'reply',
  RETWEET = 'retweet',
  CLICK = 'click',
  SHARE = 'share',
  FOLLOW = 'follow',
  BLOCK = 'block',
  MUTE = 'mute',
  PROFILE_CLICK = 'profile_click',
  VIDEO_VIEW = 'video_view',
  PHOTO_EXPAND = 'photo_expand',
  DWELL = 'dwell',
  QUOTE = 'quote',
  NOT_INTERESTED = 'not_interested',
  REPORT = 'report'
}

export interface PostCandidate {
  tweetId: string;
  authorId: string;
  score?: number;
  phoenixScores?: PhoenixScores;
  weightedScore?: number;
  inNetwork?: boolean;
  source: 'thunder' | 'phoenix';
  tweetText?: string;
  authorScreenName?: string;
  authorFollowersCount?: number;
  retweetedTweetId?: string;
  retweetedUserId?: string;
  retweetedScreenName?: string;
  inReplyToTweetId?: string;
  conversationId?: string;
  videoDurationMs?: number;
  visibilityReason?: VisibilityReason;
  ancestors?: string[];
  lastScoredAt?: number;
  predictionRequestId?: string;
  servedType?: ServedType;
}

export enum ServedType {
  FOR_YOU_IN_NETWORK = 'for_you_in_network',
  FOR_YOU_PHOENIX_RETRIEVAL = 'for_you_phoenix_retrieval'
}

export enum VisibilityReason {
  DELETED = 'deleted',
  SPAM = 'spam',
  VIOLENCE = 'violence',
  GORE = 'gore',
  NSFW = 'nsfw'
}

export interface PhoenixScores {
  favoriteScore: number;
  replyScore: number;
  retweetScore: number;
  clickScore: number;
  shareScore: number;
  followScore: number;
  blockScore: number;
  muteScore: number;
  profileClickScore: number;
  videoViewScore: number;
  photoExpandScore: number;
  dwellScore: number;
  quoteScore: number;
  notInterestedScore: number;
  reportScore: number;
  dwellTime: number;
}

export interface UserFeatures {
  followedUserIds: string[];
  mutedKeywords: string[];
  blockedUserIds: string[];
  mutedUserIds: string[];
}

export interface ScoredPostsQuery {
  userId: string;
  maxResults: number;
  seenPostIds: string[];
  servedPostIds: string[];
  inNetworkOnly: boolean;
  userFeatures: UserFeatures;
  userActionSequence?: UserAction[];
  requestId: string;
}

export interface PipelineResult {
  retrievedCandidates: PostCandidate[];
  filteredCandidates: PostCandidate[];
  selectedCandidates: PostCandidate[];
  query: ScoredPostsQuery;
}
