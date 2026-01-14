import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta
import numpy as np

# Set standard academic font
plt.rcParams['font.family'] = 'serif'
plt.rcParams['font.serif'] = ['Times New Roman'] + plt.rcParams['font.serif']

# Milestones data
milestones = [
    ("1954", "Bag-of-Words", "Statistical", 0),
    ("1972", "TF-IDF", "Statistical", 0),
    ("1975", "One-hot", "Statistical", 0),
    ("1990", "LSA", "Statistical", 0),
    
    ("2013", "Word2Vec", "Static", 0),
    ("2014", "GloVe", "Static", -4),      
    ("2014", "Doc2Vec", "Sentence", 0),         
    ("2014", "Dependency", "Static", 4),     
    
    ("2015", "Sense2Vec", "Static", -3),
    ("2015", "Skip-Thought", "Sentence", 3),
    
    ("2016", "FastText", "Static", 0),
    
    ("2017", "Poincaré", "Static", -3),
    ("2017", "Transformer", "Contextual", 3),
    
    ("2018", "ELMo", "Contextual", -4),
    ("2018", "BERT", "Contextual", 0),
    ("2018", "USE", "Sentence", 4),
    
    ("2019", "GPT-2", "Contextual", -3),
    ("2019", "S-BERT", "Sentence", 3),
    
    ("2020", "GPT-3", "Contextual", 0),
    ("2022", "ChatGPT", "Contextual", 0),
]

# EXTREME DENSITY for Huge Font (14pt)
# Strategies:
# 1. Step size 1.25 (Minimum for 14pt + padding)
# 2. Pull Sentence category UP closer to Static (Gap reduction)
# 3. Y-limits tightly hugging content

custom_levels = {
    # Statistical (Top Left)
    "Bag-of-Words": 1.3, "TF-IDF": 2.55, "One-hot": 1.3, "LSA": 2.55,
    
    # Static (Bottom Right - Upper) - Step 1.25
    "Word2Vec": -1.3, "GloVe": -2.55, "Dependency": -3.8, "Sense2Vec": -5.05, "FastText": -6.3, "Poincaré": -7.55,
    
    # Sentence (Bottom Right - Lower)
    # Pulled up from -8.1 to -8.8 (just enough clearance)
    "Doc2Vec": -9.0, "Skip-Thought": -10.25, "USE": -11.5, "S-BERT": -12.75,
    
    # Contextual (Top Right)
    "Transformer": 4.0, "ELMo": 5.25, "BERT": 6.5, "GPT-2": 7.75, "GPT-3": 9.0, "ChatGPT": 10.25
}

# Parse dates
dates = []
levels = []
names = []
categories = []

for m in milestones:
    base_date = datetime.strptime(m[0], "%Y")
    offset = timedelta(days=m[3] * 30)
    dates.append(base_date + offset)
    names.append(m[1])
    categories.append(m[2])
    val = 0
    for key, level in custom_levels.items():
        if key in m[1]:
            val = level
            break
    levels.append(val)

# ACADEMIC COLOR PALETTE
category_colors = {
    "Statistical": "#7f7f7f", 
    "Static": "#1f77b4",      
    "Contextual": "#2ca02c",  
    "Sentence": "#9467bd",    
}
colors = [category_colors[c] for c in categories]

# Create Plot - Compact
fig, ax = plt.subplots(figsize=(16, 7.5), constrained_layout=True) # Slightly taller to fit HUGE text

# Main horizontal line
min_date = datetime(1952, 1, 1)
max_date = datetime(2024, 1, 1)
ax.plot([min_date, max_date], [0, 0], "-", color="black", linewidth=1.2, zorder=1)

# Plot Points
for d, l, r, c in zip(dates, levels, names, colors):
    ax.vlines(d, 0, l, color=c, alpha=0.5, linewidth=1.0, linestyle='--')
    ax.plot(d, 0, "o", color=c, markeredgecolor="black", markeredgewidth=0.5, markersize=6, zorder=3)
    
    # Annotate - HUGE FONT (14) + Padding
    # Explicitly requested "box bigger" -> pad=0.1
    ax.text(d, l, r, ha="center", va="center", fontsize=14, fontname="Times New Roman", fontweight='bold',
            bbox=dict(boxstyle="square,pad=0.2", fc="white", ec=c, lw=0.8, alpha=1.0))

# Axes Format
ax.set_xlim(min_date, max_date)
ax.xaxis.set_major_locator(mdates.YearLocator(5))
ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
ax.tick_params(axis='x', labelsize=14, length=5, width=1.2)

# Y-Limits - Adjusted
ax.set_ylim(-14, 12)
ax.get_yaxis().set_visible(False)

# Spines
ax.spines["left"].set_visible(False)
ax.spines["right"].set_visible(False)
ax.spines["top"].set_visible(False)
ax.spines["bottom"].set_position("zero")
ax.spines["bottom"].set_linewidth(1.2)
ax.spines["bottom"].set_color('black')

# Legend - Bottom Left
handles = [plt.Line2D([0], [0], color=v, lw=3) for v in category_colors.values()]
labels = ["Statistical", "Static Word Embeddings", "Contextual Word Embeddings", "Sentence Embeddings"]

ax.legend(handles, labels, loc="lower left", bbox_to_anchor=(0.0, 0.02), ncol=1, frameon=True, fontsize=13, 
          fancybox=False, edgecolor='black', framealpha=1, borderpad=0.6)

plt.savefig("/Users/minh/Documents/Word_Embedding_Techniques_in_NLP__MAIN__Dec26/timeline_techniques.png", dpi=300, bbox_inches='tight', pad_inches=0.05)
print("Timeline saved to timeline_techniques.png")
