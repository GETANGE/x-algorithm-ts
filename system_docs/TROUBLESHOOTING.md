# Troubleshooting Guide

## Common Issues and Solutions

### Pipeline Execution Issues

#### Issue: "No candidates returned"
**Symptoms:**
- Empty response from `/scored-posts`
- `totalRetrieved: 0` in metadata

**Root Causes & Solutions:**

1. **Thunder Service Empty**
   ```bash
   # Check Thunder stats
   curl http://localhost:3000/stats
   
   # If totalPosts: 0, add sample posts
   curl -X POST http://localhost:3000/posts \
     -H "Content-Type: application/json" \
     -d '{"authorId": "user1", "content": "Test post"}'
   ```

2. **User Has No Following List**
   ```typescript
   // Check user data
   const user = homeMixer.getUser('viewer');
   if (!user.followingIds.length) {
     // Add following relationships
     homeMixer.updateUser('viewer', {
       followingIds: ['user1', 'user2']
     });
   }
   ```

3. **Phoenix Service Down**
   ```bash
   # Check Phoenix health
   curl http://localhost:8001/health
   
   # If failed, restart Phoenix
   cd phoenix && python main.py
   ```

---

#### Issue: "Pipeline timeout or slow response"
**Symptoms:**
- Response time >1000ms
- Timeout errors in logs

**Debugging Steps:**

1. **Check Component Timing**
   ```typescript
   // Enable detailed logging in pipeline
   console.log(`📊 Applied ${scorer.constructor.name}`);
   ```

2. **Phoenix Service Performance**
   ```bash
   # Test Phoenix directly
   time curl -X POST http://localhost:8001/rank \
     -H "Content-Type: application/json" \
     -d '{"user_id": "test", "candidates": [...], "user_history": []}'
   ```

3. **Thunder Memory Issues**
   ```bash
   # Check memory usage
   curl http://localhost:3000/stats
   # Look for high post counts or memory usage
   ```

**Solutions:**
- Reduce `maxResults` in query
- Restart Phoenix service
- Clear Thunder cache: `thunderService.clear()`

---

### Scoring Issues

#### Issue: "All posts have score 0"
**Symptoms:**
- All candidates return with `score: 0`
- No Phoenix scores attached

**Root Causes:**

1. **Phoenix Scorer Failed**
   ```typescript
   // Check Phoenix client connectivity
   try {
     await phoenixClient.rankCandidates(userId, candidates, history);
   } catch (error) {
     console.error('Phoenix ranking failed:', error);
   }
   ```

2. **No User History**
   ```typescript
   // Check user engagement history
   const user = homeMixer.getUser(userId);
   if (!user.engagementHistory.length) {
     // Add sample engagement
     homeMixer.addUserAction(userId, {
       postId: 'some_post',
       actionType: ActionType.FAVORITE,
       timestamp: Date.now()
     });
   }
   ```

3. **WeightedScorer Configuration**
   ```typescript
   // Verify scoring weights are configured
   const weights = {
     favorite: 1.0,  // Should be > 0
     reply: 0.8,
     // ... other weights
   };
   ```

---

#### Issue: "Scores seem incorrect or biased"
**Symptoms:**
- All posts from same author
- Unrealistic score distributions
- No diversity in results

**Debugging:**

1. **Check Author Diversity Scorer**
   ```typescript
   // Verify diversity multipliers
   private getMultiplier(position: number): number {
     switch (position) {
       case 0: return 1.0;    // First post
       case 1: return 0.8;    // Second post  
       case 2: return 0.6;    // Third post
       default: return 0.4;   // Fourth+ post
     }
   }
   ```

2. **Verify Filter Chain**
   ```bash
   # Check filter logs for excessive filtering
   grep "filtered" logs/app.log
   ```

3. **Phoenix Predictions Quality**
   ```typescript
   // Log Phoenix scores for inspection
   console.log('Phoenix scores:', candidate.phoenixScores);
   ```

---

### Data Quality Issues

#### Issue: "Posts missing content or metadata"
**Symptoms:**
- Empty `tweetText` fields
- Missing author information
- Broken post display

**Solutions:**

1. **Core Data Hydration**
   ```typescript
   // Ensure CoreDataCandidateHydrator runs
   const hydrators = [
     new CoreDataCandidateHydrator(),  // Must be first
     // ... other hydrators
   ];
   ```

2. **Check Post Ingestion**
   ```typescript
   // Verify posts have required fields
   const post: Post = {
     id: 'required',
     authorId: 'required', 
     content: 'required',  // Must not be empty
     createdAt: Date.now(),
     // ... other fields
   };
   ```

---

#### Issue: "User preferences not respected"
**Symptoms:**
- Blocked users appear in feed
- Muted keywords not filtered
- Seen posts reappear

**Debugging:**

1. **User Features Hydration**
   ```typescript
   // Check if user features are loaded
   const query = await userFeaturesHydrator.hydrate(originalQuery);
   console.log('User features:', query.userFeatures);
   ```

2. **Filter Execution Order**
   ```typescript
   // Ensure filters run in correct order
   const filters = [
     new DuplicateFilter(),
     new CoreDataHydrationFilter(),
     new AuthorSocialgraphFilter(),  // Must have user features
     new MutedKeywordFilter(),       // Must have user features
     // ... other filters
   ];
   ```

3. **Seen Posts Tracking**
   ```typescript
   // Verify seen posts are passed correctly
   const query = {
     userId: 'viewer',
     seenPostIds: ['post1', 'post2'],  // Must be accurate
     // ... other fields
   };
   ```

---

### Service Integration Issues

