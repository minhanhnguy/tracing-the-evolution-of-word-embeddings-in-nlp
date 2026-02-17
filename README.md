# Tracing the Evolution of Word Embedding Techniques in Natural Language Processing

This repository contains the curated dataset and analysis code accompanying the paper:

> **Tracing the Evolution of Word Embedding Techniques in Natural Language Processing**
> Minh Anh Nguyen (Texas Tech University), Kuheli Sai (University of Pittsburgh), Minh Nguyen (Florida Atlantic University)

## Dataset

The dataset comprises **149 manually annotated research articles** spanning **1954 to 2025**, each introducing or significantly extending a word embedding technique. The annotations enable systematic bibliometric analysis of how representation learning has evolved over seven decades.

All analyses in the paper use **first-listed affiliations only**: when an author reported multiple affiliations, only the primary (first-listed) institution was retained. This provides a consistent, conservative annotation rule across all 149 papers.

Two CSV files are provided:

| File | Description |
|---|---|
| `tracing-the-evolution-of-word-embeddings-in-nlp.csv` | **Primary dataset (used in the paper).** Each author is assigned their first-listed institutional affiliation only. |
| `tracing-the-evolution-of-word-embeddings-in-nlp-full-affiliation.csv` | Alternative version listing all reported affiliations per author, including secondary and dual appointments. |

### Schema

| Field | Description |
|---|---|
| `BE` | Unique BibTeX citation key |
| `Title` | Full paper title |
| `Abstract` | Full abstract text |
| `Year` | Publication year (1954--2025) |
| `Journal/Conference` | Name of the publication venue |
| `Journal/Conf/BC/WP/Other` | Venue type: Conference, Journal Article, Preprint, Book Chapter, or Workshop |
| `Embedding_Techniques` | Specific technique introduced or extended |
| `Embedding_Techniques(formatted)` | Standardized technique name |
| `Category` | One of four classes: Statistical Representations, Static Word Embeddings, Contextual Word Embeddings, Sentence/Document Embedding |
| `Relation` | Methodological lineage (e.g., "Extension of word2vec") |
| `Relation (Original or Varient/Enhancement)` | Whether the paper is Original Research or a Variant/Enhancement |
| `Number_Authors` | Total number of authors |
| `List of Authors` | All authors in BibTeX format |
| `Author_1` ... `Author_10` | Individual author names |
| `Affiliation_1` ... `Affiliation_12` | Institutional affiliation per author (first-listed only in the primary dataset; all affiliations in the alternative version) |
| `Country_1` ... `Country_12` | Country of each affiliation |
| `URL` | Link to the paper |

## Repository Structure

```
.
├── analysis/
│   └── before-after-gpt3.ipynb   # Pre vs. Post GPT-3 era comparison (9 hypothesis tests)
├── graph-generator/
│   ├── affiliation-distribution/
│   ├── author-connections-visualization/
│   ├── distribution-of-number-of-authors/
│   ├── embedding-method-category-frequency/
│   ├── frequency-of-original-or-varient/
│   ├── nation-distribution/
│   ├── number-of-paper-published-per-year/
│   ├── publication-type-frequency/
│   ├── timeline-of-techniques/
│   └── undirected-graph-for-authors/
├── tracing-the-evolution-of-word-embeddings-in-nlp.csv                    # Primary dataset (first affiliation)
├── tracing-the-evolution-of-word-embeddings-in-nlp-full-affiliation.csv   # All affiliations (alternative)
├── requirements.txt
└── LICENSE
```

## Reproducing the Analysis

```bash
# Clone the repository
git clone https://github.com/minhanhnguy/tracing-the-evolution-of-word-embeddings-in-nlp.git
cd tracing-the-evolution-of-word-embeddings-in-nlp

# Install dependencies
pip install -r requirements.txt

# Run the GPT-3 era comparison notebook
jupyter notebook analysis/before-after-gpt3.ipynb
```
