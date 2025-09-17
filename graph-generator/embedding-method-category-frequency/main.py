import pandas as pd
import matplotlib.pyplot as plt
import os

# Load CSV
df = pd.read_csv("../../tracing-the-evolution-of-word-embeddings-in-nlp.csv")

# Get current working directory (optional - for confirmation)
current_dir = os.getcwd()
print(f"Files will be saved to: {current_dir}")

# --- Matplotlib Export as PNG (Category frequencies) ---
category_series = df['Category'].value_counts()

plt.figure(figsize=(8, 5))
category_series.plot(kind='bar', color="mediumseagreen", edgecolor="black")
plt.xlabel("Embedding Method Category")
plt.ylabel("Number of Papers")
plt.title("Frequency of Embedding Method Categories")
plt.xticks(rotation=45, ha='right')  # Rotate labels for readability
plt.tight_layout()

# Save PNG to current folder
png_filename = "embedding_category_frequency.png"
plt.savefig(png_filename, dpi=300, bbox_inches='tight')
print(f"PNG chart saved as: {png_filename}")

# Show the plot
plt.show()

print("Category frequency chart successfully saved to the current directory!")
