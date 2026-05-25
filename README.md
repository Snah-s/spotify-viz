# Multidimensional Visualization - Spotify Audio Feature Explorer

Interactive multidimensional visualization system for exploring relationships between Spotify audio features across tracks, genres, and years using D3.js and Flask.

Draft of visualizations on:  [Observable draft prototype](https://observablehq.com/@snah/draft-spoty-viz)

Data from: [Kaggle](https://www.kaggle.com/datasets/yamaerenay/spotify-dataset-1921-2020-160k-tracks?utm_source=&select=data.csv)

---

## Overview

This project explores how Spotify tracks evolve and cluster through multidimensional audio features such as energy, danceability, valence, acousticness, speechiness, instrumentalness, loudness, tempo, popularity, and liveness.

The system combines dimensionality reduction, multidimensional projections, and interactive filtering techniques to reveal structural patterns inside the Spotify dataset.

The application was designed around three core analytical goals:

1. Understand how musical characteristics evolved from 1921 to 2020.
2. Discover clusters and relationships between audio features.
3. Analyze how genres distribute across multidimensional feature spaces.

---

## Evaluation-Oriented Summary

This project was designed to satisfy the main evaluation criteria of the assignment:

| Criterion          | How this project addresses it                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clarity            | Each visualization uses explicit titles, axis labels, legends, normalized scales, and short explanatory subtitles to make the visual encodings easier to interpret.                                                                                                                               |
| Analytical Insight | The system reveals temporal evolution, multidimensional clustering, feature correlations, genre contrasts, and outlier behavior in Spotify tracks.                                                                                                                                                |
| Design Rationale   | Each visualization technique was selected for a specific analytical purpose: temporal trends for evolution, PCA for projection, RadViz and Star Coordinates for dimensional anchoring, Parallel Coordinates for detailed multidimensional filtering, and bubble plots for genre-level comparison. |
| Technical Accuracy | The project implements all required techniques using D3: RadViz, Star Coordinates, Parallel Coordinates with brushing, and PCA projection computed in Python with `scikit-learn`.                                                                                                                 |
| Tasks Coverage     | The visualizations directly answer three analytical tasks: how audio features evolve over time, how tracks cluster in high-dimensional space, and how genres differ across acoustic and energetic profiles.                                                                                       |

---

## Visualization Design and Rationale

| Visualization        | Analytical purpose                                                     | Design rationale                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Year Trend           | Shows how audio features changed from 1921 to 2020.                    | A line chart is appropriate because the task is temporal. It makes long-term increases, decreases, and turning points visible.                        |
| PCA Projection       | Reduces high-dimensional audio features to two components.             | PCA provides a compact global view of structure, variance, dense regions, and outliers.                                                               |
| RadViz               | Shows attraction of tracks toward feature anchors.                     | RadViz is useful for observing how combinations of normalized features pull tracks toward different regions.                                          |
| Star Coordinates     | Shows the influence of weighted feature vectors.                       | Star Coordinates make it easier to compare how selected variables shape the projection direction.                                                     |
| Parallel Coordinates | Enables feature-by-feature comparison and brushing.                    | Parallel Coordinates are suitable for high-dimensional data because each feature remains visible as an axis. Brushing supports interactive filtering. |
| Genre Bubble Plot    | Compares genres by acousticness, energy, popularity, and danceability. | The scatter/bubble encoding provides a compact genre-level contrast using position, size, and color.                                                  |

---

## Task Coverage

### Task 1: How do Spotify audio features evolve over time?

Answered by:

* Year Trend

The line chart shows the historical evolution of energy, danceability, acousticness, and valence. It reveals a major shift from highly acoustic music in early decades toward more energetic and danceable music in recent decades.

### Task 2: How do tracks cluster according to multidimensional audio features?

Answered by:

* PCA Projection
* RadViz
* Star Coordinates

These projections show that most tracks form a dense central region, while acoustic, instrumental, energetic, and danceable tracks extend toward different areas of the feature space.

### Task 3: How do genres differ in acoustic and energetic profiles?

Answered by:

* Genre Bubble Plot
* Parallel Coordinates

The genre contrast view shows an inverse relationship between acousticness and energy. Parallel Coordinates complement this by showing how track-level distributions vary across all normalized audio features.

---

## Interaction and Exploration

The application includes interactive resources required for exploratory analysis:

* `mouseover` and `mouseenter` interactions for highlighting tracks and showing details.
* Tooltips to expose metadata without overloading the visual display.
* Brushing in Parallel Coordinates to filter tracks by multidimensional ranges.
* Random sampling to keep large-scale D3 rendering responsive.
* Color encoding to compare groups and feature intensity.
* Bubble-size encoding to represent genre popularity.

These interactions support exploratory analysis by allowing the user to move from overview to detail, filter dense regions, and compare multidimensional patterns dynamically.

---

## Installation

### Normal venv

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python src/process_data.py
flask --app app run --debug
```

### Micromamba or Conda

```bash
micromamba create -f environment.yml
micromamba run -n spotify-viz python src/process_data.py
micromamba run -n spotify-viz flask --app app run --debug
```

Open [http://127.0.0.1:5000](http://127.0.0.1:5000).

When the page opens, choose a random sample size. The maximum is `15000` tracks to keep D3 visualizations responsive. The `New Random Sample` button generates a fresh sample and overwrites the previous runtime sample.

---

## Analytical Tasks

### 1. Temporal Evolution of Music

How have Spotify audio characteristics changed over time?

The year trend view explores long-term changes in energy, danceability, acousticness, and valence using aggregated yearly statistics.

#### Main Findings

* Energy steadily increases from the 1960s onward, reflecting the rise of electronically amplified and heavily produced music.
* Acousticness sharply decreases over time, suggesting a transition from acoustic instrumentation toward digital and synthetic production.
* Danceability increases gradually, especially after the 1990s.
* Valence decreases slightly after 2005, suggesting that recent popular tracks tend to sound less bright or emotionally positive.

![Year Trends](img/trend.png)

---

### 2. Multidimensional Structure of Tracks

How do tracks cluster when projected from high-dimensional audio space?

The system uses PCA Projection, RadViz, and Star Coordinates to analyze latent relationships between tracks and audio attributes.

#### PCA Projection

The PCA projection reveals a dense central cluster with elongated distributions toward energetic and acoustic extremes. Most tracks share common mainstream characteristics, while outliers represent niche or highly specialized musical styles.

#### RadViz

RadViz shows how tracks gravitate toward anchors representing dominant audio characteristics. A strong relationship appears between energy, danceability, and valence, while acoustic and instrumental tracks separate toward different regions.

#### Star Coordinates

Star Coordinates reveal directional relationships between features. Energy and danceability strongly influence the dominant cluster orientation, while acousticness forms an opposing direction.

![RadViz and Star Coordinates](img/radviz-star.png)

![PCA Projection](img/Pca-Bubble.png)

---

### 3. Genre and Feature Relationships

How do genres differ across multidimensional feature distributions?

The genre contrast bubble plot compares acousticness, energy, danceability, and popularity simultaneously.

#### Main Findings

* Genres with high energy tend to have low acousticness.
* Highly acoustic genres cluster near low-energy regions.
* Popular genres occupy central-to-high energy regions.
* Danceability adds additional separation inside energetic genres.

This visualization highlights how genres naturally organize across audio feature dimensions.

---

## Parallel Coordinates Analysis

The Parallel Coordinates view enables direct multidimensional comparison across all normalized audio features.

Interactive brushing allows filtering tracks by ranges across multiple axes simultaneously.

#### Main Findings

* Popular tracks tend to combine high loudness, medium/high energy, and moderate danceability.
* Instrumentalness remains near zero for most mainstream tracks.
* Speechiness and liveness show sparse distributions with strong concentration near lower values.
* Brushing reveals correlations between energy, loudness, and popularity.

![Parallel Coordinates](img/parallel.png)
