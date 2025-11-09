import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import stationRoutes from './routes/stationRoutes.js';
import firePersonnelRoutes from './routes/firePersonnelRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import unitRoutes from './routes/unitRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import rankRoutes from './routes/rankRoutes.js';
import superAdminRoutes from './routes/superAdminRoutes.js';
import fireReportRoutes from './routes/fireReportRoutes.js';
import verifyToken from './middleware/verifyToken.js';
import { swaggerUi, specs } from './swagger.js';
import cron from 'node-cron';
import { autoDeactivateUnits } from './controllers/unitController.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

const defaultOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://auth.ekowlabs.space'
];

const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

if (!allowedOrigins.length) {
    allowedOrigins.push(...defaultOrigins);
}

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['Set-Cookie']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Authentication Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', verifyToken, profileRoutes);

// // OTP Routes (public - no auth required)
// app.use('/api/otp', otpRoutes);

// Fire Service Routes
app.use('/api/fire/stations', stationRoutes);
app.use('/api/fire/personnel', firePersonnelRoutes);
app.use('/api/fire/departments', departmentRoutes);
app.use('/api/fire/units', unitRoutes);
app.use('/api/fire/groups', groupRoutes);
app.use('/api/fire/roles', roleRoutes);
app.use('/api/fire/ranks', rankRoutes);
app.use('/api/fire/reports', fireReportRoutes);

// Super Admin routes (mixed - some public, some protected)
// The routes file handles which ones need auth
app.use('/api/super-admin', superAdminRoutes);

/**
 * @swagger
 * /api/fire/stations:
 *   post:
 *     summary: Create a new fire station (with intelligent upsert)
 *     tags: [Stations]
 *     description: Creates a new fire station or updates existing one if duplicate detected. Uses coordinates, location, or phone number for duplicate detection.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StationCreateRequest'
 *           examples:
 *             complete_station:
 *               summary: Complete station data
 *               value:
 *                 name: "Accra Central Fire Station"
 *                 call_sign: "ACFS-001"
 *                 location: "Central Business District, Accra"
 *                 location_url: "https://maps.google.com/?q=5.6037,-0.1870"
 *                 coordinates:
 *                   latitude: 5.6037
 *                   longitude: -0.1870
 *                 region: "Greater Accra"
 *                 phone_number: "+233302123456"
 *             minimal_station:
 *               summary: Minimal station data
 *               value:
 *                 name: "Test Station"
 *                 location: "Test Location"
 *     responses:
 *       201:
 *         description: Station created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StationResponse'
 *       200:
 *         description: Station updated or skipped
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StationResponse'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   get:
 *     summary: Get all fire stations
 *     tags: [Stations]
 *     description: Retrieve all fire stations with optional region filtering
 *     parameters:
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: Filter stations by region
 *         example: "Greater Accra"
 *     responses:
 *       200:
 *         description: List of fire stations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: number
 *                   example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Station'
 *
 * @swagger
 * /api/fire/stations/bulk:
 *   post:
 *     summary: Bulk create/update fire stations
 *     tags: [Stations]
 *     description: Create or update multiple fire stations in one request. Each station is processed individually with upsert logic.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StationBulkRequest'
 *           examples:
 *             bulk_stations:
 *               summary: Multiple stations
 *               value:
 *                 stations:
 *                   - name: "Accra Central Fire Station"
 *                     location: "Central Business District, Accra"
 *                     coordinates:
 *                       latitude: 5.6037
 *                       longitude: -0.1870
 *                     phone_number: "+233302123456"
 *                   - name: "Kumasi Fire Station"
 *                     location: "Central Kumasi"
 *                     coordinates:
 *                       latitude: 6.6885
 *                       longitude: -1.6244
 *                     phone_number: "+233322123456"
 *     responses:
 *       200:
 *         description: Bulk operation completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StationBulkResponse'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * @swagger
 * /api/fire/stations/{id}:
 *   get:
 *     summary: Get fire station by ID
 *     tags: [Stations]
 *     description: Retrieve a specific fire station by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Station ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Fire station details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Station'
 *       400:
 *         description: Invalid station ID format
 *       404:
 *         description: Station not found
 *   put:
 *     summary: Update fire station
 *     tags: [Stations]
 *     description: Update an existing fire station
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Station ID
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StationCreateRequest'
 *     responses:
 *       200:
 *         description: Station updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Station updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Station'
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Station not found
 *   delete:
 *     summary: Delete fire station
 *     tags: [Stations]
 *     description: Delete a fire station by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Station ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Station deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Station deleted successfully"
 *       400:
 *         description: Invalid station ID format
 *       404:
 *         description: Station not found
 *
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     description: Check if the authentication backend service is running and healthy
 *     responses:
 *       200:
 *         description: Service is healthy and running
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
app.get('/api/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        message: 'Auth backend is running',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.send('Server running');
});


// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log('✅ MongoDB connected successfully');
    
    // Schedule automatic unit deactivation at 8 AM daily
    // Cron format: minute hour day month weekday
    // "0 8 * * *" = 8:00 AM every day
    cron.schedule('0 8 * * *', async () => {
        console.log('⏰ Scheduled task: Running automatic unit deactivation...');
        try {
            await autoDeactivateUnits();
        } catch (error) {
            console.error('❌ Scheduled task error:', error);
        }
    }, {
        timezone: "Africa/Accra" // Ghana timezone (GMT+0)
    });
    
    console.log('✅ Scheduled task configured: Auto-deactivate units daily at 8:00 AM (GMT+0)');
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📍 Local: http://localhost:${PORT}`);
        console.log(`🌐 Network: http://0.0.0.0:${PORT}`);
        console.log(`📱 API Base: http://localhost:${PORT}/api`);
        console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
    });
}).catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    console.error('🔍 Check your MONGODB_URI environment variable');
    process.exit(1);
});
