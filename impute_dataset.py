"""
Impute missing values in the county-level health dataset.

Strategy (per numeric column, in order):
  1. Use the median of the same STATE.
  2. Fallback to the national median if a state has no observations
     for that column (rare; happens for very small territories).

Why state-median first?
  Health and socioeconomic outcomes cluster geographically. A missing
  value in a Texas county is far better approximated by other Texas
  counties than by counties nationwide.

Caveats:
  Several columns have high suppression rates in the source data:
      Homicide Rate ............ ~55% missing
      Drug Overdose Mortality .. ~36% missing
      Firearm Fatalities Rate .. ~27% missing
      HS Graduation Rate ....... ~21% missing
  These values are suppressed by the publisher because the underlying
  counts are too small to be statistically reliable. Imputed values for
  these columns inherit that uncertainty — treat them as visualization
  placeholders, not as estimates suitable for analysis or policy.

Usage:
    python impute_dataset.py
Output:
    merged_full_all_states_analysis_dataset_imputed.csv
"""
import os
import pandas as pd

SRC = "merged_full_all_states_analysis_dataset.csv"
OUT = "merged_full_all_states_analysis_dataset_imputed.csv"

NUMERIC_COLS = [
    'Life Expectancy',
    'Years of Potential Life Lost Rate',
    '% Fair or Poor Health',
    'Average Number of Physically Unhealthy Days',
    'Average Number of Mentally Unhealthy Days',
    'Drug Overdose Mortality Rate',
    'Firearm Fatalities Rate',
    'Homicide Rate',
    'Injury Death Rate',
    'Primary Care Physicians Rate',
    '% Uninsured',
    '% Unemployed',
    'Income Ratio',
    '% Children in Poverty',
    'Median Household Income',
    'High School Graduation Rate',
    '% Adults with Obesity',
    '% Adults Reporting Currently Smoking',
    '% Rural',
    'Population',
]


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    src_path = os.path.join(here, SRC)
    out_path = os.path.join(here, OUT)

    df = pd.read_csv(src_path)
    n_rows = len(df)
    print(f"Loaded {n_rows} rows, {len(df.columns)} columns from {SRC}")

    log = {}  # col -> (before, state_filled, national_filled, after)

    for col in NUMERIC_COLS:
        if col not in df.columns:
            print(f"  SKIP {col}: column missing from source")
            continue

        df[col] = pd.to_numeric(df[col], errors='coerce')
        before = df[col].isna().sum()
        if before == 0:
            log[col] = (0, 0, 0, 0)
            continue

        national_median = df[col].median()
        state_medians   = df.groupby('State')[col].transform('median')
        state_medians   = state_medians.fillna(national_median)

        state_filled = df[col].isna().sum() - state_medians.isna().sum()
        df[col] = df[col].fillna(state_medians)

        national_filled = df[col].isna().sum()
        df[col] = df[col].fillna(national_median)

        after = df[col].isna().sum()
        log[col] = (before, state_filled, national_filled, after)

    print()
    print(f"{'Column':55s} {'before':>8s} {'state':>8s} {'national':>10s} {'after':>8s}")
    print("-" * 95)
    for col in NUMERIC_COLS:
        if col not in df.columns:
            continue
        before, state, national, after = log[col]
        print(f"{col:55s} {before:8d} {state:8d} {national:10d} {after:8d}")

    df.to_csv(out_path, index=False)
    print()
    print(f"Wrote {out_path} ({len(df)} rows)")


if __name__ == '__main__':
    main()
