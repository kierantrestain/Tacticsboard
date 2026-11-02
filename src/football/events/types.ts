export type EventType = 'pass'|'shot'|'tackle'|'interception'|'recovery'|'block'|'clearance'|'touch'|'carry'|'take-on'|'duel'|'foul'|'card'|'save'|'claim'|'error'|'other';
export type Coverage = 'complete'|'partial'|'unavailable';
export interface EventPoint { x:number; y:number }
export interface FootballEvent {
  id:string; sourceId:string; revision:number; matchId:string; teamId:string; playerId?:string;
  period:1|2|3|4|5; clock:number; type:EventType;
  outcome?:'completed'|'failed'|'goal'|'saved'|'blocked'|'off-target'|'woodwork'|'won'|'lost';
  start?:EventPoint; end?:EventPoint; goalmouth?:{y:number;z:number};
  qualifiers:string[]; providerTags?:string[]; bodyPart?:'left'|'right'|'head-body'|'other';
  pattern?:'open-play'|'set-piece'|'penalty'; recipientId?:string; possessionId?:string;
  xG?:number; xA?:number; postShotXG?:number; deleted?:boolean;
}
export interface EventMatch {id:string;competition:string;season:string;date:string;label:string;homeId:string;awayId:string;homeScore?:number;awayScore?:number}
export interface EventIdentity {id:string;name:string;position?:string;teamIds?:string[]}
export interface EventSource { provider:string;url:string;licence:string;attribution:string;revision:string;retrievedAt:string;historical:boolean;permissionNote?:string }
export interface EventCoverage {
  metricCoverage?:Record<string,Coverage>;
  types:Partial<Record<EventType,Coverage>>; coordinates:Coverage; outcomes:Coverage;
  xG:Coverage;xA:Coverage;recipients:Coverage;goalmouth:Coverage;possessions:Coverage;
  notes:string[];
}
export interface EventMinutes {playerId:string;teamId:string;matchId:string;minutes:number;basis:string;estimated?:boolean}
export interface EventDataset {
  completeTeamIds?:string[];
  format:'bangon-events';version:1;id:string;source:EventSource;competition:string;season:string;
  coordinates:{width:number;height:number;origin:'top-left'|'bottom-left';orientation:'attacking'|'fixed';directions?:Record<string,'left'|'right'>};
  coverage:EventCoverage;matches:EventMatch[];teams:EventIdentity[];players:EventIdentity[];minutes:EventMinutes[];events:FootballEvent[];
}
export interface EventFilters {
  against?:boolean;dateFrom?:string;dateTo?:string;
  teamId?:string;playerId?:string;matchId?:string;period?:number;from?:number;to?:number;
  mode:'shots'|'passes'|'defending'|'touches'|'carries'|'network';
  subtype?:'all'|'cross'|'open-cross'|'set-piece'|'key-pass'|'progressive'|'final-third'|'box-entry'|'tackle'|'interception'|'recovery'|'block'|'clearance';
  outcome?:string;bodyPart?:string;pattern?:string;orientation:'attacking'|'reverse';
}
export interface MetricValue {value:number|null;coverage:Coverage;denominator?:number}
export interface CohortRow {id:string;name:string;position:string;teamIds:string[];minutes:number;stats:Record<string,number|null>}
export interface CohortSnapshot {id:string;source:EventSource;competitions:string[];seasons:string[];minutesBasis:string;metricVersion:string;rows:CohortRow[]}
export interface EventIndex extends Omit<EventDataset,'events'> {chunks:{teamId:string;url:string;sha256:string;bytes:number;eventCount:number}[];cohort:CohortSnapshot}
export interface DataGraphic {
  kind:'map'|'radar';resourceId:string;title:string;filters:EventFilters;selectedEventIds:string[];
  playerIds:string[];radarMetrics:string[];position:string;minimumMinutes:number;basis:'totals'|'per90';
  radarOffset?:number;
  alignment?:{assetId:string;assetRevision?:number;period:number;eventClock:number;sourceTime:number;note:string};
}
export interface GraphicResource {format:'bangon-graphic-resource';version:1;dataset:EventDataset;cohort:CohortSnapshot;createdAt:string}
