from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import numpy as np
import random

app = FastAPI(title="Phoenix ML Service", version="1.0.0")

class Post(BaseModel):
    id: str
    authorId: str
    content: str
    createdAt: int
    isReply: bool
    isRetweet: bool
    hasVideo: bool
    inReplyToPostId: Optional[str] = None
    retweetedPostId: Optional[str] = None
    retweetedUserId: Optional[str] = None
    conversationId: Optional[str] = None
    videoDurationMs: Optional[int] = None

class UserAction(BaseModel):
    postId: str
    actionType: str
    timestamp: int

class RetrievalRequest(BaseModel):
    user_id: str
    user_history: List[UserAction]
    max_results: int

class RankingRequest(BaseModel):
    user_id: str
    candidates: List[Post]
    user_history: List[UserAction]

class RetrievalResponse(BaseModel):
    candidates: List[Dict[str, Any]]

class RankingResponse(BaseModel):
    scores: List[Dict[str, float]]

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "phoenix"}

@app.post("/retrieve", response_model=RetrievalResponse)
async def retrieve_candidates(request: RetrievalRequest):
    """
    Two-tower retrieval model simulation.
    In production, this would use embeddings and vector search.
    """
    # Mock global post corpus with more realistic data
    mock_posts = []
    for i in range(200):
        post_data = {
            "id": f"global_{i}",
            "authorId": f"author_{i % 50}",  # 50 different authors
            "content": f"Global post {i}: {random.choice(['Amazing discovery!', 'Interesting thoughts on AI', 'Beautiful sunset today', 'New research findings', 'Great discussion about tech'])}",
            "createdAt": 1704067200000 + i * 60000,  # 1 minute apart
            "isReply": random.random() < 0.2,  # 20% replies
            "isRetweet": random.random() < 0.15,  # 15% retweets
            "hasVideo": random.random() < 0.1,  # 10% have video
            "videoDurationMs": random.randint(5000, 120000) if random.random() < 0.1 else None
        }
        
        if post_data["isReply"]:
            post_data["inReplyToPostId"] = f"global_{max(0, i-10)}"
            post_data["conversationId"] = f"conv_{i // 5}"
        
        if post_data["isRetweet"]:
            post_data["retweetedPostId"] = f"global_{max(0, i-5)}"
            post_data["retweetedUserId"] = f"author_{(i-5) % 50}"
        
        mock_posts.append(post_data)
    
    # Simulate user embedding based on engagement history
    user_preferences = {}
    for action in request.user_history:
        action_weight = {
            'favorite': 1.0,
            'reply': 0.8,
            'retweet': 0.9,
            'click': 0.3,
            'share': 1.2,
            'follow': 2.0,
            'block': -2.0,
            'mute': -1.5
        }.get(action.actionType, 0.1)
        
        user_preferences[action.actionType] = user_preferences.get(action.actionType, 0) + action_weight
    
    # Score posts based on similarity to user preferences
    scored_posts = []
    for post in mock_posts:
        # Base similarity score
        similarity_score = random.uniform(0.1, 0.6)
        
        # Boost based on user preferences
        if 'favorite' in user_preferences and not post['isReply']:
            similarity_score += 0.2
        if 'video_view' in user_preferences and post['hasVideo']:
            similarity_score += 0.3
        if 'reply' in user_preferences and post['isReply']:
            similarity_score += 0.15
        
        # Penalize based on negative actions
        if 'block' in user_preferences:
            similarity_score -= 0.1
        
        scored_posts.append({
            "post": post,
            "similarity_score": max(0.01, similarity_score)
        })
    
    # Sort by similarity and return top candidates
    scored_posts.sort(key=lambda x: x["similarity_score"], reverse=True)
    
    return RetrievalResponse(
        candidates=[{"post": p["post"]} for p in scored_posts[:request.max_results]]
    )

