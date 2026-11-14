# Touchline

Touchline is a browser-based football tactics board. Open the editor to move players and the ball, draw tactical annotations, and capture a sequence in Animation creator. Use Home in the bottom dock to return to recent boards, templates, and saved tactics.

## Run locally

From this directory, run `python3 -m http.server 8787 --directory dist` and open `http://localhost:8787`. Open `http://localhost:8787/?view=home` to start from the Home screen.

Board edits and saved tactics live in your browser. Use Export to download a PNG, a browser-supported video, or a JSON file you can open again. Share links contain a board snapshot. Media Draw keeps input files on your device.

## Reference

The JLA Tactics Board editor and home screen supplied the design reference. The public app assets were inspected using [REA](https://github.com/morluto/rea). Touchline uses its own implementation, graphics, and example tactics.

## Leagues and squads

Open either team menu, then **Find a club or national team**. The bundled catalog contains dated league memberships and the 2026 World Cup national squads. Some club names appear under more than one competition. A national squad is assigned to formation slots to make an editable starting shape.

The team picker uses the live API-Football feed when the deployment has a server-side `API_FOOTBALL_KEY`. It falls back to the bundled open catalog when the feed is unavailable. The browser never receives the key. Production setup uses a Sensitive environment variable named `API_FOOTBALL_KEY` in Vercel. The free plan limits available seasons. Fixture lineups can populate both sides, including substitutes and match-specific shirt and goalkeeper colours when supplied. Major clubs have editable identity palettes, with crest-derived suggestions for other clubs when available.

Catalog sources include [OpenFootball](https://github.com/openfootball) (CC0) and [Damir Devetak / Football Charts match results](https://doi.org/10.5281/zenodo.23348754) ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)). Fixture team names and season memberships were extracted and normalised for search. Source and licence links are also in the team picker.

## Motion

Open **Animation creator** to scrub, loop, or adjust playback speed. Edit a stage to choose its outgoing ball movement and duration. The arrow palette can turn a drawn pass, dribble, lob or shot into a new stage. The **From build-up to finish** play template demonstrates all four.
