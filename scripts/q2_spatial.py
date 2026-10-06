#!/usr/bin/env python3
"""
BiciMAD 2022 — Q2 Spatial Distribution preprocessing.

Counts trips per station (departures, arrivals, total) and outputs
station usage data for map + histogram + Lorenz curve.

Usage:
    python scripts/q2_spatial.py
"""

import json
from pathlib import Path

import pandas as pd
from tqdm import tqdm

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "bicimad_2022"
OUT_DIR = ROOT / "public" / "data"

AUG_GAP_START = pd.Timestamp("2022-08-18")
AUG_GAP_END = pd.Timestamp("2022-08-22 23:59:59")

CSV_FILES = [
    ("trips_22_01_January.csv", True),
    ("trips_22_02_February.csv", False),
    ("trips_22_03_March.csv", True),
    ("trips_22_04_April.csv", True),
    ("trips_22_05_May.csv", True),
    ("trips_22_06_June.csv", True),
    ("trips_22_07_July.csv", True),
    ("trips_22_08_August.csv", False),
    ("trips_22_09_September.csv", False),
    ("trips_22_10_October.csv", False),
    ("trips_22_11_November.csv", False),
    ("trips_22_12_December.csv", False),
]


def read_trip_csv(filename, has_idtrip):
    """Read CSV with schema handling and filler row filtering."""
    filepath = DATA_DIR / filename

    if has_idtrip:
        col_names = [
            "fecha", "idTrip", "idBike", "fleet", "trip_minutes",
            "geolocation_unlock", "address_unlock", "unlock_date",
            "locktype", "unlocktype", "geolocation_lock", "address_lock",
            "lock_date", "station_unlock", "dock_unlock",
            "unlock_station_name", "station_lock", "dock_lock",
            "lock_station_name",
        ]
    else:
        col_names = [
            "fecha", "idBike", "fleet", "trip_minutes",
            "geolocation_unlock", "address_unlock", "unlock_date",
            "locktype", "unlocktype", "geolocation_lock", "address_lock",
            "lock_date", "station_unlock", "dock_unlock",
            "unlock_station_name", "station_lock", "dock_lock",
            "lock_station_name",
        ]

    df = pd.read_csv(
        filepath, sep=";", encoding="utf-8", dtype=str,
        header=0, on_bad_lines="skip",
    )
    df.columns = col_names[:len(df.columns)]

    # Filter filler rows
    mask = df["fecha"].notna() & (df["fecha"].str.strip() != "")
    df = df[mask].copy()
    return df


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load station metadata
    stations_path = OUT_DIR / "stations.json"
    if not stations_path.exists():
        raise FileNotFoundError("Run preprocess.py first to generate stations.json")
    with open(stations_path) as f:
        stations = {s["id"]: s for s in json.load(f)}

    print("Loading trip CSVs for spatial aggregation...")
    departures = pd.Series(dtype=int)
    arrivals = pd.Series(dtype=int)

    for filename, has_idtrip in tqdm(CSV_FILES, desc="Processing"):
        df = read_trip_csv(filename, has_idtrip)

        # Filter Aug gap
        df["unlock_dt"] = pd.to_datetime(df["unlock_date"], errors="coerce")
        gap_mask = (df["unlock_dt"] >= AUG_GAP_START) & (df["unlock_dt"] <= AUG_GAP_END)
        df = df[~gap_mask]

        # Count departures (station_unlock)
        su = pd.to_numeric(df["station_unlock"], errors="coerce").dropna().astype(int)
        dep_counts = su.value_counts()
        departures = departures.add(dep_counts, fill_value=0).astype(int)

        # Count arrivals (station_lock)
        sl = pd.to_numeric(df["station_lock"], errors="coerce").dropna().astype(int)
        arr_counts = sl.value_counts()
        arrivals = arrivals.add(arr_counts, fill_value=0).astype(int)

    # Build output
    result = []
    for sid, info in sorted(stations.items()):
        dep = int(departures.get(sid, 0))
        arr = int(arrivals.get(sid, 0))
        result.append({
            "stationId": sid,
            "name": info["name"],
            "number": info["number"],
            "lat": info["lat"],
            "lon": info["lon"],
            "departures": dep,
            "arrivals": arr,
            "total": dep + arr,
        })

    # Sort by total descending (useful for Lorenz curve)
    result.sort(key=lambda x: x["total"], reverse=True)

    out_path = OUT_DIR / "q2_station_usage.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    total_trips = sum(r["total"] for r in result)
    print(f"  → {out_path.name}: {len(result)} stations, {total_trips:,} total trip-ends")
    print(f"  Top 5 hubs: {', '.join(r['name'] for r in result[:5])}")
    print("Q2 preprocessing complete.")


if __name__ == "__main__":
    main()