@app.post("/rank", response_model=RankingResponse)
async def rank_candidates(request: RankingRequest):
    """
    Transformer-based ranking model simulation.
    In production, this would use the Grok-based transformer with candidate isolation.
    """
    scores = []
    
    # Analyze user history for personalization
    user_action_counts = {}
    recent_actions = [a for a in request.user_history if a.timestamp > (1704067200000 - 7*24*60*60*1000)]  # Last 7 days
    
    for action in recent_actions:
        user_action_counts[action.actionType] = user_action_counts.get(action.actionType, 0) + 1
    
    for post in request.candidates:
        # Base engagement probabilities (realistic ranges)
        base_favorite = random.uniform(0.05, 0.25)
        base_reply = random.uniform(0.01, 0.08)
        base_retweet = random.uniform(0.02, 0.12)
        base_click = random.uniform(0.15, 0.45)
        base_share = random.uniform(0.005, 0.03)
        base_follow = random.uniform(0.001, 0.02)
        
        # Negative action probabilities (much lower)
        base_block = random.uniform(0.0001, 0.01)
        base_mute = random.uniform(0.0001, 0.005)
        base_not_interested = random.uniform(0.001, 0.02)
        base_report = random.uniform(0.0001, 0.002)
        
        # Content-based adjustments
        content_length = len(post.content)
        has_video = post.hasVideo
        is_reply = post.isReply
        is_retweet = post.isRetweet
        
        # Adjust based on content characteristics
        content_boost = 0.1 if content_length > 50 else 0
        video_boost = 0.2 if has_video else 0
        reply_penalty = -0.03 if is_reply else 0
        retweet_penalty = -0.01 if is_retweet else 0
        
        # Personalization based on user history
        personalization_boost = 0
        if 'favorite' in user_action_counts:
            personalization_boost += 0.05 * min(user_action_counts['favorite'] / 10, 1.0)
        if 'video_view' in user_action_counts and has_video:
            personalization_boost += 0.1
        if 'reply' in user_action_counts and is_reply:
            personalization_boost += 0.03
        
        # Apply adjustments
        favorite_score = max(0, base_favorite + content_boost + video_boost + personalization_boost + reply_penalty)
        reply_score = max(0, base_reply + (0.05 if is_reply else 0) + personalization_boost * 0.5)
        retweet_score = max(0, base_retweet + content_boost * 0.5 + personalization_boost * 0.7 + retweet_penalty)
        click_score = max(0, base_click + content_boost + video_boost * 0.5)
        share_score = max(0, base_share + content_boost * 1.5 + video_boost)
        follow_score = max(0, base_follow + (0.01 if content_length > 100 else 0))
        
        # Video-specific scores
        video_view_score = max(0, random.uniform(0.1, 0.6) if has_video else 0)
        photo_expand_score = max(0, random.uniform(0.05, 0.3) if not has_video else 0)
        
        # Additional engagement scores
        profile_click_score = max(0, base_follow * 2 + random.uniform(0, 0.05))
        dwell_score = max(0, base_click * 0.8 + content_boost)
        quote_score = max(0, base_retweet * 0.6 + content_boost)
        
        # Negative scores (influenced by content quality)
        quality_penalty = random.uniform(0, 0.02) if content_length < 20 else 0
        block_score = max(0, base_block + quality_penalty)
        mute_score = max(0, base_mute + quality_penalty * 0.5)
        not_interested_score = max(0, base_not_interested + quality_penalty)
        report_score = max(0, base_report + quality_penalty * 2)
        
        # Continuous values
        dwell_time = max(0, random.uniform(1.0, 30.0) + content_boost * 10)  # seconds
        
        post_scores = {
            "favorite": favorite_score,
            "reply": reply_score,
            "retweet": retweet_score,
            "click": click_score,
            "share": share_score,
            "follow": follow_score,
            "block": block_score,
            "mute": mute_score,
            "profile_click": profile_click_score,
            "video_view": video_view_score,
            "photo_expand": photo_expand_score,
            "dwell": dwell_score,
            "quote": quote_score,
            "not_interested": not_interested_score,
            "report": report_score,
            "dwell_time": dwell_time
        }
        
        scores.append(post_scores)
    
    return RankingResponse(scores=scores)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
