from pydantic import BaseModel
from typing import Optional


class WeatherData(BaseModel):
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    wind_speed: Optional[float] = None


class ThermalStress(BaseModel):
    index: Optional[float] = None
    level: Optional[str] = None


class RiskData(BaseModel):
    score: Optional[float] = None
    level: Optional[str] = None
    confidence: Optional[float] = None


class DashboardResponse(BaseModel):
    location: str
    weather: WeatherData
    thermal_stress: ThermalStress
    risk: RiskData
    recommendations: list[str]
    