// Keep the provider's event evidence without inventing absent coordinates or roles.
export function normaliseReportEvent(entry, commentary = false) {
  const play = commentary ? entry.play || {} : entry;
  const clock = entry.time || play.clock || entry.clock || {};
  const number = (v) => typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  const coordinate = (v) => number(v) !== undefined && v >= 0 && v <= 100 ? v : undefined;
  const x = coordinate(play.fieldPositionX), y = coordinate(play.fieldPositionY);
  const targetX = coordinate(play.fieldPosition2X), targetY = coordinate(play.fieldPosition2Y);
  return {
    id: play.id != null ? String(play.id) : commentary && entry.sequence != null ? `commentary-${entry.sequence}` : undefined,
    minute: clock.displayValue,
    seconds: number(clock.value),
    text: entry.text || play.text || '',
    type: play.type?.text,
    teamId: play.team?.id != null ? String(play.team.id) : undefined,
    teamName: play.team?.displayName,
    period: number(play.period?.number),
    scoringPlay: typeof play.scoringPlay === 'boolean' ? play.scoringPlay : undefined,
    participants: (play.participants || []).filter(p => p.athlete?.id || p.athlete?.displayName).map(p => ({
      id: p.athlete.id != null ? String(p.athlete.id) : undefined,
      name: p.athlete.displayName,
    })),
    ...(x !== undefined && y !== undefined ? { position: { x, y, ...(targetX !== undefined && targetY !== undefined ? { targetX, targetY } : {}) } } : {}),
  };
}
