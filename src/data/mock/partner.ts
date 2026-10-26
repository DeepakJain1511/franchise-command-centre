import type { City, Tier } from '@/engine/types';

/**
 * DEMO partner-portal fixtures: relationship managers, illustrative store economics and
 * canned chat replies.
 * PHASE-2: real logic goes here — CRM assignment, real P&L assumptions, real messaging.
 */

export interface RelationshipManager {
  name: string;
  role: string;
  phone: string; // demo numbers, not real
  email: string; // example domain
  hours: string;
  languages: string[];
}

const RM = (name: string, phone: string, email: string, languages: string[]): RelationshipManager => ({
  name,
  role: 'Partner relationship manager',
  phone,
  email,
  hours: 'Mon–Sat · 9:30 am – 6:30 pm',
  languages,
});

/** One manager per territory (Bengaluru) or per city elsewhere. */
export const managersByTerritory: Record<string, RelationshipManager> = {
  'TER-01': RM('Ananya Rao', '+91 80 0000 0101', 'ananya.rao@bunty.example', ['Kannada', 'English', 'Hindi']),
  'TER-02': RM('Rohan Shetty', '+91 80 0000 0102', 'rohan.shetty@bunty.example', ['Kannada', 'English']),
  'TER-03': RM('Ananya Rao', '+91 80 0000 0101', 'ananya.rao@bunty.example', ['Kannada', 'English', 'Hindi']),
};
export const managersByCity: Record<City, RelationshipManager> = {
  Bengaluru: RM('Rohan Shetty', '+91 80 0000 0102', 'rohan.shetty@bunty.example', ['Kannada', 'English']),
  Mysuru: RM('Kavitha Gowda', '+91 821 000 0103', 'kavitha.gowda@bunty.example', ['Kannada', 'English']),
  Mangaluru: RM("Sharon D'Souza", '+91 824 000 0104', 'sharon.dsouza@bunty.example', ['English', 'Kannada']),
  'Hubballi-Dharwad': RM('Vinod Kulkarni', '+91 836 000 0105', 'vinod.kulkarni@bunty.example', ['Kannada', 'Hindi']),
  Belagavi: RM('Meera Patil', '+91 831 000 0106', 'meera.patil@bunty.example', ['Kannada', 'Hindi', 'English']),
  Tumakuru: RM('Sunil Hegde', '+91 816 000 0107', 'sunil.hegde@bunty.example', ['Kannada', 'English']),
  Davanagere: RM('Sunil Hegde', '+91 816 000 0107', 'sunil.hegde@bunty.example', ['Kannada', 'English']),
};

/** Illustrative monthly economics per city tier (₹ lakh). Not a forecast. */
export const economicsByTier: Record<Tier, { monthlySalesLakh: number; grossMargin: number; monthlyCostsLakh: number }> = {
  'Tier 1': { monthlySalesLakh: 9, grossMargin: 0.58, monthlyCostsLakh: 3.0 },
  'Tier 2': { monthlySalesLakh: 6.5, grossMargin: 0.58, monthlyCostsLakh: 2.1 },
  'Tier 3': { monthlySalesLakh: 4.6, grossMargin: 0.58, monthlyCostsLakh: 1.45 },
};

/** Canned replies, matched by keyword in the partner's message. */
export const cannedReplies: Array<{ keys: RegExp; reply: string }> = [
  { keys: /open|launch|date|when/i, reply: 'Your target opening date is on your dashboard. If anything moves it, I will tell you the same day.' },
  { keys: /train|module|course|staff/i, reply: 'Training is self-paced. Finish the modules in your language; I can arrange a live session for your staff too.' },
  { keys: /space|shop|rent|floor|sq/i, reply: 'For the space we need ground floor and at least 400 sq ft. Send me photos and the rent quote and I will get projects to check.' },
  { keys: /pay|fee|invest|money|payback|profit/i, reply: 'The payback numbers are an estimate from similar stores. Happy to walk you through them on a call.' },
  { keys: /document|kyc|agreement|loi|sign/i, reply: 'You can upload documents here soon. For now, email them to me and I will confirm once they are in.' },
];
export const defaultReply = 'Thanks! I have noted this and will get back to you within a working day.';
