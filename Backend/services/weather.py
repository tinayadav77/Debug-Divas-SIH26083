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
            "wind_speed": None
        }

    coordinates = LOCATIONS[location_key]

    url = "https://api.open-meteo.com/v1/forecast"

    params = {
        "latitude": coordinates["latitude"],
        "longitude": coordinates["longitude"],
        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m",
        "timezone": "Asia/Kolkata"
    }

    response = requests.get(url, params=params)
    response.raise_for_status()

    current = response.json()["current"]

    return {
        "temperature": current["temperature_2m"],
        "humidity": current["relative_humidity_2m"],
        "wind_speed": current["wind_speed_10m"]
    }