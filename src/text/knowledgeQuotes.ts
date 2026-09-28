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
  | 'stream-usb'
  | 'null-personal-problem'
  | 'two-hard-things'
  | 'kubernetes-complicated'
  | 'microservice-monolith'
  | 'cloud-other-computer'
  | 'debugging-detective'
  | 'agile-figure-it-out'
  | 'java-optional-cat'
  | 'demo-rehearsal'
  | 'ci-proof-broken'
  | 'documentation-six-months'
  | 'technical-debt-loan';

export const KNOWLEDGE_QUOTES: Record<KnowledgeQuoteId, string> = {
  'stream-usb':
    'A stream is like a suspicious USB stick you found in a parking lot: use it once, then throw it away.',
  'null-personal-problem': 'Null is not a value. Null is a personal problem.',
  'two-hard-things':
    'There are only two hard things in computer science: cache invalidation, naming things, and off-by-one errors.',
  'kubernetes-complicated': "Kubernetes: it's not that complicated, said no one, ever.",
  'microservice-monolith': 'A microservice is a monolith that got expensive to deploy in twelve different ways.',
  'cloud-other-computer': 'The cloud is just someone else\'s computer, having a worse day than yours.',
  'debugging-detective': "Debugging is being the detective in a crime movie where you're also the murderer.",
  'agile-figure-it-out': "Agile is what we call 'we'll figure it out as we go' when it's in a slide deck.",
  'java-optional-cat': "A Java Optional is Schrödinger's cat with a legal requirement to check before you touch it.",
  'demo-rehearsal': 'A demo that works in rehearsal is a demo plotting against you.',
  'ci-proof-broken':
    "Continuous integration: proof that everyone's code was broken all along, just not at the same time.",
  'documentation-six-months':
    'The best time to write documentation was six months ago. The second best time is never, apparently.',
  'technical-debt-loan':
    'Technical debt is just a loan you take out from Future You, who never agreed to the interest rate.',
};
