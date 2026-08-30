def generate_recommendations(risk_data):

    level = risk_data.get("level")

    recommendations = {
        "LOW": [
            "Outdoor activity is generally safe.",
            "Stay hydrated throughout the day.",
            "Continue monitoring weather conditions."
        ],

        "MODERATE": [
            "Stay hydrated and take regular breaks.",
            "Avoid unnecessary prolonged exposure to heat.",
            "Monitor yourself for signs of heat stress."
        ],

        "HIGH": [
            "Limit prolonged outdoor exposure.",
            "Drink water frequently.",
            "Take regular breaks in a cool or shaded area.",
            "Avoid strenuous activity during peak heat."
        ],

        "VERY HIGH": [
            "Avoid strenuous outdoor activity where possible.",
            "Stay in a cool or shaded environment.",
            "Drink water frequently and take frequent cooling breaks.",
            "Closely monitor vulnerable individuals and outdoor workers."
        ],

        "EXTREME": [
            "Avoid outdoor activity unless absolutely necessary.",
            "Stay in a cool environment.",
            "Hydrate frequently.",
            "Check on vulnerable individuals and outdoor workers.",
            "Seek medical assistance if serious heat-stress symptoms occur."
        ]
    }

    return recommendations.get(
        level,
        ["Risk information is currently unavailable."]
    )