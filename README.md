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
- **User Authentication**: Secure multi-user support with JWT-based authentication

### Race Analysis
- **GPX Comparison**: Upload actual race GPX files and compare against planned routes
- **Performance Analysis**: Detailed waypoint-by-waypoint comparison of planned vs actual times
- **Pace Analysis**: Compare planned and actual paces for each route segment
- **Save & Load Analysis**: Store race analyses for future reference and improvement

### Export Options
- **CSV Export**: Detailed waypoint data for spreadsheet analysis
- **PDF Export**: Professional route plans with elevation charts, waypoint tables, and route summaries
- **Print-Ready Formats**: Clean layouts suitable for race day reference

## Technology Stack

### Backend
- **Python FastAPI** framework with JWT authentication
- **PostgreSQL** database with function-based operations
- **RESTful API** with comprehensive error handling and logging
- **Structured logging** with rotation and monitoring

### Frontend
- **React with TypeScript** for modern component-based architecture
- **Zustand** for state management
- **Tailwind CSS** for responsive design
- **React-Leaflet** for interactive mapping and route visualization
- **Recharts** for elevation profile charts

### Infrastructure
- **Docker** containerization for easy deployment
- **Docker Compose** for development environment
- **PostgreSQL** with persistent volume storage
- **Multi-stage Docker builds** for optimized production images

## Getting Started

### Using Docker (Recommended)
```bash
# Clone the repository
git clone https://github.com/mrllamafarmer/runPlanPrototype.git
cd runPlanPrototype

# Start the application
docker-compose up -d

# Access the application
open http://localhost
```

### Environment Setup
The application uses environment variables for configuration. Default values are provided in the Docker Compose file for development.

### Database Migrations
When deploying updates that include database changes, run the migration script:

```bash
# Run database migrations
./scripts/run-migrations.sh
```

This script will:
- Check if the database container is running
- Apply any new migration files in order
- Provide clear feedback on migration status

### Manual Database Updates
If you prefer to run migrations manually:

```bash
# Run all migrations
docker-compose exec -T database psql -U runplan_user -d runplanprod < backend/database/migrations/001_fix_race_analysis_detail_function.sql

# Or reload all database functions
docker-compose exec database psql -U runplan_user -d runplanprod -c "$(cat backend/database/functions/race_analysis_functions.sql)"
```

## Usage

### Route Planning
1. **Create Account**: Register and log in to access route planning features
2. **Upload a GPX File**: Drag and drop or use the "Choose GPX File" button
3. **Review Route Data**: Check distance, elevation, and track points
4. **Add Waypoints**: Create custom stops along your route with types (start, checkpoint, finish, POI)
5. **Set Target Time**: Plan your pacing strategy with elevation-adjusted calculations
6. **Configure Rest Times**: Add planned stops at waypoints
7. **Save Route**: Store your analysis for future reference

### Race Analysis
1. **Load Saved Route**: Select a previously saved route plan
2. **Upload Race GPX**: Upload your actual race GPX file
3. **Compare Performance**: View detailed comparison of planned vs actual performance
4. **Analyze Pacing**: Review pace differences for each route segment
5. **Save Analysis**: Store race analysis for future review and improvement
6. **Load Previous Analysis**: Access and review past race performances

### Data Management
- **Load Saved Routes**: Access previously planned routes
- **Load Race Analyses**: Review past race performance comparisons
- **Delete Data**: Remove unwanted routes or analyses

## File Support

- Standard GPX files from GPS devices
- GPX exports from Strava, Garmin Connect, and similar apps
- Route files from mapping software like Gaia GPS or AllTrails
- Both route planning GPX files and actual race tracking GPX files

## Development

### Project Structure
```
├── backend/                 # Python FastAPI backend
│   ├── api/                # API endpoints
│   ├── database/           # Database functions and migrations
│   │   ├── functions/      # PostgreSQL functions
│   │   └── migrations/     # Database migration scripts
│   └── models/             # Data models
├── frontend/               # React TypeScript frontend
│   └── src/
│       ├── components/     # React components
│       ├── services/       # API services
│       └── stores/         # Zustand state management
├── scripts/                # Utility scripts
│   └── run-migrations.sh   # Database migration runner
└── docker-compose.yml      # Development environment
```

### Database Migrations
Database schema changes are managed through migration files:

1. **Create Migration**: Add new `.sql` files to `backend/database/migrations/`
2. **Number Migrations**: Use format `001_description.sql`, `002_description.sql`, etc.
3. **Run Migrations**: Use `./scripts/run-migrations.sh` to apply changes
4. **Production Deployment**: Always run migrations after pulling updates

### Testing
- Backend tests: `docker-compose exec backend pytest`
- Frontend tests: `docker-compose exec frontend npm test`

## Deployment

### Production Checklist
1. Pull latest changes: `git pull origin main`
2. Run database migrations: `./scripts/run-migrations.sh`
3. Restart services: `docker-compose restart`
4. Verify health checks: Check `/health` endpoint

### Environment Variables
Configure these for production deployment:
- Database credentials
- JWT secret keys
- CORS origins
- Log levels

## License

MIT License - see LICENSE file for details
