/**
 * Every rule number used by the decision engine (Build Spec §4).
 * No magic numbers anywhere else in src/engine — import from here.
 */

export type TierNum = 1 | 2 | 3;
export type FactorKey = 'money' | 'space' | 'experience' | 'background' | 'timeline';
export type PriorityKey = 'High' | 'Medium' | 'Low';

/* ---------------- Allowed values (§3.5) ---------------- */

export const CITY_INFO = {
  Bengaluru: { prefix: '560', tier: 1 },
  Mysuru: { prefix: '570', tier: 2 },
  Mangaluru: { prefix: '575', tier: 2 },
  'Hubballi-Dharwad': { prefix: '580', tier: 2 },
  Belagavi: { prefix: '590', tier: 2 },
  Tumakuru: { prefix: '572', tier: 3 },
  Davanagere: { prefix: '577', tier: 3 },
} as const satisfies Record<string, { prefix: string; tier: TierNum }>;

/* ---------------- Money (₹ lakh) ---------------- */

export const TIER_MIN_INVESTMENT: Record<TierNum, number> = { 1: 40, 2: 25, 3: 15 };
export const MONEY_HARD_FLOOR_RATIO = 0.7;
/** Checked top-down; first band whose minRatio ≤ ratio wins. W_PAYBACK_RISK below 1.0. */
export const MONEY_BANDS = [
  { minRatio: 1.0, points: 30 },
  { minRatio: 0.9, points: 22 },
  { minRatio: 0.8, points: 15 },
  { minRatio: 0.7, points: 8 },
] as const;

/* ---------------- Space ---------------- */

export const SPACE_SIZE: Record<TierNum, { min: number; idealMin: number; idealMax: number }> = {
  1: { min: 200, idealMin: 250, idealMax: 500 },
  2: { min: 250, idealMin: 300, idealMax: 600 },
  3: { min: 300, idealMin: 350, idealMax: 800 },
};
export const SIZE_POINTS = { ideal: 8, slightlySmall: 4, larger: 4 } as const;
export const OWNERSHIP_POINTS = { Owned: 10, Rented: 7 } as const;
export const FLOOR_POINTS = { Ground: 7, 'Mall unit': 7, Upper: 3 } as const;

/* ---------------- Experience ---------------- */

/** Checked top-down; first band whose minYears ≤ years wins. Blank → 0 years. */
export const EXPERIENCE_BANDS = [
  { minYears: 5, points: 20 },
  { minYears: 3, points: 16 },
  { minYears: 2, points: 12 },
  { minYears: 1, points: 8 },
  { minYears: 0, points: 4 },
] as const;

/* ---------------- Background ---------------- */

export const BACKGROUND_POINTS = { retail: 15, otherBusiness: 8, unclear: 3 } as const;
/** [DEFAULT] keyword lists (§7.4). Extended with a few obvious retail trades found in the sample data. */
export const BACKGROUND_KEYWORDS = {
  retail: [
    'shop', 'store', 'retail', 'retailer', 'showroom', 'outlet', 'boutique', 'kirana', 'grocery', 'supermarket', 'mart', 'fmcg',
    'footwear', 'garment', 'apparel', 'clothing', 'textile', 'mobile', 'electronics', 'optical', 'pharmacy', 'medical store',
    'stationery', 'bakery', 'franchise', 'franchisee', 'dealer', 'dealership', 'trader', 'trading', 'wholesale',
    // extensions (§21 allows extending the defaults)
    'optician', 'jewellery', 'jewelry', 'hardware', 'cosmetics',
  ],
  otherBusiness: [
    'business', 'owner', 'proprietor', 'entrepreneur', 'agency', 'distributor', 'distribution', 'restaurant', 'cafe', 'hotel',
    'contractor', 'manufacturing', 'manager', 'management', 'startup', 'consultancy',
  ],
} as const;

/* ---------------- Timeline ---------------- */

export const REALISTIC_MIN_MONTHS_WITH_SPACE = 3;
export const REALISTIC_MIN_MONTHS_NO_SPACE = 4;
export const TIMELINE_LONG_MONTHS = 9;
export const TIMELINE_POINTS = { realistic: 10, long: 6, tight: 4, unrealistic: 0, blank: 6 } as const;

