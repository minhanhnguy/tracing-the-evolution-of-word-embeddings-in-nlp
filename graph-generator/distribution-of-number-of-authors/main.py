import pandas as pd
import matplotlib.pyplot as plt
import os

# Load CSV
df = pd.read_csv("../../tracing-the-evolution-of-word-embeddings-in-nlp.csv")

# Get current working directory (optional - for confirmation)
current_dir = os.getcwd()
print(f"Files will be saved to: {current_dir}")

# --- Distribution of Number of Authors ---
author_dist = df['Number_Authors'].value_counts().sort_index()
print(author_dist)

plt.figure(figsize=(8, 5))
author_dist.plot(kind='bar', color="mediumseagreen", edgecolor="black")
plt.xlabel("Number of Authors")
plt.ylabel("Number of Papers")
plt.title("Distribution of Number of Authors per Paper")
plt.xticks(rotation=0)  # keep x-axis labels horizontal
plt.tight_layout()

# Save PNG
png_filename = "author_distribution.png"
plt.savefig(png_filename, dpi=300, bbox_inches='tight')
print(f"PNG chart saved as: {png_filename}")

# Show chart
plt.show()

print("Author distribution chart successfully saved to the current directory!")
