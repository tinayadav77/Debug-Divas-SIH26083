import math


def calculate_thermal_stress(weather_data):

    temperature = weather_data.get("temperature")
    humidity = weather_data.get("humidity")
    wind_speed = weather_data.get("wind_speed")
    solar_radiation = weather_data.get("solar_radiation")

    if any(value is None for value in [
        temperature,
        humidity,
        wind_speed,
        solar_radiation
    ]):
        return {
            "index": None,
            "level": None
        }

    # Estimate natural wet-bulb temperature
    # Stull (2011) approximation
    twb = (
        temperature * math.atan(0.151977 * math.sqrt(humidity + 8.313659))
        + math.atan(temperature + humidity)
        - math.atan(humidity - 1.676331)
        + 0.00391838 * humidity ** 1.5
        * math.atan(0.023101 * humidity)
        - 4.686035
    )

    # Estimate globe temperature from air temperature
    # and solar radiation.
    solar_effect = 0.02 * solar_radiation

    tg = temperature + solar_effect

    # Outdoor WBGT
    wbgt = (
        0.7 * twb
        + 0.2 * tg
        + 0.1 * temperature
    )

    # Risk thresholds used by the project
    if wbgt < 27:
        level = "LOW"
    elif wbgt < 29:
        level = "MODERATE"
    elif wbgt < 31:
        level = "HIGH"
    elif wbgt < 33:
        level = "VERY HIGH"
    else:
        level = "EXTREME"

    return {
        "index": round(wbgt, 2),
        "level": level
    }