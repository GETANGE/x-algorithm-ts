# API Documentation

## Home Mixer Service API

Base URL: `http://localhost:3000`

### Health Check

**GET** `/health`

Returns the health status of the service.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Get Scored Posts (For You Feed)

**POST** `/scored-posts`

Returns a ranked list of posts for the user's For You feed.

**Request Body:**
```json
{
  "userId": "string",           // User ID requesting the feed
  "maxResults": 10,             // Maximum number of posts to return (default: 10)
  "seenPostIds": ["string"],    // Array of post IDs user has already seen
  "inNetworkOnly": false        // If true, only return posts from followed accounts
}
```

**Response:**
```json
{
  "posts": [
    {
      "id": "string",           // Post ID
      "content": "string",      // Post content
      "authorId": "string",     // Author user ID
      "score": 0.85,           // Relevance score (0-1)
      "inNetwork": true,       // Whether from followed account
      "source": "thunder"      // Source: "thunder" or "phoenix"
    }
  ],
  "totalCandidates": 25        // Total candidates processed
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/scored-posts \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "viewer",
    "maxResults": 5,
    "seenPostIds": ["post1", "post2"],
    "inNetworkOnly": false
  }'
```

### Add New Post

**POST** `/posts`

Adds a new post to the system.

**Request Body:**
```json
{
  "id": "string",               // Optional: Post ID (auto-generated if not provided)
  "authorId": "string",         // Required: Author user ID
  "content": "string",          // Required: Post content
  "isReply": false,            // Optional: Whether this is a reply
  "isRetweet": false,          // Optional: Whether this is a retweet
  "hasVideo": false,           // Optional: Whether post contains video
  "inReplyToPostId": "string", // Optional: ID of post being replied to
  "retweetedPostId": "string"  // Optional: ID of post being retweeted
}
```

**Response:**
```json
{
  "success": true,
  "postId": "string"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{
    "authorId": "user123",
    "content": "Just had an amazing coffee! ☕",
    "hasVideo": false
  }'
```

## Phoenix ML Service API

Base URL: `http://localhost:8001`

### Health Check

**GET** `/health`

Returns the health status of the ML service.

**Response:**
```json
{
  "status": "healthy",
  "service": "phoenix"
}
```

### Retrieve Candidates

**POST** `/retrieve`

Finds relevant out-of-network posts using two-tower similarity search.

**Request Body:**
```json
{
  "user_id": "string",
  "user_history": [
    {
      "postId": "string",
      "actionType": "favorite",    // favorite, reply, retweet, click, share, follow, block, mute
      "timestamp": 1704067200000
    }
  ],
  "max_results": 50
}
```

**Response:**
```json
{
  "candidates": [
    {
      "post": {
        "id": "string",
        "authorId": "string",
        "content": "string",
        "createdAt": 1704067200000,
        "isReply": false,
        "isRetweet": false,
        "hasVideo": false
      }
    }
  ]
}
```

### Rank Candidates

**POST** `/rank`

Predicts engagement probabilities for candidate posts using transformer model.

**Request Body:**
```json
{
  "user_id": "string",
  "candidates": [
    {
      "id": "string",
      "authorId": "string",
      "content": "string",
      "createdAt": 1704067200000,
      "isReply": false,
      "isRetweet": false,
      "hasVideo": false
    }
  ],
  "user_history": [
    {
      "postId": "string",
      "actionType": "favorite",
      "timestamp": 1704067200000
    }
  ]
}
```

**Response:**
```json
{
  "scores": [
    {
      "favorite": 0.25,    // Probability of favoriting
      "reply": 0.08,       // Probability of replying
      "retweet": 0.15,     // Probability of retweeting
      "click": 0.45,       // Probability of clicking
      "share": 0.12,       // Probability of sharing
      "follow": 0.05,      // Probability of following author
      "block": 0.02,       // Probability of blocking author
      "mute": 0.01         // Probability of muting author
    }
  ]
}
```

## Error Responses

All endpoints may return error responses in the following format:

**400 Bad Request:**
```json
{
  "error": "Invalid request parameters",
  "details": "userId is required"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error"
}
```

## Rate Limiting

Currently no rate limiting is implemented. In production, consider:
- 100 requests per minute per user for `/scored-posts`
- 1000 requests per minute per user for `/posts`
- 10 requests per second for ML endpoints

## Authentication

Currently no authentication is implemented. In production, add:
- JWT token validation
- User session management
- API key authentication for service-to-service calls
