import xgboost as xgb
import joblib

model = xgb.XGBClassifier()
model.load_model("models/heat_stress_xgb_model.json")

feature_order = joblib.load("models/feature_order.pkl")

print("JSON model loaded successfully!")
print("Feature order:")
print(feature_order)