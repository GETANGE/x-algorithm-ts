# Component Dependencies and Requirements

## Overview
This document details the critical dependencies, requirements, and interconnections between all system components. Understanding these relationships is essential for proper system operation and troubleshooting.

## Dependency Graph

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   HTTP Request  │───▶│ HomeMixerController │───▶│ HomeMixerService │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │CandidatePipeline│
                                              └─────────────────┘
                                                        │
                        ┌───────────────────────────────┼───────────────────────────────┐
                        ▼                               ▼                               ▼
                ┌─────────────┐                ┌─────────────┐                ┌─────────────┐
                │Query        │                │  Sources    │                │  Hydrators  │
                │Hydrators    │                │             │                │             │
                └─────────────┘                └─────────────┘                └─────────────┘
                        │                               │                               │
                        ▼                               ▼                               ▼
                ┌─────────────┐                ┌─────────────┐                ┌─────────────┐
                │User Features│                │Thunder      │                │Core Data    │
                │User Actions │                │Phoenix      │                │Gizmoduck    │
                └─────────────┘                └─────────────┘                │Video        │
                                                                              └─────────────┘
```

## Core Service Dependencies

### HomeMixerService
**Critical Dependencies:**
- `ThunderService` - Must be initialized with post data
- `PhoenixClient` - Must have connectivity to ML service
- All pipeline components properly configured

**Initialization Requirements:**
```typescript
// Required order of initialization
1. ThunderService.new()
2. PhoenixClient.new() 
3. Pipeline components (sources, filters, scorers)
4. HomeMixerService.new(thunder, phoenix)
```

**Failure Modes:**
- If Thunder fails: No in-network content
- If Phoenix fails: No out-of-network content, no ML scoring
- If pipeline components fail: Graceful degradation per component

---

### ThunderService
**Memory Requirements:**
- ~1MB per 1000 posts stored
- Automatic cleanup every 2 minutes
- Configurable retention period (default: 24 hours)

**Critical Operations:**
```typescript
// Post ingestion
addPost(post) -> categorizes into timelines
├── Original posts (non-reply, non-retweet)
├── Secondary posts (replies/retweets) 
└── Video posts (if eligible)

// Retrieval
getInNetworkPosts(followingIds, maxResults)
├── Queries multiple user timelines
├── Applies deduplication
└── Sorts by recency
```

**Performance Characteristics:**
- Sub-millisecond lookups via HashMap
- O(1) post insertion
- O(n) retrieval where n = posts per user

---

### PhoenixClient
**Network Dependencies:**
- Phoenix ML service at `http://localhost:8001`
- Stable network connection
- Service health monitoring

**API Requirements:**
```typescript
// Retrieval endpoint
POST /retrieve
├── Requires: user_id, user_history, max_results
└── Returns: candidate posts with similarity scores

// Ranking endpoint  
POST /rank
├── Requires: user_id, candidates, user_history
└── Returns: engagement probability predictions
```

**Failure Handling:**
- Connection failures: Return empty results
- Timeout: Configurable timeout (default: 30s)
- Malformed responses: Log error, continue pipeline

---

## Pipeline Component Dependencies

### Query Hydrators

#### UserFeaturesQueryHydrator
**Purpose**: Enriches query with user social graph data

**Dependencies:**
- User following list storage
- User preferences (muted keywords, blocked users)
- Real-time user data access

**Critical for:**
- `ThunderSource` - Needs following list
- `AuthorSocialgraphFilter` - Needs blocked/muted users
- `MutedKeywordFilter` - Needs muted keywords

**Failure Impact**: Pipeline continues with empty user features

---

#### UserActionSequenceQueryHydrator
**Purpose**: Provides user engagement history for ML personalization

**Dependencies:**
- User action tracking system
- Historical engagement data (7-day window)
- Action aggregation logic

**Critical for:**
- `PhoenixSource` - ML retrieval needs user history
- `PhoenixScorer` - ML ranking needs engagement patterns

