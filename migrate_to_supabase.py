"""
migrate_to_supabase.py
----------------------
Imports Results_cleaned.xlsx into Supabase using bulk inserts.
Writes skipped_rows.xlsx with full data of every skipped row.

Usage:
    python migrate_to_supabase.py --file Results_cleaned.xlsx \
        --url https://xxx.supabase.co --key <service_role_key>

Flags:
    --dry-run       Parse & print first 5 rows, no DB writes
    --start-row     Resume from this Excel row number (default 0)
    --batch         Batch size for bulk inserts (default 100)
"""

import argparse
import re
import time
from datetime import datetime

import pandas as pd
from supabase import create_client

C_REGD_NO     = 0
C_PETITIONER  = 1
C_RESPONDENT  = 2
C_ADVOCATE    = 3
C_DATE        = 4
C_COPIES      = 5
C_DISTRICT    = 6
C_RESP_NO     = 7
C_TYPE_SHORT  = 8
C_REMARK      = 9
C_ADV_ADDRESS = 10
C_ADV_MOBILE  = 11
C_LONG_TYPE   = 12

HEADERS = ["REGD.NO","Petitioner","RESPONDENT","ADVOCATE","DATE","CP",
           "District","RESPONDENT.NO","Type","Remark","AdvAddress","AdvMoNo","LongType"]


def clean(val):
    if val is None:
        return None
    if isinstance(val, float):
        import math
        if math.isnan(val):
            return None
    s = str(val).strip()
    return s if s else None


def parse_date(val):
    if val is None:
        return None
    try:
        ts = pd.to_datetime(val)
        if pd.isnull(ts):
            return None
        return ts.strftime("%Y-%m-%d")
    except Exception:
        return None


def parse_copies(val):
    s = clean(val)
    if not s:
        return 1
    digits = re.sub(r"[^0-9]", "", s)
    if not digits:
        return 1
    v = int(digits)
    # cap at 100 — larger values are phone numbers / respondent lists in wrong column
    if v > 100:
        return 1
    return max(1, v)


def parse_resp_nos(val):
    s = clean(val)
    if not s:
        return [1]
    parts = re.split(r"[,;]", s)
    result = []
    for p in parts:
        p = re.sub(r"[^0-9]", "", p.strip())
        if p:
            try:
                n = int(p)
                if 1 <= n <= 32767:  # smallint range
                    result.append(n)
            except ValueError:
                pass
    return result if result else [1]


def normalise_type(val):
    s = clean(val)
    return s.upper().strip() if s else None


def fetch_all(sb, table, columns):
    result = []
    fetched = 0
    while True:
        res = sb.table(table).select(columns).range(fetched, fetched + 999).execute()
        if not res.data:
            break
        result.extend(res.data)
        fetched += len(res.data)
        if len(res.data) < 1000:
            break
    return result


def bulk_insert(sb, table, rows, retries=3, delay=5):
    for attempt in range(retries):
        try:
            return sb.table(table).insert(rows).execute()
        except Exception as e:
            err = str(e)
            is_conn = any(x in err for x in ["ConnectionTerminated", "timeout", "connect", "reset", "EOF"])
            if attempt < retries - 1 and is_conn:
                print(f"    ~ connection error, retrying in {delay}s... ({attempt+1}/{retries})")
                time.sleep(delay)
            else:
                raise


