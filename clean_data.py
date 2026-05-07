"""
clean_data.py
-------------
Cleans Results.xlsx before migration to Supabase.
Does NOT delete any rows — only normalizes values.
Outputs: Results_cleaned.xlsx

Usage:
    python clean_data.py --file Results.xlsx
"""

import argparse
import re
import pandas as pd

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

# ── type normalization map ────────────────────────────────────────────────────
# Maps messy type values (uppercased) to a clean short code
# Add more entries here if needed after inspecting Results_cleaned.xlsx
TYPE_NORMALIZE = {
    # Writ Petition variants
    'WRIT PETITION NO':           'WP',
    'WRIT PETITION NO.':          'WP',
    'WRIT PETITION':              'WP',
    'W.P.':                       'WP',
    'W.P.NO.':                    'WP',
    'WP':                         'WP',
    'WRIT PETITION (ST)':         'WP',

    # PIL variants
    'PUBLIC INTEREST LITIGATION': 'PIL',
    'PUBLIC INTEREST LITIGAITON': 'PIL',
    'P.I.L':                      'PIL',
    'P.I.L.':                     'PIL',
    'PIL':                        'PIL',

    # Misc Civil Application
    'MISC. CIVIL APPLICATIONS':   'MCA',
    'MISC. CIVIL APPLICATION':    'MCA',
    'MISC CIVIL APPLICATION':     'MCA',
    'M.C.A.':                     'MCA',
    'MCA':                        'MCA',

    # Contempt Petition
    'CONTEMPT PETITION':          'CP',
    'CONTEMPT PETITION NO.':      'CP',
    'C.P.':                       'CP',
    'CP':                         'CP',

    # Wealth Tax
    'WEALTH TAX REFERENCE':       'WTR',

    # Letters Patent Appeal
    'LETTERS PATENT APPEAL':      'LPA',
    'L.P.A.':                     'LPA',
}

def clean_str(val):
    if val is None:
        return None
    if isinstance(val, float):
        import math
        if math.isnan(val):
            return None
    s = str(val).strip()
    return s if s else None


def normalize_type(val):
    """
    Try to map messy type values to a clean short code.
    Strategy:
      1. Exact match in TYPE_NORMALIZE
      2. Starts-with match (handles 'W.P.NO. 4423/2017' -> 'WP')
      3. Contains key match
      4. Return first 20 chars of original as fallback (never loses the row)
    """
    s = clean_str(val)
    if not s:
        return 'UNKNOWN', s or ''

    upper = s.upper().strip()

    # 1. exact match
    if upper in TYPE_NORMALIZE:
        return TYPE_NORMALIZE[upper], s

    # 2. starts-with match
    for key, code in TYPE_NORMALIZE.items():
        if upper.startswith(key):
            return code, s

    # 3. contains match
    for key, code in TYPE_NORMALIZE.items():
        if key in upper:
            return code, s

    # 4. fallback — use first 20 chars, never lose the row
    return upper[:20].strip(), s


def normalize_copies(val):
    s = clean_str(val)
    if not s:
        return '1'
    digits = re.sub(r'[^0-9]', '', s)
    if not digits:
        return '1'
    v = int(digits)
    # cap at smallint max, and treat phone-number-like values as 1
    if v > 100:
        return '1'
    return str(max(1, v))

