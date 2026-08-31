from fastapi import FastAPI
from schemas import DashboardResponse

from fastapi.middleware.cors import CORSMiddleware
from services.weather import get_weather
from services.thermal import calculate_thermal_stress
from services.recommendation import generate_recommendations
from services.forecast import get_forecast
app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "SIH Backend is running!"}


@app.get("/health")
def health():
    return {"status": "ok"}
@app.get("/dashboard/{location}", response_model=DashboardResponse)
def dashboard(location: str):

    weather = get_weather(location)

    thermal = calculate_thermal_stress(weather)

    risk = {
    "score": thermal["index"],
    "level": thermal["level"],
    "confidence": None
}

    recommendations = generate_recommendations(risk)

    return {
        "location": location,
        "weather": weather,
        "thermal_stress": thermal,
        "risk": risk,
        "recommendations": recommendations
    }
@app.get("/forecast/{location}")
def forecast(location: str):
    return {
        "location": location,
        "forecast": get_forecast(location)
    }