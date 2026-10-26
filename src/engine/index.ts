/**
 * The active DecisionEngine. To plug in the real engine in Phase 2, implement
 * `DecisionEngine` (see ./types.ts) and change this ONE import.
 */
import { mockEngine } from './mockEngine';
import type { DecisionEngine } from './types';

export const engine: DecisionEngine = mockEngine;
export * from './types';