def clean_data(input_path, output_path):
    print(f"Reading: {input_path}")
    df = pd.read_excel(input_path, header=None, dtype=str)
    print(f"  {len(df):,} rows loaded")

    report = {
        "dates_filled":      0,
        "districts_filled":  0,
        "petitioners_filled":0,
        "advocates_upper":   0,
        "types_normalized":  0,
        "types_fallback":    0,
        "copies_fixed":      0,
    }

    # ── Advocate: uppercase ───────────────────────────────────────────────────
    def fix_advocate(val):
        s = clean_str(val)
        if not s:
            return s
        upper = s.upper()
        if upper != s:
            report["advocates_upper"] += 1
        return upper

    df[C_ADVOCATE] = df[C_ADVOCATE].apply(fix_advocate)

    # ── Date: fill missing with placeholder ──────────────────────────────────
    def fix_date(val):
        s = clean_str(val)
        if not s:
            report["dates_filled"] += 1
            return '1900-01-01'
        try:
            ts = pd.to_datetime(val, errors='coerce')
            if pd.isnull(ts):
                report["dates_filled"] += 1
                return '1900-01-01'
            return ts.strftime('%Y-%m-%d')
        except Exception:
            report["dates_filled"] += 1
            return '1900-01-01'

    df[C_DATE] = df[C_DATE].apply(fix_date)

    # ── District: fill missing ────────────────────────────────────────────────
    def fix_district(val):
        s = clean_str(val)
        if not s:
            report["districts_filled"] += 1
            return 'UNKNOWN'
        return s.strip()

    df[C_DISTRICT] = df[C_DISTRICT].apply(fix_district)

    # ── Petitioner: fill missing ──────────────────────────────────────────────
    def fix_petitioner(val):
        s = clean_str(val)
        if not s:
            report["petitioners_filled"] += 1
            return 'UNKNOWN'
        return s.strip()

    df[C_PETITIONER] = df[C_PETITIONER].apply(fix_petitioner)

    # ── Case type: normalize ──────────────────────────────────────────────────
    original_types = df[C_TYPE_SHORT].tolist()
    new_short = []
    new_long  = []
    for val in original_types:
        short_code, original = normalize_type(val)
        new_short.append(short_code)
        # long_type: use original full text if available, else short code
        long_val = clean_str(df[C_LONG_TYPE][original_types.index(val)]) or original or short_code
        new_long.append(long_val)
        if short_code != (clean_str(val) or '').upper()[:20].strip():
            report["types_normalized"] += 1
        if len(clean_str(val) or '') > 20:
            report["types_fallback"] += 1

    df[C_TYPE_SHORT] = new_short
    df[C_LONG_TYPE]  = [clean_str(df[C_LONG_TYPE][i]) or new_short[i] for i in range(len(df))]

    # ── Copies: fix messy values ──────────────────────────────────────────────
    def fix_copies(val):
        original = clean_str(val)
        fixed = normalize_copies(val)
        if fixed != (original or '').strip():
            report["copies_fixed"] += 1
        return fixed

    df[C_COPIES] = df[C_COPIES].apply(fix_copies)

    # ── Fill missing case type ────────────────────────────────────────────────
    df[C_TYPE_SHORT] = df[C_TYPE_SHORT].apply(lambda v: clean_str(v) or 'UNKNOWN')

    # ── Save ──────────────────────────────────────────────────────────────────
    df.to_excel(output_path, index=False, header=False)

    print(f"\nCleaning complete. Saved to: {output_path}")
    print(f"  Total rows:            {len(df):,}  (no rows removed)")
    print(f"  Dates filled:          {report['dates_filled']}")
    print(f"  Districts filled:      {report['districts_filled']}")
    print(f"  Petitioners filled:    {report['petitioners_filled']}")
    print(f"  Advocates uppercased:  {report['advocates_upper']}")
    print(f"  Types normalized:      {report['types_normalized']}")
    print(f"  Copies fixed:          {report['copies_fixed']}")
    print(f"\nPlease open Results_cleaned.xlsx and spot-check before importing.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Clean Results.xlsx before Supabase import")
    parser.add_argument("--file",   required=True, help="Input Excel file (e.g. Results.xlsx)")
    parser.add_argument("--output", default=None,  help="Output file (default: <input>_cleaned.xlsx)")
    args = parser.parse_args()

    output = args.output or args.file.replace(".xlsx", "_cleaned.xlsx").replace(".XLSX", "_cleaned.xlsx")
    clean_data(args.file, output)