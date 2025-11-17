import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { io as ioClient } from 'socket.io-client';
import EmergencyAlert from '../models/EmergencyAlert.js';
import User from '../models/User.js';
import FirePersonnel from '../models/FirePersonnel.js';
import Station from '../models/Station.js';
import Department from '../models/Department.js';
import Unit from '../models/Unit.js';
import Incident from '../models/Incident.js';
import { createEmergencyAlertService } from '../services/emergencyAlertService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Interval in milliseconds (2 minutes = 120000 ms)
const INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

// Function to convert MongoDB export format to regular objects
function convertMongoDBFormat(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => convertMongoDBFormat(item));
    }
    
    if (typeof obj === 'object') {
        // Handle $oid
        if (obj.$oid) {
            return new mongoose.Types.ObjectId(obj.$oid);
        }
        
        // Handle $date
        if (obj.$date) {
            return new Date(obj.$date);
        }
        
        // Recursively convert nested objects
        const converted = {};
        for (const key in obj) {
            converted[key] = convertMongoDBFormat(obj[key]);
        }
        return converted;
    }
    
    return obj;
}

// Function to sleep/delay
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function createAlertsWithInterval() {
    let socket = null;
    
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Connect to main server's Socket.IO as a client
        const MAIN_SERVER_PORT = process.env.PORT || 8080;
        const MAIN_SERVER_URL = process.env.SERVER_URL || `http://localhost:${MAIN_SERVER_PORT}`;
        
        console.log(`🔌 Connecting to main server's WebSocket at: ${MAIN_SERVER_URL}`);
        socket = ioClient(MAIN_SERVER_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });

        // Wait for connection
        await new Promise((resolve, reject) => {
            socket.on('connect', () => {
                console.log('✅ Connected to main server WebSocket');
                console.log(`   Socket ID: ${socket.id}`);
                resolve();
            });

            socket.on('connect_error', (error) => {
                console.error('❌ Failed to connect to main server WebSocket:', error.message);
                console.error('   Make sure the main server is running on port', MAIN_SERVER_PORT);
                reject(error);
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                if (!socket.connected) {
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });

        // Read the JSON file
        const jsonPath = path.join(__dirname, '..', 'ai-db.firereports.json');
        const jsonData = fs.readFileSync(jsonPath, 'utf8');
        const rawData = JSON.parse(jsonData);

        console.log(`📄 Found ${rawData.length} records in JSON file`);
        console.log(`⏱️  Will create alerts with ${INTERVAL_MS / 1000 / 60} minute intervals`);
        console.log(`📡 Using main server's WebSocket connection`);
        console.log(`🔗 Frontend should connect to: ${MAIN_SERVER_URL}\n`);

        // Convert MongoDB format to regular objects
        const alertsData = convertMongoDBFormat(rawData);

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        // Process each alert one by one with intervals
        for (let i = 0; i < alertsData.length; i++) {
            const alertData = alertsData[i];
            
            try {
                console.log(`\n📋 Processing alert ${i + 1}/${alertsData.length}`);
                console.log(`   Incident: ${alertData.incidentName || 'N/A'}`);
                console.log(`   Type: ${alertData.incidentType || 'N/A'}`);

                // Check if alert already exists
                const existingAlert = await EmergencyAlert.findById(alertData._id);
                if (existingAlert) {
                    console.log(`   ⏭️  Skipping - alert ${alertData._id} already exists`);
                    skipCount++;
                    
                    // Still wait before next iteration
                    if (i < alertsData.length - 1) {
                        console.log(`   ⏳ Waiting ${INTERVAL_MS / 1000 / 60} minutes before next alert...`);
                        await sleep(INTERVAL_MS);
                    }
                    continue;
                }

                // Get any available user for reporter
                let reporterId = alertData.userId || alertData.reporterId;
                
                if (!reporterId) {
                    const anyUser = await User.findOne();
                    if (anyUser) {
                        reporterId = anyUser._id;
                        console.log(`   ℹ️  Using first available user as reporter: ${reporterId}`);
                    } else {
                        console.log(`   ⚠️  No users found, skipping alert creation`);
                        errorCount++;
                        if (i < alertsData.length - 1) {
                            console.log(`   ⏳ Waiting ${INTERVAL_MS / 1000 / 60} minutes before next alert...`);
                            await sleep(INTERVAL_MS);
                        }
                        continue;
                    }
                }

                // Get any available station
                let station = alertData.station;
                
                if (!station) {
                    const anyStation = await Station.findOne();
                    if (anyStation) {
                        station = anyStation._id;
                        console.log(`   ℹ️  Using first available station: ${station}`);
                    } else {
                        console.log(`   ⚠️  No stations found, skipping alert creation`);
                        errorCount++;
                        if (i < alertsData.length - 1) {
                            console.log(`   ⏳ Waiting ${INTERVAL_MS / 1000 / 60} minutes before next alert...`);
                            await sleep(INTERVAL_MS);
                        }
                        continue;
                    }
                }

                // Prepare alert data for service function
                const alertDataForService = {
                    incidentType: alertData.incidentType,
                    incidentName: alertData.incidentName,
                    location: alertData.location,
                    station: station,
                    userId: reporterId,
                    description: alertData.description,
                    estimatedCasualties: alertData.estimatedCasualties,
                    estimatedDamage: alertData.estimatedDamage,
                    priority: alertData.priority || 'high'
                };

                // Use the service function to create the alert (skip WebSocket emission - we'll handle it via socket client)
                console.log(`   🔄 Creating alert using service function...`);
                const result = await createEmergencyAlertService(alertDataForService, { emitWebSocket: false });
                
                if (!result.success) {
                    console.log(`   ❌ Failed to create alert: ${result.error.message}`);
                    if (result.error.stationStatus) {
                        console.log(`   📊 Station Status:`, result.error.stationStatus);
                    }
                    errorCount++;
                    
                    // Still wait before next iteration
                    if (i < alertsData.length - 1) {
                        console.log(`   ⏳ Waiting ${INTERVAL_MS / 1000 / 60} minutes before next alert...`);
                        await sleep(INTERVAL_MS);
                    }
                    continue;
                }

                const emergencyAlert = result.data;
                console.log(`   ✅ Alert created successfully: ${emergencyAlert._id}`);
                console.log(`   📅 Created at: ${emergencyAlert.createdAt}`);
                console.log(`   📅 Updated at: ${emergencyAlert.updatedAt}`);

                // Handle WebSocket broadcasting via socket client connection
                if (result.webSocketInfo && result.webSocketInfo.shouldEmit && socket && socket.connected) {
                    try {
                        const socketService = await import('../services/socketService.js');
                        const { payload, stationId } = socketService.formatAlertPayload(emergencyAlert);
                        
                        if (result.webSocketInfo.hasActiveIncident && result.webSocketInfo.activeIncident) {
                            // Send active incident notification
                            socket.emit('server:broadcast_active_incident', {
                                alert: payload,
                                activeIncident: result.webSocketInfo.activeIncident,
                                stationId: stationId,
                                message: 'This station has an active incident. Would you like to refer or accept this new alert?',
                                requiresAction: true
                            });
                            console.log(`   📡 Sent active_incident_exists notification to main server`);
                        } else {
                            // Send regular alert notification
                            socket.emit('server:broadcast_alert', { ...payload, stationId });
                            console.log(`   📡 Sent alert notification to main server for broadcasting`);
                        }
                    } catch (socketError) {
                        console.error(`   ⚠️  Failed to send WebSocket notification: ${socketError.message}`);
                    }
                } else if (!socket || !socket.connected) {
                    console.log(`   ⚠️  Socket not connected, skipping WebSocket broadcast`);
                }

                successCount++;
                console.log(`   ✅ Successfully processed alert ${i + 1}/${alertsData.length}`);

                // Wait before next alert (except for the last one)
                if (i < alertsData.length - 1) {
                    const nextAlertTime = new Date(Date.now() + INTERVAL_MS);
                    console.log(`   ⏳ Waiting ${INTERVAL_MS / 1000 / 60} minutes before next alert...`);
                    console.log(`   ⏰ Next alert will be created at: ${nextAlertTime.toLocaleString()}`);
                    console.log(`   📡 Make sure your frontend is connected to: http://localhost:${MAIN_SERVER_PORT}\n`);
                    await sleep(INTERVAL_MS);
                } else {
                    console.log(`\n   ✅ All alerts processed!`);
                }

            } catch (error) {
                console.error(`   ❌ Error creating alert ${alertData._id}:`, error.message);
                errorCount++;
                
                // Still wait before next iteration
                if (i < alertsData.length - 1) {
                    console.log(`   ⏳ Waiting ${INTERVAL_MS / 1000 / 60} minutes before next alert...`);
                    await sleep(INTERVAL_MS);
                }
            }
        }

        console.log('\n📊 Summary:');
        console.log(`   ✅ Successfully created: ${successCount}`);
        console.log(`   ⏭️  Skipped (already exists): ${skipCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log(`   📝 Total processed: ${alertsData.length}`);

        // Close socket connection and database connection
        if (socket && socket.connected) {
            socket.disconnect();
            console.log('\n✅ Socket connection closed');
        }
        await mongoose.connection.close();
        console.log('✅ Database connection closed');
        process.exit(0);

    } catch (error) {
        console.error('❌ Script error:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n⚠️  Script interrupted by user. Cleaning up...');
    await mongoose.connection.close();
    process.exit(0);
});

// Run the script
console.log('🚀 Starting emergency alert creation with intervals...\n');
createAlertsWithInterval();

