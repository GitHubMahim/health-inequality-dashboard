from flask import Flask, jsonify, render_template
import pandas as pd
import numpy as np
import os

app = Flask(__name__)

# ── Load data ────────────────────────────────────────────────────────────────
BASE = os.path.dirname(__file__)
df = pd.read_csv(os.path.join(BASE, "merged_full_all_states_analysis_dataset.csv"))

# ── Option C data strategy ───────────────────────────────────────────────────
#
# DROP variables with >20% missing — these are suppressed by the source for
# small counties (too few events to report) and imputing them would be misleading.
#   - Drug Overdose Mortality Rate  (36% missing)
#   - Firearm Fatalities Rate       (27% missing)
#   - Homicide Rate                 (55% missing)
#   - High School Graduation Rate   (21% missing)
#
# IMPUTE variables with <10% missing using each county's state-level median.
# This fills gaps caused by reporting lags or small-county suppression where
# the neighboring counties are a reasonable reference.

NUMERIC_COLS = [
    'Life Expectancy',
    'Years of Potential Life Lost Rate',
    '% Fair or Poor Health',
    'Average Number of Physically Unhealthy Days',
    'Average Number of Mentally Unhealthy Days',
    'Injury Death Rate',
    'Primary Care Physicians Rate',
    '% Uninsured',
    '% Unemployed',
    'Income Ratio',
    '% Children in Poverty',
    'Median Household Income',
    '% Adults with Obesity',
    '% Adults Reporting Currently Smoking',
    '% Rural',
    'Population',
]

# Impute each column's missing values with the state-level median
for col in NUMERIC_COLS:
    df[col] = pd.to_numeric(df[col], errors='coerce')
    df[col] = df.groupby('State')[col].transform(
        lambda x: x.fillna(x.median())
    )
    # Any counties whose entire state had no data → fill with national median
    df[col] = df[col].fillna(df[col].median())

# ── Routes ───────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/data')
def api_data():
    """Return all county records with all numeric variables."""
    records = []
    for _, row in df.iterrows():
        try:
            fips = str(int(float(row['FIPS']))).zfill(5)
        except (ValueError, TypeError):
            continue
        rec = {
            'fips': fips,
            'state': str(row['State']),
            'county': str(row['County']),
        }
        for col in NUMERIC_COLS:
            v = row.get(col)
            rec[col] = None if (v is None or (isinstance(v, float) and np.isnan(v))) else round(float(v), 3)
        records.append(rec)
    return jsonify({'data': records, 'columns': NUMERIC_COLS})


@app.route('/api/correlations')
def api_correlations():
    """Return pairwise Pearson correlation matrix for all numeric columns."""
    clean = df[NUMERIC_COLS].apply(pd.to_numeric, errors='coerce').dropna()
    corr = clean.corr()
    matrix = [
        [None if np.isnan(v) else round(float(v), 3) for v in row]
        for row in corr.values
    ]
    return jsonify({'columns': NUMERIC_COLS, 'matrix': matrix})


if __name__ == '__main__':
    app.run(debug=True, port=5050)
