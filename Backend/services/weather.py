import requests


LOCATIONS = {
    "vijayawada": {
        "latitude": 16.5062,
        "longitude": 80.6480
    },
    "ainavolu": {
        "latitude": 16.4873,
        "longitude": 80.50329
    }
}


def get_weather(location: str):

    location_key = location.lower()

    if location_key not in LOCATIONS:
        return {
            "temperature": None,
            "humidity": None,
            "wind_speed": None,
            "solar_radiation": None,
            "pressure": None,
            "dew_point": None,
            "timestamp": None
        }

    coordinates = LOCATIONS[location_key]

    url = "https://api.open-meteo.com/v1/forecast"

    params = {
        "latitude": coordinates["latitude"],
        "longitude": coordinates["longitude"],
        "current": (
            "temperature_2m,"
            "relative_humidity_2m,"
            "wind_speed_10m,"
            "shortwave_radiation,"
            "pressure_msl,"
            "dew_point_2m"
        ),
        "wind_speed_unit": "ms",
        "timezone": "Asia/Kolkata"
    }

    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()

    current = response.json()["current"]

    return {
        "temperature": current["temperature_2m"],
        "humidity": current["relative_humidity_2m"],
        "wind_speed": current["wind_speed_10m"],
        "solar_radiation": current["shortwave_radiation"],
        "pressure": current["pressure_msl"],
        "dew_point": current["dew_point_2m"],
        "timestamp": current["time"]
    }