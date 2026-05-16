import csv

CSV_PATH = r"D:\highcourt\highcourt_export.csv"

with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
    reader = csv.reader(f)
    for i, row in enumerate(reader):
        if i >= 5:
            break
        print(f"Line {i+1} ({len(row)} cols): {row}")