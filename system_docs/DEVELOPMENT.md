# Development Guide

## Project Structure

```
x-algorithm-ts/
├── src/
│   ├── types.ts                 # Core type definitions
│   ├── index.ts                 # Main Express server
│   ├── services/
│   │   ├── homeMixer.ts         # Main orchestration service
│   │   ├── thunder.ts           # In-network post storage
│   │   └── phoenix.ts           # ML service client
│   └── pipeline/
│       ├── pipeline.ts          # Pipeline framework
│       ├── sources.ts           # Candidate sources
│       ├── filters.ts           # Content filters
│       └── scorers.ts           # Scoring algorithms
├── phoenix/
│   ├── main.py                  # FastAPI ML service
│   └── requirements.txt         # Python dependencies
├── system_docs/                 # Documentation
└── package.json                 # Node.js dependencies
```

## Core Concepts

### 1. Pipeline Architecture

The system uses a modular pipeline pattern where each stage can be independently modified:

```typescript
interface CandidatePipeline<Q, C> {
  sources: Source<Q, C>[];    // Fetch candidates
  filters: Filter<Q, C>[];    // Remove unwanted candidates
  scorers: Scorer<Q, C>[];    // Compute relevance scores
}
```

### 2. Type System

All components use strongly-typed interfaces:

```typescript
interface PostCandidate {
  post: Post;              // The actual post data
  score?: number;          // Final relevance score
  phoenixScores?: PhoenixScores; // ML predictions
  inNetwork: boolean;      // From followed account?
  source: 'thunder' | 'phoenix'; // Where it came from
}
```

### 3. Async/Await Pattern

All I/O operations use async/await for clean, readable code:

```typescript
async execute(query: ScoredPostsQuery): Promise<PipelineResult> {
  const candidates = await this.fetchCandidates(query);
  const filtered = this.applyFilters(candidates, query);
  const scored = await this.applyScorers(filtered, query);
  return { candidates: scored, query };
}
```

## Adding New Components

### Adding a New Source

1. **Create the source class:**
```typescript
// src/pipeline/sources.ts
export class NewSource implements Source {
  async getCandidates(query: ScoredPostsQuery): Promise<PostCandidate[]> {
    // Your candidate fetching logic here
    return candidates;
  }
}
```

2. **Register in HomeMixer:**
```typescript
// src/services/homeMixer.ts
const sources = [
  new ThunderSource(/* ... */),
  new PhoenixSource(/* ... */),
  new NewSource(/* ... */)  // Add your source
];
```

### Adding a New Filter

1. **Create the filter class:**
```typescript
// src/pipeline/filters.ts
export class NewFilter implements Filter {
  filter(candidates: PostCandidate[], query: ScoredPostsQuery): PostCandidate[] {
    return candidates.filter(candidate => {
      // Your filtering logic here
      return shouldKeep;
    });
  }
}
```

2. **Register in HomeMixer:**
```typescript
const filters = [
  new DuplicateFilter(),
  new SeenPostsFilter(),
  new NewFilter()  // Add your filter
];
```

### Adding a New Scorer

1. **Create the scorer class:**
```typescript
// src/pipeline/scorers.ts
export class NewScorer implements Scorer {
  async score(candidates: PostCandidate[]): Promise<PostCandidate[]> {
    return candidates.map(candidate => ({
      ...candidate,
      score: computeNewScore(candidate)
    }));
  }
}
```

2. **Register in HomeMixer:**
```typescript
const scorers = [
  new PhoenixScorer(/* ... */),
  new WeightedScorer(),
  new NewScorer()  // Add your scorer
];
```

## Testing

### Unit Tests

Create tests for individual components:

```typescript
// tests/pipeline/filters.test.ts
import { DuplicateFilter } from '../../src/pipeline/filters';

describe('DuplicateFilter', () => {
  it('should remove duplicate posts', () => {
    const filter = new DuplicateFilter();
    const candidates = [
      { post: { id: '1', /* ... */ } },
      { post: { id: '1', /* ... */ } },  // Duplicate
      { post: { id: '2', /* ... */ } }
    ];
    
    const result = filter.filter(candidates, mockQuery);
    expect(result).toHaveLength(2);
  });
});
```

### Integration Tests

Test the full pipeline:

```typescript
// tests/integration/pipeline.test.ts
describe('Full Pipeline', () => {
  it('should return scored posts', async () => {
    const homeMixer = new HomeMixerService(mockThunder, mockPhoenix);
    const query = { userId: 'test', maxResults: 5 };
    
    const result = await homeMixer.getScoredPosts(query);
    
    expect(result.candidates).toBeDefined();
    expect(result.candidates.length).toBeLessThanOrEqual(5);
  });
});
```

### Load Testing

Test performance with artillery or similar tools:

