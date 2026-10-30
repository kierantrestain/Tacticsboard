# Data provenance

Snapshot season: **2026/27**. Snapshot check: **30 October 2026**. Inspect the exact `updatedAt`, coverage and issues in `public/data/catalogue.json`.

## Coverage

- 20 Premier League club memberships.
- 36 Champions League league-phase club memberships.
- 51 unique clubs after deduplication; 1,609 squad player records.
- 380 Premier League fixtures in 38 official FPL gameweeks.
- 144 UCL league-phase fixtures in eight matchdays.
- Full archived reports for all 134 completed games, including individual match statistics and key events. Detailed live commentary is fetched on demand rather than republished in the archive. Reports load on demand; 84 lightweight summaries remain in the starting-XI bootstrap.
- 669 FPL player records in the PL statistics view; 546 safely matched squad profiles have FPL enrichment.
- 51 club crest URLs supplied by ESPN; all 51 returned image responses during verification.
- All 51 manager records have an identity source. Starting-shape frequencies are derived from available summaries, not copied from a roster coach field.

The catalogue represents these competitions for this season, including the full 36-club UCL league phase. It does not claim every historic European qualifying club or a multi-season archive.

## Sources

Public ESPN football JSON supplies team membership, current squads, player biographies, competition-scoped statistics, schedules and match summaries:

- `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams?limit=100`
- `https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/teams?limit=100`
- `.../{league}/teams/{teamId}/roster?season=2026`
- `.../{league}/teams/{teamId}/schedule?season=2026`
- `.../{league}/summary?event={eventId}`
- `.../{league}/scoreboard?dates={YYYYMMDD}`

Each club/player/match keeps its available public source URL. The server whitelists two competitions, supported actions and identifier formats, applies a 9-second timeout and returns a 503 on source failure. Successful match/daily data uses a 30-second CDN cache, season/player/table data two minutes, and roster data 15 minutes. No upstream error is converted into fabricated data.

Manager identity sources include the [Premier League's manager coverage](https://www.premierleague.com/en/managers) and [UEFA Champions League club pages](https://www.uefa.com/uefachampionsleague/clubs/). Exact source links and check dates are stored on each generated manager record. For Fenerbahce, the newer [Liverpool announcement about Dirk Kuyt's interim appointment](https://www.liverpoolfc.com/news/dirk-kuyt-takes-interim-charge-of-fenerbahce-ahead-of-clash-with-liverpool) supersedes the older coach listing.

## Transformations and limits

- IDs are stable source strings. A club in both competitions is deduplicated; its statistics remain under the original competition keys.
- Numeric zero is preserved when supplied. Unavailable values stay null/absent and render as a dash.
- Height is converted from inches to rounded centimetres; weight from pounds to rounded kilograms.
- Feed formation identifiers are not treated as left-to-right pitch positions. Confirmed starter roles are ordered by depth and flank before placement in an editable formation template.
- “Confirmed match XI” requires 11 supplied starters. Otherwise the recent XI or a role-balanced squad selection is labelled explicitly.
- Match accuracy/completion percentages are calculated from supplied numerator/denominator counts; this avoids treating the provider’s rounded 0–1 ratio display as a literal percentage.
- Pitch locations are schematic analyst reconstructions. The data is not player tracking, and animation shows the analyst's explanation.
- Formation frequency includes only the imported match sample. Manager analysis lenses are original editorial prompts; they are not attributed tactical claims or computed metrics.
- Valuations, salary, preferred foot and heatmaps are not supplied or inferred. ESPN roster data is separate from the explicitly sourced FPL availability and xG/xA fields.

These public endpoints have no contracted uptime or data-completeness guarantee. Provider rights, club marks and broadcast use require their own commercial review if the project becomes a commercial data service. Club crests load from the ESPN-supplied image URLs and remain their owners' marks. No player photographs or third-party match footage are committed or deployed.


## Premier League public FPL source

- `https://fantasy.premierleague.com/api/bootstrap-static/` supplies official gameweek metadata, registered player statistics, availability flags and birth dates.
- `https://fantasy.premierleague.com/api/fixtures/` supplies all 380 PL fixtures, gameweek IDs, kickoff times, scores and supplied event contributions.
- `https://fantasy.premierleague.com/api/element-summary/{id}/` supplies individual match logs and past-season aggregates.
- `https://site.api.espn.com/apis/v2/sports/soccer/{league}/standings?season=2026` supplies the 20-club PL and 36-club UCL tables.

FPL fixture team IDs map to verified club names from the ESPN catalogue. Existing PL match IDs are joined only for the same home/away clubs in the same season. FPL player enrichment requires a unique identity match within that club; ambiguous records remain separate in the league player table. No transfer or identity is inferred from an image. FPL assists and availability definitions are identified in the UI and do not overwrite ESPN assists.

The UCL archive groups the eight league-phase rounds by their published fixture dates; it does not guess knockout participants. Fixture dates can change. The date/week lookup checks the public source on use. The shipped archive can be rebuilt with `npm run data:season`; raw responses are cached outside git.

The archived reports retain every supplied team-statistic field, every player's supplied match statistics, key events, venue, attendance and officials. Extended commentary is fetched from the source only when a report is opened. Static report files are fetched when selected rather than included in the initial UI payload. A live report updates the data without moving the analyst's player positions.
