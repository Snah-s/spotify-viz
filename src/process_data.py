from __future__ import annotations

import argparse
import ast
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUT_DIR = ROOT / "processed"

FEATURES = [
    "danceability",
    "energy",
    "valence",
    "acousticness",
    "instrumentalness",
    "liveness",
    "speechiness",
    "tempo",
    "loudness",
    "popularity",
]

RADIAL_FEATURES = [
    "danceability",
    "energy",
    "valence",
    "acousticness",
    "instrumentalness",
    "speechiness",
]


def parse_list(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(v) for v in value if str(v).strip()]
    if pd.isna(value):
        return []
    text = str(value).strip()
    if not text or text == "[]":
        return []
    try:
        parsed = ast.literal_eval(text)
        if isinstance(parsed, list):
            return [str(v).strip() for v in parsed if str(v).strip()]
    except (SyntaxError, ValueError):
        pass
    return [part.strip().strip("'\"") for part in text.strip("[]").split(",") if part.strip()]


def minmax(series: pd.Series) -> pd.Series:
    lo = series.min()
    hi = series.max()
    if pd.isna(lo) or pd.isna(hi) or hi == lo:
        return pd.Series(np.full(len(series), 0.5), index=series.index)
    return (series - lo) / (hi - lo)


def add_normalized(df: pd.DataFrame, features: list[str]) -> pd.DataFrame:
    out = df.copy()
    for feature in features:
        out[f"n_{feature}"] = minmax(out[feature])
    return out


def add_pca(df: pd.DataFrame, features: list[str], prefix: str = "pca") -> tuple[pd.DataFrame, dict[str, float]]:
    out = df.copy()
    matrix = out[features].astype(float).to_numpy()
    scaled = StandardScaler().fit_transform(matrix)
    pca = PCA(n_components=2, random_state=42)
    coords = pca.fit_transform(scaled)
    out[f"{prefix}1"] = coords[:, 0]
    out[f"{prefix}2"] = coords[:, 1]
    variance = {
        f"{prefix}1": float(pca.explained_variance_ratio_[0]),
        f"{prefix}2": float(pca.explained_variance_ratio_[1]),
    }
    return out, variance


def compact_records(df: pd.DataFrame, columns: list[str]) -> list[dict[str, object]]:
    records = df[columns].replace({np.nan: None}).to_dict(orient="records")
    for record in records:
        for key, value in list(record.items()):
            if isinstance(value, np.integer):
                record[key] = int(value)
            elif isinstance(value, np.floating):
                record[key] = round(float(value), 6)
    return records


def build_artist_genre_map(artists_with_genres: pd.DataFrame) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for row in artists_with_genres[["artists", "genres"]].itertuples(index=False):
        genres = parse_list(row.genres)
        if genres:
            mapping[str(row.artists)] = genres[0]
    return mapping