```yaml
# load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10

scenarios:
  - name: "Get scored posts"
    requests:
      - post:
          url: "/scored-posts"
          json:
            userId: "test-user"
            maxResults: 10
```

## Debugging

### Logging

Add detailed logging throughout the pipeline:

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
});

// In pipeline stages
logger.info('Pipeline stage completed', {
  stage: 'sources',
  candidateCount: candidates.length,
  userId: query.userId
});
```

### Performance Profiling

Add timing to identify bottlenecks:

```typescript
async execute(query: ScoredPostsQuery): Promise<PipelineResult> {
  const startTime = Date.now();
  
  const candidates = await this.fetchCandidates(query);
  logger.debug('Sources completed', { 
    duration: Date.now() - startTime,
    count: candidates.length 
  });
  
  // ... rest of pipeline
}
```

### Memory Monitoring

Monitor memory usage in Thunder service:

```typescript
class ThunderService {
  logStats() {
    const stats = {
      totalPosts: this.allPosts.size,
      totalUsers: this.postsByUser.size,
      memoryUsage: process.memoryUsage()
    };
    logger.info('Thunder stats', stats);
  }
}
```

## Configuration Management

### Environment-based Config

```typescript
// src/config.ts
export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    phoenixUrl: process.env.PHOENIX_URL || 'http://localhost:8001'
  },
  pipeline: {
    maxCandidates: parseInt(process.env.MAX_CANDIDATES || '100'),
    defaultMaxResults: parseInt(process.env.DEFAULT_MAX_RESULTS || '10'),
    ageFilterHours: parseInt(process.env.AGE_FILTER_HOURS || '24')
  },
  scoring: {
    favoriteWeight: parseFloat(process.env.FAVORITE_WEIGHT || '1.0'),
    replyWeight: parseFloat(process.env.REPLY_WEIGHT || '0.8'),
    // ... other weights
  }
};
```

### Feature Flags

Implement feature toggles for gradual rollouts:

```typescript
// src/features.ts
export const features = {
  enablePhoenixRetrieval: process.env.ENABLE_PHOENIX === 'true',
  enableAuthorDiversity: process.env.ENABLE_DIVERSITY === 'true',
  enableCaching: process.env.ENABLE_CACHE === 'true'
};

// In pipeline
if (features.enablePhoenixRetrieval) {
  sources.push(new PhoenixSource(/* ... */));
}
```

## Code Style and Standards

### TypeScript Best Practices

1. **Use strict types:**
```typescript
// Good
interface User {
  id: string;
  name: string;
  followingIds: string[];
}

// Avoid
const user: any = { /* ... */ };
```

2. **Prefer async/await over Promises:**
```typescript
// Good
async function fetchData() {
  const result = await apiCall();
  return result;
}

// Avoid
function fetchData() {
  return apiCall().then(result => result);
}
```

3. **Use meaningful names:**
```typescript
// Good
const inNetworkCandidates = await thunderSource.getCandidates(query);

// Avoid
const data = await source.get(q);
```

### Error Handling

Implement consistent error handling:

```typescript
class PipelineError extends Error {
  constructor(
    message: string,
    public stage: string,
    public component: string
  ) {
    super(message);
    this.name = 'PipelineError';
  }
}

// Usage
try {
  const candidates = await source.getCandidates(query);
} catch (error) {
  throw new PipelineError(
    `Failed to fetch candidates: ${error.message}`,
    'sources',
    'ThunderSource'
  );
}
```

## Performance Guidelines

### Memory Management

1. **Limit collection sizes:**
```typescript
// Keep only recent posts
if (userPosts.length > MAX_POSTS_PER_USER) {
  userPosts.sort((a, b) => b.createdAt - a.createdAt);
  this.postsByUser.set(userId, userPosts.slice(0, MAX_POSTS_PER_USER));
}
```

2. **Clean up resources:**
```typescript
class ThunderService {
  private cleanupInterval: NodeJS.Timeout;
  
  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.removeOldPosts();
    }, 60000); // Every minute
  }
  
  destroy() {
    clearInterval(this.cleanupInterval);
  }
}
```

### Async Optimization

1. **Parallel execution where possible:**
```typescript
// Good - parallel
const [thunderCandidates, phoenixCandidates] = await Promise.all([
  thunderSource.getCandidates(query),
  phoenixSource.getCandidates(query)
]);

// Avoid - sequential
const thunderCandidates = await thunderSource.getCandidates(query);
const phoenixCandidates = await phoenixSource.getCandidates(query);
```

2. **Batch operations:**
```typescript
// Good - batch ML predictions
const allScores = await phoenixClient.rankCandidates(userId, allCandidates, history);

// Avoid - individual predictions
const scores = await Promise.all(
  candidates.map(c => phoenixClient.rankCandidate(userId, c, history))
);
```

This development guide provides the foundation for extending and maintaining the X algorithm implementation.
