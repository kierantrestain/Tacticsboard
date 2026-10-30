import { create } from "zustand";
import { useStudio } from "../store";
import type { Catalogue, Match, MatchDetails, Player, Team } from "../types";
import type {
  SeasonData,
  LeagueTable,
  PlayerHistory,
  CareerData,
  SeasonArchive,
} from "./types";
import { getRecord, putRecord } from "../studio/assetStore";
const pending = new Map<string, Promise<any>>(),
  recent = new Map<string, { at: number; value: any }>();
export async function requestFootball(
  query: string,
  ttl = 30000,
  force = false,
) {
  const key = "/api/football?" + query,
    hit = recent.get(key);
  if (!force && hit && Date.now() - hit.at < ttl) return hit.value;
  if (pending.has(key)) return pending.get(key);
  const work = fetch(key, {
    signal: AbortSignal.timeout(
      query.startsWith("action=archive") ? 55000 : 15000,
    ),
  })
    .then(async (r) => {
      if (!r.ok)
        throw Error(
          "The football feed is temporarily unavailable. Saved data is still available.",
        );
      const value = await r.json();
      recent.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, work);
  return work;
}
interface FootballState {
  focusMatchId?: string;
  season: SeasonData | null;
  refreshing: boolean;
  error: string;
  checkedAt: string;
  history: Record<number, PlayerHistory>;
  careers: Record<string, CareerData>;
  archives: Record<string, SeasonArchive>;
  set: (v: Partial<FootballState>) => void;
  tab: "fixtures" | "table" | "players";
}
export const useFootball = create<FootballState>((set) => ({
  season: null,
  refreshing: false,
  error: "",
  checkedAt: "",
  history: {},
  careers: {},
  archives: {},
  tab: "fixtures",
  set,
}));
export function mergeFixtures(old: Match[], incoming: Match[]) {
  const map = new Map(old.map((m) => [m.id, m]));
  for (const next of incoming) {
    const prior =
      map.get(next.id) ||
      [...map.values()].find(
        (m) =>
          m.league === next.league &&
          m.homeId === next.homeId &&
          m.awayId === next.awayId &&
          (m.league === "eng.1" ||
            m.matchweek === next.matchweek ||
            m.date.slice(0, 10) === next.date.slice(0, 10)),
      );
    if (prior) {
      map.set(prior.id, {
        ...prior,
        ...next,
        id: prior.id,
        fplId: prior.fplId || next.fplId,
        matchweek: prior.matchweek || next.matchweek,
        fplStats: next.fplStats || prior.fplStats,
      });
    } else map.set(next.id, next);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function applyAdvanced(
  catalogue: Catalogue,
  season: SeasonData,
): Catalogue {
  const byId = new Map(season.players.map((p) => [p.id, p]));
  return {
    ...catalogue,
    matches: mergeFixtures(catalogue.matches, season.fixtures),
    teams: catalogue.teams.map((t) => ({
      ...t,
      players: t.players.map((p) => {
        const extra = p.fplId ? byId.get(p.fplId) : undefined;
        return extra
          ? {
              ...p,
              advanced: {
                checkedAt: season.updatedAt,
                status: extra.status,
                news: extra.news,
                stats: extra.stats,
              },
            }
          : p;
      }),
    })),
  };
}
let booted = false;
export async function bootFootball() {
  if (booted) return;
  booted = true;
  try {
    const r = await fetch("/data/season.json");
    if (!r.ok) throw Error();
    let season: SeasonData = await r.json();
    const saved = await getRecord<SeasonData>(
      "projects",
      "football-season:" + season.seasonYear,
    ).catch(() => null);
    if (
      saved?.seasonYear === season.seasonYear &&
      Array.isArray(saved.players) &&
      Date.parse(saved.updatedAt) > Date.parse(season.updatedAt)
    )
      season = saved;
    const catalogue = useStudio.getState().catalogue;
    if (catalogue) {
      useStudio.setState({ catalogue: applyAdvanced(catalogue, season) });
      useFootball.setState({ season, checkedAt: season.updatedAt });
    }
    void refreshFootball();
  } catch {
    useFootball.setState({
      error: "The saved season index could not be opened.",
    });
  }
}
export async function refreshFootball() {
  const state = useFootball.getState();
  if (state.refreshing || !state.season) return;
  useFootball.setState({ refreshing: true, error: "" });
  const year = state.season.seasonYear;
  const results = await Promise.allSettled([
    requestFootball("action=season&season=" + year, 90000, true),
    ...["eng.1", "uefa.champions"].map((league) =>
      requestFootball(
        `action=standings&league=${league}&season=${year}`,
        120000,
        true,
      ),
    ),
  ]);
  const season = { ...state.season, standings: { ...state.season.standings } };
  let successes = 0;
  if (results[0].status === "fulfilled") {
    const fresh = results[0].value;
    if (fresh.seasonYear === year) {
      Object.assign(season, {
        players: fresh.players,
        weeks: fresh.weeks,
        updatedAt: fresh.updatedAt,
        fixtures: mergeFixtures(season.fixtures, fresh.fixtures),
      });
      successes++;
    }
  }
  ["eng.1", "uefa.champions"].forEach((league, i) => {
    const r = results[i + 1];
    if (r.status === "fulfilled") {
      season.standings[league] = r.value as LeagueTable;
      successes++;
    }
  });
  const catalogue = useStudio.getState().catalogue;
  if (catalogue)
    useStudio.setState({ catalogue: applyAdvanced(catalogue, season) });
  useFootball.setState({
    season,
    refreshing: false,
    checkedAt: successes ? new Date().toISOString() : state.checkedAt,
    error:
      successes < 3
        ? "Some sources could not refresh. Their last saved data remains available."
        : "",
  });
  if (successes)
    void putRecord("projects", "football-season:" + year, season).catch(
      () => {},
    );
}
export async function refreshMatchday(date: string, league: string) {
  const result = await requestFootball(
    `action=fixtures&league=${league}&date=${date.replaceAll("-", "")}`,
    30000,
    false,
  );
  const state = useFootball.getState(),
    catalogue = useStudio.getState().catalogue;
  if (!state.season || !catalogue) return;
  const fixtures = mergeFixtures(state.season.fixtures, result.matches || []);
  useFootball.setState({ season: { ...state.season, fixtures } });
  useStudio.setState({ catalogue: { ...catalogue, matches: fixtures } });
}
function acceptReport(m: Match, d: MatchDetails) {
  const s = useStudio.getState();
  useStudio.setState({ summaries: { ...s.summaries, [m.id]: d } });
  if (s.board?.match?.id === m.id) {
    const match = { ...s.board.match, ...d.match };
    if (d.status) match.status = d.status;
    if (d.state) {
      match.state = d.state;
      match.completed = d.state === "post";
    }
    for (const score of d.score || []) {
      if (score.teamId === match.homeId) match.homeScore = score.score;
      if (score.teamId === match.awayId) match.awayScore = score.score;
    }
    useStudio.setState({ board: { ...s.board, match } });
  }
}
const reports = new Map<string, Promise<MatchDetails>>();
export async function loadReport(
  m: Match,
  force = false,
): Promise<MatchDetails> {
  if (reports.has(m.id)) return reports.get(m.id)!;
  let cached: MatchDetails | undefined = useStudio.getState().summaries[m.id];
  if (
    !force &&
    cached?.updatedAt &&
    Date.now() - new Date(cached.updatedAt).getTime() < 30000
  )
    return cached;
  const network = () =>
    requestFootball(
      `action=summary&league=${m.league}&event=${m.id}${m.date ? "&date=" + m.date.slice(0, 10).replaceAll("-", "") : ""}`,
      30000,
      force,
    ).then((d: MatchDetails) => {
      acceptReport(m, d);
      void putRecord("projects", "football-report:" + m.id, d).catch(() => {});
      return d;
    });
  const work = (async () => {
    cached ||=
      (await getRecord<MatchDetails>(
        "projects",
        "football-report:" + m.id,
      ).catch(() => null)) || undefined;
    if (cached?.id !== m.id) cached = undefined;
    if (cached) {
      acceptReport(m, cached);
      if (!force) {
        void network().catch(() => {});
        return cached;
      }
    }
    if (!force && /^\d+$/.test(m.id)) {
      try {
        const r = await fetch(`/data/reports/${m.id}.json`);
        if (r.ok) {
          const saved: MatchDetails = await r.json();
          acceptReport(m, saved);
          void network().catch(() => {});
          return saved;
        }
      } catch {}
    }
    try {
      return await network();
    } catch (e) {
      if (cached) return cached;
      throw e;
    }
  })().finally(() => reports.delete(m.id));
  reports.set(m.id, work);
  return work;
}
export async function loadPlayerHistory(id: number, force = false) {
  const state = useFootball.getState(),
    cached =
      state.history[id] ||
      (await getRecord<PlayerHistory>(
        "projects",
        "football-player:" + id,
      ).catch(() => null));
  if (cached)
    useFootball.setState((s) => ({ history: { ...s.history, [id]: cached } }));
  if (
    !force &&
    cached &&
    Date.now() - new Date(cached.updatedAt).getTime() < 120000
  )
    return cached;
  try {
    const data: PlayerHistory = await requestFootball(
      "action=player&player=" + id,
      120000,
      force,
    );
    useFootball.setState((s) => ({ history: { ...s.history, [id]: data } }));
    void putRecord("projects", "football-player:" + id, data).catch(() => {});
    return data;
  } catch (e) {
    if (cached) return cached;
    throw e;
  }
}
export async function loadCareer(
  id: string,
  league: string,
  force = false,
): Promise<CareerData> {
  const key = league + ":" + id,
    state = useFootball.getState(),
    cached =
      state.careers[key] ||
      (await getRecord<CareerData>("projects", "career:" + key).catch(
        () => null,
      ));
  if (cached)
    useFootball.setState((s) => ({ careers: { ...s.careers, [key]: cached } }));
  if (!force && cached && Date.now() - Date.parse(cached.updatedAt) < 3600000)
    return cached;
  try {
    const data: CareerData = await requestFootball(
      `action=career&league=${league}&player=${id}`,
      3600000,
      force,
    );
    useFootball.setState((s) => ({ careers: { ...s.careers, [key]: data } }));
    void putRecord("projects", "career:" + key, data).catch(() => {});
    return data;
  } catch (e) {
    if (cached) return cached;
    throw e;
  }
}
export async function loadArchive(
  year: number,
  league: string,
  force = false,
): Promise<SeasonArchive> {
  const key = league + ":" + year,
    state = useFootball.getState(),
    cached =
      state.archives[key] ||
      (await getRecord<SeasonArchive>(
        "projects",
        "season-archive:" + key,
      ).catch(() => null));
  if (cached)
    useFootball.setState((s) => ({
      archives: { ...s.archives, [key]: cached },
    }));
  if (!force && cached && Date.now() - Date.parse(cached.updatedAt) < 3600000)
    return cached;
  try {
    const data: SeasonArchive = await requestFootball(
      `action=archive&league=${league}&season=${year}`,
      3600000,
      force,
    );
    useFootball.setState((s) => ({ archives: { ...s.archives, [key]: data } }));
    void putRecord("projects", "season-archive:" + key, data).catch(() => {});
    return data;
  } catch (e) {
    if (cached) return cached;
    throw e;
  }
}
export async function refreshTeam(teamId: string, league: string) {
  const s = useStudio.getState(),
    cat = s.catalogue;
  if (!cat) return;
  const team = cat.teams.find((t) => t.id === teamId);
  if (!team) return;
  try {
    const r = await requestFootball(
      `action=roster&league=${league}&team=${teamId}&season=${cat.seasonYear}`,
      900000,
    );
    const old = new Map(team.players.map((p) => [p.id, p]));
    const players: Player[] = r.players.map((p: Player) => ({
      ...old.get(p.id),
      ...p,
      fplId: old.get(p.id)?.fplId,
      advanced: old.get(p.id)?.advanced,
      statsByCompetition: {
        ...old.get(p.id)?.statsByCompetition,
        ...p.statsByCompetition,
      },
    }));
    const current = useStudio.getState().catalogue!;
    useStudio.setState({
      catalogue: {
        ...current,
        teams: current.teams.map((t) =>
          t.id === teamId
            ? {
                ...t,
                players,
                rosterCheckedAt: new Date().toISOString(),
                rosterUpdatedAt: r.updatedAt,
              }
            : t,
        ),
      },
    });
  } catch {}
}
export const checkedTime = (v?: string) =>
  v
    ? new Date(v).toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }) + " UTC"
    : "saved snapshot";
