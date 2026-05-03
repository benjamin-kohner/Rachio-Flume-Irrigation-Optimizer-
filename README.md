# Rachio/Flume Irrigation Optimizer

Welcome to the Rachio/Flume Irrigation Optimizer. This application is a dashboard to aggregate data from Flume and Rachio, calculate flow rates, analyze efficiency, and log manual screwdriver tests for optimal watering. By correlating discrete cycle events from Rachio with minute-by-minute telemetry from Flume, the system can accurately isolate each zone's true Gallons Per Minute (GPM).

## Live Demo
Check out the live version of the app here: **[Rachio/Flume Irrigation Optimizer Live App](https://rachio-flume-irrigation-optimizer-1073165315355.us-west1.run.app)**

## Features
- **Data Correlation**: Matches Rachio cycle and soak events precisely to Flume minute-by-minute flow data.
- **Efficiency Analysis**: Calculates true GPM (gallons per minute) to help spot leaks, oversized nozzles, or dry spots.
- **AI-Powered Insights**: Generates actionable lawn care and irrigation insights by combining weekly/monthly water usage with physical "screwdriver test" records.
- **Screwdriver Test Logging**: A dedicated interface to record manual moisture and soil depth findings for each zone.

## Running Locally

To run this project locally on your machine:

1. Clone the repository.
2. Install the necessary dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables by copying `.env.example` to `.env` and providing the required strings (you will need a Gemini API key for the insights generation to work).
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Navigate to `http://localhost:3000` to view the app. You can then configure your Rachio and Flume API credentials securely via the settings menu in the UI.
