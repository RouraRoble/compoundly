/**
 * Product-level configuration. Every product edits this file.
 * Keep values honest: they end up in metadata, structured data and legal pages.
 */
export const site = {
  name: 'Compoundly',
  slug: 'compoundly',
  tagline: 'Compare up to three savings or investing plans, side by side, in one link.',
  description: 'Free compound interest calculator: compare up to three savings or investing scenarios side by side, with a chart, year-by-year table and a shareable link.',
  locale: 'en',
  ogLocale: 'en_US',
  themeColor: '#0b3d3a',
  backgroundColor: '#fbf7ee',
  accent: '#0f6f66',
  accentGold: '#c8952c',
  author: { name: 'RouraRoble', url: 'https://github.com/RouraRoble' },
  contactEmail: 'roura.roble@gmail.com',
  launched: '2026-09-23',
  category: 'FinanceApplication', // schema.org SoftwareApplication applicationCategory
  keywords: [
    'compound interest calculator',
    'investment calculator',
    'savings calculator',
    'compound interest calculator monthly',
    'apy vs apr',
    'rule of 72',
  ] as string[],
  social: { twitter: '' },
  affiliate: {
    // Documented in PRODUCT.md. No partner is signed yet, so hrefs stay '#' until one is.
    enabled: true,
    heading: 'Where to actually earn this rate',
    disclosure: 'Sponsored — we may earn a commission if you open an account through these links. This never changes the rate or price you get.',
    items: [
      { name: 'High-yield savings account', blurb: 'FDIC/FSCS-insured cash, no market risk. Typical rates trail the "growth" scenarios above.', href: '#' },
      { name: 'Low-cost brokerage account', blurb: 'For the index-fund-style scenarios: buy a broad market ETF and hold.', href: '#' },
    ],
  },
  // Monetization / analytics hooks (all optional, env-driven at build time)
  adsenseClient: import.meta.env.PUBLIC_ADSENSE_CLIENT || '',
  beaconUrl: import.meta.env.PUBLIC_BEACON_URL || '',
  plausibleDomain: import.meta.env.PUBLIC_PLAUSIBLE_DOMAIN || '',
};
export type SiteConfig = typeof site;
