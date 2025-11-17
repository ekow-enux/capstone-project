import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import EmergencyAlert from '../models/EmergencyAlert.js';
import User from '../models/User.js';
import FirePersonnel from '../models/FirePersonnel.js';
import Station from '../models/Station.js';
import Department from '../models/Department.js';
import Unit from '../models/Unit.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function seedEmergencyAlerts() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Read the JSON file
        const jsonPath = path.join(__dirname, '..', 'ai-db.firereports.json');
        const jsonData = fs.readFileSync(jsonPath, 'utf8');
        const rawData = JSON.parse(jsonData);

        console.log(`📄 Found ${rawData.length} records in JSON file`);

        // Convert MongoDB format to regular objects
        const alertsData = convertMongoDBFormat(rawData);

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        // Process each alert
        for (const alertData of alertsData) {
            try {
                // Check if alert already exists
                const existingAlert = await EmergencyAlert.findById(alertData._id);
                if (existingAlert) {
                    console.log(`⏭️  Skipping alert ${alertData._id} - already exists`);
                    skipCount++;
                    continue;
                }

                // Find and validate station ID - get station data
                let stationId = alertData.station;
                let stationData = null;
                
                if (stationId) {
                    stationData = await Station.findById(stationId);
                    if (!stationData) {
                        console.log(`⚠️  Station ID ${stationId} not found, finding alternative...`);
                        // Find any available station
                        const anyStation = await Station.findOne();
                        if (anyStation) {
                            stationId = anyStation._id;
                            stationData = anyStation;
                            console.log(`   ✅ Using station: ${anyStation.name} (${stationId})`);
                        } else {
                            console.log(`   ❌ No stations found in database. Skipping alert ${alertData._id}`);
                            errorCount++;
                            continue;
                        }
                    } else {
                        console.log(`   ✅ Found station: ${stationData.name} (${stationId})`);
                        console.log(`      Location: ${stationData.location || 'N/A'}`);
                    }
                } else {
                    console.log(`⚠️  No station ID in alert data, finding any available station...`);
                    const anyStation = await Station.findOne();
                    if (anyStation) {
                        stationId = anyStation._id;
                        stationData = anyStation;
                        console.log(`   ✅ Using station: ${anyStation.name} (${stationId})`);
                    } else {
                        console.log(`   ❌ No stations found in database. Skipping alert ${alertData._id}`);
                        errorCount++;
                        continue;
                    }
                }

                // Find and validate user/reporter ID - get user data
                const userId = alertData.userId || alertData.reporterId;
                let reporterId = userId;
                let reporterType = 'User';
                let reporterData = null;

                if (userId) {
                    // Check if userId exists in User collection
                    const user = await User.findById(userId);
                    if (user) {
                        reporterType = 'User';
                        reporterId = userId;
                        reporterData = user;
                        console.log(`   ✅ Found user: ${user.name || user.email} (${userId})`);
                        console.log(`      Email: ${user.email || 'N/A'}`);
                        console.log(`      Phone: ${user.phone || 'N/A'}`);
                    } else {
                        // Check if it's a FirePersonnel
                        const personnel = await FirePersonnel.findById(userId);
                        if (personnel) {
                            reporterType = 'FirePersonnel';
                            reporterId = userId;
                            reporterData = personnel;
                            console.log(`   ✅ Found fire personnel: ${personnel.name} (${userId})`);
                            console.log(`      Rank: ${personnel.rank || 'N/A'}`);
                            console.log(`      Service Number: ${personnel.serviceNumber || 'N/A'}`);
                        } else {
                            console.log(`⚠️  Reporter ID ${userId} not found, finding alternative...`);
                            // Find any available user
                            const anyUser = await User.findOne();
                            if (anyUser) {
                                reporterId = anyUser._id;
                                reporterType = 'User';
                                reporterData = anyUser;
                                console.log(`   ✅ Using user: ${anyUser.name || anyUser.email} (${reporterId})`);
                            } else {
                                // Try FirePersonnel
                                const anyPersonnel = await FirePersonnel.findOne();
                                if (anyPersonnel) {
                                    reporterId = anyPersonnel._id;
                                    reporterType = 'FirePersonnel';
                                    reporterData = anyPersonnel;
                                    console.log(`   ✅ Using fire personnel: ${anyPersonnel.name} (${reporterId})`);
                                } else {
                                    console.log(`   ❌ No users or fire personnel found in database. Skipping alert ${alertData._id}`);
                                    errorCount++;
                                    continue;
                                }
                            }
                        }
                    }
                } else {
                    console.log(`⚠️  No user ID in alert data, finding any available user...`);
                    // Find any available user
                    const anyUser = await User.findOne();
                    if (anyUser) {
                        reporterId = anyUser._id;
                        reporterType = 'User';
                        reporterData = anyUser;
                        console.log(`   ✅ Using user: ${anyUser.name || anyUser.email} (${reporterId})`);
                    } else {
                        // Try FirePersonnel
                        const anyPersonnel = await FirePersonnel.findOne();
                        if (anyPersonnel) {
                            reporterId = anyPersonnel._id;
                            reporterType = 'FirePersonnel';
                            reporterData = anyPersonnel;
                            console.log(`   ✅ Using fire personnel: ${anyPersonnel.name} (${reporterId})`);
                        } else {
                            console.log(`   ❌ No users or fire personnel found in database. Skipping alert ${alertData._id}`);
                            errorCount++;
                            continue;
                        }
                    }
                }

                // Prepare the alert data with validated IDs (no department/unit lookup)
                const alertToInsert = {
                    _id: alertData._id,
                    incidentType: alertData.incidentType,
                    incidentName: alertData.incidentName,
                    location: alertData.location,
                    station: stationId, // Use validated station ID
                    reporterId: reporterId, // Use validated reporter ID
                    reporterType: reporterType,
                    reportedAt: alertData.reportedAt || alertData.createdAt || new Date(),
                    status: 'active', // Always set status to 'active' when seeding
                    priority: alertData.priority || 'high',
                    description: alertData.description || null,
                    estimatedCasualties: alertData.estimatedCasualties || 0,
                    estimatedDamage: alertData.estimatedDamage || 'minimal',
                    responseTime: alertData.responseTime || null,
                    resolvedAt: alertData.resolvedAt || null,
                    notes: alertData.notes || null,
                    dispatched: alertData.dispatched || false,
                    dispatchedAt: alertData.dispatchedAt || null,
                    declined: alertData.declined || false,
                    declinedAt: alertData.declinedAt || null,
                    declineReason: alertData.declineReason || null,
                    referred: alertData.referred || false,
                    referredAt: alertData.referredAt || null,
                    referredToStation: alertData.referredToStation || null,
                    referReason: alertData.referReason || null,
                    createdAt: alertData.createdAt || new Date(),
                    updatedAt: alertData.updatedAt || new Date()
                };

                // Verify station and user exist before creating alert
                if (!stationId) {
                    console.log(`   ❌ Station ID is required. Skipping alert ${alertData._id}`);
                    errorCount++;
                    continue;
                }

                if (!reporterId) {
                    console.log(`   ❌ Reporter ID is required. Skipping alert ${alertData._id}`);
                    errorCount++;
                    continue;
                }

                // Double-check station exists
                const verifyStation = await Station.findById(stationId);
                if (!verifyStation) {
                    console.log(`   ❌ Station ${stationId} does not exist in database. Skipping alert ${alertData._id}`);
                    errorCount++;
                    continue;
                }

                // Double-check user/reporter exists
                let verifyReporter = null;
                if (reporterType === 'User') {
                    verifyReporter = await User.findById(reporterId);
                } else {
                    verifyReporter = await FirePersonnel.findById(reporterId);
                }

                if (!verifyReporter) {
                    console.log(`   ❌ Reporter ${reporterId} (${reporterType}) does not exist in database. Skipping alert ${alertData._id}`);
                    errorCount++;
                    continue;
                }

                // Create and save the alert with proper validation (no bypass)
                try {
                    const alert = new EmergencyAlert(alertToInsert);
                    await alert.save();
                    
                    // Populate the alert to verify relationships and get full data
                    await alert.populate([
                        { 
                            path: 'station', 
                            select: 'name location lat lng phone_number placeId' 
                        },
                        { 
                            path: 'reporterDetails',
                            select: reporterType === 'User' 
                                ? 'name email phone phone_number' 
                                : 'name rank serviceNumber department unit role station'
                        }
                    ]);
                    
                    console.log(`✅ Inserted alert ${alert._id} - ${alert.incidentName}`);
                    console.log(`   📍 Station: ${alert.station?.name || 'N/A'}`);
                    if (alert.station) {
                        console.log(`      Location: ${alert.station.location || 'N/A'}`);
                        console.log(`      Phone: ${alert.station.phone_number || 'N/A'}`);
                    }
                    console.log(`   👤 Reporter: ${alert.reporterDetails?.name || alert.reporterDetails?.email || 'N/A'}`);
                    if (alert.reporterDetails) {
                        if (reporterType === 'User') {
                            console.log(`      Email: ${alert.reporterDetails.email || 'N/A'}`);
                            console.log(`      Phone: ${alert.reporterDetails.phone || alert.reporterDetails.phone_number || 'N/A'}`);
                        } else {
                            console.log(`      Rank: ${alert.reporterDetails.rank || 'N/A'}`);
                            console.log(`      Service Number: ${alert.reporterDetails.serviceNumber || 'N/A'}`);
                        }
                    }
                    
                    successCount++;
                } catch (saveError) {
                    console.error(`   ❌ Failed to save alert: ${saveError.message}`);
                    errorCount++;
                }

            } catch (error) {
                console.error(`❌ Error inserting alert ${alertData._id}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n📊 Seeding Summary:');
        console.log(`   ✅ Successfully inserted: ${successCount}`);
        console.log(`   ⏭️  Skipped (already exists): ${skipCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log(`   📝 Total processed: ${alertsData.length}`);

        // Close the connection
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
        process.exit(0);

    } catch (error) {
        console.error('❌ Seeding error:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
}

// Run the seed function
seedEmergencyAlerts();

