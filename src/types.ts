import type { FootballAction } from "./studio/footballActionTypes";
import type { StudioDocument } from "./studio/types";
export type Side = "home" | "away";
export type Tool =
  | "select"
  | "arrow"
  | "run"
  | "line"
  | "pen"
  | "zone"
  | "ellipse"
  | "triangle"
  | "spotlight"
  | "text"
  | "erase"
  | "measure"
  | "offside";
export type Stat = { value?: number | null; display?: string; label: string };
export interface Player {
  fplId?: number;
  advanced?: {
    checkedAt: string;
    status?: string;
    news?: string;
    stats: Record<string, Stat>;
  };
  id: string;
  name: string;
  shortName?: string;
  firstName?: string;
  lastName?: string;
  number?: string | null;
  position?: string;
  positionCode?: string;
  nationality?: string;
  dateOfBirth?: string;
  heightCm?: number | null;
  weightKg?: number | null;
  birthPlace?: { city?: string; country?: string };
  statsByCompetition: Record<string, Record<string, Stat>>;
  sourceUrl?: string;
}
export interface LineupPlayer {
  stats?: Record<string, Stat>;
  subbedIn?: boolean;
  subbedOut?: boolean;
  id: string;
  name: string;
  number?: string;
  starter: boolean;
  formationPlace?: string;
  position?: string;
  positionCode?: string;
}
export interface Lineup {
  teamId: string;
  side: Side;
  formation?: string | null;
  players: LineupPlayer[];
}
export interface Manager {
  name: string;
  nationality: string;
  bio: string;
  lens: string;
  status?: string;
  sourceUrl: string;
  checkedAt: string;
  formations: { name: string; matches: number }[];
  tacticsBasis: string;
}
export interface Team {
  archived?: boolean;
  badgeUrl?: string;
  fplId?: number;
  rosterCheckedAt?: string;
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  color: string;
  alternateColor: string;
  competitions: string[];
  players: Player[];
  manager?: Manager;
  defaultFormation?: string;
  sourceUrl?: string;
  rosterUpdatedAt?: string;
  recentLineups?: {
    matchId: string;
    date: string;
    formation?: string;
    players: LineupPlayer[];
  }[];
}
export interface Match {
  seasonYear?: number;
  fplId?: number;
  matchweek?: number;
  stage?: string;
  state?: string;
  fplStats?: {
    identifier: string;
    h: { element: number; value: number }[];
    a: { element: number; value: number }[];
  }[];
  id: string;
  league: string;
  date: string;
  name: string;
  homeId: string;
  awayId: string;
  homeName: string;
  awayName: string;
  homeScore?: string | null;
  awayScore?: string | null;
  status: string;
  completed: boolean;
  venue?: string;
  sourceUrl: string;
}
export interface MatchDetails {
  updatedAt?: string;
  state?: string;
  status?: string;
  clock?: string;
  attendance?: number | null;
  venue?: string;
  officials?: { name: string; role?: string }[];
  commentary?: { minute?: string; text: string }[];
  score?: { teamId: string; score: string }[];
  match?: Match;
  id: string;
  lineups: Lineup[];
  teamStats: {
    teamId: string;
    stats: Record<string, { display: string; label: string }>;
  }[];
  events: { minute?: string; text?: string; type?: string }[];
  sourceUrl?: string;
}
export interface Catalogue {
  season: string;
  seasonYear: number;
  updatedAt: string;
  provider: string;
  competitions: { id: string; name: string; teamCount: number }[];
  teams: Team[];
  matches: Match[];
  quality: {
    issues: unknown[];
    squadCount: number;
    playerCount: number;
    notes: string[];
  };
}
export interface BoardPlayer {
  cutout?: string;
  uid: string;
  playerId: string;
  side: Side;
  x: number;
  y: number;
  name: string;
  number: string;
  position?: string;
  opacity?: number;
}
export interface Drawing {
  id: string;
  type: Exclude<Tool, "select" | "erase">;
  points: number[];
  color: string;
  width: number;
  opacity: number;
  text?: string;
}
export interface Frame {
  players: BoardPlayer[];
  drawings: Drawing[];
  ball: { x: number; y: number };
}
export interface Scene extends Frame {
  ballAction?: FootballAction;
  source?: { assetId: string; time: number; review: boolean };
  id: string;
  title: string;
  duration: number;
  note: string;
}
export interface Board extends Frame {
  context?: Record<
    Side,
    Pick<
      Team,
      | "id"
      | "name"
      | "shortName"
      | "abbreviation"
      | "color"
      | "alternateColor"
      | "badgeUrl"
      | "competitions"
    >
  >;
  version: 1;
  studio?: StudioDocument;
  id: string;
  title: string;
  homeTeamId: string;
  awayTeamId: string;
  competition: string;
  formations: Record<Side, string>;
  colors: Record<Side, string>;
  lineupSource: Record<Side, string>;
  scenes: Scene[];
  activeScene: string;
  match?: Match;
  managerNotes: Record<string, string>;
  media?: { id: string; name: string; type: "image" | "video" };
  settings: {
    theme: "studio" | "grass" | "light";
    camera: "top" | "angle";
    view: "full" | "left" | "right";
    names: boolean;
    numbers: boolean;
    grid: boolean;
    lanes: boolean;
    trails: boolean;
    homeVisible: boolean;
    awayVisible: boolean;
    mediaVisible: boolean;
    tokenStyle: "disc" | "shirt";
    ballVisible?: boolean;
    thirds?: boolean;
    teamShape?: boolean;
    teamLines?: boolean;
    shapeSide?: Side;
    focusPlayer?: string;
    markerScale?: number;
  };
}
export interface SavedBoard {
  id: string;
  title: string;
  updatedAt: string;
  homeTeamId: string;
  awayTeamId: string;
  scenes: number;
}
