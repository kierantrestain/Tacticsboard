import type {Match,MatchDetails} from '../types';
export interface MatchCorrection {matchId:string;homeScore:string|null;awayScore:string|null;state:'pre'|'in'|'post';status:string;reason:string;at:string}
export function validMatchSource(m:unknown):m is Match {const v=m as Match;return !!v&&['id','league','homeId','awayId','homeName','awayName','status','date','sourceUrl'].every(k=>typeof (v as any)[k]==='string'&&(v as any)[k].length<=1000)&&v.sourceUrl.startsWith('https://')&&typeof v.completed==='boolean'&&Number.isFinite(Date.parse(v.date));}
export function validMatchCorrection(c:unknown):c is MatchCorrection {const v=c as MatchCorrection;return !!v&&typeof v.matchId==='string'&&v.matchId.length<=150&&[v.homeScore,v.awayScore].every(s=>s===null||typeof s==='string'&&/^\d{1,2}$/.test(s))&&['pre','in','post'].includes(v.state)&&typeof v.status==='string'&&v.status.length<=200&&typeof v.reason==='string'&&v.reason.trim().length>0&&v.reason.length<=500&&Number.isFinite(Date.parse(v.at));}
export function correctedMatch(source:Match,correction?:MatchCorrection):Match {
 if(!correction)return structuredClone(source);if(!validMatchCorrection(correction)||correction.matchId!==source.id)throw Error('The correction belongs to another match or is invalid.');
 return{...structuredClone(source),homeScore:correction.homeScore,awayScore:correction.awayScore,state:correction.state,status:correction.status,completed:correction.state==='post'};
}
export function matchFromReport(source:Match,report:MatchDetails):Match {
 if(report.id!==source.id||report.match&&report.match.id!==source.id)throw Error('This report belongs to another match.');
 const match={...source,...report.match};if(report.status)match.status=report.status;if(report.state){match.state=report.state;match.completed=report.state==='post';}
 for(const score of report.score||[]){if(score.teamId===source.homeId)match.homeScore=score.score;if(score.teamId===source.awayId)match.awayScore=score.score;}return match;
}
