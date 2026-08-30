import joblib
import xgboost as xgb
import pandas as pd


# Load trained XGBoost model
model = xgb.XGBClassifier()
model.load_model("models/heat_stress_xgb_model.json")

# Load the exact feature order used during training
feature_order = joblib.load("models/feature_order.pkl")


RISK_LEVELS = {
    0: "LOW",
    1: "MODERATE",
    2: "HIGH",
    3: "VERY HIGH",
    4: "EXTREME"
}


def predict_risk(weather_data, thermal_data):

    # Current weather alone does not contain all 12 model features.
    # These additional values are currently supplied by the forecast/data pipeline.
    required_features = [
        "Temperature",
        "Relative humidity",
        "Wind speed",
        "Solar radiation",
        "Pressure",
        "Precipitation",
        "Cloud cover",
        "Population density",
        "Outdoor worker population",
        "hour",
        "day",
        "month"
    ]

    # For now, return a clear response rather than making an
    # incorrect prediction from incomplete live data.
    if not all([
        weather_data.get("temperature") is not None,
        weather_data.get("humidity") is not None,
        weather_data.get("wind_speed") is not None
    ]):
        return {
            "score": None,
            "level": None,
            "confidence": None
        }

    return {
        "score": None,
        "level": None,
        "confidence": None
    }