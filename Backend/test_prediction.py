import pandas as pd
import xgboost as xgb
import joblib

# Load model
model = xgb.XGBClassifier()
model.load_model("models/heat_stress_xgb_model.json")

# Load feature order
feature_order = joblib.load("models/feature_order.pkl")

# Load forecast
df = pd.read_excel("data/processed/Vijayawada_Forecast.xlsx")

# Convert timestamp
df["Timestamp"] = pd.to_datetime(df["Timestamp"])

# Create model input
input_data = pd.DataFrame({
    "Temperature": df["Temperature (°C)"],
    "Relative humidity": df["Relative humidity (%)"],
    "Wind speed": df["Wind speed (m/s)"],
    "Solar radiation": df["Solar radiation (W/m²)"],
    "Pressure": df["Pressure (hPa)"],
    "Precipitation": df["Precipitation (mm)"],
    "Cloud cover": df["Cloud cover (%)"],
    "Population density": df["Population density (people/km²)"],
    "Outdoor worker population": df["Outdoor worker population (people)"],
    "hour": df["Timestamp"].dt.hour,
    "day": df["Timestamp"].dt.day,
    "month": df["Timestamp"].dt.month
})

# Ensure exact feature order
input_data = input_data[feature_order]

# Predict all rows
predictions = model.predict(input_data)

# Add predictions to forecast data
df["risk_code"] = predictions
df["risk_level"] = df["risk_code"].map({
    0: "LOW",
    1: "MODERATE",
    2: "HIGH",
    3: "VERY HIGH",
    4: "EXTREME"
})

# Save result
df.to_csv("data/processed/Vijayawada_predictions.csv", index=False)

# Display summary
print("Total forecast rows:", len(df))
print("\nRisk distribution:")
print(df["risk_level"].value_counts())

print("\nFirst 10 predictions:")
print(df[["Timestamp", "Temperature (°C)", "risk_level"]].head(10).to_string(index=False))

print("\nPrediction file saved successfully!")