# U.S. County Health Inequality Dashboard

An interactive visual analytics dashboard for exploring socioeconomic drivers of health disparities across U.S. counties.

**CSE 564 — Information Visualization | Mahim Mohtadi & Naseer Ahmed**

---

## Overview

This dashboard visualizes county-level health and socioeconomic data for 3,158 U.S. counties across all 50 states. It uses linked brushing across four coordinated views to enable interactive exploration of how factors like income, poverty, and access to care relate to health outcomes like life expectancy and premature mortality.

## Features

- **Choropleth Map** — U.S. counties colored by any selected health or socioeconomic variable
- **Scatter Plot** — Explore relationships between any two variables; drag to brush-select counties
- **Parallel Coordinates** — View all 20 variables simultaneously; brush any axis to filter
- **Correlation Heatmap** — Pairwise Pearson correlations; click a cell to update scatter axes
- **Linked Brushing** — Selections in any view instantly update all other views

## Dataset

Derived from the [Robert Wood Johnson Foundation County Health Rankings](https://www.countyhealthrankings.org/) program. Contains 20 variables per county across five categories:

| Category | Variables |
|---|---|
| Health Outcomes | Life Expectancy, YPLL Rate, % Fair/Poor Health, Physically & Mentally Unhealthy Days, Drug Overdose Rate, Firearm Fatalities, Homicide Rate, Injury Death Rate |
| Socioeconomic | Median Household Income, Income Ratio, % Children in Poverty, % Uninsured, % Unemployed |
| Healthcare Access | Primary Care Physicians Rate |
| Education & Lifestyle | HS Graduation Rate, % Obesity, % Smoking |
| Demographics | % Rural, Population |

## Project Structure

```
├── app.py                          # Flask backend — serves data API and static files
├── merged_full_all_states_analysis_dataset.csv
├── requirements.txt
├── templates/
│   └── index.html                  # Dashboard layout (2×2 grid)
└── static/
    ├── style.css                   # Light/clean theme, no-scroll layout
    ├── main.js                     # Shared state, dispatch, data loading
    ├── map.js                      # Choropleth map (D3 geoAlbersUsa)
    ├── scatter.js                  # Scatter plot with brush selection
    ├── parallel.js                 # Parallel coordinates with axis brushing
    └── heatmap.js                  # Correlation heatmap
```

## Getting Started

**1. Install dependencies**
```bash
pip install -r requirements.txt
```

**2. Run the server**
```bash
python app.py
```

**3. Open in browser**
```
http://localhost:5050
```

## How to Use

| Interaction | Effect |
|---|---|
| Click a county on the map | Select that county across all views |
| Shift+click counties on the map | Multi-select |
| Drag a rectangle on the scatter plot | Select all counties in that area |
| Brush an axis on the parallel coordinates | Filter to counties in that range |
| Brush multiple PCP axes | AND-filter across all brushed axes |
| Click a cell on the heatmap | Set scatter X/Y axes to those two variables |
| Map Variable dropdown | Change the choropleth color variable |
| Clear Selection button | Reset all selections and brushes |

## Dependencies

- [Flask](https://flask.palletsprojects.com/) — Python web server
- [D3.js v7](https://d3js.org/) — All chart rendering and interactions
- [TopoJSON Client](https://github.com/topojson/topojson-client) — County boundary rendering
- [US Atlas](https://github.com/topojson/us-atlas) — U.S. county TopoJSON (fetched from CDN)
- Pandas, NumPy — Data preprocessing and correlation computation
