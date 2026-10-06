#!/usr/bin/env python3
"""
BiciMAD 2022 — Q3 Flow Network Structure preprocessing.

Builds origin-destination matrix, applies Louvain community detection,
computes net flow, and reorders matrix by community assignment.

Usage:
    python scripts/q3_flows.py
"""

import json
from pathlib import Path

import community as community_louvain  # python-louvain
import numpy as np
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
        stations_list = json.load(f)

    station_ids = sorted(s["id"] for s in stations_list)
    id_to_idx = {sid: i for i, sid in enumerate(station_ids)}
    n = len(station_ids)
    print(f"Building OD matrix for {n} stations...")

    # Initialize OD matrix
    od_matrix = np.zeros((n, n), dtype=np.int32)

    for filename, has_idtrip in tqdm(CSV_FILES, desc="Processing CSVs"):
        df = read_trip_csv(filename, has_idtrip)

        # Filter Aug gap
        df["unlock_dt"] = pd.to_datetime(df["unlock_date"], errors="coerce")
        gap_mask = (df["unlock_dt"] >= AUG_GAP_START) & (df["unlock_dt"] <= AUG_GAP_END)
        df = df[~gap_mask]

        # Parse station IDs
        origins = pd.to_numeric(df["station_unlock"], errors="coerce").dropna().astype(int)
        dests = pd.to_numeric(df["station_lock"], errors="coerce").dropna().astype(int)

        # Only count valid station pairs
        valid = origins.isin(id_to_idx) & dests.isin(id_to_idx)
        origins = origins[valid].values
        dests = dests[valid].values

        # Vectorized increment
        o_idx = np.array([id_to_idx[o] for o in origins])
        d_idx = np.array([id_to_idx[d] for d in dests])
        np.add.at(od_matrix, (o_idx, d_idx), 1)

    total_flows = od_matrix.sum()
    print(f"  Total flows recorded: {total_flows:,}")

    # --- Community Detection (Louvain) ---
    print("Running Louvain community detection...")
    # Symmetrize for undirected community detection
    sym_matrix = od_matrix + od_matrix.T

    # Build networkx-like graph dict for python-louvain
    # python-louvain expects a networkx Graph
    import networkx as nx

    G = nx.Graph()
    for i in range(n):
        G.add_node(i)
    for i in range(n):
        for j in range(i + 1, n):
            weight = int(sym_matrix[i, j])
            if weight > 0:
                G.add_edge(i, j, weight=weight)

    partition = community_louvain.best_partition(G, random_state=42)
    n_communities = len(set(partition.values()))
    print(f"  Found {n_communities} communities")

    # Group stations by community
    communities = {}
    for idx, comm in partition.items():
        communities.setdefault(comm, []).append(idx)

    # Reorder: sort by community, then by within-community degree (descending)
    degree = dict(G.degree(weight="weight"))
    ordered_indices = []
    community_labels_ordered = []
    for comm in sorted(communities.keys()):
        members = sorted(communities[comm], key=lambda x: degree.get(x, 0), reverse=True)
        ordered_indices.extend(members)
        community_labels_ordered.extend([comm] * len(members))

    # Create reorder mapping
    old_to_new = {old: new for new, old in enumerate(ordered_indices)}

    # Reorder OD matrix
    reordered_od = np.zeros_like(od_matrix)
    reordered_net = np.zeros((n, n), dtype=np.float32)
    for i_old in range(n):
        for j_old in range(n):
            i_new = old_to_new[i_old]
            j_new = old_to_new[j_old]
            reordered_od[i_new, j_new] = od_matrix[i_old, j_old]
            reordered_net[i_new, j_new] = float(od_matrix[i_old, j_old] - od_matrix[j_old, i_old])

    # Build station info in reordered order
    stations_reordered = []
    for idx in ordered_indices:
        sid = station_ids[idx]
        s = next(s for s in stations_list if s["id"] == sid)
        stations_reordered.append({
            "id": sid,
            "name": s["name"],
            "number": s["number"],
            "lat": s["lat"],
            "lon": s["lon"],
            "community": partition[idx],
        })

    # Community boundaries (indices where community changes)
    boundaries = []
    for i in range(1, n):
        if community_labels_ordered[i] != community_labels_ordered[i - 1]:
            boundaries.append(i)

    # Convert matrices to lists for JSON (sparse representation for large matrix)
    # Use dense list-of-lists since we need full matrix for rendering
    print("Serializing OD matrix to JSON...")
    output = {
        "stations": stations_reordered,
        "nStations": n,
        "nCommunities": n_communities,
        "communityBoundaries": boundaries,
        "matrix": reordered_od.tolist(),
        "netFlow": reordered_net.tolist(),
    }

    out_path = OUT_DIR / "q3_od_matrix.json"
    with open(out_path, "w") as f:
        json.dump(output, f)

    file_size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"  → {out_path.name}: {file_size_mb:.1f} MB")
    print(f"  Communities: {dict(sorted(((k, len(v)) for k, v in communities.items())))}")
    print("Q3 preprocessing complete.")


if __name__ == "__main__":
    main()