def migrate(excel_path, supabase_url, supabase_key, sheet=0, dry_run=False, start_row=0, batch_size=100):

    print(f"Reading: {excel_path}")
    df = pd.read_excel(excel_path, sheet_name=sheet, header=None, dtype=str)
    print(f"  {len(df):,} rows x {len(df.columns)} columns loaded")

    if dry_run:
        print("\n[DRY RUN] First 5 rows:")
        for i, row in df.head(5).iterrows():
            print(f"\n  Row {i}:")
            for j, label in enumerate(HEADERS):
                print(f"    {label:14s}: {clean(row[j])}")
        return

    sb = create_client(supabase_url, supabase_key)

    # log of skipped rows: (excel_row, reason, original_row_data)
    skipped_log = []

    def log_skip(idx, reason, row):
        skipped_log.append({
            "excel_row": idx,
            "skip_reason": reason,
            **{HEADERS[j]: clean(row[j]) for j in range(len(HEADERS))}
        })

    # ── 1. Districts ──────────────────────────────────────────────────────────
    print("\n[1/4] Upserting districts...")
    BULK = 500
    district_names = sorted(set(clean(v) for v in df[C_DISTRICT].tolist() if clean(v)))
    for i in range(0, len(district_names), BULK):
        chunk = [{"name": n} for n in district_names[i:i+BULK]]
        sb.table("districts").upsert(chunk, on_conflict="name").execute()
    district_id_map = {r["name"]: r["id"] for r in fetch_all(sb, "districts", "id,name")}
    print(f"  -> {len(district_id_map)} districts")

    # ── 2. Case types ─────────────────────────────────────────────────────────
    print("[2/4] Upserting case_types...")
    type_map = {}
    for _, row in df[[C_TYPE_SHORT, C_LONG_TYPE]].drop_duplicates().iterrows():
        short = clean(row[C_TYPE_SHORT])
        long  = clean(row[C_LONG_TYPE])
        if not short:
            continue
        key = short.upper().strip()
        short_code = key[:20]
        existing_long = type_map.get(key, (short_code, None))[1]
        best_long = long if (long and (not existing_long or len(long) > len(existing_long))) else existing_long
        type_map[key] = (short_code, best_long or short_code)

    type_rows = [{"short_code": sc, "long_name": ln} for sc, ln in type_map.values()]
    for i in range(0, len(type_rows), BULK):
        sb.table("case_types").upsert(type_rows[i:i+BULK], on_conflict="short_code").execute()
    case_type_id_map = {r["short_code"].upper().strip(): r["id"] for r in fetch_all(sb, "case_types", "id,short_code")}
    print(f"  -> {len(case_type_id_map)} case types")

    # ── 3. Advocates ──────────────────────────────────────────────────────────
    print("[3/4] Upserting advocates...")
    adv_info = {}
    for _, row in df[[C_ADVOCATE, C_ADV_ADDRESS, C_ADV_MOBILE]].iterrows():
        name = clean(row[C_ADVOCATE])
        if not name:
            continue
        if name not in adv_info:
            adv_info[name] = {"address": None, "mobile": None}
        addr = clean(row[C_ADV_ADDRESS])
        mob  = clean(row[C_ADV_MOBILE])
        if addr:
            adv_info[name]["address"] = addr
        if mob and not adv_info[name]["mobile"]:
            adv_info[name]["mobile"] = mob

    adv_rows = [{"full_name": n, "address": i["address"], "mobile_no": i["mobile"]} for n, i in adv_info.items()]
    for i in range(0, len(adv_rows), BULK):
        sb.table("advocates").upsert(adv_rows[i:i+BULK], on_conflict="full_name").execute()
        print(f"  ... {min(i+BULK, len(adv_rows))}/{len(adv_rows)} advocates upserted")
    advocate_id_map = {r["full_name"]: r["id"] for r in fetch_all(sb, "advocates", "id,full_name")}
    print(f"  -> {len(advocate_id_map)} advocates")

    # ── 4. Cases ──────────────────────────────────────────────────────────────
    print(f"[4/4] Inserting cases in batches of {batch_size}...")
    if start_row > 0:
        print(f"      Resuming from row {start_row}")

    inserted = 0
    case_batch = []
    case_meta  = []

    def flush_batch():
        nonlocal inserted
        if not case_batch:
            return
        try:
            res = bulk_insert(sb, "cases", case_batch)
            inserted_cases = res.data
        except Exception as e:
            err_msg = str(e)
            print(f"  x batch insert failed: {e}")
            print(f"    --> rerun with --start-row {case_meta[0][0]} to retry this batch")
            # log every row in the failed batch
            for (idx, regd_no, resp_name, resp_nos, remark), payload in zip(case_meta, case_batch):
                skipped_log.append({
                    "excel_row":   idx,
                    "skip_reason": f"batch_insert_error: {err_msg[:100]}",
                    **{HEADERS[j]: None for j in range(len(HEADERS))}
                })
            case_batch.clear()
            case_meta.clear()
            return

        resp_batch   = []
        remark_batch = []
        for case_row, (idx, regd_no, resp_name, resp_nos, remark) in zip(inserted_cases, case_meta):
            case_id = case_row["id"]
            if resp_name:
                for rn in resp_nos:
                    resp_batch.append({
                        "case_id":       case_id,
                        "resp_no":       rn,
                        "resp_name_raw": resp_name,
                    })
            if remark:
                remark_batch.append({"case_id": case_id, "note": remark})

        if resp_batch:
            try:
                bulk_insert(sb, "case_respondents", resp_batch)
            except Exception as e:
                print(f"    ! respondent batch error: {e}")

        if remark_batch:
            try:
                bulk_insert(sb, "case_remarks", remark_batch)
            except Exception as e:
                print(f"    ! remark batch error: {e}")

        inserted += len(inserted_cases)
        if inserted % 2000 == 0:
            print(f"  ... {inserted:,} inserted (last Excel row: {case_meta[-1][0]})")

        case_batch.clear()
        case_meta.clear()

    for idx, row in df.iterrows():
        if idx < start_row:
            continue

        # regd_no
        regd_raw = clean(row[C_REGD_NO])
        try:
            regd_no = int(float(regd_raw))
        except (TypeError, ValueError):
            log_skip(idx, "bad_regd_no", row)
            continue

        # date
        dated = parse_date(row[C_DATE])
        if not dated:
            log_skip(idx, "missing_date", row)
            continue
        cyear = int(dated[:4])
        if cyear < 1990 or cyear > 2099:
            cyear = 1990

        # case type
        type_key = normalise_type(row[C_TYPE_SHORT])
        if not type_key or type_key not in case_type_id_map:
            log_skip(idx, f"unknown_type: {type_key}", row)
            continue
        case_type_id = case_type_id_map[type_key]

        # district
        district    = clean(row[C_DISTRICT])
        district_id = district_id_map.get(district) if district else None
        if not district_id:
            log_skip(idx, f"unknown_district: {district}", row)
            continue

        adv_name    = clean(row[C_ADVOCATE])
        advocate_id = advocate_id_map.get(adv_name) if adv_name else None
        petitioner  = clean(row[C_PETITIONER]) or "UNKNOWN"
        copies      = parse_copies(row[C_COPIES])

        case_batch.append({
            "regd_no":      regd_no,
            "cyear":        cyear,
            "petitioner":   petitioner,
            "case_type_id": case_type_id,
            "district_id":  district_id,
            "dated":        dated,
            "copies":       copies,
            "advocate_id":  advocate_id,
            "adv_name_raw": adv_name,
        })
        case_meta.append((
            idx,
            regd_no,
            clean(row[C_RESPONDENT]),
            parse_resp_nos(row[C_RESP_NO]),
            clean(row[C_REMARK]),
        ))

        if len(case_batch) >= batch_size:
            flush_batch()

    flush_batch()

    # ── Write skipped log ─────────────────────────────────────────────────────
    skipped = len(skipped_log)
    if skipped_log:
        log_path = excel_path.replace(".xlsx", "_skipped.xlsx").replace(".XLSX", "_skipped.xlsx")
        pd.DataFrame(skipped_log).to_excel(log_path, index=False)
        print(f"\n  Skipped log saved to: {log_path}")
        print(f"  Open this file to see exactly which rows were skipped and why.")
    else:
        print("\n  No rows skipped!")

    print(f"\nDone -- inserted: {inserted:,}  skipped: {skipped:,}")
    if skipped == 0:
        print("  All rows inserted successfully!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate Results_cleaned.xlsx -> Supabase (bulk)")
    parser.add_argument("--file",       required=True,        help="Path to cleaned Excel file")
    parser.add_argument("--url",        required=True,        help="Supabase project URL")
    parser.add_argument("--key",        required=True,        help="Supabase service_role key")
    parser.add_argument("--sheet",      default=0,            help="Sheet index or name (default 0)")
    parser.add_argument("--dry-run",    action="store_true",  help="Parse only, no DB writes")
    parser.add_argument("--start-row",  default=0, type=int,  help="Resume from this Excel row (default 0)")
    parser.add_argument("--batch",      default=100, type=int,help="Batch size (default 100)")
    args = parser.parse_args()

    migrate(
        excel_path   = args.file,
        supabase_url = args.url,
        supabase_key = args.key,
        sheet        = args.sheet,
        dry_run      = args.dry_run,
        start_row    = args.start_row,
        batch_size   = args.batch,
    )