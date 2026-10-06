#!/usr/bin/env python3
"""
BiciMAD 2022 — Main preprocessing entry point.

Extracts station metadata from JSON snapshots and generates
the holidays calendar for Spain 2022.

Usage:
    python scripts/preprocess.py

Outputs:
    public/data/stations.json   — 264 station records
    public/data/holidays.json   — Spanish national holidays 2022
"""

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "bicimad_2022"
OUT_DIR = ROOT / "public" / "data"


def extract_stations():
    """Parse first JSON snapshot to extract all 264 station metadata."""
    json_path = DATA_DIR / "202201.json"
    stations = []

    with open(json_path, "r", encoding="utf-8") as f:
        first_line = f.readline()
        snapshot = json.loads(first_line)

    for s in snapshot["stations"]:
        stations.append({
            "id": int(s["id"]),
            "number": str(s["number"]),
            "name": str(s["name"]),
            "lat": float(s["latitude"]),
            "lon": float(s["longitude"]),
            "total_bases": int(s["total_bases"]),
        })

    # Sort by id for consistent ordering
    stations.sort(key=lambda x: x["id"])
    return stations


def generate_holidays():
    """Spain 2022 national public holidays (fixed list)."""
    holidays = [
        {"date": "2022-01-01", "name": "Año Nuevo"},
        {"date": "2022-01-06", "name": "Reyes Magos"},
        {"date": "2022-04-15", "name": "Viernes Santo"},
        {"date": "2022-05-02", "name": "Día del Trabajador"},
        {"date": "2022-07-25", "name": "Santiago Apóstol"},
        {"date": "2022-08-15", "name": "Asunción de la Virgen"},
        {"date": "2022-10-12", "name": "Fiesta Nacional de España"},
        {"date": "2022-11-01", "name": "Todos los Santos"},
        {"date": "2022-12-06", "name": "Día de la Constitución"},
        {"date": "2022-12-08", "name": "Inmaculada Concepción"},
        {"date": "2022-12-26", "name": "San Esteban (trasladado)"},
    ]
    # Also include Madrid regional holidays
    madrid_holidays = [
        {"date": "2022-03-19", "name": "San José (Madrid)"},
        {"date": "2022-04-14", "name": "Jueves Santo (Madrid)"},
        {"date": "2022-05-02", "name": "Día del Trabajador (Madrid)"},
        {"date": "2022-05-15", "name": "San Isidro (Madrid)"},
        {"date": "2022-11-09", "name": "Almudena (Madrid)"},
    ]
    # Merge and deduplicate by date
    seen = set()
    merged = []
    for h in holidays + madrid_holidays:
        if h["date"] not in seen:
            seen.add(h["date"])
            merged.append(h)
    merged.sort(key=lambda x: x["date"])
    return merged


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Extracting station metadata...")
    stations = extract_stations()
    out_path = OUT_DIR / "stations.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(stations, f, indent=2, ensure_ascii=False)
    print(f"  → {len(stations)} stations written to {out_path}")

    print("Generating holidays calendar...")
    holidays = generate_holidays()
    out_path = OUT_DIR / "holidays.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(holidays, f, indent=2, ensure_ascii=False)
    print(f"  → {len(holidays)} holidays written to {out_path}")

    print("Done.")


if __name__ == "__main__":
    main()
