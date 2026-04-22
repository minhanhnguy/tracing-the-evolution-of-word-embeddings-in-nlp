import csv
from collections import Counter
import matplotlib.pyplot as plt

def get_country_distribution(file_path):
    country_counts = Counter()

    with open(file_path, 'r', encoding='utf-8') as csv_file:
        reader = csv.DictReader(csv_file)
        # Strip whitespace from headers
        reader.fieldnames = [h.strip() for h in reader.fieldnames]

        for row in reader:
            for i in range(1, 13):  # Country_1 ... Country_12
                key = f'Country_{i}'
                country = (row.get(key) or '').strip()
                if country and country.lower() not in ('na', 'n/a', ''):
                    country_counts[country] += 1

    return country_counts


def print_top_k(counts: Counter, title: str, k: int = 20):
    top_k = counts.most_common(k)
    print(f"\n=== Top {k} {title} ===")
    for name, count in top_k:
        print(f"{name}: {count}")

    others_total = sum(counts.values()) - sum(c for _, c in top_k)
    if others_total > 0:
        print(f"Others (all remaining): {others_total}")

    return top_k


def main():
    file_name = "../../tracing-the-evolution-of-word-embeddings-in-nlp.csv"
    distribution = get_country_distribution(file_name)

    # Top 20 nations + Others
    top_20 = print_top_k(distribution, title="Nations", k=20)

    # --- Plot ---
    labels = [name for name, _ in top_20]
    values = [count for _, count in top_20]

    plt.figure(figsize=(10, 7))
    plt.barh(labels[::-1], values[::-1], color="cornflowerblue", edgecolor="black")
    plt.xlabel("Number of Authors")
    plt.title("Top 20 Nations by Author Count")
    plt.tight_layout()

    png_filename = "nation_distribution.png"
    plt.savefig(png_filename, dpi=300, bbox_inches="tight")
    print(f"PNG chart saved as: {png_filename}")
    plt.show()


if __name__ == "__main__":
    main()
