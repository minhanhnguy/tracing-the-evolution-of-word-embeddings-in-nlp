import csv
from collections import Counter
import matplotlib.pyplot as plt

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

    # --- Plot ---
    labels = [aff for aff, _ in top_20]
    values = [count for _, count in top_20]

    plt.figure(figsize=(10, 7))
    plt.barh(labels[::-1], values[::-1], color="cornflowerblue", edgecolor="black")
    plt.xlabel("Number of Authors")
    plt.title("Top 20 Affiliations by Author Count")
    plt.tight_layout()

    png_filename = "affiliation_distribution.png"
    plt.savefig(png_filename, dpi=300, bbox_inches="tight")
    print(f"PNG chart saved as: {png_filename}")
    plt.show()


if __name__ == "__main__":
    main()
