#!/usr/bin/env python3
"""
BiciMAD 2022 — Q1 Temporal Patterns preprocessing.

Reads all 12 trip CSVs and builds a compact station x date x hour cube:
    public/data/q1_cube.bin        uint16 little-endian counts, [S][D][24]
    public/data/q1_cube_meta.json  station ids, date list, shape, max cell

All four Q1 views (Year / Month / Week / Day) and any station filter are
derived client-side from this single cube.

Handles two CSV schemas (with/without idTrip) by column name and excludes
the August 18-22 trip recording gap from the date axis.

Usage:
    .venv/bin/python scripts/q1_temporal.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from tqdm import tqdm

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "bicimad_2022"
OUT_DIR = ROOT / "public" / "data"

# August 18-22 gap: exclude these dates from ALL aggregations
AUG_GAP_DATES = {f"2022-08-{d:02d}" for d in range(18, 23)}

CSV_FILES = [
    "trips_22_01_January.csv",
    "trips_22_02_February.csv",
    "trips_22_03_March.csv",
    "trips_22_04_April.csv",
    "trips_22_05_May.csv",
    "trips_22_06_June.csv",
    "trips_22_07_July.csv",
    "trips_22_08_August.csv",
    "trips_22_09_September.csv",
    "trips_22_10_October.csv",
    "trips_22_11_November.csv",
    "trips_22_12_December.csv",
]

COLS_19 = [
    "fecha", "idTrip", "idBike", "fleet", "trip_minutes",
    "geolocation_unlock", "address_unlock", "unlock_date",
    "locktype", "unlocktype", "geolocation_lock", "address_lock",
    "lock_date", "station_unlock", "dock_unlock",
    "unlock_station_name", "station_lock", "dock_lock",
    "lock_station_name",
]
COLS_18 = [c for c in COLS_19 if c != "idTrip"]


def read_trip_csv(filename):
    """Read a single trip CSV, handling both schemas by column name."""
    filepath = DATA_DIR / filename
    df = pd.read_csv(
        filepath,
        sep=";",
        encoding="utf-8",
        dtype=str,
        usecols=lambda c: c.strip() in ("fecha", "unlock_date", "station_unlock"),
        on_bad_lines="skip",
    )
    # Normalize column names
    df.columns = [c.strip() for c in df.columns]
    missing = {"fecha", "unlock_date", "station_unlock"} - set(df.columns)
    if missing:
        raise ValueError(f"{filename}: missing columns {missing}")
    # Drop filler rows
    df = df[df["fecha"].notna() & (df["fecha"].str.strip() != "")].copy()
    return df


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading all trip CSVs...")
    frames = []
    for filename in tqdm(CSV_FILES, desc="Reading CSVs"):
        df = read_trip_csv(filename)
        frames.append(df)
        print(f"  {filename}: {len(df):,} rows")

    trips = pd.concat(frames, ignore_index=True)
    print(f"Total rows loaded: {len(trips):,}")

    trips["unlock_dt"] = pd.to_datetime(trips["unlock_date"], errors="coerce")
    trips = trips[trips["unlock_dt"].notna()].copy()

    trips["date_str"] = trips["unlock_dt"].dt.strftime("%Y-%m-%d")
    trips["hour"] = trips["unlock_dt"].dt.hour.astype(np.int16)
    total = len(trips)
    trips = trips[~trips["date_str"].isin(AUG_GAP_DATES)]
    print(f"Excluded {total - len(trips):,} trips in Aug 18-22 gap")

    trips["station_unlock"] = pd.to_numeric(
        trips["station_unlock"], errors="coerce"
    )
    n_known = trips["station_unlock"].notna().sum()
    print(f"Trips with valid station: {n_known:,} "
          f"(unknown-station trips go to sentinel row)")

    # Date axis: every 2022 day except the Aug 18-22 gap
    all_dates = pd.date_range("2022-01-01", "2022-12-31", freq="D")
    dates = [d.strftime("%Y-%m-%d") for d in all_dates
             if d.strftime("%Y-%m-%d") not in AUG_GAP_DATES]
    date_idx = {d: i for i, d in enumerate(dates)}

    # Station axis: sorted ids present in the data + sentinel (-1) for unknown
    known_ids = sorted(
        trips.loc[trips["station_unlock"].notna(), "station_unlock"]
        .astype(int).unique().tolist()
    )
    station_ids = known_ids + [-1]
    station_idx = {s: i for i, s in enumerate(station_ids)}
    print(f"Axis: {len(station_ids)} rows x {len(dates)} days x 24 hours")

    # Drop any trip whose date is outside the 2022 axis (should be none)
    trips = trips[trips["date_str"].isin(date_idx)].copy()
    trips["station_unlock"] = trips["station_unlock"].fillna(-1).astype(int)

    si = trips["station_unlock"].map(station_idx).to_numpy(dtype=np.int64)
    di = trips["date_str"].map(date_idx).to_numpy(dtype=np.int64)
    hi = trips["hour"].to_numpy(dtype=np.int64)

    cube = np.zeros((len(station_ids), len(dates), 24), dtype=np.uint32)
    np.add.at(cube, (si, di, hi), 1)

    max_cell = int(cube.max())
    cube_total = int(cube.sum())
    print(f"Trips placed in cube: {cube_total:,} (max cell {max_cell})")
    assert cube_total == len(trips), "cube total mismatch"
    assert max_cell < 65536, "uint16 overflow"

    cube.astype("<u2").tofile(OUT_DIR / "q1_cube.bin")

    meta = {
        "dtype": "u2le",
        "shape": [len(station_ids), len(dates), 24],
        "stationIds": station_ids,
        "dates": dates,
        "gapDates": sorted(AUG_GAP_DATES),
        "maxCell": max_cell,
        "totalTrips": cube_total,
    }
    with open(OUT_DIR / "q1_cube_meta.json", "w") as f:
        json.dump(meta, f)

    size_mb = (OUT_DIR / "q1_cube.bin").stat().st_size / 1e6
    print(f"  -> q1_cube.bin ({size_mb:.1f} MB) + q1_cube_meta.json")
    print(f"  date range: {dates[0]} .. {dates[-1]}")
    print("Q1 preprocessing complete.")


if __name__ == "__main__":
    main()
