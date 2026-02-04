# Deployment Guide

## Quick Start

### Prerequisites
- Node.js 18+ 
- Python 3.8+
- npm or yarn

### Development Setup

1. **Clone and setup the project:**
```bash
cd x-algorithm-ts
npm install
```

2. **Setup Python environment for Phoenix:**
```bash
cd phoenix
pip install -r requirements.txt
```

3. **Start Phoenix ML service:**
```bash
cd phoenix
python main.py
# Phoenix will run on http://localhost:8001
```

4. **Start Home Mixer service:**
```bash
# In project root
npm run dev
# Home Mixer will run on http://localhost:3000
```

5. **Test the system:**
```bash
# Health check
curl http://localhost:3000/health

# Get scored posts
curl -X POST http://localhost:3000/scored-posts \
  -H "Content-Type: application/json" \
  -d '{"userId": "viewer", "maxResults": 5}'
```

## Production Deployment

### Docker Setup

**Dockerfile for Home Mixer:**
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

**Dockerfile for Phoenix:**
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY main.py .
EXPOSE 8001
CMD ["python", "main.py"]
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  home-mixer:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PHOENIX_URL=http://phoenix:8001
    depends_on:
      - phoenix
      - redis

  phoenix:
    build: ./phoenix
    ports:
      - "8001:8001"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### Kubernetes Deployment

**home-mixer-deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: home-mixer
spec:
  replicas: 3
  selector:
    matchLabels:
      app: home-mixer
  template:
    metadata:
      labels:
        app: home-mixer
    spec:
      containers:
      - name: home-mixer
        image: x-algorithm/home-mixer:latest
        ports:
        - containerPort: 3000
        env:
        - name: PHOENIX_URL
          value: "http://phoenix-service:8001"
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: home-mixer-service
spec:
  selector:
    app: home-mixer
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

**phoenix-deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: phoenix
spec:
  replicas: 2
  selector:
    matchLabels:
      app: phoenix
  template:
    metadata:
      labels:
        app: phoenix
    spec:
      containers:
      - name: phoenix
        image: x-algorithm/phoenix:latest
        ports:
        - containerPort: 8001
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
---
apiVersion: v1
kind: Service
metadata:
  name: phoenix-service
spec:
  selector:
    app: phoenix
  ports:
  - port: 8001
    targetPort: 8001
```

## Environment Configuration

### Home Mixer Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Phoenix ML Service
PHOENIX_URL=http://localhost:8001

# Redis Configuration (for production)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info

# Performance Tuning
MAX_CANDIDATES=100
DEFAULT_MAX_RESULTS=10
CACHE_TTL_SECONDS=300
```

### Phoenix Environment Variables

```bash
# Server Configuration
HOST=0.0.0.0
PORT=8001

# Model Configuration
MODEL_PATH=/app/models
BATCH_SIZE=32
MAX_SEQUENCE_LENGTH=512

# Performance
WORKERS=4
TIMEOUT=30
```

## Scaling Considerations

### Horizontal Scaling

**Home Mixer:**
- Stateless service - can scale horizontally
- Load balance with nginx or cloud load balancer
- Consider sticky sessions if using in-memory caching

**Phoenix ML Service:**
- CPU/GPU intensive - scale based on inference load
- Consider model serving frameworks (TensorFlow Serving, TorchServe)
- Use GPU instances for transformer models

### Vertical Scaling

**Memory Requirements:**
- Home Mixer: 512MB - 2GB per instance
- Phoenix: 1GB - 8GB per instance (depending on model size)

**CPU Requirements:**
- Home Mixer: 1-2 cores per instance
- Phoenix: 2-8 cores per instance (or GPU)

### Database Scaling

**Replace In-Memory Storage:**
```typescript
// Replace Thunder in-memory maps with Redis
import Redis from 'redis';

class ThunderService {
  private redis = new Redis(process.env.REDIS_URL);
  
  async addPost(post: Post) {
    await this.redis.hset(`posts:${post.id}`, post);
    await this.redis.lpush(`user:${post.authorId}:posts`, post.id);
    await this.redis.ltrim(`user:${post.authorId}:posts`, 0, 99); // Keep last 100
  }
}
```

## Monitoring and Observability

### Health Checks

**Kubernetes Liveness/Readiness:**
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

### Metrics Collection

**Add Prometheus metrics:**
```typescript
import prometheus from 'prom-client';

const requestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

const candidateCount = new prometheus.Histogram({
  name: 'pipeline_candidates_total',
  help: 'Number of candidates processed',
  labelNames: ['source', 'stage']
});
```

### Logging

**Structured logging with Winston:**
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' })
  ]
});
```

## Security Considerations

### Production Security Checklist

- [ ] Add authentication (JWT tokens)
- [ ] Implement rate limiting
- [ ] Use HTTPS/TLS encryption
- [ ] Validate and sanitize all inputs
- [ ] Add CORS configuration
- [ ] Implement request/response logging
- [ ] Use secrets management (AWS Secrets Manager, etc.)
- [ ] Network security (VPC, security groups)
- [ ] Regular security updates

### Example Security Middleware

```typescript
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet()); // Security headers

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/scored-posts', limiter);
```

## Performance Optimization

### Caching Strategy

```typescript
import NodeCache from 'node-cache';

class CachedHomeMixer extends HomeMixerService {
  private cache = new NodeCache({ stdTTL: 300 }); // 5 minute TTL
  
  async getScoredPosts(query: ScoredPostsQuery) {
    const cacheKey = `${query.userId}:${query.maxResults}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) return cached;
    
    const result = await super.getScoredPosts(query);
    this.cache.set(cacheKey, result);
    return result;
  }
}
```

### Database Optimization

- Use Redis for hot data (recent posts, user timelines)
- Use PostgreSQL for persistent data (user profiles, historical posts)
- Implement read replicas for scaling reads
- Use connection pooling

This deployment guide provides a foundation for running the X algorithm in various environments, from development to production-scale deployments.
