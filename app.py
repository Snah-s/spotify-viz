from __future__ import annotations

import atexit
import json
import secrets
from functools import lru_cache
from pathlib import Path

from flask import Flask, jsonify, render_template, request

from src.process_data import generate_session_sample


ROOT = Path(__file__).resolve().parent
PROCESSED_DIR = ROOT / "processed"

app = Flask(__name__)
SESSION_FILES = ["session_tracks.json", "session_metadata.json"]


def cleanup_session_files() -> None:
    for name in SESSION_FILES:
        path = PROCESSED_DIR / name
        if path.exists():
            path.unlink()


atexit.register(cleanup_session_files)


@lru_cache(maxsize=8)
def load_json(name: str):
    path = PROCESSED_DIR / name
    if not path.exists():
        raise FileNotFoundError(
            f"Missing {path}. Run: micromamba run -n vast2020 python src/process_data.py"
        )
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/metadata")
def metadata():
    base = dict(load_json("metadata.json"))
    session_path = PROCESSED_DIR / "session_metadata.json"
    if session_path.exists():
        with session_path.open("r", encoding="utf-8") as file:
            session_metadata = json.load(file)
        base.update(session_metadata)
        base["using_session_sample"] = True
    else:
        base["using_session_sample"] = False
    return jsonify(base)


@app.post("/api/sample")
def sample():
    payload = request.get_json(silent=True) or {}
    requested_size = int(payload.get("size", 3500))
    size = max(100, min(requested_size, 15000))
    seed = secrets.randbits(32)
    session_metadata = generate_session_sample(size, random_state=seed)
    load_json.cache_clear()
    base_metadata = dict(load_json("metadata.json"))
    base_metadata.update(session_metadata)
    base_metadata["using_session_sample"] = True
    base_metadata["random_seed"] = seed
    return jsonify(base_metadata)


@app.get("/api/tracks")
def tracks():
    data_name = "session_tracks.json" if (PROCESSED_DIR / "session_tracks.json").exists() else "tracks.json"
    data = load_json(data_name)
    year_min = request.args.get("year_min", type=float)
    year_max = request.args.get("year_max", type=float)
    min_popularity = request.args.get("min_popularity", default=0, type=float)
    limit = request.args.get("limit", default=15000, type=int)

    filtered = []
    for row in data:
        year = row.get("year")
        popularity = row.get("popularity", 0)
        if year_min is not None and year < year_min:
            continue
        if year_max is not None and year > year_max:
            continue
        if popularity < min_popularity:
            continue
        filtered.append(row)

    filtered.sort(key=lambda row: row.get("popularity", 0), reverse=True)
    return jsonify(filtered[: max(1, min(limit, 15000))])


@app.get("/api/genres")
def genres():
    data = load_json("genres.json")
    limit = request.args.get("limit", default=1200, type=int)
    min_popularity = request.args.get("min_popularity", default=0, type=float)
    filtered = [row for row in data if row.get("popularity", 0) >= min_popularity]
    return jsonify(filtered[: max(1, min(limit, len(filtered)))])


@app.get("/api/years")
def years():
    return jsonify(load_json("years.json"))


if __name__ == "__main__":
    app.run(debug=True)
