# Data provenance

Snapshot season: **2026/27**. Snapshot check: **30 October 2026**. Inspect the exact `updatedAt`, coverage and issues in `public/data/catalogue.json`.

## Coverage

- 20 Premier League club memberships.
- 36 Champions League league-phase club memberships.
- 51 unique clubs after deduplication; 1,609 squad player records.
- 134 fixtures/results and 84 bundled match summaries.
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

Each club/player/match keeps its available public source URL. The server whitelists two competitions, supported actions and identifier formats, applies a 9-second timeout and returns a 503 on source failure. Successful data can be cached for 15 minutes and served stale while revalidating. No upstream error is converted into fabricated data.

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
- Injury lists, valuations, salary, preferred foot, xG and heatmaps are not supplied or inferred.

These public endpoints have no contracted uptime or data-completeness guarantee. Provider rights, club marks and broadcast use require their own commercial review if the project becomes a commercial data service. No club crests, player photographs or third-party video are bundled; original monogram badges are used.
