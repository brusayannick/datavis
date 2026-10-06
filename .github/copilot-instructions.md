# Copilot Instructions — BiciMAD 2022 Visualization

## Context
This project visualizes Madrid's BiciMAD bike-share 2022 open data (~4.1M trips, 264 stations, 8.7K hourly snapshots). The web app answers three research questions using D3.js and Deck.gl visualizations with a glassmorphism UI.

## Critical Data Caveats
1. **Two CSV schemas**: Jan/Mar/Apr/May/Jun/Jul have 19 columns (with `idTrip`); Feb/Aug/Sep/Oct/Nov/Dec have 18 columns (without). Always select by column NAME, never position.
2. **Filler rows**: Every data row in CSVs is followed by an empty semicolons-only row. Filter these out.
3. **Geolocation**: Python literal format `{'type': 'Point', 'coordinates': [lon, lat]}`. Use `ast.literal_eval()`, NOT `json.loads()`. Longitude comes FIRST.
4. **August 18–22 gap**: Trip recording drops to ~300/day (normally ~9K). Exclude from ALL aggregations. JSON station snapshots are complete for these dates.
5. **Station IDs**: Join key is `station_unlock`/`station_lock` in CSV → `stations[].id` in JSON. NOT the `number` field.
6. **Lat/lon in JSON are strings** — cast to float.

## Tech Stack
React 19 + Vite, D3.js v7, Deck.gl v9, MapLibre GL, lucide-react, vanilla CSS glassmorphism.

## Style Guide
- Glassmorphism: `backdrop-filter: blur(20px)`, semi-transparent white backgrounds, 16px border-radius
- Warm off-white background (#F5F3EF), muted navy accent (#1B2A4A)
- Uppercase tracking for labels, generous whitespace
- Pill-shaped buttons, smooth 200-300ms transitions
