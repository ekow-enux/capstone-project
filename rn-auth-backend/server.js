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
import emergencyAlertRoutes from './routes/emergencyAlertRoutes.js';
import incidentRoutes from './routes/incidentRoutes.js';
import referralRoutes from './routes/referralRoutes.js';
import verifyToken from './middleware/verifyToken.js';
import { swaggerUi, specs } from './swagger.js';
import cron from 'node-cron';
import { autoDeactivateUnits } from './controllers/unitController.js';
import { initializeSocket } from './services/socketService.js';
import { createServer } from 'http';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server for Socket.IO
const httpServer = createServer(app);

app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001','https://gnfs.ekowlabs.space'],
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
app.use('/api/emergency/alerts', emergencyAlertRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/referrals', referralRoutes);

// Super Admin routes (mixed - some public, some protected)
// The routes file handles which ones need auth
app.use('/api/super-admin', superAdminRoutes);

// Station Admin routes (mixed - some public, some protected)
// The routes file handles which ones need auth
app.use('/api/station-admin', stationAdminRoutes);

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
    
    // Initialize Socket.IO
    initializeSocket(httpServer);
    
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
    
    httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📍 Local: http://localhost:${PORT}`);
        console.log(`🌐 Network: http://0.0.0.0:${PORT}`);
        console.log(`📱 API Base: http://localhost:${PORT}/api`);
        console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
        console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    console.error('🔍 Check your MONGODB_URI environment variable');
    process.exit(1);
});
