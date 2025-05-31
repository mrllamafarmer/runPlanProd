const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Database setup
const dbPath = path.join(dataDir, 'gpx_routes.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
function initDatabase() {
    db.serialize(() => {
        // Routes table
        db.run(`CREATE TABLE IF NOT EXISTS routes (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            total_distance REAL,
            total_elevation_gain REAL,
            total_elevation_loss REAL,
            start_time TEXT,
            target_time_seconds INTEGER,
            slowdown_factor_percent REAL DEFAULT 0,
            has_valid_time BOOLEAN DEFAULT 0,
            using_target_time BOOLEAN DEFAULT 0,
            gpx_data TEXT
        )`);

        // Waypoints/Legs table
        db.run(`CREATE TABLE IF NOT EXISTS waypoints (
            id TEXT PRIMARY KEY,
            route_id TEXT,
            leg_number INTEGER,
            leg_name TEXT,
            distance_miles REAL,
            cumulative_distance REAL,
            duration_seconds REAL,
            leg_pace_seconds REAL,
            elevation_gain REAL,
            elevation_loss REAL,
            cumulative_elevation_gain REAL,
            cumulative_elevation_loss REAL,
            rest_time_seconds INTEGER DEFAULT 0,
            notes TEXT,
            latitude REAL,
            longitude REAL,
            elevation REAL,
            FOREIGN KEY (route_id) REFERENCES routes (id) ON DELETE CASCADE
        )`);

        // Track points table (for detailed GPS data)
        db.run(`CREATE TABLE IF NOT EXISTS track_points (
            id TEXT PRIMARY KEY,
            route_id TEXT,
            point_number INTEGER,
            latitude REAL,
            longitude REAL,
            elevation REAL,
            timestamp TEXT,
            distance_from_start REAL,
            cumulative_distance REAL,
            FOREIGN KEY (route_id) REFERENCES routes (id) ON DELETE CASCADE
        )`);

        console.log('Database initialized successfully');
    });
}

initDatabase();

// API Routes

// Save a complete route with all data
app.post('/api/routes', (req, res) => {
    const {
        filename,
        totalDistance,
        totalElevationGain,
        totalElevationLoss,
        startTime,
        targetTimeSeconds,
        slowdownFactorPercent,
        hasValidTime,
        usingTargetTime,
        gpxData,
        waypoints,
        trackPoints
    } = req.body;

    const routeId = uuidv4();

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Insert route
        db.run(`INSERT INTO routes (
            id, filename, total_distance, total_elevation_gain, total_elevation_loss,
            start_time, target_time_seconds, slowdown_factor_percent, has_valid_time,
            using_target_time, gpx_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [routeId, filename, totalDistance, totalElevationGain, totalElevationLoss,
         startTime, targetTimeSeconds, slowdownFactorPercent, hasValidTime,
         usingTargetTime, gpxData],
        function(err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }

            // Insert waypoints
            if (waypoints && waypoints.length > 0) {
                const waypointStmt = db.prepare(`INSERT INTO waypoints (
                    id, route_id, leg_number, leg_name, distance_miles, cumulative_distance,
                    duration_seconds, leg_pace_seconds, elevation_gain, elevation_loss,
                    cumulative_elevation_gain, cumulative_elevation_loss, rest_time_seconds,
                    notes, latitude, longitude, elevation
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

                waypoints.forEach((waypoint) => { // index is now waypoint.legNumber from client
                    waypointStmt.run([
                        uuidv4(), 
                        routeId, 
                        waypoint.legNumber, // Use legNumber from client
                        waypoint.legName || `Leg ${waypoint.legNumber}`, // Use legName from client, or default
                        waypoint.distanceMiles,
                        waypoint.cumulativeDistance, 
                        waypoint.durationSeconds,
                        waypoint.legPaceSeconds, 
                        waypoint.elevationGain,
                        waypoint.elevationLoss, 
                        waypoint.cumulativeElevationGain,
                        waypoint.cumulativeElevationLoss, 
                        waypoint.restTimeSeconds || 0,
                        waypoint.notes || '', 
                        waypoint.latitude, 
                        waypoint.longitude,
                        waypoint.elevation
                    ]);
                });
                waypointStmt.finalize();
            }

            // Insert track points
            if (trackPoints && trackPoints.length > 0) {
                const trackStmt = db.prepare(`INSERT INTO track_points (
                    id, route_id, point_number, latitude, longitude, elevation,
                    timestamp, distance_from_start, cumulative_distance
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

                trackPoints.forEach((point, index) => {
                    let isoTimestamp = null;
                    if (point.time) {
                        const dateObj = new Date(point.time);
                        // Check if dateObj is a valid Date instance and not 'Invalid Date'
                        if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
                            isoTimestamp = dateObj.toISOString();
                        }
                    }
                    trackStmt.run([
                        uuidv4(), routeId, index, point.lat, point.lon,
                        point.elevation, isoTimestamp,
                        point.distance, point.cumulativeDistance
                    ]);
                });
                trackStmt.finalize();
            }

            db.run('COMMIT');
            res.json({ routeId, message: 'Route saved successfully' });
        });
    });
});

// Get all routes
app.get('/api/routes', (req, res) => {
    db.all(`SELECT 
        id, filename, upload_date, total_distance, total_elevation_gain,
        total_elevation_loss, start_time, target_time_seconds, slowdown_factor_percent,
        has_valid_time, using_target_time
    FROM routes ORDER BY upload_date DESC`, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Get a specific route with all data
app.get('/api/routes/:id', (req, res) => {
    const routeId = req.params.id;

    db.get('SELECT * FROM routes WHERE id = ?', [routeId], (err, route) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!route) {
            return res.status(404).json({ error: 'Route not found' });
        }

        // Get waypoints
        db.all('SELECT * FROM waypoints WHERE route_id = ? ORDER BY leg_number',
            [routeId], (err, waypoints) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // Get track points
            db.all('SELECT * FROM track_points WHERE route_id = ? ORDER BY point_number',
                [routeId], (err, trackPoints) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                res.json({
                    route,
                    waypoints,
                    trackPoints
                });
            });
        });
    });
});

// Update waypoint notes
app.put('/api/waypoints/:id/notes', (req, res) => {
    const { notes } = req.body;
    const waypointId = req.params.id;

    db.run('UPDATE waypoints SET notes = ? WHERE id = ?', [notes, waypointId], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Waypoint not found' });
        }
        res.json({ message: 'Notes updated successfully' });
    });
});

// Delete a route
app.delete('/api/routes/:id', (req, res) => {
    const routeId = req.params.id;
    console.log(`[DELETE /api/routes/${routeId}] Request received for routeId: ${routeId}`);

    db.serialize(() => {
        console.log(`[DELETE /api/routes/${routeId}] Starting transaction.`);
        db.run('BEGIN TRANSACTION');
        let operationsSuccessful = true;
        let routeFound = false;

        // Delete associated track points
        db.run('DELETE FROM track_points WHERE route_id = ?', [routeId], function(err) {
            if (err) {
                operationsSuccessful = false;
                console.error(`[DELETE /api/routes/${routeId}] Error deleting track_points:`, err.message);
            } else {
                console.log(`[DELETE /api/routes/${routeId}] Deleted track_points for routeId: ${routeId}, changes: ${this.changes}`);
            }
        });

        // Delete associated waypoints
        db.run('DELETE FROM waypoints WHERE route_id = ?', [routeId], function(err) {
            if (err) {
                operationsSuccessful = false;
                console.error(`[DELETE /api/routes/${routeId}] Error deleting waypoints:`, err.message);
            } else {
                console.log(`[DELETE /api/routes/${routeId}] Deleted waypoints for routeId: ${routeId}, changes: ${this.changes}`);
            }
        });

        // Delete the route itself
        db.run('DELETE FROM routes WHERE id = ?', [routeId], function(err) {
            if (err) {
                operationsSuccessful = false;
                console.error(`[DELETE /api/routes/${routeId}] Error deleting route from routes table:`, err.message);
            } else {
                console.log(`[DELETE /api/routes/${routeId}] Deleted route from routes table for routeId: ${routeId}, changes: ${this.changes}`);
                if (this.changes > 0) {
                    routeFound = true;
                }
            }
        });

        const finalAction = operationsSuccessful ? 'COMMIT' : 'ROLLBACK';
        console.log(`[DELETE /api/routes/${routeId}] Attempting to ${finalAction} transaction. operationsSuccessful: ${operationsSuccessful}, routeFound: ${routeFound}`);
        db.run(finalAction, function(err) {
            if (err) {
                // This is a serious error, means commit/rollback failed
                console.error('Transaction commit/rollback error:', err.message);
                return res.status(500).json({ error: 'Transaction failed during commit/rollback.' });
            }
            if (!operationsSuccessful) {
                return res.status(500).json({ error: 'Failed to delete route and/or its associated data.' });
            }
            if (!routeFound && operationsSuccessful) {
                // This case implies associated data might have been deleted (or didn't exist),
                // but the main route entry itself wasn't found. This is effectively a 404.
                return res.status(404).json({ error: 'Route not found, but transaction attempted.' });
            }
            res.json({ message: 'Route and associated data deleted successfully' });
        });
    });
});

// Update an existing route with all data
app.put('/api/routes/:id', (req, res) => {
    const routeId = req.params.id;
    const {
        filename,
        totalDistance,
        totalElevationGain,
        totalElevationLoss,
        startTime,
        targetTimeSeconds,
        slowdownFactorPercent,
        hasValidTime,
        usingTargetTime,
        gpxData,
        waypoints,
        trackPoints
    } = req.body;

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Update route
        db.run(`UPDATE routes SET
            filename = ?, total_distance = ?, total_elevation_gain = ?, total_elevation_loss = ?,
            start_time = ?, target_time_seconds = ?, slowdown_factor_percent = ?, has_valid_time = ?,
            using_target_time = ?, gpx_data = ?
        WHERE id = ?`,
        [filename, totalDistance, totalElevationGain, totalElevationLoss,
         startTime, targetTimeSeconds, slowdownFactorPercent, hasValidTime,
         usingTargetTime, gpxData, routeId],
        function(err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }

            if (this.changes === 0) {
                db.run('ROLLBACK');
                return res.status(404).json({ error: 'Route not found' });
            }

            // Delete existing waypoints and track points
            db.run('DELETE FROM waypoints WHERE route_id = ?', [routeId], function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }

                db.run('DELETE FROM track_points WHERE route_id = ?', [routeId], function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }

                    // Insert new waypoints
                    if (waypoints && waypoints.length > 0) {
                        const waypointStmt = db.prepare(`INSERT INTO waypoints (
                            id, route_id, leg_number, leg_name, distance_miles, cumulative_distance,
                            duration_seconds, leg_pace_seconds, elevation_gain, elevation_loss,
                            cumulative_elevation_gain, cumulative_elevation_loss, rest_time_seconds,
                            notes, latitude, longitude, elevation
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

                        waypoints.forEach((waypoint) => {
                            waypointStmt.run([
                                uuidv4(), 
                                routeId, 
                                waypoint.legNumber,
                                waypoint.legName || `Leg ${waypoint.legNumber}`,
                                waypoint.distanceMiles,
                                waypoint.cumulativeDistance, 
                                waypoint.durationSeconds,
                                waypoint.legPaceSeconds, 
                                waypoint.elevationGain,
                                waypoint.elevationLoss, 
                                waypoint.cumulativeElevationGain,
                                waypoint.cumulativeElevationLoss, 
                                waypoint.restTimeSeconds || 0,
                                waypoint.notes || '', 
                                waypoint.latitude, 
                                waypoint.longitude,
                                waypoint.elevation
                            ]);
                        });
                        waypointStmt.finalize();
                    }

                    // Insert new track points
                    if (trackPoints && trackPoints.length > 0) {
                        const trackStmt = db.prepare(`INSERT INTO track_points (
                            id, route_id, point_number, latitude, longitude, elevation,
                            timestamp, distance_from_start, cumulative_distance
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

                        trackPoints.forEach((point, index) => {
                            let isoTimestamp = null;
                            if (point.time) {
                                const dateObj = new Date(point.time);
                                if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
                                    isoTimestamp = dateObj.toISOString();
                                }
                            }
                            trackStmt.run([
                                uuidv4(), routeId, index, point.lat, point.lon,
                                point.elevation, isoTimestamp,
                                point.distance, point.cumulativeDistance
                            ]);
                        });
                        trackStmt.finalize();
                    }

                    db.run('COMMIT');
                    res.json({ routeId, message: 'Route updated successfully' });
                });
            });
        });
    });
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the application at: http://localhost:${PORT}`);
    console.log(`Access Adminer (DB UI) at: http://localhost:8080`);
    console.log(`Database location: ${dbPath}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});