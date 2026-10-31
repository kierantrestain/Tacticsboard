export interface ReportRecreation {
  version: 1;
  matchId: string;
  eventId: string;
  minute: string;
  title: string;
  sourceText: string;
  sourceUrl: string;
  actorId: string;
  assisterId?: string;
  coordinateBasis: 'provider' | 'illustrative';
  layoutBasis: 'illustrative';
  createdAt: string;
}
export function isReportRecreation(value: unknown): value is ReportRecreation {
  if (!value || typeof value !== 'object') return false;
  const r = value as ReportRecreation;
  return r.version === 1 && r.layoutBasis === 'illustrative' &&
    ['provider', 'illustrative'].includes(r.coordinateBasis) &&
    [r.matchId, r.eventId, r.actorId].every(s => typeof s === 'string' && s.length > 0 && s.length <= 160) &&
    typeof r.minute === 'string' && r.minute.length <= 30 &&
    typeof r.title === 'string' && r.title.length <= 120 &&
    typeof r.sourceText === 'string' && r.sourceText.length <= 4000 &&
    typeof r.sourceUrl === 'string' && /^https:\/\//.test(r.sourceUrl) && r.sourceUrl.length <= 1000 &&
    typeof r.createdAt === 'string' && Number.isFinite(Date.parse(r.createdAt)) &&
    (r.assisterId === undefined || typeof r.assisterId === 'string');
}