**Data Requirements:**
```typescript
UserAction {
  postId: string     // Target post
  actionType: enum   // favorite, reply, retweet, etc.
  timestamp: number  // When action occurred
}
```

---

### Sources

#### ThunderSource
**Dependencies:**
- `ThunderService` operational
- User following list from query hydration
- Recent posts in Thunder storage

**Process Flow:**
```typescript
1. getUserFollowing(userId) -> string[]
2. thunderService.getInNetworkPosts(followingIds, 50)
3. Convert to PostCandidate format
4. Mark as in-network content
```

**Performance**: Typically returns 10-50 candidates in <1ms

---

#### PhoenixSource
**Dependencies:**
- `PhoenixClient` connectivity
- User engagement history from query hydration
- Phoenix ML service operational

**Process Flow:**
```typescript
1. Check if out-of-network content requested
2. getUserHistory(userId) -> UserAction[]
3. phoenixClient.retrieveCandidates(userId, history, 50)
4. Convert to PostCandidate format
5. Mark as out-of-network content
```

**Performance**: Typically returns 20-50 candidates in 50-200ms

---

### Filters (Sequential Processing)

#### Critical Filter Dependencies:

**DuplicateFilter**
- No dependencies
- Must run early to prevent duplicate processing

**CoreDataHydrationFilter** 
- Depends on: Core data hydration completed
- Removes posts missing essential data

**AgeFilter**
- Depends on: Post timestamp extraction
- Configurable age threshold (default: 24 hours)

**SelfPostFilter**
- Depends on: Query userId
- Prevents user seeing own posts

**AuthorSocialgraphFilter**
- Depends on: User features hydration
- Requires blocked/muted user lists

**MutedKeywordFilter**
- Depends on: User features hydration, post text
- Requires muted keywords list

**SeenPostsFilter / ServedPostsFilter**
- Depends on: Query seen/served post IDs
- Requires accurate tracking

---

### Hydrators (Parallel Processing)

#### CoreDataCandidateHydrator
**Purpose**: Fetches post content and metadata

**Mock Dependencies:**
- TES (Tweet Enrichment Service) simulation
- Post ID to content mapping

**Real Dependencies (Production):**
- TES service connectivity
- Post content database
- Author relationship data

---

#### GizmoduckCandidateHydrator
**Purpose**: Fetches user/author information

**Mock Dependencies:**
- User ID to profile mapping

**Real Dependencies (Production):**
- Gizmoduck service connectivity
- User profile database
- Batch user lookup capability

---

#### VideoDurationCandidateHydrator
**Purpose**: Fetches video metadata

**Dependencies:**
- Media entity service
- Video duration extraction
- Post to media mapping

**Critical for:**
- `WeightedScorer` VQV eligibility
- Video-specific engagement predictions

---

### Scorers (Sequential Processing)

#### PhoenixScorer
**Dependencies:**
- `PhoenixClient` operational
- User engagement history
- Candidate posts with basic metadata

**Process:**
```typescript
1. Get user history from query
2. Call phoenixClient.rankCandidates()
3. Receive 15+ engagement predictions per post
4. Attach predictions to candidates
```

**Critical Output**: PhoenixScores object with all prediction types

---

#### WeightedScorer
**Dependencies:**
- `PhoenixScorer` output (PhoenixScores)
- Video duration data (for VQV eligibility)
- Configured scoring weights

**Algorithm:**
```typescript
1. Check VQV eligibility (video >5 seconds)
2. Apply weights to each prediction type
3. Sum weighted predictions
4. Apply score normalization
5. Handle negative score offset
```

**Weight Configuration:**
- Positive actions: favorite (1.0), share (1.2), follow (2.0)
- Negative actions: block (-5.0), mute (-3.0), report (-10.0)

---

#### AuthorDiversityScorer
**Dependencies:**
- Previous scorer output (weighted scores)
- Author ID for each candidate

**Algorithm:**
```typescript
1. Sort candidates by current score
2. Track author occurrence count
3. Apply diversity multiplier
4. Update final scores
```

---

#### OONScorer
**Dependencies:**
- Previous scorer output
- In-network status for each candidate

