// Level 2 (Knowledge Run) "conference wisdom" one-liners — a genuinely funny
// SFW rewrite of the programmer-folk-wisdom genre, written fresh rather than
// quoting anything real (same "inspired by, never copied" rule as the robot
// models). Shown as a toast (Hud.showQuoteToast()) the instant Droid picks up
// the nugget that carries it — see KnowledgeRun.ts's QUOTE_DEFS, which pairs
// each id below with a world position.
//
// Keyed by id rather than array position/index: a plain parallel array here
// would let a dropped or reordered entry silently mispair a quote with the
// wrong nugget with a clean typecheck. Keying against this union means tsc
// enforces both completeness (every id used) and correct pairing.

export type KnowledgeQuoteId =
  | 'stream-single-use'
  | 'undocumented-feature'
  | 'kubernetes-cluster'
  | 'microservice-monolith'
  | 'cloud-other-computer'
  | 'debugging-detective'
  | 'architecture-legacy'
  | 'java-write-debug'
  | 'demo-worked-yesterday'
  | 'ai-code-review'
  | 'ai-confident-wrong'
  | 'technical-debt-loan';

export const KNOWLEDGE_QUOTES: Record<KnowledgeQuoteId, string> = {
  'stream-single-use': 'A stream can only be consumed once. Ask for seconds and it throws a tantrum.',
  'undocumented-feature': "It's not a bug, it's an undocumented feature.",
  'kubernetes-cluster': 'Kubernetes: turning one problem into a cluster of them.',
  'microservice-monolith': 'A microservice is just a monolith, chopped into twelve smaller problems.',
  'cloud-other-computer': "The cloud is just someone else's computer.",
  'debugging-detective': "Debugging is being the detective in a crime movie where you're also the murderer.",
  'architecture-legacy': "Every well-architected system eventually becomes someone else's legacy code.",
  'java-write-debug': 'Java: write once, debug everywhere.',
  'demo-worked-yesterday': 'The most dangerous words before a demo: "it worked yesterday."',
  'ai-code-review': "AI didn't replace developers. It just gave them more code to review.",
  'ai-confident-wrong': "LLMs are confident. That's not the same as correct.",
  'technical-debt-loan': 'Technical debt is a loan you take out from Future You.',
};