def process_tracks(
    limit: int,
    artist_genres: dict[str, str],
    random_state: int | None = 42,
    popularity_floor: int = 20,
    include_popular_seed: bool = True,
) -> tuple[list[dict[str, object]], dict[str, float]]:
    tracks = pd.read_csv(DATA_DIR / "data.csv")
    tracks["artists_list"] = tracks["artists"].map(parse_list)
    tracks["artist"] = tracks["artists_list"].map(lambda values: values[0] if values else "Unknown artist")
    tracks["primary_genre"] = tracks["artist"].map(artist_genres).fillna("Unknown genre")
    tracks["duration_min"] = tracks["duration_ms"] / 60000
    tracks["explicit"] = tracks["explicit"].astype(bool)

    numeric_cols = FEATURES + ["year", "duration_min", "key", "mode"]
    for col in numeric_cols:
        tracks[col] = pd.to_numeric(tracks[col], errors="coerce")

    tracks = tracks.dropna(subset=FEATURES + ["year"])

    popular = tracks[tracks["popularity"] >= popularity_floor]
    if include_popular_seed:
        top = popular.sort_values("popularity", ascending=False).head(limit // 2)
        rest = popular.drop(index=top.index, errors="ignore")
        sample_size = max(0, limit - len(top))
        sampled = rest.sample(n=sample_size, random_state=random_state) if len(rest) > sample_size else rest
        tracks = pd.concat([top, sampled], ignore_index=True).drop_duplicates("id")
    else:
        sample_size = min(limit, len(popular))
        tracks = popular.sample(n=sample_size, random_state=random_state).reset_index(drop=True)

    tracks = add_normalized(tracks, FEATURES)
    tracks, variance = add_pca(tracks, FEATURES)

    ncols = [f"n_{feature}" for feature in FEATURES]
    columns = [
        "id",
        "name",
        "artist",
        "primary_genre",
        "year",
        "release_date",
        "explicit",
        "duration_min",
        "pca1",
        "pca2",
    ] + FEATURES + ncols
    return compact_records(tracks, columns), variance


def process_genres() -> tuple[list[dict[str, object]], dict[str, float]]:
    genres = pd.read_csv(DATA_DIR / "data_by_genres.csv")
    genres = genres.rename(columns={"genres": "genre"})
    genres["duration_min"] = genres["duration_ms"] / 60000
    for col in FEATURES + ["duration_min", "key", "mode"]:
        genres[col] = pd.to_numeric(genres[col], errors="coerce")
    genres = genres.dropna(subset=FEATURES)
    genres = add_normalized(genres, FEATURES)
    genres, variance = add_pca(genres, FEATURES)
    genres = genres.sort_values("popularity", ascending=False)

    ncols = [f"n_{feature}" for feature in FEATURES]
    columns = ["genre", "duration_min", "pca1", "pca2"] + FEATURES + ncols
    return compact_records(genres, columns), variance


def process_years() -> list[dict[str, object]]:
    years = pd.read_csv(DATA_DIR / "data_by_year.csv")
    years["duration_min"] = years["duration_ms"] / 60000
    for col in FEATURES + ["year", "duration_min"]:
        years[col] = pd.to_numeric(years[col], errors="coerce")
    years = years.dropna(subset=FEATURES + ["year"]).sort_values("year")
    columns = ["year", "duration_min"] + FEATURES
    return compact_records(years, columns)


def write_json(name: str, payload: object) -> None:
    with (OUT_DIR / name).open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, separators=(",", ":"))


def generate_session_sample(limit: int, random_state: int | None = None) -> dict[str, object]:
    OUT_DIR.mkdir(exist_ok=True)
    limit = max(100, min(int(limit), 15000))
    artists_with_genres = pd.read_csv(DATA_DIR / "data_w_genres.csv")
    artist_genres = build_artist_genre_map(artists_with_genres)
    tracks, track_pca = process_tracks(
        limit,
        artist_genres,
        random_state=random_state,
        popularity_floor=0,
        include_popular_seed=False,
    )
    metadata = {
        "sample_size": len(tracks),
        "track_pca_variance": track_pca,
    }
    write_json("session_tracks.json", tracks)
    write_json("session_metadata.json", metadata)
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare Spotify data for the Flask/D3 app.")
    parser.add_argument("--limit", type=int, default=6000, help="Maximum track records for browser views.")
    args = parser.parse_args()

    OUT_DIR.mkdir(exist_ok=True)
    artists_with_genres = pd.read_csv(DATA_DIR / "data_w_genres.csv")
    artist_genres = build_artist_genre_map(artists_with_genres)

    tracks, track_pca = process_tracks(args.limit, artist_genres)
    genres, genre_pca = process_genres()
    years = process_years()

    metadata = {
        "features": FEATURES,
        "radial_features": RADIAL_FEATURES,
        "track_count": len(tracks),
        "genre_count": len(genres),
        "year_count": len(years),
        "track_pca_variance": track_pca,
        "genre_pca_variance": genre_pca,
        "source_files": [
            "data.csv",
            "data_by_artist.csv",
            "data_by_genres.csv",
            "data_by_year.csv",
            "data_w_genres.csv",
        ],
    }

    outputs = {
        "tracks.json": tracks,
        "genres.json": genres,
        "years.json": years,
        "metadata.json": metadata,
    }
    for name, payload in outputs.items():
        write_json(name, payload)

    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
