# GPX Route Analyzer

A web-based application for planning and analyzing GPS routes for running, hiking, and other outdoor activities. Upload GPX files to create detailed pace plans with waypoints, elevation profiles, and exportable route summaries.

## Features

### Route Analysis
- **GPX File Processing**: Upload GPX files from GPS devices, running apps, and mapping software
- **Elevation Profile Visualization**: Interactive elevation charts showing route terrain
- **Interactive Map**: Route visualization with waypoints and elevation markers using Leaflet.js
- **Route Statistics**: Total distance, elevation gain/loss, and track point analysis

### Pace Planning
- **Target Time Planning**: Set goal finish times with automatic pace calculations
- **Variable Pace Modeling**: Configure pace slowdown factors for realistic race planning
- **Custom Waypoints**: Add strategic waypoints for water stops, aid stations, or key landmarks
- **Rest Time Calculation**: Plan for breaks and stops along the route

### Route Management
- **Save & Load Routes**: Persistent storage of analyzed routes with all settings
- **Route Editing**: Update existing route plans without losing previous work
- **Visual Editing Indicators**: Clear feedback when modifying saved routes

### Export Options
- **CSV Export**: Detailed waypoint data for spreadsheet analysis
- **PDF Export**: Professional route plans with elevation charts, waypoint tables, and route summaries
- **Print-Ready Formats**: Clean layouts suitable for race day reference

## Technology Stack

### Backend
- **Node.js** with Express.js framework
- **SQLite** database for route storage and waypoint data
- **RESTful API** for route management operations

### Frontend
- **Vanilla HTML/CSS/JavaScript** - no frameworks, fast loading
- **Leaflet.js** for interactive mapping and route visualization
- **Chart.js** for elevation profile charts
- **jsPDF** for client-side PDF generation

### Infrastructure
- **Docker** containerization for easy deployment
- **Docker Compose** for development environment
- **Volume mounting** for persistent database storage

## Getting Started

### Using Docker (Recommended)
```bash
# Clone the repository
git clone https://github.com/mrllamafarmer/runPlanPrototype.git
cd runPlanPrototype

# Start the application
docker-compose up -d

# Access the application
open http://localhost:3450
```

### Manual Setup
```bash
# Install dependencies
npm install

# Start the server
npm start

# Access the application
open http://localhost:3450
```

## Usage

1. **Upload a GPX File**: Drag and drop or use the "Choose GPX File" button
2. **Review Route Data**: Check distance, elevation, and track points
3. **Add Waypoints**: Create custom stops along your route
4. **Set Target Time** (optional): Plan your pacing strategy
5. **Save Route**: Store your analysis for future reference
6. **Export**: Generate CSV or PDF reports for race day

## File Support

- Standard GPX files from GPS devices
- GPX exports from Strava, Garmin Connect, and similar apps
- Route files from mapping software like Gaia GPS or AllTrails

## License

MIT License - see LICENSE file for details
