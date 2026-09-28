// Sponsor-booth backdrop copy (name + tagline, baked into a canvas texture —
// see scene/sponsorBooths.ts's createXSignTexture()/createBannerTexture()
// functions) and kiosk labels/status text (see gameplay/vendingMachine.ts's
// createKiosk() configs). Same "inspired by, never copied" rule as the robot
// models; same tone rule as attendeeDialogue.ts — nothing here should read
// as a real complaint about a real sponsor. Re-check every pass (past
// corrections: Smals, Oracle, Vaultius) — "industry-wide humor" can still
// land as a genuine complaint about that specific sponsor.

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

// Belgium's real 10 provinces — factual, not a joke, but rendered as
// on-screen text on Tiny's backdrop screen, so kept alongside the rest of
// this booth's copy for the same one-place review/translation reason.
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

// Kiosk label/status copy (see vendingMachine.ts's createWifiKiosk() — JAVA
// and CANDY now build their own labels internally, see src/props/).
export const KIOSK_SIGNAGE = {
  wifi: { label: 'WIFI', availableLabel: 'CONNECTED', unavailableLabel: 'NO SIGNAL' },
};
