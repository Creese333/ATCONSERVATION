# A.T. Resource Grid on MapLibre

**[atconservation.com](https://atconservation.com)** is a copy of the [A.T. Resource Grid](https://grid.trailassessment.org) dashboard ([Creese333/AT-Resource-Grid](https://github.com/Creese333/AT-Resource-Grid)), rebuilt on the [MapLibre GL JS](https://maplibre.org) map engine (version 5.24.0) in place of Leaflet.

> The summaries are generalized to the grid and are for screening and planning. They are not site assessments, boundary determinations or a trail condition survey.

## Where the data comes from

All data stays in AT-Resource-Grid and is rebuilt there by its workflows. This site reads it from `https://grid.trailassessment.org/data/` (and the bird photos from `/images/birds/`); GitHub Pages allows those cross-site reads. Nothing here builds or stores data, so this repository has no build workflows, caches or secrets.

## Files

| File | What it is |
|---|---|
| `index.html` | The page: layout, styles, the loading screen and the loader (grid data, MapLibre, the map, then the app) |
| `atmap.js` | The map engine: the MapLibre map, basemaps, the basemap tile queue, drawing order, geometry helpers |
| `app.js` | The dashboard: questions, measures, cells, legend, side panel, charts, selection, export |
| `inat.js` | iNaturalist live lookup for a selected cell |
| `sw.js` | Service worker: opens from saved copies, "A new version is ready", Save for offline |
| `manifest.webmanifest`, `images/` | App icons, launch screens and tour photos |
| `CNAME` | `atconservation.com` |

`data/`, `scripts/` and `.github/workflows/` hold only a note each, so the folders exist for uploads.

## How the map works

- **Zoom numbers.** app.js counts zoom the Leaflet way, one more than MapLibre's number at the same scale. `atmap.js` converts at the edge, so every threshold in app.js means what it did on the Leaflet dashboard.
- **Layers** are added once the style is in (`style.load`), never on `load`, which waits for every first tile and never fires when a basemap service is down. The loader makes the map and starts app.js only after the style is in.
- **Cells** are one GeoJSON source per cell size, colored through feature-state, so restyling never rebuilds geometry.
- **Basemap tiles** go through the `atq://` protocol in atmap.js. Each service gets a few requests at a time; a failed tile is asked for again a little later each time; NAIP Plus falls back to plain NAIP. A tile that still failed is asked for again with `map.refreshTiles` 30 seconds later and when the connection comes back, so holes close themselves (MapLibre does not retry a failed raster tile on its own: maplibre-gl-js issue #8612). The sharp NAIP pictures are asked for only once the map stops moving.

## Port status

1. **Cells and basemaps** (done): cells at all three sizes, hover and pinned labels, clicking a cell to select it, the selection outline, the HUC10 watershed cells with corridor outlines, state lines, all basemaps with the tile queue, your location, offline imagery.
2. **Trail and facility layers** (done): the A.T. centerline (the grid file's line, replaced by the official centerline, and the detailed line by tiles from zoom 12), shelters, campsites, parking, privies, bridges, vistas, side trails, administrative areas, maintained landscapes, National Register and cemetery points, their name labels and popups, and the 500-foot trail segments.
3. **Everything else** (done): box selection and picking cells, guided tours with their site stars and labels, phenology dots week by week, the search markers (the place found, a tract's outline). Leaflet is gone from the code.
