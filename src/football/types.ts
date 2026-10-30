import type { Match, Stat, Team } from "../types";
export interface CareerData {
  playerId: string;
  league: string;
  updatedAt: string;
  sourceUrl: string;
  seasons: {
    seasonYear: number;
    season: string;
    teamId?: string;
    team: string;
    stats: Record<string, Stat>;
  }[];
}
export interface SeasonArchive {
  table?: LeagueTable;
  seasonYear: number;
  league: string;
  matches: Match[];
  teams: Team[];
  updatedAt: string;
  sourceUrl: string;
  coverage: {
    returned: number;
    expected: number | null;
    complete: boolean | null;
  };
}
export interface StandingRow {
  teamId: string;
  rank: number;
  qualification?: string;
  stats: Record<string, Stat>;
}
export interface LeagueTable {
  updatedAt: string;
  seasonYear?: number;
  groups: { name: string; entries: StandingRow[] }[];
}
export interface FPLPlayer {
  id: number;
  teamId?: string;
  name: string;
  webName: string;
  dateOfBirth?: string;
  status?: string;
  news?: string;
  stats: Record<string, Stat>;
}
export interface SeasonData {
  seasonYear: number;
  updatedAt: string;
  fixtures: Match[];
  players: FPLPlayer[];
  weeks: {
    id: number;
    name: string;
    deadline: string;
    current: boolean;
    next: boolean;
    finished: boolean;
  }[];
  standings: Record<string, LeagueTable>;
  coverage: {
    pl: number;
    ucl: number;
    plMatchweeks: number;
    uclMatchdays: number;
    crests: number;
    mappedPlayers: number;
  };
  sources: string[];
}
export interface PlayerHistory {
  updatedAt: string;
  history: {
    fixtureId: number;
    matchweek: number;
    opponentFplId: number;
    home: boolean;
    date: string;
    homeScore: number;
    awayScore: number;
    stats: Record<string, Stat>;
  }[];
  pastSeasons: { season: string; stats: Record<string, Stat> }[];
}
