import type { Side } from '../types';
import type { AttackDirection } from './teamMovement';

export const PLAYBOOK = [
  { id: 'counter', name: 'Counterattack', category: 'open', patterns: [['break', 'Break forward']] },
  { id: 'build-up', name: 'Play out', category: 'open', patterns: [['short', 'Short build-up']] },
  { id: 'high-press', name: 'High press', category: 'open', patterns: [['press', 'Press the short pass']] },
  { id: 'switch', name: 'Switch play', category: 'open', patterns: [['switch', 'Through the pivot']] },
  { id: 'overlap', name: 'Wide overload', category: 'open', patterns: [['overlap', 'Overlap outside']] },
  { id: 'low-block', name: 'Low block', category: 'open', patterns: [['recover', 'Recover and slide']] },
  { id: 'corner', name: 'Corner', category: 'restart', patterns: [['near', 'Near post'], ['far', 'Far post'], ['short', 'Short corner'], ['edge', 'Edge of the box']] },
  { id: 'free-kick', name: 'Free kick', category: 'restart', patterns: [['direct', 'Direct shot'], ['near', 'Near-post delivery'], ['far', 'Far-post delivery'], ['short', 'Short pass']] },
  { id: 'throw-in', name: 'Throw-in', category: 'restart', patterns: [['feet', 'To feet'], ['line', 'Down the line']] },
  { id: 'goal-kick', name: 'Goal kick', category: 'restart', patterns: [['short', 'Short to a defender'], ['long', 'Long to the outlet']] },
  { id: 'penalty', name: 'Penalty', category: 'restart', patterns: [['direct', 'Penalty kick']] },
] as const;
export type PlayId = typeof PLAYBOOK[number]['id'];
export interface PlayRequest {
  id: PlayId;
  side: Side;
  direction: AttackDirection;
  flank: 'top' | 'bottom';
  pattern: string;
  marking: 'zonal' | 'man';
  wallSize: number;
  seconds: number;
  mode: 'setup' | 'sequence';
  takerId?: string;
  receiverId?: string;
  outcome?: 'goal' | 'saved' | 'off-target';
  goalTarget: 'left' | 'centre' | 'right';
  guides: boolean;
}
export interface PlayPhase {
  id: PlayId;
  phase: 'setup' | 'delivery' | 'finish';
  key: string;
  roles: Record<string, string>;
  basis: 'illustrative';
}
export function isPlayPhase(value: unknown): value is PlayPhase {
  if (!value || typeof value !== 'object') return false;
  const p = value as PlayPhase;
  return PLAYBOOK.some(play => play.id === p.id) && ['setup', 'delivery', 'finish'].includes(p.phase) && p.basis === 'illustrative'
    && typeof p.key === 'string' && p.key.length <= 1500 && !!p.roles && typeof p.roles === 'object' && !Array.isArray(p.roles)
    && Object.keys(p.roles).length <= 32 && Object.values(p.roles).every(id => typeof id === 'string' && id.length <= 150);
}
