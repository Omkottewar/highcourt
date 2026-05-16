import psycopg2
import csv
import sys
import io
import logging
from pathlib import Path
from datetime import datetime

# ── CONFIG ────────────────────────────────────────────────────────────────────
DB_URL     = "postgresql://postgres:aH5yK3ozYQApdpja@db.gqnwysohazttukfncvig.supabase.co:5432/postgres"
CSV_PATH   = r"C:\Users\omkot\OneDrive\Desktop\Results.csv"
LOG_PATH   = r"C:\Users\omkot\OneDrive\Desktop\import_log.txt"
BATCH_SIZE = 5000
# ─────────────────────────────────────────────────────────────────────────────

# 14 cols, exact same sequence as SELECT query
COLUMNS = [
    "RegdNo",
    "Petitioner",
    "Respondets",
    "Adv",
    "Dated",
    "Copies",
    "District",
    "RespndentNo",
    "Type",
    "Remark",
    "AdvAddress",
    "AdvMoNo",
    "LongType",
    "CYear",
]

CREATE_TABLE = """
DROP TABLE IF EXISTS public."tblRegEntry";
CREATE TABLE public."tblRegEntry" (
    "RegdNo"      BIGINT,
    "Petitioner"  TEXT,
    "Respondets"  TEXT,
    "Adv"         TEXT,
    "Dated"       TEXT,
    "Copies"      TEXT,
    "District"    TEXT,
    "RespndentNo" TEXT,
    "Type"        TEXT,
    "Remark"      TEXT,
    "AdvAddress"  TEXT,
    "AdvMoNo"     TEXT,
    "LongType"    TEXT,
    "CYear"       TEXT
);
"""

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_PATH, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ]
)
log = logging.getLogger(__name__)

def detect_encoding(path):
    with open(path, "rb") as f:
        raw = f.read(3)
    return "utf-8-sig" if raw.startswith(b"\xef\xbb\xbf") else "utf-8"

def clean_val(val):
    v = val.strip()
    return None if (v == "" or v.upper() == "NULL") else v

def row_to_tsv(row):
    parts = []
    for v in row:
        if v is None:
            parts.append("\\N")
        else:
            v = v.replace("\\", "\\\\")
            v = v.replace("\t", "\\t")
            v = v.replace("\n", "\\n")
            v = v.replace("\r", "\\r")
            parts.append(v)
    return "\t".join(parts) + "\n"

def bulk_insert(cur, rows):
    cols_quoted = ", ".join(f'"{c}"' for c in COLUMNS)
    buf = io.StringIO()
    for row in rows:
        buf.write(row_to_tsv(row))
    buf.seek(0)
    cur.copy_expert(
        f'COPY public."tblRegEntry" ({cols_quoted}) FROM STDIN WITH (FORMAT text, NULL \'\\N\')',
        buf
    )

def import_csv(csv_path, db_url):
    path = Path(csv_path)
    if not path.exists():
        log.error(f"File not found: {csv_path}")
        sys.exit(1)

    encoding = detect_encoding(csv_path)
    log.info("=" * 60)
    log.info("IMPORT STARTED")
    log.info(f"File     : {csv_path}")
    log.info(f"Encoding : {encoding}")
    log.info(f"Batch    : {BATCH_SIZE} rows per flush")
    log.info("=" * 60)

    conn = psycopg2.connect(db_url)
    cur  = conn.cursor()

    log.info("Dropping and recreating tblRegEntry...")
    cur.execute(CREATE_TABLE)
    conn.commit()
    log.info("Table created.")

    total   = 0
    skipped = 0
    batch   = []
    start   = datetime.now()

    with open(csv_path, encoding=encoding, newline="") as f:
        reader = csv.reader(f)
        for line_num, row in enumerate(reader, start=1):

            if not any(row):
                continue

            if len(row) != 14:
                log.warning(f"SKIP line {line_num}: expected 14 cols, got {len(row)}")
                skipped += 1
                continue

            # all 14 cols map directly — no skipping, no slicing
            batch.append([clean_val(v) for v in row])

            if len(batch) >= BATCH_SIZE:
                bulk_insert(cur, batch)
                conn.commit()
                total += len(batch)
                elapsed = (datetime.now() - start).seconds
                log.info(f"Inserted {total:>6} rows  |  elapsed: {elapsed}s")
                batch = []

    if batch:
        bulk_insert(cur, batch)
        conn.commit()
        total += len(batch)

    cur.close()
    conn.close()

    elapsed = (datetime.now() - start).seconds
    log.info("=" * 60)
    log.info(f"DONE")
    log.info(f"Total inserted : {total}")
    log.info(f"Total skipped  : {skipped}")
    log.info(f"Time taken     : {elapsed}s")
    log.info(f"Log saved to   : {LOG_PATH}")
    log.info("=" * 60)

if __name__ == "__main__":
    import_csv(CSV_PATH, DB_URL)