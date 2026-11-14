# Touchline

Touchline is a browser-based football tactics board. Open the editor to move players and the ball, draw tactical annotations, and capture a sequence in Animation creator. Use Home in the bottom dock to return to recent boards, templates, and saved tactics.

## Run locally

From this directory, run `python3 -m http.server 8787 --directory dist` and open `http://localhost:8787`. Open `http://localhost:8787/?view=home` to start from the Home screen.

Board edits and saved tactics live in your browser. Use Export to download a PNG, a browser-supported video, or a JSON file you can open again. Share links contain a board snapshot. Media Draw keeps input files on your device.

## Reference

The JLA Tactics Board editor and home screen supplied the design reference. The public app assets were inspected using [REA](https://github.com/morluto/rea). Touchline uses its own implementation, graphics, and example tactics.
