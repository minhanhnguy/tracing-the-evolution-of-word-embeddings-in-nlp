import csv

def process_csv(file_path):
    results = []
    
    with open(file_path, 'r', encoding='utf-8') as csv_file:
        reader = csv.DictReader(csv_file)
        # Strip whitespace from headers
        reader.fieldnames = [h.strip() for h in reader.fieldnames]
        
        for row in reader:
            paper_id = row.get('BE', '(missing)')
            
            # Count authors
            if row.get('Number_Authors', '').strip():
                num_authors = int(row['Number_Authors'])
            else:
                num_authors = 0
                for i in range(1, 11):
                    author_key = f'Author_{i}'
                    if row.get(author_key, '').strip().lower() not in ('na', ''):
                        num_authors += 1
            
            # Count affiliations
            num_affiliations = 0
            for i in range(1, 13):
                aff_key = f'Affiliation_{i}'
                if row.get(aff_key, '').strip().lower() not in ('na', ''):
                    num_affiliations += 1
            
            # Compare
            if num_affiliations > num_authors:  # Change to >= if you want equality too
                results.append(paper_id)
    
    return results


# Run
file_name = "./tracing-the-evolution-of-word-embeddings-in-nlp-copy.csv"
results = process_csv(file_name)
print("Results:", results)