**Simple Logic**: Multiply out-of-network scores by 0.8

---

### Selector

#### TopKScoreSelector
**Dependencies:**
- Final scores from all scorers
- Query maxResults parameter

**Process:**
```typescript
1. Sort candidates by score (descending)
2. Take first maxResults candidates
3. Return selected candidates
```

---

## Data Flow Requirements

### Request Processing Flow
```
1. HTTP Request -> Controller
2. Controller -> HomeMixerService
3. Service -> CandidatePipeline.execute()
4. Pipeline -> Query Hydration (parallel)
5. Pipeline -> Source Retrieval (parallel)
6. Pipeline -> Candidate Hydration (parallel)
7. Pipeline -> Filtering (sequential)
8. Pipeline -> Scoring (sequential)
9. Pipeline -> Selection
10. Pipeline -> Post-Selection Processing
11. Pipeline -> Side Effects (async)
12. Service -> Controller -> HTTP Response
```

### Critical Data Transformations

**Post -> LightPost (Thunder)**
```typescript
Post {
  id, authorId, content, createdAt,
  isReply, isRetweet, hasVideo,
  relationships...
} -> LightPost (optimized for storage)
```

**LightPost -> PostCandidate (Sources)**
```typescript
LightPost -> PostCandidate {
  tweetId, authorId, tweetText,
  inNetwork, source, servedType,
  metadata...
}
```

**PostCandidate + Predictions -> Scored Candidate**
```typescript
PostCandidate + PhoenixScores -> {
  ...candidate,
  phoenixScores: {...predictions},
  weightedScore: number,
  score: number
}
```

---

## Performance Requirements

### Latency Targets
- **Query Hydration**: <10ms
- **Source Retrieval**: <100ms (Thunder <1ms, Phoenix <200ms)
- **Hydration**: <50ms (parallel execution)
- **Filtering**: <20ms (sequential but fast)
- **Scoring**: <100ms (ML predictions dominate)
- **Selection**: <1ms
- **Total Pipeline**: <300ms typical

### Memory Requirements
- **Thunder Service**: 1MB per 1000 posts
- **Pipeline Processing**: ~10MB per request
- **Node.js Base**: ~50MB
- **Total per Instance**: ~100-200MB

### Throughput Targets
- **Single Instance**: 100 requests/second
- **Bottleneck**: Phoenix ML service
- **Scaling**: Horizontal scaling of both services

---

## Error Handling Strategy

### Component Failure Modes

**Thunder Service Failure:**
- Impact: No in-network content
- Mitigation: Continue with Phoenix-only content
- Recovery: Restart Thunder service, reload posts

**Phoenix Service Failure:**
- Impact: No out-of-network content, no ML scoring
- Mitigation: In-network only, fallback scoring
- Recovery: Restart Phoenix service

**Individual Filter/Scorer Failure:**
- Impact: Skip failed component
- Mitigation: Continue pipeline with remaining components
- Recovery: Fix component, restart service

### Data Quality Issues

**Missing User Features:**
- Fallback: Empty features (no filtering)
- Impact: Reduced personalization

**Missing User History:**
- Fallback: Empty history
- Impact: No ML personalization

**Incomplete Post Data:**
- Filtering: Remove incomplete posts
- Impact: Fewer candidates

---

## Monitoring and Alerting

### Critical Metrics

**Pipeline Performance:**
- Request latency (p50, p95, p99)
- Success rate per component
- Candidate count at each stage

**Service Health:**
- Thunder memory usage
- Phoenix service connectivity
- Error rates by component

**Business Metrics:**
- Final candidate count
- In-network vs out-of-network ratio
- Score distribution

### Alert Conditions

**Critical Alerts:**
- Pipeline success rate <95%
- Phoenix service down >1 minute
- Thunder memory usage >80%

**Warning Alerts:**
- Pipeline latency >500ms
- Low candidate count (<5 per request)
- High filter rejection rate (>90%)

This comprehensive dependency documentation ensures proper system understanding and operational success.
