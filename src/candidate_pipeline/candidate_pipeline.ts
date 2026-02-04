// Candidate pipeline framework
import { PostCandidate, ScoredPostsQuery, PipelineResult } from '../types';

export interface Source {
  getCandidates(query: ScoredPostsQuery): Promise<PostCandidate[]>;
}

export interface Filter {
  filter(candidates: PostCandidate[], query: ScoredPostsQuery): PostCandidate[];
}

export interface Scorer {
  score(candidates: PostCandidate[], query: ScoredPostsQuery): Promise<PostCandidate[]>;
}

export interface Hydrator {
  hydrate(candidates: PostCandidate[], query: ScoredPostsQuery): Promise<PostCandidate[]>;
}

export interface QueryHydrator {
  hydrate(query: ScoredPostsQuery): Promise<ScoredPostsQuery>;
}

export interface Selector {
  select(candidates: PostCandidate[], query: ScoredPostsQuery): PostCandidate[];
}

export interface SideEffect {
  run(input: SideEffectInput): Promise<void>;
}

export interface SideEffectInput {
  query: ScoredPostsQuery;
  selectedCandidates: PostCandidate[];
}

export class CandidatePipeline {
  constructor(
    private queryHydrators: QueryHydrator[],
    private sources: Source[],
    private hydrators: Hydrator[],
    private filters: Filter[],
    private scorers: Scorer[],
    private selector: Selector,
    private postSelectionHydrators: Hydrator[],
    private postSelectionFilters: Filter[],
    private sideEffects: SideEffect[]
  ) {}

  async execute(query: ScoredPostsQuery): Promise<PipelineResult> {
    console.log(`🔄 Starting pipeline for user ${query.userId} (request: ${query.requestId})`);
    
    // 1. Hydrate query
    let hydratedQuery = query;
    for (const hydrator of this.queryHydrators) {
      hydratedQuery = await hydrator.hydrate(hydratedQuery);
    }
    console.log(`✅ Query hydrated`);

    // 2. Fetch candidates from all sources (parallel)
    const candidatePromises = this.sources.map(source => source.getCandidates(hydratedQuery));
    const candidateArrays = await Promise.all(candidatePromises);
    let candidates = candidateArrays.flat();
    console.log(`📥 Fetched ${candidates.length} candidates from ${this.sources.length} sources`);

    // 3. Hydrate candidates (parallel)
    for (const hydrator of this.hydrators) {
      candidates = await hydrator.hydrate(candidates, hydratedQuery);
    }
    console.log(`💧 Hydrated candidates`);

    const retrievedCandidates = [...candidates];

    // 4. Apply pre-scoring filters (sequential)
    let filteredCandidates: PostCandidate[] = [];
    for (const filter of this.filters) {
      const beforeCount = candidates.length;
      candidates = filter.filter(candidates, hydratedQuery);
      const filtered = beforeCount - candidates.length;
      if (filtered > 0) {
        console.log(`🔍 ${filter.constructor.name}: filtered ${filtered} candidates`);
      }
      filteredCandidates.push(...candidates.slice(beforeCount - filtered));
    }
    console.log(`🔍 After filtering: ${candidates.length} candidates remain`);

    // 5. Apply scorers (sequential)
    for (const scorer of this.scorers) {
      candidates = await scorer.score(candidates, hydratedQuery);
      console.log(`📊 Applied ${scorer.constructor.name}`);
    }

    // 6. Select top candidates
    const selectedCandidates = this.selector.select(candidates, hydratedQuery);
    console.log(`🎯 Selected ${selectedCandidates.length} top candidates`);

    // 7. Post-selection hydration
    let finalCandidates = selectedCandidates;
    for (const hydrator of this.postSelectionHydrators) {
      finalCandidates = await hydrator.hydrate(finalCandidates, hydratedQuery);
    }

    // 8. Post-selection filtering
    for (const filter of this.postSelectionFilters) {
      const beforeCount = finalCandidates.length;
      finalCandidates = filter.filter(finalCandidates, hydratedQuery);
      const filtered = beforeCount - finalCandidates.length;
      if (filtered > 0) {
        console.log(`🔍 Post-selection ${filter.constructor.name}: filtered ${filtered} candidates`);
      }
    }

    // 9. Run side effects
    const sideEffectInput = {
      query: hydratedQuery,
      selectedCandidates: finalCandidates
    };
    
    // Run side effects in parallel without blocking
    Promise.all(this.sideEffects.map(se => se.run(sideEffectInput))).catch(console.error);

    console.log(`✅ Pipeline complete: ${finalCandidates.length} final candidates`);

    return {
      retrievedCandidates,
      filteredCandidates,
      selectedCandidates: finalCandidates,
      query: hydratedQuery
    };
  }
}
