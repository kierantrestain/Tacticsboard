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

Open **Animation creator** to play from the start, scrub, loop, or adjust playback speed. Select the ball or use **Give ball** to assign a carrier. Edit a stage to set its duration, release and arrival timing, and bend. **Run arrows** combines marked player runs with one ball action, then carries unused arrows into the next stage. The **From build-up to finish** play demonstrates a ground pass, dribble, lob and shot.

## Match maps

Open **Match maps** on Home or on the board. The seven bundled Bundesliga and 2. Bundesliga fixtures use event coordinates and xG supplied in the DFL dataset by Bassek, Rein, Weber and Memmert ([data source](https://doi.org/10.6084/m9.figshare.28196177), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)). Positions and event names were adapted to the Touchline pitch. The heat map and average positions in the bundled samples represent recorded on-ball actions.

Import a single [Hudl StatsBomb event JSON](https://github.com/hudl/open-data/tree/master/data/events) file, or wrap the event array as `{ "home": "...", "away": "...", "date": "...", "competition": "...", "title": "...", "events": [...] }`. The browser reads the file locally. The map is saved with the board when you add the layer.

The API-Football connection supplies competitions, squads and fixture lineups. Live location overlays use BALLDONTLIE when the deployment has a server-side `SPATIAL_FOOTBALL_KEY` with access to its match-map endpoints. Coverage depends on the competition and the provider. Live data remains optional when using samples or imports.

## Drawing and presets

Use **More tools** to open shapes, paths, field of view, target and number markers, distance measurement, and training cones. Pin individual tools to the toolbar or show them all. The library starts on Home. To jump straight to the editor use `?view=board`. Play multi-stage presets directly from the Templates panel, then edit any stage after playback.

### Match stories and moving drawings

Load a fixture through a team picker, then open **Match story** for recorded events and team statistics. Build an editable substitution board from the starting lineups and matching substitution events. The replay changes who is on the pitch and uses their previous formation slots. Coordinates for live runs and passes are not part of this feed.

Draw an arrow between two players with **Link arrows to players** enabled to set its endpoints. Switch to **Select**, click a drawing, and choose **Edit drawing** to change its colour or what the endpoints follow. **Show runs to next stage** previews where players are going. Pitch style, kit colours and marker style can be reused through **Saved looks**.

### Projects and folders

Media Draw's **Projects** button saves clips, drawings, visibility ranges and motion keyframes in the current browser. Use **Animate annotation** to set the position and scale of a drawing at different times. Tactics folders in Home organize your saved boards. Both libraries are stored on the current device.
