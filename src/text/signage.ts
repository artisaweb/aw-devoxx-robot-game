// Sponsor-booth backdrop copy (name + tagline, baked into a canvas texture —
// see scene/sponsorBooths.ts's createXSignTexture()/createBannerTexture()
// functions). Same "inspired by, never copied" rule as the robot
// models; same tone rule as attendeeDialogue.ts — nothing here should read
// as a real complaint about a real sponsor. Re-check every pass
// "industry-wide humor" can still land as a genuine complaint about that specific sponsor.

// The event's own branding, as opposed to SPONSOR_SIGNAGE's fictional booth
// tenants below: the real conference name, baked into Room 4's own signage —
// its room panel and the branded AV flight case at the stage
// (scene/ExhibitionHall.ts's buildAuditorium()). No date anywhere — same
// reason the hallway screen carries none: a printed year goes stale.
//
// `standingLetters` does belong here after all: props/devoxxLetters.js draws
// real extruded glyph outlines rather than canvas text, but it picks which
// outlines to extrude from this string, so this is still the one place the
// word itself is written down. It only knows the glyphs # D E V O X — anything
// else throws at build time rather than silently dropping a letter.
export const EVENT_SIGNAGE = {
  standingLetters: '#DEVOXX',
  wordmark: 'DEVOXX',
  crate: ['DEVOXX', 'BELGIUM'],
};

export const SPONSOR_SIGNAGE = {
  rocketMind: { name: 'RocketMind', tagline: 'The IDE of 2040' },
  miracleSystems: { name: 'MIRACLE SYSTEMS', tagline: 'ENGINEERED FOR EXTREME PERFORMANCE' },
  gogglesCloud: { name: 'GOGGLES CLOUD', tagline: 'Clear Vision for the Cloud' },
  king: { name: 'KING' },
  vaultius: { name: 'Vaultius' },
  omniWare: {
    name: 'OMNIWARE',
    tagline: 'RUN ANYWHERE • INSTANT SPARK',
    vmReady: 'VM: READY',
    vmActive: 'VM: ACTIVE',
  },
  tiny: {
    name: 'TINY',
    tagline: 'TINY FOOTPRINT • NATIONAL SCALE',
    subtitle: 'ACTIVE ACROSS ALL 10 BELGIAN PROVINCES',
    footerTitle: 'BRUSSELS CAPITAL REGION & NATIONWIDE COVERAGE',
    footerSubtitle: '100% REGIONAL REDUNDANCY • ZERO OVERHEAD',
  },
};
export const BELGIAN_PROVINCES = [
  'Antwerpen',
  'Limburg',
  'Oost-Vlaanderen',
  'Vlaams-Brabant',
  'West-Vlaanderen',
  'Brabant wallon',
  'Hainaut',
  'Liège',
  'Luxembourg',
  'Namur',
];
