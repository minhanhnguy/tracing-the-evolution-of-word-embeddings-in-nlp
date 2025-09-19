import pandas as pd
import matplotlib.pyplot as plt
import os

# Load CSV
df = pd.read_csv("../../tracing-the-evolution-of-word-embeddings-in-nlp.csv")

# Get current working directory (optional - for confirmation)
current_dir = os.getcwd()
print(f"Files will be saved to: {current_dir}")

# --- Count Original vs Variation/Enhancement ---
col_name = "Relation (Original or Varient/Enhancement)"

# Clean up column name in case of extra spaces
df[col_name] = df[col_name].str.strip()

counts = df[col_name].value_counts()
print("Counts of Original vs Variation/Enhancement:")
print(counts)

# --- Plot ---
plt.figure(figsize=(6, 5))
counts.plot(kind='bar', color=["skyblue", "lightgreen"], edgecolor="black")
plt.xlabel("Category")
plt.ylabel("Number of Papers")
plt.title("Original vs Variation/Enhancement Papers")
plt.xticks(rotation=45)
plt.tight_layout()

# Save PNG
png_filename = "original_vs_variation.png"
plt.savefig(png_filename, dpi=300, bbox_inches='tight')
print(f"PNG chart saved as: {png_filename}")

# Show plot
plt.show()