export const FACTOR_MAX: Record<FactorKey, number> = { money: 30, space: 25, experience: 20, background: 15, timeline: 10 };

/* ---------------- Cannibalisation (same city; diff = |pinA − pinB|) ---------------- */

export const CANNIBAL_PENALTY = [
  { maxDiff: 10, penalty: 10 },
  { maxDiff: 30, penalty: 5 },
] as const;

/* ---------------- Decision lines ---------------- */

export const REJECT_LINE = 45;
export const APPROVAL_BAR: Record<PriorityKey, number> = { High: 55, Medium: 60, Low: 65 };
export const STRONG_LINE = 70;
export const GAP_RULE_POINTS = 15;
export const PRIORITY_ORDER: PriorityKey[] = ['High', 'Medium', 'Low'];

/* ---------------- Deadlines (days from decision date) ---------------- */

export const HOLD_INFO_DAYS = 7;
export const HOLD_SPACE_DAYS = 30;
export const REDIRECT_ACCEPT_DAYS = 7;
export const REDIRECT_SPACE_DAYS = 30;
export const REDIRECT_VERIFY_DAYS = 5; // brand check → done by day 35
export const DEADLINE_EXTENSION_DAYS = 7;

/* ---------------- Onboarding ---------------- */

export const BASE_OPENING_WEEKS = 12;
export const MALL_EXTRA_WEEKS = 2;
export const SPACE_SEARCH_EXTRA_WEEKS = 4;
export const WEEKS_PER_MONTH = 4.33;
export const TRAINING_START_WEEK = 4;
export const TRAINING_WEEKS = { extended: 6, standard: 4, fast: 2 } as const;
/** Experience (years) thresholds for the training track. */
export const TRAINING_TRACK_YEARS = { standardFrom: 2, fastFrom: 5 } as const;
/** Money ratio below which a funding-proof task is added (with any W_PAYBACK_RISK). */
export const FUNDING_PROOF_MAX_RATIO = 1.2;

/** Buddy store fallback for cities with no store of their own (§13.4). */
export const BUDDY_FALLBACK: Record<string, string> = { Tumakuru: 'ST-01', Davanagere: 'ST-09' };

/* ---------------- Health ---------------- */

export const AT_RISK_DAYS_BEFORE_DUE = 3;
export const DELAYED_DAYS_OVERDUE = 7;

/* ---------------- Demo time slider ---------------- */

/** "Simulate: Day 0 → Week 14". */
export const TIME_SLIDER_MAX_DAYS = 14 * 7;

/* ---------------- Notes keywords (§6) ---------------- */

export const NOTES_HAS_SPACE_KEYWORDS = [
  'own shop', 'my shop', 'have a shop', 'have space', 'own space', 'my space', 'already have',
  // extension: scenario 29 is phrased "I own a shop"
  'own a shop', 'own a space', 'own building',
];
export const NOTES_NO_SPACE_KEYWORDS = ['looking for space', 'no space', 'searching for', 'yet to find'];

/**
 * Next occurrence of each occasion after the decision date (26 Oct 2026).
 * Festival dates follow the lunar calendar — approximate, for the timeline check only.
 */
export const OCCASION_DATES: Array<{ keys: string[]; label: string; date: string }> = [
  { keys: ['diwali', 'deepavali', 'divali'], label: 'Diwali', date: '2026-11-08' },
  { keys: ['christmas', 'xmas'], label: 'Christmas', date: '2026-12-25' },
  { keys: ['new year'], label: 'New Year', date: '2027-01-01' },
  { keys: ['sankranti', 'sankranthi', 'pongal'], label: 'Sankranti', date: '2027-01-14' },
  { keys: ['eid'], label: 'Eid', date: '2027-03-10' },
  { keys: ['ugadi', 'yugadi'], label: 'Ugadi', date: '2027-04-07' },
  { keys: ['onam'], label: 'Onam', date: '2027-09-12' },
  { keys: ['dasara', 'dussehra', 'dasera'], label: 'Dasara', date: '2027-10-09' },
];

export const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
] as const;
