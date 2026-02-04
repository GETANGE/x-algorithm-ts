# X For You Feed Algorithm - TypeScript Implementation

## System Architecture Overview

This is a simplified TypeScript + FastAPI implementation of the X For You Feed recommendation system. The architecture follows the same principles as the original Rust implementation but with simplified components for easier understanding and development.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT REQUEST                           │
│                    POST /scored-posts                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      HOME MIXER SERVICE                         │
│                    (TypeScript/Express)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                CANDIDATE PIPELINE                       │   │
│   │                                                         │   │
│   │  1. SOURCES (Parallel)                                 │   │
│   │     ├── Thunder Source (In-Network)                    │   │
│   │     └── Phoenix Source (Out-of-Network)                │   │
│   │                                                         │   │
│   │  2. FILTERS (Sequential)                               │   │
│   │     ├── Duplicate Filter                               │   │
│   │     ├── Seen Posts Filter                              │   │
│   │     ├── Age Filter                                     │   │
│   │     └── Self Post Filter                               │   │
│   │                                                         │   │
│   │  3. SCORERS (Sequential)                               │   │
│   │     ├── Phoenix Scorer (ML Predictions)                │   │
│   │     ├── Weighted Scorer (Combine Predictions)          │   │
│   │     └── Author Diversity Scorer                        │   │
│   │                                                         │   │
│   │  4. SELECTION                                          │   │
│   │     └── Sort by Score + Limit Results                  │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPPORTING SERVICES                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │   THUNDER SERVICE   │    │      PHOENIX ML SERVICE        │ │
│  │  (In-Memory Store)  │    │       (FastAPI/Python)         │ │
│  │                     │    │                                 │ │
│  │ • Post Storage      │    │ • /retrieve (Two-Tower)        │ │
│  │ • User Timelines    │    │ • /rank (Transformer)          │ │
│  │ • Real-time Updates │    │ • Mock ML Predictions          │ │
│  └─────────────────────┘    └─────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Home Mixer Service (`src/services/homeMixer.ts`)

**Purpose**: Main orchestration service that coordinates the recommendation pipeline.

**Key Responsibilities**:
- Initialize and configure the candidate pipeline
- Manage user data (following lists, engagement history)
- Execute the full recommendation flow
- Return ranked posts to clients

**API Endpoint**: `POST /scored-posts`

### 2. Thunder Service (`src/services/thunder.ts`)

**Purpose**: In-memory storage for posts from accounts the user follows (in-network content).

**Key Features**:
- **Fast Lookups**: In-memory Map structures for sub-millisecond access
- **User Timelines**: Separate post lists per user
- **Automatic Cleanup**: Keeps only recent posts (last 100 per user)
- **Real-time Updates**: Add/remove posts as they're created/deleted

**Data Structures**:
```typescript
private postsByUser = new Map<string, Post[]>();  // User timelines
private allPosts = new Map<string, Post>();       // Global post lookup
```

### 3. Phoenix ML Service (`phoenix/main.py`)

**Purpose**: Machine learning service for out-of-network content discovery and ranking.

**Endpoints**:
- `POST /retrieve`: Find relevant posts from global corpus using two-tower similarity
- `POST /rank`: Predict engagement probabilities using transformer model

**Mock Implementation**:
- Simulates two-tower retrieval with random similarity scores
- Simulates transformer predictions with realistic probability distributions
- Adjusts scores based on post characteristics and user history

### 4. Candidate Pipeline (`src/pipeline/`)

**Purpose**: Modular framework for processing recommendation requests.

**Pipeline Stages**:

#### Sources (`src/pipeline/sources.ts`)
- **ThunderSource**: Fetches posts from followed accounts
- **PhoenixSource**: Fetches ML-discovered posts from global corpus
- **Execution**: Parallel execution for optimal performance

#### Filters (`src/pipeline/filters.ts`)
- **DuplicateFilter**: Remove duplicate post IDs
- **SeenPostsFilter**: Remove posts user has already seen
- **AgeFilter**: Remove posts older than 24 hours
- **SelfPostFilter**: Remove user's own posts
- **Execution**: Sequential execution (order matters)

