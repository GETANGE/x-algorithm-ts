import { Scorer } from '../candidate_pipeline/candidate_pipeline';
import { PostCandidate } from '../types';

export class WeightedScorer implements Scorer {
  private weights = {
    favorite: 1.0,
    reply: 0.8,
    retweet: 0.9,
    click: 0.3,
    share: 1.2,
    follow: 2.0,
    block: -5.0,
    mute: -3.0,
    profileClick: 0.4,
    videoView: 0.6,
    photoExpand: 0.5,
    dwell: 0.7,
    quote: 1.1,
    notInterested: -2.0,
    report: -10.0
  };

  // Video quality view weight eligibility
  private readonly MIN_VIDEO_DURATION_MS = 5000; // 5 seconds
  private readonly VQV_WEIGHT = 0.8;

  async score(candidates: PostCandidate[]): Promise<PostCandidate[]> {
    return candidates.map(candidate => {
      if (!candidate.phoenixScores) {
        return { ...candidate, weightedScore: 0 };
      }

      const scores = candidate.phoenixScores;
      
      // Determine VQV weight eligibility
      const vqvWeight = this.getVQVWeightEligibility(candidate);
      
      const weightedScore = 
        scores.favoriteScore * this.weights.favorite +
        scores.replyScore * this.weights.reply +
        scores.retweetScore * this.weights.retweet +
        scores.clickScore * this.weights.click +
        scores.shareScore * this.weights.share +
        scores.followScore * this.weights.follow +
        scores.blockScore * this.weights.block +
        scores.muteScore * this.weights.mute +
        scores.profileClickScore * this.weights.profileClick +
        scores.videoViewScore * vqvWeight +
        scores.photoExpandScore * this.weights.photoExpand +
        scores.dwellScore * this.weights.dwell +
        scores.quoteScore * this.weights.quote +
        scores.notInterestedScore * this.weights.notInterested +
        scores.reportScore * this.weights.report;

      const finalScore = this.offsetScore(weightedScore);

      return { 
        ...candidate, 
        weightedScore: finalScore,
        score: finalScore 
      };
    });
  }

  private getVQVWeightEligibility(candidate: PostCandidate): number {
    if (candidate.videoDurationMs && candidate.videoDurationMs > this.MIN_VIDEO_DURATION_MS) {
      return this.VQV_WEIGHT;
    }
    return 0.0;
  }

  private offsetScore(combinedScore: number): number {
    const NEGATIVE_SCORES_OFFSET = 0.1;
    const WEIGHTS_SUM = Object.values(this.weights).reduce((sum, w) => sum + Math.max(0, w), 0);
    const NEGATIVE_WEIGHTS_SUM = Math.abs(Object.values(this.weights).reduce((sum, w) => sum + Math.min(0, w), 0));

    if (WEIGHTS_SUM === 0) {
      return Math.max(0, combinedScore);
    } else if (combinedScore < 0) {
      return (combinedScore + NEGATIVE_WEIGHTS_SUM) / WEIGHTS_SUM * NEGATIVE_SCORES_OFFSET;
    } else {
      return combinedScore + NEGATIVE_SCORES_OFFSET;
    }
  }
}
