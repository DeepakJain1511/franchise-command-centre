import type { Territory } from '@/engine/types';

/**
 * 8 demo territories. TER-01, TER-02 and TER-05 are deliberately oversubscribed;
 * TER-07 (Belagavi) has no applicants. Davanagere has no territory at all.
 */
export const territories: Territory[] = [
  {
    id: 'TER-01', name: 'Bengaluru East', city: 'Bengaluru', state: 'Karnataka', tier: 'Tier 1',
    pins: ['560037', '560048', '560036', '560067', '560087', '560066', '560103'], openSlots: 3, priority: 'High',
  },
  {
    id: 'TER-02', name: 'Bengaluru South', city: 'Bengaluru', state: 'Karnataka', tier: 'Tier 1',
    pins: ['560102', '560068', '560100', '560078', '560041', '560076', '560062'], openSlots: 2, priority: 'High',
  },
  {
    id: 'TER-03', name: 'Bengaluru North', city: 'Bengaluru', state: 'Karnataka', tier: 'Tier 1',
    pins: ['560024', '560092', '560064', '560097', '560094', '560043'], openSlots: 3, priority: 'Medium',
  },
  {
    id: 'TER-04', name: 'Mysuru City', city: 'Mysuru', state: 'Karnataka', tier: 'Tier 2',
    pins: ['570001', '570002', '570008', '570011', '570017', '570020', '570023', '570009'], openSlots: 2, priority: 'Medium',
  },
  {
    id: 'TER-05', name: 'Mangaluru Central', city: 'Mangaluru', state: 'Karnataka', tier: 'Tier 2',
    pins: ['575001', '575002', '575003', '575004', '575006'], openSlots: 1, priority: 'Medium',
  },
  {
    id: 'TER-06', name: 'Hubballi-Dharwad', city: 'Hubballi-Dharwad', state: 'Karnataka', tier: 'Tier 2',
    pins: ['580020', '580021', '580029', '580030', '580031', '580001', '580004'], openSlots: 2, priority: 'High',
  },
  {
    id: 'TER-07', name: 'Belagavi Core', city: 'Belagavi', state: 'Karnataka', tier: 'Tier 2',
    pins: ['590001', '590006', '590010', '590011', '590016'], openSlots: 1, priority: 'Low',
  },
  {
    id: 'TER-08', name: 'Tumakuru', city: 'Tumakuru', state: 'Karnataka', tier: 'Tier 3',
    pins: ['572101', '572102', '572103', '572104', '572106'], openSlots: 2, priority: 'Low',
  },
];
