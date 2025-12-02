import EmergencyAlert from '../models/EmergencyAlert.js';
import User from '../models/User.js';
import FirePersonnel from '../models/FirePersonnel.js';
import Station from '../models/Station.js';
import mongoose from 'mongoose';
import { emitNewAlert, emitActiveIncidentExists } from './socketService.js';
import Incident from '../models/Incident.js';

/**
 * Service function to create an emergency alert
 * This is the core logic extracted from the controller for reuse
 * @param {Object} alertData - Alert data object
 * @param {Object} options - Optional configuration
 * @param {boolean} options.emitWebSocket - Whether to emit WebSocket events (default: true)
 * @returns {Object} - { success: boolean, data?: EmergencyAlert, error?: Object, webSocketInfo?: Object }
 */
export const createEmergencyAlertService = async (alertData, options = {}) => {
    const { emitWebSocket = true } = options;
    try {
        const {
            incidentType,
            incidentName,
            location,
            station,
            userId,
            description,
            estimatedCasualties,
            estimatedDamage,
            priority
        } = alertData;

        // Check station status before creating alert
        let stationId = null;
        if (station) {
            if (typeof station === 'string' && mongoose.Types.ObjectId.isValid(station)) {
                stationId = new mongoose.Types.ObjectId(station);
            } else if (station._id) {
                stationId = station._id;
            } else if (typeof station === 'object' && station.placeId) {
                const foundStation = await Station.findOne({ placeId: station.placeId });
                if (foundStation) {
                    stationId = foundStation._id;
                }
            }
            
            if (stationId) {
                const stationDoc = await Station.findById(stationId);
                if (!stationDoc) {
                    return {
                        success: false,
                        error: {
                            statusCode: 404,
                            message: 'Station not found',
                            stationStatus: null
                        }
                    };
                }
                
                // Check if station is out of commission
                if (stationDoc.status === 'out of commission') {
                    return {
                        success: false,
                        error: {
                            statusCode: 400,
                            message: 'Cannot create alert: Station is out of commission',
                            stationStatus: {
                                status: stationDoc.status,
                                isActive: false,
                                hasActiveAlert: stationDoc.hasActiveAlert || false,
                                hasActiveIncident: stationDoc.hasActiveIncident || false
                            }
                        }
                    };
                }
                
                // Check if station already has an active incident
                if (stationDoc.hasActiveIncident) {
                    // Verify by querying for active incidents
                    const activeIncident = await Incident.findOne({
                        station: stationId,
                        status: { $in: ['active', 'dispatched', 'en-route', 'on-scene'] }
                    }).populate([
                        { path: 'alertId', select: 'incidentName incidentType' },
                        { path: 'departmentOnDuty', select: 'name' },
                        { path: 'unitOnDuty', select: 'name' }
                    ]);
                    
                    if (activeIncident) {
                        return {
                            success: false,
                            error: {
                                statusCode: 409,
                                message: 'Station is currently busy with an active incident. Please try again later or contact another station.',
                                stationStatus: {
                                    status: stationDoc.status,
                                    isActive: stationDoc.status === 'in commission',
                                    hasActiveAlert: stationDoc.hasActiveAlert || false,
                                    hasActiveIncident: true,
                                    activeIncidentId: activeIncident._id.toString(),
                                    activeIncidentDetails: {
                                        incidentName: activeIncident.alertId?.incidentName || 'Unknown',
                                        incidentType: activeIncident.alertId?.incidentType || 'Unknown',
                                        status: activeIncident.status,
                                        department: activeIncident.departmentOnDuty?.name || 'Unknown',
                                        unit: activeIncident.unitOnDuty?.name || 'Unknown',
                                        startedAt: activeIncident.createdAt
                                    }
                                }
                            }
                        };
                    }
                }
                
                // Check if station already has an active alert
                if (stationDoc.hasActiveAlert) {
                    // Verify by querying for active alerts
                    const activeAlert = await EmergencyAlert.findOne({
                        station: stationId,
                        status: { $in: ['active', 'pending'] }
                    });
                    
                    if (activeAlert) {
                        return {
                            success: false,
                            error: {
                                statusCode: 400,
                                message: 'Cannot create alert: Station already has an active alert',
                                stationStatus: {
                                    status: stationDoc.status,
                                    isActive: stationDoc.status === 'in commission',
                                    hasActiveAlert: true,
                                    hasActiveIncident: stationDoc.hasActiveIncident || false,
                                    activeAlertId: activeAlert._id.toString()
                                }
                            }
                        };
                    }
                }
            }
        }
        
        // Validate required fields
        if (!incidentType || !incidentName || !location || !station || !userId) {
            return {
                success: false,
                error: {
                    statusCode: 400,
                    message: 'Missing required fields: incidentType, incidentName, location, station, userId'
                }
            };
        }

        // Validate coordinates
        if (!location.coordinates || !location.coordinates.latitude || !location.coordinates.longitude) {
            return {
                success: false,
                error: {
                    statusCode: 400,
                    message: 'Location coordinates (latitude, longitude) are required'
                }
            };
        }

        // Validate userId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return {
                success: false,
                error: {
                    statusCode: 400,
                    message: 'Invalid user ID format'
                }
            };
        }

        // Determine reporter type - check if userId is a User or FirePersonnel
        let reporterId = userId;
        let reporterType = null;
        
        const user = await User.findById(userId);
        if (user) {
            reporterType = 'User';
        } else {
            const personnel = await FirePersonnel.findById(userId);
            if (personnel) {
                reporterType = 'FirePersonnel';
            } else {
                return {
                    success: false,
                    error: {
                        statusCode: 404,
                        message: 'User ID not found. The provided ID does not exist in Users or FirePersonnel'
                    }
                };
            }
        }

        // Handle station - could be ObjectId or station object
        // If stationId wasn't set from the commission check above, determine it now
        if (!stationId) {
            if (typeof station === 'string') {
                // Station is already an ObjectId
                if (!mongoose.Types.ObjectId.isValid(station)) {
                    return {
                        success: false,
                        error: {
                            statusCode: 400,
                            message: 'Invalid station ID format'
                        }
                    };
                }
                stationId = station;
            } else if (typeof station === 'object' && station !== null) {
                // Station is an object with station details - find the station
                let foundStation = null;
                
                // Try to find by placeId first (most reliable)
                if (station.placeId) {
                    foundStation = await Station.findOne({ placeId: station.placeId });
                }
                
                // If not found by placeId, try by coordinates
                if (!foundStation && station.latitude && station.longitude) {
                    foundStation = await Station.findOne({
                        lat: station.latitude,
                        lng: station.longitude
                    });
                }
                
                // If still not found, try by name
                if (!foundStation && station.name) {
                    foundStation = await Station.findOne({
                        name: { $regex: new RegExp(station.name, 'i') }
                    });
                }
                
                if (!foundStation) {
                    return {
                        success: false,
                        error: {
                            statusCode: 404,
                            message: 'Station not found. Please ensure the station exists in the system.',
                            providedStation: station
                        }
                    };
                }
                
                stationId = foundStation._id;
            } else {
                return {
                    success: false,
                    error: {
                        statusCode: 400,
                        message: 'Station must be either a valid ObjectId or a station object with details'
                    }
                };
            }
        }

        // Create alert without department/unit lookup (department will be found when alert is accepted)
        const emergencyAlert = new EmergencyAlert({
            incidentType,
            incidentName,
            location,
            station: stationId,
            reporterId,
            reporterType,
            description,
            estimatedCasualties,
            estimatedDamage,
            priority
        });

        await emergencyAlert.save();
        
        // Update station's hasActiveAlert field if alert is active or pending
        const alertStatus = emergencyAlert.status || 'active';
        if (alertStatus === 'active' || alertStatus === 'pending') {
            try {
                const stationIdForUpdate = emergencyAlert.station?._id || emergencyAlert.station;
                if (stationIdForUpdate) {
                    await Station.findByIdAndUpdate(stationIdForUpdate, {
                        hasActiveAlert: true
                    });
                }
            } catch (stationUpdateError) {
                console.error('⚠️ Error updating station hasActiveAlert:', stationUpdateError.message);
                // Don't fail the request if station update fails
            }
        }
        
        // Populate related data
        await emergencyAlert.populate([
            { path: 'station', select: 'name location lat lng phone_number placeId' },
            { path: 'department', select: 'name description' },
            { path: 'unit', select: 'name isActive' },
            { path: 'referredStationDetails', select: 'name location lat lng phone_number placeId' },
            { 
                path: 'reporterDetails', 
                select: reporterType === 'User' ? 'name phone email' : 'name rank department unit role station' 
            }
        ]);

        // Check for active incident and prepare WebSocket info
        let hasActiveIncident = false;
        let activeIncident = null;
        const stationIdForCheck = emergencyAlert.station?._id || emergencyAlert.station;
        
        if ((alertStatus === 'active' || alertStatus === 'pending') && stationIdForCheck) {
            try {
                // Convert to ObjectId if it's a string
                const stationObjectId = typeof stationIdForCheck === 'string' 
                    ? new mongoose.Types.ObjectId(stationIdForCheck) 
                    : stationIdForCheck;
                
                // Check if this station has an active incident
                activeIncident = await Incident.findOne({
                    $or: [
                        { station: stationObjectId },
                        { station: stationObjectId.toString() }
                    ],
                    status: { $in: ['active', 'dispatched', 'on_scene'] }
                }).populate([
                    { path: 'alertId', select: 'incidentName incidentType station' },
                    { path: 'departmentOnDuty', select: '_id name' },
                    { path: 'unitOnDuty', select: '_id name' }
                ]);
                
                if (activeIncident) {
                    hasActiveIncident = true;
                }
            } catch (activeIncidentCheckError) {
                console.error('⚠️ Error checking for active incidents:', activeIncidentCheckError.message);
                // Don't fail the request if this check fails
            }
        }

        // Emit WebSocket events if requested and Socket.IO is available
        if (emitWebSocket && (alertStatus === 'active' || alertStatus === 'pending')) {
            try {
                if (hasActiveIncident && activeIncident) {
                    // Send ONLY active incident notification (which includes the alert data)
                    emitActiveIncidentExists(emergencyAlert, activeIncident);
                } else {
                    // If no active incident, send regular alert notification
                    emitNewAlert(emergencyAlert);
                }
            } catch (socketError) {
                console.error('⚠️ Failed to broadcast alert via WebSocket:', socketError.message);
                // Don't fail the request if WebSocket fails
            }
        }

        return {
            success: true,
            data: emergencyAlert,
            webSocketInfo: {
                shouldEmit: alertStatus === 'active' || alertStatus === 'pending',
                hasActiveIncident,
                activeIncident: activeIncident ? {
                    _id: activeIncident._id.toString(),
                    status: activeIncident.status,
                    alertId: activeIncident.alertId?._id?.toString() || activeIncident.alertId?.toString() || null,
                    departmentOnDuty: activeIncident.departmentOnDuty?.toString() || null,
                    unitOnDuty: activeIncident.unitOnDuty?.toString() || null,
                    createdAt: activeIncident.createdAt ? new Date(activeIncident.createdAt).toISOString() : null
                } : null
            }
        };

    } catch (error) {
        console.error('❌ Create emergency alert service error:', error);
        return {
            success: false,
            error: {
                statusCode: 500,
                message: error.message
            }
        };
    }
};

