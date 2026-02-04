# Function Documentation - Complete System Reference

## Table of Contents
- [Controllers](#controllers)
- [Services](#services)
- [Pipeline Components](#pipeline-components)
- [Sources](#sources)
- [Filters](#filters)
- [Scorers](#scorers)
- [Hydrators](#hydrators)
- [Query Hydrators](#query-hydrators)
- [Selectors](#selectors)
- [Side Effects](#side-effects)

---

## Controllers

### HomeMixerController

#### `getHealth(req: Request, res: Response)`
**Purpose**: Provides system health status and service availability check.

**Why Important**: 
- Essential for monitoring and alerting systems
- Load balancers use this to determine if instance is healthy
- Provides real-time service status including Thunder statistics

**Dependencies**:
- `thunderService.getStats()` - Thunder service must be initialized
- Phoenix client connection status

**Returns**: JSON with health status, timestamp, and service statistics

---

#### `getScoredPosts(req: Request, res: Response)`
**Purpose**: Main endpoint for the For You feed - orchestrates the entire recommendation pipeline.

**Why Critical**: 
- Core business function - generates personalized feed
- Handles the complete ML pipeline from candidate retrieval to final ranking
- Provides detailed metadata for debugging and analytics

**Input Requirements**:
- `userId` (required) - User requesting the feed
- `maxResults` (optional, default: 10) - Number of posts to return
- `seenPostIds` (optional) - Posts user has already seen
- `servedPostIds` (optional) - Posts already served in session
- `inNetworkOnly` (optional) - Limit to followed accounts only
- `userFeatures` (optional) - Will be hydrated if not provided

**Process Flow**:
1. Validates and normalizes request parameters
2. Generates unique request ID for tracking
3. Executes full pipeline via `homeMixer.getScoredPosts()`
4. Transforms internal candidate format to API response
5. Includes performance metrics and debugging metadata

**Dependencies**:
- HomeMixerService must be fully initialized
- All pipeline components (sources, filters, scorers) operational
- Phoenix ML service connectivity

---

#### `createPost(req: Request, res: Response)`
**Purpose**: Adds new posts to the Thunder in-memory store for real-time availability.

**Why Important**:
- Enables real-time content ingestion
- Posts become immediately available for in-network recommendations
- Simulates Kafka-based post ingestion in production

**Input Requirements**:
- `authorId` (required) - Post author
- `content` (required) - Post text content
- `isReply`, `isRetweet`, `hasVideo` (optional) - Content type flags
- `inReplyToPostId`, `retweetedPostId` (optional) - Relationship IDs

**Process**:
1. Creates Post object with current timestamp
2. Adds to Thunder service for immediate availability
3. Thunder automatically categorizes (original/secondary/video)

---

#### `addUserAction(req: Request, res: Response)`
**Purpose**: Records user engagement actions for ML personalization.

**Why Critical**:
- Feeds ML models with user preference signals
- Enables personalized recommendations
- Tracks engagement patterns for scoring weights

**Input Requirements**:
- `userId` (URL parameter) - Acting user
- `postId` (required) - Target post
- `actionType` (required) - Type of engagement (favorite, reply, etc.)

**Process**:
1. Creates UserAction with current timestamp
2. Adds to user's engagement history
3. Maintains rolling window of recent actions (last 1000)

---

#### `getStats(req: Request, res: Response)`
**Purpose**: Provides system performance and storage statistics.

**Why Important**:
- Monitoring system performance
- Capacity planning
- Debugging storage issues

**Returns**: Thunder service statistics including post counts, user counts, memory usage

---

## Services

### HomeMixerService

#### `constructor(thunderService, phoenixClient)`
**Purpose**: Initializes the complete recommendation pipeline with all components.

**Why Complex**: 
- Must coordinate 20+ pipeline components in correct order
- Each component has specific dependencies and requirements
- Order matters - filters must run before scorers, etc.

**Pipeline Assembly**:
1. **Query Hydrators** - Enrich request with user data
2. **Sources** - Thunder (in-network) + Phoenix (out-of-network)
3. **Hydrators** - Enrich candidates with metadata
4. **Filters** - Remove ineligible content (12 different filters)
5. **Scorers** - ML predictions + weighted scoring + diversity
6. **Selector** - Sort and limit results
7. **Post-Selection** - Final hydration and filtering
8. **Side Effects** - Caching and analytics

---

#### `getScoredPosts(query: ScoredPostsQuery)`
**Purpose**: Executes the complete recommendation pipeline.

**Why Central**: Single entry point for all recommendation logic.

**Process**:
1. Generates request ID if missing
2. Ensures user features are available
3. Delegates to pipeline.execute()
4. Returns structured result with metadata

**Dependencies**: All pipeline components must be operational

---

#### `addUser(user: User)` / `updateUser(userId, updates)`
**Purpose**: Manages user data for personalization.

**Why Needed**: 
- Stores following lists for in-network retrieval
- Maintains engagement history for ML personalization
- Tracks user preferences (muted keywords, blocked users)

---

#### `addUserAction(userId, action)`
**Purpose**: Records user engagement for ML training.

**Why Critical**:
- Primary signal for recommendation personalization
- Maintains rolling window of recent actions
- Feeds into Phoenix ML scoring

---

### ThunderService

#### `addPost(post: Post)`
**Purpose**: Ingests posts into in-memory storage with intelligent categorization.

**Why Complex**:
- Must categorize posts into multiple timelines (original/secondary/video)
- Handles retweet and reply relationships
- Manages memory efficiently with automatic cleanup

**Process**:
1. Converts to LightPost format
2. Stores in main posts map
3. Categorizes into appropriate user timelines:
   - Original posts (non-reply, non-retweet)
   - Secondary posts (replies/retweets)
   - Video posts (if eligible)
4. Enforces per-user limits to prevent memory bloat
5. Handles video eligibility logic (retweets of videos count)

**Memory Management**:
- Limits posts per user per category
- Automatic sorting by recency
- Trimming of old posts

---

#### `getInNetworkPosts(followingIds, maxResults)`
**Purpose**: Retrieves posts from followed accounts with sophisticated filtering.

**Why Important**: Primary source for in-network recommendations.

**Process**:
1. Iterates through followed users
2. Retrieves from both original and secondary timelines
3. Applies deduplication
4. Filters deleted posts
5. Sorts by recency
6. Limits results

**Performance**: Sub-millisecond lookups via in-memory maps

---

#### `removePost(postId)` / `trimOldPosts()`
**Purpose**: Manages post lifecycle and memory cleanup.

**Why Essential**:
- Handles post deletions
- Prevents memory leaks
- Maintains data freshness

---

### PhoenixClient

#### `retrieveCandidates(userId, userHistory, maxResults)`
**Purpose**: Discovers relevant out-of-network content using two-tower similarity.

**Why Important**: 
- Expands content beyond user's following list
- Uses ML to find relevant content from global corpus
- Enables content discovery

**Process**:
1. Sends user history to Phoenix ML service
2. Phoenix computes user embedding
3. Finds similar posts via vector search
4. Returns top-K candidates

**Dependencies**: Phoenix ML service must be running and healthy

---

#### `rankCandidates(userId, candidates, userHistory)`
**Purpose**: Predicts engagement probabilities using transformer model.

**Why Critical**: 
- Core ML component for relevance scoring
- Predicts 15+ different engagement types
- Enables personalized ranking

**Process**:
1. Sends candidates and user context to Phoenix
2. Phoenix transformer computes engagement probabilities
3. Returns detailed predictions for each candidate
4. Adds prediction metadata (request ID, timestamp)

---

## Pipeline Components

### CandidatePipeline

#### `execute(query: ScoredPostsQuery)`
**Purpose**: Orchestrates the complete recommendation pipeline with proper error handling and logging.

**Why Complex**: 
- Must coordinate multiple async operations
- Handles failures gracefully
- Provides detailed logging for debugging
- Maintains data flow integrity

**Execution Stages**:
1. **Query Hydration** - Enrich request with user data
2. **Candidate Sourcing** - Parallel retrieval from multiple sources
3. **Candidate Hydration** - Enrich with metadata
4. **Pre-Scoring Filtering** - Remove ineligible content
5. **Scoring** - ML predictions and weighted scoring
6. **Selection** - Sort and limit
7. **Post-Selection Processing** - Final validation
8. **Side Effects** - Async analytics and caching

**Error Handling**: Each stage handles failures independently to prevent cascade failures

---

## Sources

### ThunderSource

#### `getCandidates(query: ScoredPostsQuery)`
**Purpose**: Retrieves in-network posts from Thunder service.

**Why Important**: 
- Primary source for content from followed accounts
- Provides high-quality, relevant content
- Fast retrieval from in-memory store

**Process**:
1. Gets user's following list
2. Retrieves posts from Thunder
3. Converts to PostCandidate format
4. Marks as in-network content
5. Sets appropriate served type

**Dependencies**: Thunder service with populated post data

---

### PhoenixSource

#### `getCandidates(query: ScoredPostsQuery)`
**Purpose**: Retrieves out-of-network posts via ML-based discovery.

**Why Important**:
- Enables content discovery beyond following list
- Uses ML to find relevant content
- Expands user's content horizon

**Process**:
1. Checks if out-of-network content is requested
2. Gets user engagement history
3. Calls Phoenix retrieval service
4. Converts to PostCandidate format
5. Marks as out-of-network content

**Dependencies**: Phoenix ML service operational, user has engagement history

---

## Filters

### DuplicateFilter

#### `filter(candidates: PostCandidate[])`
**Purpose**: Removes duplicate posts by ID.

**Why Essential**: 
- Prevents showing same content multiple times
- Can occur when post appears in multiple sources
- Improves user experience

**Algorithm**: Uses Set for O(1) duplicate detection

---

### SeenPostsFilter / ServedPostsFilter

#### `filter(candidates, query)`
**Purpose**: Removes posts user has already seen or been served.

**Why Critical**:
- Prevents repetitive content
- Respects user's browsing history
- Improves engagement by showing fresh content

**Dependencies**: Requires accurate seen/served post tracking

---

### AgeFilter

#### `filter(candidates)`
**Purpose**: Removes posts older than specified threshold (default 24 hours).

**Why Important**:
- Ensures content freshness
- Prevents stale content from appearing
- Aligns with user expectations for "recent" content

**Implementation**: Extracts timestamp from post ID (Twitter snowflake format)

---

### SelfPostFilter

#### `filter(candidates, query)`
**Purpose**: Removes user's own posts from their feed.

**Why Necessary**:
- Users don't want to see their own content in recommendations
- Prevents narcissistic feedback loops
- Standard social media practice

---

### MutedKeywordFilter

#### `filter(candidates, query)`
**Purpose**: Removes posts containing user's muted keywords.

**Why Important**:
- Respects user content preferences
- Improves user experience by filtering unwanted topics
- Reduces negative engagement

**Algorithm**: Case-insensitive substring matching against post text

---

### AuthorSocialgraphFilter

#### `filter(candidates, query)`
**Purpose**: Removes posts from blocked or muted authors.

**Why Critical**:
- Enforces user's social graph preferences
- Prevents harassment by filtering blocked users
- Respects muting decisions

**Dependencies**: Accurate blocked/muted user lists

---

### RetweetDeduplicationFilter

#### `filter(candidates)`
**Purpose**: Prevents showing both original post and its retweets.

**Why Important**:
- Avoids content duplication
- Prioritizes original content over retweets
- Improves feed diversity

**Algorithm**: Tracks seen original post IDs, filters subsequent retweets

---

### CoreDataHydrationFilter

#### `filter(candidates)`
**Purpose**: Removes posts that failed to load essential metadata.

**Why Necessary**:
- Ensures all posts have required data (text, author)
- Prevents broken content from appearing
- Maintains feed quality

---

### IneligibleSubscriptionFilter

#### `filter(candidates, query)`
**Purpose**: Removes subscription content user cannot access.

**Why Important**:
- Prevents showing paywalled content to non-subscribers
- Avoids user frustration
- Respects content access controls

---

### VFFilter (Visibility Filter)

#### `filter(candidates)`
**Purpose**: Removes posts flagged for policy violations (spam, violence, etc.).

**Why Critical**:
- Enforces platform safety policies
- Protects users from harmful content
- Maintains platform reputation

**Categories Filtered**: Deleted, spam, violence, gore content

---

### DedupConversationFilter

#### `filter(candidates)`
**Purpose**: Prevents multiple posts from same conversation thread.

**Why Important**:
- Improves feed diversity
- Prevents conversation threads from dominating feed
- Better user experience

**Algorithm**: Groups by conversation ID, keeps only first occurrence

---

## Scorers

### PhoenixScorer

#### `score(candidates, query)`
**Purpose**: Applies ML predictions from Phoenix transformer model.

**Why Central**: 
- Core ML component providing engagement predictions
- Replaces hand-engineered features with learned representations
- Enables personalized scoring

**Process**:
1. Gets user engagement history
2. Calls Phoenix ranking service
3. Receives 15+ engagement probability predictions
4. Attaches predictions to candidates

**Dependencies**: Phoenix ML service, user engagement history

---

### WeightedScorer

#### `score(candidates)`
**Purpose**: Combines ML predictions into single relevance score using learned weights.

**Why Complex**:
- Must balance multiple engagement types
- Handles positive and negative signals
- Includes special logic for video content (VQV eligibility)
- Applies score normalization

**Weights**:
- **Positive**: favorite (1.0), share (1.2), follow (2.0)
- **Negative**: block (-5.0), mute (-3.0), report (-10.0)
- **Video**: Special VQV weight for videos >5 seconds

**Algorithm**:
1. Computes weighted sum of predictions
2. Applies video quality view eligibility
3. Normalizes with offset scoring
4. Handles negative score adjustment

---

### AuthorDiversityScorer

#### `score(candidates)`
**Purpose**: Reduces scores for repeated authors to ensure feed diversity.

**Why Important**:
- Prevents single author from dominating feed
- Improves content variety
- Better user engagement through diversity

**Algorithm**:
1. Sorts candidates by current score
2. Tracks author occurrence count
3. Applies diminishing multiplier:
   - 1st post: 1.0x
   - 2nd post: 0.8x
   - 3rd post: 0.6x
   - 4th+ post: 0.4x

---

### OONScorer (Out-of-Network Scorer)

#### `score(candidates)`
**Purpose**: Applies slight penalty to out-of-network content.

**Why Needed**:
- In-network content generally more relevant
- Balances exploration vs exploitation
- Maintains user satisfaction

**Algorithm**: Multiplies out-of-network scores by 0.8 factor

---

## Hydrators

### CoreDataCandidateHydrator

#### `hydrate(candidates)`
**Purpose**: Fetches essential post metadata (text, author, relationships).

**Why Critical**:
- Posts need content text for display and filtering
- Author information required for social graph filtering
- Reply/retweet relationships needed for deduplication

**Mock Implementation**: Simulates TES (Tweet Enrichment Service) calls

---

### GizmoduckCandidateHydrator

#### `hydrate(candidates)`
**Purpose**: Fetches user/author information (screen names, follower counts).

**Why Important**:
- Screen names needed for display
- Follower counts can influence ranking
- Author verification status affects trust

**Process**:
1. Extracts unique author IDs
2. Batch fetches user data
3. Maps data back to candidates

---

### VideoDurationCandidateHydrator

#### `hydrate(candidates)`
**Purpose**: Fetches video metadata for video posts.

**Why Important**:
- Video duration affects VQV (Video Quality View) scoring
- Videos <5 seconds don't qualify for VQV weight
- Influences engagement predictions

---

### InNetworkCandidateHydrator

#### `hydrate(candidates, query)`
**Purpose**: Marks whether posts are from followed accounts.

**Why Needed**:
- Affects scoring (in-network vs out-of-network)
- Used by filters and scorers
- Important for analytics

---

### VFCandidateHydrator

#### `hydrate(candidates)`
**Purpose**: Fetches visibility filtering status (safety labels).

**Why Critical**:
- Identifies content policy violations
- Enables safety filtering
- Protects users from harmful content

---

### SubscriptionHydrator

#### `hydrate(candidates)`
**Purpose**: Checks subscription eligibility for premium content.

**Why Important**:
- Prevents showing inaccessible content
- Respects content creator monetization
- Improves user experience

---

## Query Hydrators

### UserFeaturesQueryHydrator

#### `hydrate(query)`
**Purpose**: Enriches query with user's social graph and preferences.

**Why Essential**:
- Following list needed for in-network retrieval
- Muted keywords/users needed for filtering
- Blocked users must be filtered out

**Data Retrieved**:
- Following list
- Muted keywords
- Blocked user IDs
- Muted user IDs

**Error Handling**: Returns empty features if fetch fails

---

### UserActionSequenceQueryHydrator

#### `hydrate(query)`
**Purpose**: Fetches and processes user's engagement history for ML personalization.

**Why Complex**:
- Must aggregate actions over time window
- Filters to recent actions (7 days)
- Limits sequence length (32 actions)
- Sorts by recency

**Process**:
1. Fetches raw user actions
2. Filters to recent time window
3. Sorts by timestamp (newest first)
4. Truncates to max sequence length

**Dependencies**: User engagement tracking system

---

## Selectors

### TopKScoreSelector

#### `select(candidates, query)`
**Purpose**: Sorts candidates by score and selects top K results.

**Why Simple but Critical**:
- Final step in recommendation pipeline
- Determines what user actually sees
- Must be efficient for large candidate sets

**Algorithm**: 
1. Sorts by score (descending)
2. Takes first maxResults candidates

---

## Side Effects

### CacheRequestInfoSideEffect

#### `run(input: SideEffectInput)`
**Purpose**: Caches request information for analytics and future optimization.

**Why Important**:
- Enables A/B testing and experimentation
- Provides data for model training
- Supports recommendation debugging

**Data Cached**:
- User ID and request ID
- Selected candidate IDs
- Timestamp and result count

**Implementation**: Async operation that doesn't block main pipeline

---

## System Integration Requirements

### Critical Dependencies

1. **Phoenix ML Service**: Must be running and healthy for out-of-network content and scoring
2. **User Data**: Following lists, engagement history, preferences must be available
3. **Post Data**: Thunder service must have recent posts from followed accounts
4. **Memory Management**: Thunder service must handle cleanup to prevent memory leaks

### Performance Requirements

1. **Latency**: Total pipeline execution <300ms typical
2. **Throughput**: Support 100+ requests/second per instance
3. **Memory**: Efficient in-memory storage with automatic cleanup
4. **Reliability**: Graceful degradation when components fail

### Monitoring Points

1. **Pipeline Stages**: Track execution time and success rate for each stage
2. **ML Service**: Monitor Phoenix service health and response times
3. **Memory Usage**: Track Thunder service memory consumption
4. **User Experience**: Monitor final result quality and diversity

This comprehensive documentation covers every function's purpose, importance, dependencies, and implementation details necessary for understanding and maintaining the X For You Feed Algorithm.
