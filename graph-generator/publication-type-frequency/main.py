import pandas as pd
import matplotlib.pyplot as plt
import os

# Load CSV
df = pd.read_csv("../../tracing-the-evolution-of-word-embeddings-in-nlp.csv")

# Get current working directory (optional)
current_dir = os.getcwd()
print(f"Files will be saved to: {current_dir}")

# --- Count publication types ---
col_name = "Journal/Conf/BC/WP/Other"

# Clean strings
df[col_name] = df[col_name].str.strip()

pub_counts = df[col_name].value_counts()
print("Counts of Publication Types:")
print(pub_counts)

# --- Plot ---
plt.figure(figsize=(7, 5))
pub_counts.plot(kind='bar', color="cornflowerblue", edgecolor="black")
plt.xlabel("Publication Type")
plt.ylabel("Number of Papers")
plt.title("Distribution of Publication Types")
plt.xticks(rotation=45)
plt.tight_layout()

# Save PNG
png_filename = "publication_types.png"
plt.savefig(png_filename, dpi=300, bbox_inches="tight")
print(f"PNG chart saved as: {png_filename}")

# Show plot
plt.show()