#### Scorers (`src/pipeline/scorers.ts`)
- **PhoenixScorer**: Get ML predictions from Phoenix service
- **WeightedScorer**: Combine predictions into final relevance score
- **AuthorDiversityScorer**: Reduce scores for repeated authors
- **Execution**: Sequential execution (each builds on previous)

## Data Flow

### 1. Request Processing
```
Client Request → Home Mixer → Pipeline.execute()
```

### 2. Candidate Sourcing
```
Thunder Source: User Following → Recent Posts → In-Network Candidates
Phoenix Source: User History → ML Retrieval → Out-of-Network Candidates
```

### 3. Filtering
```
All Candidates → Remove Duplicates → Remove Seen → Remove Old → Remove Self
```

### 4. Scoring
```
Filtered Candidates → ML Predictions → Weighted Scores → Diversity Adjustment
```

### 5. Selection
```
Scored Candidates → Sort by Score → Limit to Max Results → Return to Client
```

## Key Design Decisions

### 1. **Simplified Architecture**
- Removed complex Rust concurrency patterns
- Used familiar TypeScript/JavaScript patterns
- Maintained core algorithmic concepts

### 2. **In-Memory Storage**
- Thunder uses JavaScript Maps instead of Redis for simplicity
- Suitable for development and small-scale deployment
- Can be easily replaced with Redis for production

### 3. **Mock ML Service**
- Phoenix service simulates real ML predictions
- Maintains realistic probability distributions
- Easy to replace with actual transformer models

### 4. **Modular Pipeline**
- Clean separation of concerns
- Easy to add/remove/modify components
- Follows original pipeline pattern

### 5. **TypeScript Simplicity**
- Minimal type definitions
- Clear, readable code structure
- Easy to understand and modify

## Configuration

### Scoring Weights (`src/pipeline/scorers.ts`)
```typescript
private weights = {
  favorite: 1.0,    // Positive engagement
  reply: 0.8,       // Strong engagement
  retweet: 0.9,     // Amplification
  click: 0.3,       // Basic engagement
  share: 1.2,       // High-value action
  follow: 2.0,      // Strongest signal
  block: -5.0,      // Strong negative signal
  mute: -3.0        // Negative signal
};
```

### Filter Settings
- **Age Filter**: 24 hours maximum post age
- **Thunder**: 100 posts per user maximum
- **Results**: 10 posts per request (configurable)

## Performance Characteristics

### Latency
- **Thunder Lookups**: < 1ms (in-memory)
- **Phoenix ML**: 50-200ms (network + computation)
- **Total Pipeline**: 100-300ms typical

### Throughput
- **Single Instance**: ~100 requests/second
- **Bottleneck**: Phoenix ML service
- **Scaling**: Horizontal scaling of both services

### Memory Usage
- **Thunder**: ~1MB per 1000 posts
- **Node.js**: ~50MB base memory
- **Phoenix**: ~100MB (FastAPI + NumPy)

## Deployment

### Development
```bash
# Terminal 1: Start Phoenix ML service
cd phoenix
pip install -r requirements.txt
python main.py

# Terminal 2: Start Home Mixer
npm install
npm run dev
```

### Production Considerations
1. **Replace in-memory storage with Redis**
2. **Add proper ML models to Phoenix**
3. **Implement proper authentication**
4. **Add monitoring and logging**
5. **Use container orchestration (Docker/Kubernetes)**

## API Usage

### Get Scored Posts
```bash
curl -X POST http://localhost:3000/scored-posts \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "viewer",
    "maxResults": 10,
    "seenPostIds": [],
    "inNetworkOnly": false
  }'
```

### Add New Post
```bash
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{
    "authorId": "user1",
    "content": "Hello world!",
    "isReply": false,
    "isRetweet": false,
    "hasVideo": false
  }'
```

This implementation provides a solid foundation for understanding and extending the X For You Feed algorithm while maintaining simplicity and clarity.
