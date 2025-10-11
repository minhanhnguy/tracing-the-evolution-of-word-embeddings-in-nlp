import csv
from collections import Counter

def get_affiliation_distribution(file_path, threshold=10):
    affiliation_counts = Counter()

    with open(file_path, 'r', encoding='utf-8') as csv_file:
        reader = csv.DictReader(csv_file)
        # Clean headers
        reader.fieldnames = [h.strip() for h in reader.fieldnames]

        for row in reader:
            for i in range(1, 13):  # Affiliation_1 ... Affiliation_12
                key = f'Affiliation_{i}'
                aff = row.get(key, '').strip()
                if aff and aff.lower() not in ('na', 'n/a', ''):
                    affiliation_counts[aff] += 1

    # Group affiliations with fewer than threshold into "Others"
    grouped_counts = Counter()
    others_total = 0
    for aff, count in affiliation_counts.items():
        if count < threshold:
            others_total += count
        else:
            grouped_counts[aff] = count

    if others_total > 0:
        grouped_counts["Others"] = others_total

    return grouped_counts


def main():
    file_name = "../../tracing-the-evolution-of-word-embeddings-in-nlp-first-affiliation.csv"
    distribution = get_affiliation_distribution(file_name, threshold=10)

    print("\n=== Distribution of Affiliations (Grouped) ===")
    for aff, count in sorted(distribution.items(), key=lambda x: x[1], reverse=True):
        print(f"{aff}: {count}")


if __name__ == "__main__":
    main()
