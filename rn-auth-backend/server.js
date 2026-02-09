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
import stationAdminRoutes from './routes/stationAdminRoutes.js';
import departmentAdminRoutes from './routes/departmentAdminRoutes.js';
import unitAdminRoutes from './routes/unitAdminRoutes.js';
import emergencyAlertRoutes from './routes/emergencyAlertRoutes.js';
import incidentRoutes from './routes/incidentRoutes.js';
import referralRoutes from './routes/referralRoutes.js';
import turnoutSlipRoutes from './routes/turnoutSlipRoutes.js';
import verifyToken from './middleware/verifyToken.js';
import { swaggerUi, specs } from './swagger.js';

dotenv.config();
const app = express();

// CORS configuration
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://gnfs.ekowlabs.space',
        'https://auth.ekowlabs.space'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    optionsSuccessStatus: 200
}));
app.use(express.json());

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Authentication Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', verifyToken, profileRoutes);

// Fire Service Routes
app.use('/api/fire/stations', stationRoutes);
app.use('/api/fire/personnel', firePersonnelRoutes);
app.use('/api/fire/departments', departmentRoutes);
app.use('/api/fire/units', unitRoutes);
app.use('/api/fire/groups', groupRoutes);
app.use('/api/fire/roles', roleRoutes);
app.use('/api/fire/ranks', rankRoutes);
app.use('/api/emergency/alerts', emergencyAlertRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/turnout-slips', turnoutSlipRoutes);

// Admin routes
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/station-admin', stationAdminRoutes);
app.use('/api/department-admin', departmentAdminRoutes);
app.use('/api/unit-admin', unitAdminRoutes);

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

// MongoDB connection with caching for serverless
let isConnected = false;

const connectDB = async () => {
    if (isConnected) {
        return;
    }
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        isConnected = true;
        console.log('✅ MongoDB connected successfully');
    } catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
        throw err;
    }
};

// Connect to MongoDB on first request
app.use(async (req, res, next) => {
    if (!isConnected) {
        await connectDB();
    }
    next();
});

// Vercel serverless export
export default app;

// Local development server (not used on Vercel)
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
}
