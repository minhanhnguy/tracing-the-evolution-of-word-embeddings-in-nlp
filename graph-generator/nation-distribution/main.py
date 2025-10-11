import csv
from collections import Counter

def get_country_distribution(file_path):
    country_counts = Counter()

    with open(file_path, 'r', encoding='utf-8') as csv_file:
        reader = csv.DictReader(csv_file)
        # Strip whitespace from headers
        reader.fieldnames = [h.strip() for h in reader.fieldnames]

        for row in reader:
            for i in range(1, 13):  # Country_1 ... Country_12
                key = f'Country_{i}'
                country = row.get(key, '').strip()
                if country and country.lower() not in ('na', 'n/a', ''):
                    country_counts[country] += 1

    return country_counts


def main():
    file_name = "../../tracing-the-evolution-of-word-embeddings-in-nlp-first-affiliation.csv"
    distribution = get_country_distribution(file_name)

    print("\n=== Distribution of Nations ===")
    for country, count in sorted(distribution.items(), key=lambda x: x[1], reverse=True):
        print(f"{country}: {count}")


if __name__ == "__main__":
    main()
