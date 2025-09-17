import pandas as pd
import matplotlib.pyplot as plt
import os

# Load CSV
df = pd.read_csv("../../tracing-the-evolution-of-word-embeddings-in-nlp.csv")

# Get current working directory (optional - for confirmation)
current_dir = os.getcwd()
print(f"Files will be saved to: {current_dir}")

# --- Matplotlib Export as PNG ---
papers_per_year_series = df['Year'].value_counts().sort_index()

plt.figure(figsize=(8, 5))
papers_per_year_series.plot(kind='bar', color="skyblue", edgecolor="black")
plt.xlabel("Year")
plt.ylabel("Number of Papers")
plt.title("Number of Papers per Year")
plt.xticks(rotation=45)  # Rotate x-axis labels for better readability
plt.tight_layout()

# Save PNG to current folder
png_filename = "papers_per_year.png"
plt.savefig(png_filename, dpi=300, bbox_inches='tight')
print(f"PNG chart saved as: {png_filename}")

# Show the plot
plt.show()

print("Chart successfully saved to the current directory!")