#### Issue: "Phoenix service connection failed"
**Symptoms:**
- `Phoenix retrieval failed` errors
- `Phoenix ranking failed` errors
- No out-of-network content

**Solutions:**

1. **Check Service Status**
   ```bash
   # Verify Phoenix is running
   curl http://localhost:8001/health
   
   # Check logs
   cd phoenix && python main.py
   ```

2. **Network Configuration**
   ```typescript
   // Verify Phoenix URL configuration
   const phoenixClient = new PhoenixClient('http://localhost:8001');
   ```

3. **Request Format**
   ```typescript
   // Ensure request format matches Phoenix expectations
   const request = {
     user_id: string,
     candidates: Post[],  // Must match Post interface
     user_history: UserAction[]
   };
   ```

---

#### Issue: "Thunder service memory issues"
**Symptoms:**
- Slow response times
- Memory usage growing continuously
- Out of memory errors

**Solutions:**

1. **Enable Auto-Cleanup**
   ```typescript
   // Ensure auto-trim is running
   thunderService.startAutoTrim(2); // Every 2 minutes
   ```

2. **Manual Cleanup**
   ```typescript
   // Force cleanup of old posts
   const trimmed = thunderService.trimOldPosts();
   console.log(`Trimmed ${trimmed} old posts`);
   ```

3. **Adjust Retention**
   ```typescript
   // Reduce retention period
   const thunderService = new ThunderService(
     12 * 60 * 60, // 12 hours instead of 24
     5000          // 5 second timeout
   );
   ```

---

### Performance Issues

#### Issue: "High memory usage"
**Symptoms:**
- Node.js process using >500MB RAM
- Slow garbage collection
- Memory leaks

**Debugging:**

1. **Thunder Service Stats**
   ```bash
   curl http://localhost:3000/stats
   # Check totalPosts, totalUsers counts
   ```

2. **Memory Profiling**
   ```bash
   # Use Node.js memory profiling
   node --inspect src/index.ts
   ```

3. **Optimize Data Structures**
   ```typescript
   // Use LightPost instead of full Post objects
   interface LightPost {
     id: string;
     authorId: string;
     content: string;
     createdAt: number;
     // Minimal fields only
   }
   ```

---

#### Issue: "High CPU usage"
**Symptoms:**
- CPU usage >80%
- Slow request processing
- Request queuing

**Solutions:**

1. **Optimize Filtering**
   ```typescript
   // Use efficient data structures
   const seenIds = new Set(query.seenPostIds); // O(1) lookup
   return candidates.filter(c => !seenIds.has(c.tweetId));
   ```

2. **Parallel Processing**
   ```typescript
   // Ensure hydrators run in parallel
   const hydratePromises = hydrators.map(h => h.hydrate(candidates));
   const results = await Promise.all(hydratePromises);
   ```

3. **Reduce Candidate Count**
   ```typescript
   // Limit candidates early in pipeline
   const THUNDER_MAX_RESULTS = 50;  // Reduce if needed
   const PHOENIX_MAX_RESULTS = 50;
   ```

---

## Debugging Tools

### Logging Configuration

```typescript
// Enable detailed pipeline logging
const DEBUG_PIPELINE = process.env.DEBUG_PIPELINE === 'true';

if (DEBUG_PIPELINE) {
  console.log(`🔄 Starting pipeline for user ${query.userId}`);
  console.log(`📥 Fetched ${candidates.length} candidates`);
  console.log(`🔍 After filtering: ${candidates.length} remain`);
  console.log(`📊 After scoring: ${candidates.length} scored`);
}
```

### Health Check Endpoints

```bash
# System health
curl http://localhost:3000/health

# Phoenix health  
curl http://localhost:8001/health

# System statistics
curl http://localhost:3000/stats
```

### Test Requests

```bash
# Basic feed request
curl -X POST http://localhost:3000/scored-posts \
  -H "Content-Type: application/json" \
  -d '{"userId": "viewer", "maxResults": 5}'

# In-network only
curl -X POST http://localhost:3000/scored-posts \
  -H "Content-Type: application/json" \
  -d '{"userId": "viewer", "inNetworkOnly": true}'

# With seen posts
curl -X POST http://localhost:3000/scored-posts \
  -H "Content-Type: application/json" \
  -d '{"userId": "viewer", "seenPostIds": ["1", "2"]}'
```

### Performance Testing

```bash
# Load testing with curl
for i in {1..10}; do
  time curl -X POST http://localhost:3000/scored-posts \
    -H "Content-Type: application/json" \
    -d '{"userId": "viewer"}' &
done
wait
```

---

## Recovery Procedures

### Service Recovery

1. **Restart Phoenix Service**
   ```bash
   cd phoenix
   pkill -f "python main.py"
   python main.py &
   ```

2. **Restart Home Mixer**
   ```bash
   pkill -f "npm run dev"
   npm run dev &
   ```

3. **Clear Thunder Cache**
   ```bash
   curl -X POST http://localhost:3000/admin/clear-cache
   # Or restart service
   ```

### Data Recovery

1. **Reload Sample Data**
   ```typescript
   // Add sample posts
   samplePosts.forEach(post => thunderService.addPost(post));
   
   // Add sample users
   sampleUsers.forEach(user => homeMixer.addUser(user));
   ```

2. **Reset User State**
   ```typescript
   // Clear user engagement history
   homeMixer.updateUser(userId, { engagementHistory: [] });
   
   // Reset user preferences
   homeMixer.updateUser(userId, {
     mutedKeywords: [],
     blockedUserIds: [],
     mutedUserIds: []
   });
   ```

This troubleshooting guide covers the most common issues and provides systematic approaches to diagnosis and resolution.
