import csv
from collections import Counter

def get_affiliation_counts(file_path):
    counts = Counter()

    with open(file_path, 'r', encoding='utf-8') as csv_file:
        reader = csv.DictReader(csv_file)
        # Clean headers
        reader.fieldnames = [h.strip() for h in reader.fieldnames]

        for row in reader:
            for i in range(1, 13):  # Affiliation_1 ... Affiliation_12
                key = f'Affiliation_{i}'
                aff = (row.get(key) or '').strip()
                if aff and aff.lower() not in ('na', 'n/a', ''):
                    counts[aff] += 1
    return counts


def main():
    file_name = "../../tracing-the-evolution-of-word-embeddings-in-nlp.csv"
    counts = get_affiliation_counts(file_name)

    top_20 = counts.most_common(20)

    print("\n=== Top 20 Affiliations ===")
    for aff, count in top_20:
        print(f"{aff}: {count}")

    # Optional: show how many are outside the top 20
    others_total = sum(counts.values()) - sum(c for _, c in top_20)
    if others_total > 0:
        print(f"Others (all remaining): {others_total}")


if __name__ == "__main__":
    main()
