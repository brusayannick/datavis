# AGENTS.md — BiciMAD 2022 Visualization Project

## Project Overview
Interactive web application visualizing Madrid's BiciMAD bike-share 2022 open data. Three research questions answered through dedicated visualization idioms: temporal heatmap (Q1), spatial map + histogram (Q2), origin-destination matrix with community detection (Q3).

## Architecture
```
Raw Data (bicimad_2022/) → Python Scripts (scripts/) → Static JSON (public/data/) → React App (src/)
```

## File Ownership
| Directory | Purpose | Owner Role |
|-----------|---------|------------|
| `scripts/` | Python preprocessing pipeline | Data Engineer |
| `public/data/` | Pre-processed JSON outputs | Generated (do not edit manually) |
| `src/components/` | React visualization components | Frontend Dev |
| `src/components/ui/` | Glassmorphism UI primitives | Design System |
| `src/hooks/` | Custom React hooks | Frontend Dev |
| `src/utils/` | Utility functions (colors, formatters) | Frontend Dev |
| `bicimad_2022/` | Raw data (READ ONLY) | — |

## Testing Expectations
- Preprocessing: Verify output JSON shapes, record counts, date ranges after each script run
- Frontend: Visual verification in browser; check responsive behavior at 1280/1024/768px
- No formal test suite required (local zip submission)

## Key Constraints
- August 18–22 trip data gap MUST be excluded from all aggregations and annotated in UI
- Two CSV schemas (with/without idTrip) MUST be handled by column name, never position
- Geolocation fields are Python literals, not JSON — use `ast.literal_eval()`
- OD matrix MUST use Canvas rendering (not SVG) due to cell count
- Community detection via Louvain algorithm (python-louvain)
