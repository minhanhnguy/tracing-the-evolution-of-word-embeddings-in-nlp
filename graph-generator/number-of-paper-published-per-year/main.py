import pandas as pd
import matplotlib.pyplot as plt
import os

# Load CSV
df = pd.read_csv("../../tracing-the-evolution-of-word-embeddings-in-nlp.csv")

# Get current working directory (optional)
current_dir = os.getcwd()
print(f"Files will be saved to: {current_dir}")

# --- Count publications per year ---
col_name = "Year"

# Convert to numeric and drop any NaN values
df[col_name] = pd.to_numeric(df[col_name], errors='coerce')
df_clean = df.dropna(subset=[col_name])

# Count papers per year and sort by year
year_counts = df_clean[col_name].value_counts().sort_index()
print("Counts of Publications per Year:")
print(year_counts)

# --- Plot ---
plt.figure(figsize=(12, 6))
year_counts.plot(kind='bar', color="cornflowerblue", edgecolor="black")
plt.xlabel("Year")
plt.ylabel("Number of Papers")
plt.title("Distribution of Paper Publications per Year")
plt.xticks(rotation=45)
plt.tight_layout()

# Save PNG
png_filename = "publications_per_year.png"
plt.savefig(png_filename, dpi=300, bbox_inches="tight")
print(f"PNG chart saved as: {png_filename}")

# Show plot
plt.show()

# Optional: Print summary statistics
print(f"\nTotal papers: {len(df_clean)}")
print(f"Year range: {int(year_counts.index.min())} - {int(year_counts.index.max())}")
print(f"Average papers per year: {year_counts.mean():.2f}")
print(f"Peak year: {int(year_counts.idxmax())} with {year_counts.max()} papers")