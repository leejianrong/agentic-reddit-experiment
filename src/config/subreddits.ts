export interface SubredditConfig {
  name: string;
  enabled: boolean;
}

/**
 * Starter list (Q9, PLAN.md). Only a couple are enabled to start —
 * flip more on once the dry-run loop has been soak-tested (SLICES.md V1
 * step 7).
 */
export const SUBREDDITS: SubredditConfig[] = [
  { name: 'Python', enabled: true },
  { name: 'MachineLearning', enabled: true },
  { name: 'dataisbeautiful', enabled: false },
  { name: 'LocalLLaMA', enabled: false },
  { name: 'artificial', enabled: false },
  { name: 'datascience', enabled: false },
];
