"""
OBD2 Analytics Pack Builder
Builds compact Parquet + JSON packs from MongoDB session data for Code Interpreter analysis
"""
import os
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional
import polars as pl
from pymongo import MongoClient
import json

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "obd")
COLL_SAMPLES = os.getenv("COLL_SAMPLES", "obd2datapoints")
COLL_SESSIONS = os.getenv("COLL_SESSIONS", "diagnosticsessions")
OUT_DIR = Path(os.getenv("OUT_DIR", "./packs"))

def fetch_session_samples(session_id: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """Fetch all data points for a session from MongoDB"""
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    coll = db[COLL_SAMPLES]
    
    # Convert session_id to ObjectId if it's a string
    from bson import ObjectId
    try:
        session_oid = ObjectId(session_id)
    except:
        session_oid = session_id
    
    query = {"sessionId": session_oid}
    cursor = coll.find(query, projection={"_id": 0, "sessionId": 0}).sort("timestamp", 1)
    if limit:
        cursor = cursor.limit(limit)
    
    records = list(cursor)
    client.close()
    return records

def fetch_session_metadata(session_id: str) -> Dict[str, Any]:
    """Fetch session metadata"""
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    coll = db[COLL_SESSIONS]
    
    from bson import ObjectId
    try:
        session_oid = ObjectId(session_id)
    except:
        session_oid = session_id
    
    session = coll.find_one({"_id": session_oid}, projection={"_id": 0})
    client.close()
    return session or {}

def to_long_form(records: List[Dict[str, Any]]) -> pl.DataFrame:
    """Convert wide-form records to long-form (ts, pid, value)"""
    if not records:
        return pl.DataFrame({"ts": [], "pid": [], "value": []})
    
    # Check if already long-form
    sample = records[0]
    if all(k in sample for k in ("ts", "pid", "value")):
        return pl.DataFrame(records).with_columns([
            pl.col("ts").cast(pl.Int64),
            pl.col("pid").cast(pl.Utf8),
            pl.col("value").cast(pl.Float64)
        ])
    
    # Convert wide-form to long-form
    # Expected: {timestamp: Date, rpm: 812, speed: 45, ...}
    long_rows = []
    for record in records:
        ts = int(record.get("timestamp", {}).get("$date", 0)) if isinstance(record.get("timestamp"), dict) else int(record.get("timestamp", 0))
        if not ts:
            continue
        
        for key, value in record.items():
            if key in ("timestamp", "sessionId", "_id"):
                continue
            if value is None:
                continue
            try:
                float_val = float(value)
                long_rows.append({
                    "ts": ts,
                    "pid": key,
                    "value": float_val
                })
            except (ValueError, TypeError):
                continue
    
    if not long_rows:
        return pl.DataFrame({"ts": [], "pid": [], "value": []})
    
    return pl.DataFrame(long_rows).with_columns([
        pl.col("ts").cast(pl.Int64),
        pl.col("pid").cast(pl.Utf8),
        pl.col("value").cast(pl.Float64)
    ])

def build_pack(session_id: str) -> Dict[str, Any]:
    """Build analytics pack for a session"""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pack_dir = OUT_DIR / session_id
    pack_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"📦 Building pack for session {session_id}...")
    
    # Fetch data
    raw = fetch_session_samples(session_id)
    if not raw:
        raise RuntimeError(f"No data found for session {session_id}")
    
    print(f"📊 Fetched {len(raw)} data points")
    
    # Convert to long-form
    df_long = to_long_form(raw)
    if df_long.height == 0:
        raise RuntimeError(f"No valid data points after conversion for session {session_id}")
    
    print(f"📈 Converted to {df_long.height} long-form rows")
    
    # Pivot to wide (one column per PID)
    wide = df_long.pivot(
        index="ts",
        columns="pid",
        values="value",
        aggregate_function="mean"
    ).sort("ts")
    
    print(f"🔄 Pivoted to wide format: {wide.width} columns, {wide.height} rows")
    
    # Downsample to 1 Hz (assuming ts in milliseconds)
    if wide.height > 0:
        wide = (
            wide
            .with_columns((pl.col("ts") // 1000).alias("sec"))
            .group_by("sec").mean()
            .with_columns((pl.col("sec") * 1000).alias("ts"))
            .drop("sec")
            .sort("ts")
        )
        print(f"⏱️  Downsampled to 1Hz: {wide.height} rows")
    
    # Calculate KPIs
    cols = set(wide.columns)
    kpis: Dict[str, Any] = {
        "rows": int(wide.height),
        "start": int(wide["ts"].min()) if wide.height > 0 else 0,
        "end": int(wide["ts"].max()) if wide.height > 0 else 0,
        "signals": [c for c in wide.columns if c != "ts"],
        "duration_seconds": (int(wide["ts"].max()) - int(wide["ts"].min())) // 1000 if wide.height > 0 else 0
    }
    
    # RPM analysis
    if "rpm" in cols:
        rpm_col = wide["rpm"]
        kpis["rpm_mean"] = float(rpm_col.mean()) if rpm_col.len() > 0 else None
        kpis["rpm_max"] = float(rpm_col.max()) if rpm_col.len() > 0 else None
        kpis["rpm_min"] = float(rpm_col.min()) if rpm_col.len() > 0 else None
        idle_mask = (rpm_col < 900)
        if idle_mask.any():
            kpis["idleRPMStd"] = float(rpm_col.filter(idle_mask).std())
            kpis["idleRPMMean"] = float(rpm_col.filter(idle_mask).mean())
    
    # Engine temperature analysis
    if "engineTemp" in cols:
        temp_col = wide["engineTemp"]
        kpis["coolantRiseC"] = float(temp_col.max() - temp_col.min()) if temp_col.len() > 0 else None
        kpis["coolantMax"] = float(temp_col.max()) if temp_col.len() > 0 else None
        kpis["coolantMin"] = float(temp_col.min()) if temp_col.len() > 0 else None
    
    # Speed analysis
    if "speed" in cols:
        speed_col = wide["speed"]
        kpis["speed_mean"] = float(speed_col.mean()) if speed_col.len() > 0 else None
        kpis["speed_max"] = float(speed_col.max()) if speed_col.len() > 0 else None
    
    # Fuel trim analysis
    if "shortTermFuelTrim" in cols or "longTermFuelTrim" in cols:
        stft = wide.get_column("shortTermFuelTrim") if "shortTermFuelTrim" in cols else None
        ltft = wide.get_column("longTermFuelTrim") if "longTermFuelTrim" in cols else None
        if stft is not None:
            kpis["stft_mean"] = float(stft.mean()) if stft.len() > 0 else None
            kpis["stft_max"] = float(stft.max()) if stft.len() > 0 else None
        if ltft is not None:
            kpis["ltft_mean"] = float(ltft.mean()) if ltft.len() > 0 else None
            kpis["ltft_max"] = float(ltft.max()) if ltft.len() > 0 else None
    
    # Fetch session metadata
    session_meta = fetch_session_metadata(session_id)
    if session_meta:
        kpis["sessionName"] = session_meta.get("sessionName", "")
        kpis["dtcCodes"] = session_meta.get("dtcCodes", [])
        kpis["vehicleId"] = session_meta.get("vehicleId", "")
    
    # Write Parquet file
    parquet_path = pack_dir / "timeseries.parquet"
    if parquet_path.exists():
        parquet_path.unlink()
    wide.write_parquet(str(parquet_path))
    print(f"💾 Wrote {parquet_path}")
    
    # Write summary JSON
    summary_path = pack_dir / "summary.json"
    with open(summary_path, "w") as f:
        json.dump(kpis, f, indent=2)
    print(f"💾 Wrote {summary_path}")
    
    return {
        "sessionId": session_id,
        "packPath": str(pack_dir.resolve()),
        "summary": kpis,
        "parquetSize": parquet_path.stat().st_size,
        "signals": kpis["signals"]
    }

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Build analytics pack for OBD2 session")
    parser.add_argument("session_id", help="Session ID to build pack for")
    args = parser.parse_args()
    
    try:
        info = build_pack(args.session_id)
        print("\n✅ Pack built successfully!")
        print(json.dumps(info, indent=2))
    except Exception as e:
        print(f"\n❌ Error building pack: {e}", file=sys.stderr)
        sys.exit(1)

	
