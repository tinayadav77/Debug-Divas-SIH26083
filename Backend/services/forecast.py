import pandas as pd
import xgboost as xgb
import joblib


# Load model once when the backend starts
model = xgb.XGBClassifier()
model.load_model("models/heat_stress_xgb_model.json")

feature_order = joblib.load("models/feature_order.pkl")


def get_forecast(location: str):

    # Select forecast file
    if location.lower() == "vijayawada":
        file_path = "data/processed/Vijayawada_Forecast.xlsx"

    elif location.lower() == "ainavolu":
        file_path = "data/processed/Ainavolu_Forecast.xlsx"

    else:
        return []

    # Read forecast
    df = pd.read_excel(file_path)

    # Convert timestamp
    df["Timestamp"] = pd.to_datetime(df["Timestamp"])

    # Prepare model input
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

    # Match model feature order
    input_data = input_data[feature_order]

    # Predict
    predictions = model.predict(input_data)

    # Convert prediction codes to risk levels
    risk_mapping = {
        0: "LOW",
        1: "MODERATE",
        2: "HIGH",
        3: "VERY HIGH",
        4: "EXTREME"
    }

    # Build API-friendly result
    results = []

    for i, prediction in enumerate(predictions):

        results.append({
            "timestamp": df.iloc[i]["Timestamp"].isoformat(),
            "temperature": float(df.iloc[i]["Temperature (°C)"]),
            "humidity": float(df.iloc[i]["Relative humidity (%)"]),
            "wind_speed": float(df.iloc[i]["Wind speed (m/s)"]),
            "risk_code": int(prediction),
            "risk_level": risk_mapping[int(prediction)]
        })

    return results