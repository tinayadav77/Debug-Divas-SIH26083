# HeatShield 🔥

### Smart Heat Stress Monitoring and Risk Prediction System

HeatShield is a web-based heat-stress monitoring system developed for **Smart India Hackathon 2026 – Problem Statement SIH26083**.

It combines weather data, thermal stress calculation, risk classification, recommendations, and forecast information into a single dashboard to help users understand heat-related risks.

## 🚀 Features

- 🌡️ Live weather information
- 🔥 Thermal stress index calculation
- ⚠️ Heat-risk classification
- 💧 Personalized safety recommendations
- 📊 Interactive dashboard
- 🌤️ Weather forecast
- 🔌 Frontend–backend API integration

## 🏗️ Project Structure

```text
SIH2026/
│
├── Backend/
│   ├── main.py
│   ├── schemas.py
│   ├── services/
│   │   ├── weather.py
│   │   ├── thermal.py
│   │   ├── recommendation.py
│   │   └── forecast.py
│   ├── data/
│   └── .gitignore
│
├── Frontend/
│   ├── index.html
│   └── Final.js
│
└── README.md

## Techonologies Used
Frontend
    - HTML
    - CSS
    - JavaScript
Backend
    - Python
    - FastAPI
    - Uvicorn
    - Pandas
DATA
    - Weather Data
    - Forecast Data
    - Thermak Stress Calculation

## API Endpoints
Endpoint               Purpose
/                      Backend Status
/health                Health check
/dashboard/{location}  Weather, thermal stress and recommendations
/forecast/{location}   Forecast Information

## How to run the project
   ## Start the Backend
        Open a terminal in the project root:
           cd Backend
        Activate the virtual environment: 
           .\.venv\Scripts\Activate.ps1
        Start FastAPI:
            uvicorn main:app --reload
        Backend:
            http://127.0.0.1:8000
   ## Start the frontend
        Open a second terminal and run the frontend using your local development server.
        Frontend:
            http://127.0.0.1:5500


## System Flow:

Frontend
   ↓
FastAPI Backend
   ↓
Weather Data
   ↓
Thermal Stress Calculation
   ↓
Risk Classification
   ↓
Recommendations
   ↓
Dashboard

## TEAM:
DEBUG DIVAS
    -Developed as part of Smart India Hackathon 2026.
Problem Statement:
    -SIH26083

##OBJECTIVE:
    - The objective of HeatShield is to provide an accessible system for monitoring heat stress and communicating heat-related risks so that users can take timely preventive action