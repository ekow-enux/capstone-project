// Socket.IO service for real-time communication
import { Server } from 'socket.io';

let io = null;

export const initializeSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: ['http://localhost:3000', 'http://localhost:3001', 'https://gnfs.ekowlabs.space'],
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        console.log('🔌 Client connected:', socket.id);

        socket.on('disconnect', () => {
            console.log('🔌 Client disconnected:', socket.id);
        });

        // Optional: Join room for specific station
        socket.on('join_station', (stationId) => {
            socket.join(`station_${stationId}`);
            console.log(`📍 Client ${socket.id} joined station room: ${stationId}`);
        });

        // Optional: Leave station room
        socket.on('leave_station', (stationId) => {
            socket.leave(`station_${stationId}`);
            console.log(`📍 Client ${socket.id} left station room: ${stationId}`);
        });

        // Listen for alerts from interval script or other services
        socket.on('server:broadcast_alert', (payload) => {
            console.log('📡 Received alert broadcast request from service');
            // Broadcast to all clients
            io.emit('alert_created', payload);
            io.emit('new_alert', payload); // Backward compatibility
            
            // Also emit to specific station room if station is available
            if (payload.stationId) {
                io.to(`station_${payload.stationId}`).emit('alert_created', payload);
                io.to(`station_${payload.stationId}`).emit('new_alert', payload);
            }
            console.log('📡 Alert broadcasted to all clients');
        });

        // Listen for active incident notifications from interval script or other services
        socket.on('server:broadcast_active_incident', (notification) => {
            console.log('📡 Received active incident notification from service');
            // Broadcast to all clients
            io.emit('active_incident_exists', notification);
            
            // Also emit to specific station room if station is available
            if (notification.stationId) {
                io.to(`station_${notification.stationId}`).emit('active_incident_exists', notification);
            }
            console.log('📡 Active incident notification broadcasted to all clients');
        });
    });

    console.log('✅ Socket.IO initialized');
    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call initializeSocket first.');
    }
    return io;
};

// Helper function to format alert payload (exported for use in scripts)
export const formatAlertPayload = (alertData) => {
    // Handle station - extract all station info
    let stationInfo = null;
    let stationId = null;
    
    if (alertData.station) {
        // If station is populated (object with properties)
        if (typeof alertData.station === 'object' && alertData.station._id) {
            stationId = alertData.station._id.toString();
            stationInfo = {
                _id: stationId,
                name: alertData.station.name || null,
                location: alertData.station.location || null,
                phone: alertData.station.phone_number || alertData.station.phone || null,
                lat: alertData.station.lat || null,
                lng: alertData.station.lng || null,
                placeId: alertData.station.placeId || null
            };
        } 
        // If station is just an ObjectId
        else if (typeof alertData.station === 'object' && alertData.station.toString) {
            stationId = alertData.station.toString();
        }
        // If station is a string
        else if (typeof alertData.station === 'string') {
            stationId = alertData.station;
        }
    }
    
    // Handle user/reporter information
    let userName = null;
    let userContact = null;
    
    if (alertData.reporterDetails) {
        userName = alertData.reporterDetails.name || null;
        const userPhone = alertData.reporterDetails.phone || alertData.reporterDetails.phone_number || null;
        const userEmail = alertData.reporterDetails.email || null;
        
        // Combine email and phone into userContact object
        userContact = {
            email: userEmail,
            phone: userPhone
        };
    }
    
    // Extract GPS coordinates from location
    let gpsCoordinates = null;
    if (alertData.location?.coordinates) {
        gpsCoordinates = alertData.location.coordinates;
    } else if (alertData.location?.lat && alertData.location?.lng) {
        gpsCoordinates = {
            lat: alertData.location.lat,
            lng: alertData.location.lng
        };
    }
    
    // Prepare the alert data in the exact format requested
    return {
        payload: {
            _id: alertData._id ? alertData._id.toString() : null,
            // 1. Incident type
            incidentType: alertData.incidentType || null,
            // 2. Incident name
            incidentName: alertData.incidentName || null,
            // 3. The reporting user's name
            userName: userName,
            // 4. User contact (email + phone)
            userContact: userContact,
            // 5. Location name
            locationName: alertData.location?.locationName || null,
            // 6. Location URL
            locationUrl: alertData.location?.locationUrl || null,
            // 7. GPS coordinates
            gpsCoordinates: gpsCoordinates,
            // 8. Station information
            stationInfo: stationInfo,
            // 9. Priority
            priority: alertData.priority || null,
            // 10. Timestamps
            timestamps: {
                createdAt: alertData.createdAt ? new Date(alertData.createdAt).toISOString() : null,
                updatedAt: alertData.updatedAt ? new Date(alertData.updatedAt).toISOString() : null,
                reportedAt: alertData.reportedAt ? new Date(alertData.reportedAt).toISOString() : null
            },
            // Additional fields for reference
            status: alertData.status || null
        },
        stationId: stationId
    };
};

// Emit new alert (CREATE)
export const emitNewAlert = (alertData) => {
    try {
        const socketIO = getIO();
        const { payload, stationId } = formatAlertPayload(alertData);

        // Broadcast to all connected clients
        socketIO.emit('alert_created', payload);
        socketIO.emit('new_alert', payload); // Backward compatibility
        console.log('📡 Broadcasted alert_created event:', payload.incidentName);

        // Also emit to specific station room if station is available
        if (stationId) {
            socketIO.to(`station_${stationId}`).emit('alert_created', payload);
            socketIO.to(`station_${stationId}`).emit('new_alert', payload); // Backward compatibility
            console.log(`📡 Broadcasted alert_created to station room: ${stationId}`);
        }

    } catch (error) {
        console.error('❌ Error emitting alert_created event:', error.message);
    }
};

// Emit updated alert (UPDATE)
export const emitAlertUpdated = (alertData) => {
    try {
        const socketIO = getIO();
        const { payload, stationId } = formatAlertPayload(alertData);

        // Broadcast to all connected clients
        socketIO.emit('alert_updated', payload);
        console.log('📡 Broadcasted alert_updated event:', payload.incidentName);

        // Also emit to specific station room if station is available
        if (stationId) {
            socketIO.to(`station_${stationId}`).emit('alert_updated', payload);
            console.log(`📡 Broadcasted alert_updated to station room: ${stationId}`);
        }

    } catch (error) {
        console.error('❌ Error emitting alert_updated event:', error.message);
    }
};

// Emit deleted alert (DELETE)
export const emitAlertDeleted = (alertId) => {
    try {
        const socketIO = getIO();
        const payload = {
            _id: alertId ? alertId.toString() : null,
            deletedAt: new Date().toISOString()
        };

        // Broadcast to all connected clients
        socketIO.emit('alert_deleted', payload);
        console.log('📡 Broadcasted alert_deleted event:', payload._id);

    } catch (error) {
        console.error('❌ Error emitting alert_deleted event:', error.message);
    }
};

// Emit new incident (CREATE)
export const emitNewIncident = (incidentData) => {
    try {
        const socketIO = getIO();
        const payload = {
            _id: incidentData._id ? incidentData._id.toString() : null,
            alertId: incidentData.alertId ? incidentData.alertId.toString() : null,
            departmentOnDuty: incidentData.departmentOnDuty ? incidentData.departmentOnDuty.toString() : null,
            unitOnDuty: incidentData.unitOnDuty ? incidentData.unitOnDuty.toString() : null,
            status: incidentData.status || null,
            createdAt: incidentData.createdAt ? new Date(incidentData.createdAt).toISOString() : null,
            updatedAt: incidentData.updatedAt ? new Date(incidentData.updatedAt).toISOString() : null
        };

        // Broadcast to all connected clients
        socketIO.emit('incident_created', payload);
        console.log('📡 Broadcasted incident_created event:', payload._id);

    } catch (error) {
        console.error('❌ Error emitting incident_created event:', error.message);
    }
};

// Emit updated incident (UPDATE)
export const emitIncidentUpdated = (incidentData) => {
    try {
        const socketIO = getIO();
        const payload = {
            _id: incidentData._id ? incidentData._id.toString() : null,
            alertId: incidentData.alertId ? incidentData.alertId.toString() : null,
            departmentOnDuty: incidentData.departmentOnDuty ? incidentData.departmentOnDuty.toString() : null,
            unitOnDuty: incidentData.unitOnDuty ? incidentData.unitOnDuty.toString() : null,
            status: incidentData.status || null,
            dispatchedAt: incidentData.dispatchedAt ? new Date(incidentData.dispatchedAt).toISOString() : null,
            arrivedAt: incidentData.arrivedAt ? new Date(incidentData.arrivedAt).toISOString() : null,
            resolvedAt: incidentData.resolvedAt ? new Date(incidentData.resolvedAt).toISOString() : null,
            closedAt: incidentData.closedAt ? new Date(incidentData.closedAt).toISOString() : null,
            updatedAt: incidentData.updatedAt ? new Date(incidentData.updatedAt).toISOString() : null
        };

        // Broadcast to all connected clients
        socketIO.emit('incident_updated', payload);
        console.log('📡 Broadcasted incident_updated event:', payload._id);

    } catch (error) {
        console.error('❌ Error emitting incident_updated event:', error.message);
    }
};

// Emit deleted incident (DELETE)
export const emitIncidentDeleted = (incidentId) => {
    try {
        const socketIO = getIO();
        const payload = {
            _id: incidentId ? incidentId.toString() : null,
            deletedAt: new Date().toISOString()
        };

        // Broadcast to all connected clients
        socketIO.emit('incident_deleted', payload);
        console.log('📡 Broadcasted incident_deleted event:', payload._id);

    } catch (error) {
        console.error('❌ Error emitting incident_deleted event:', error.message);
    }
};

// Emit notification when active incident exists for a station
export const emitActiveIncidentExists = (alertData, activeIncident) => {
    try {
        const socketIO = getIO();
        const { payload, stationId } = formatAlertPayload(alertData);
        
        const notification = {
            alert: payload,
            activeIncident: {
                _id: activeIncident._id.toString(),
                status: activeIncident.status,
                alertId: activeIncident.alertId?._id?.toString() || activeIncident.alertId?.toString() || null,
                departmentOnDuty: activeIncident.departmentOnDuty?.toString() || null,
                unitOnDuty: activeIncident.unitOnDuty?.toString() || null,
                createdAt: activeIncident.createdAt ? new Date(activeIncident.createdAt).toISOString() : null
            },
            stationId: stationId,
            message: 'This station has an active incident. Would you like to refer or accept this new alert?',
            requiresAction: true
        };
        
        // Broadcast to all clients
        socketIO.emit('active_incident_exists', notification);
        
        // Also emit to specific station room if station is available
        if (stationId) {
            socketIO.to(`station_${stationId}`).emit('active_incident_exists', notification);
        }
        
        console.log('📡 Broadcasted active_incident_exists event for station:', stationId);
    } catch (error) {
        console.error('❌ Error emitting active_incident_exists event:', error.message);
    }
};

// Emit Referral Created
export const emitReferralCreated = (referralData) => {
    try {
        const socketIO = getIO();
        if (!socketIO) {
            console.warn('⚠️ Socket.IO not initialized. Skipping referral_created event.');
            return;
        }

        const payload = {
            _id: referralData._id.toString(),
            data_id: referralData.data_id.toString(),
            data_type: referralData.data_type,
            from_station: referralData.from_station_id ? {
                _id: referralData.from_station_id._id?.toString() || referralData.from_station_id.toString(),
                name: referralData.from_station_id.name || null,
                location: referralData.from_station_id.location || null
            } : null,
            to_station: referralData.to_station_id ? {
                _id: referralData.to_station_id._id?.toString() || referralData.to_station_id.toString(),
                name: referralData.to_station_id.name || null,
                location: referralData.to_station_id.location || null
            } : null,
            reason: referralData.reason || null,
            status: referralData.status,
            referred_at: referralData.referred_at ? new Date(referralData.referred_at).toISOString() : null,
            createdAt: referralData.createdAt ? new Date(referralData.createdAt).toISOString() : null
        };

        // Broadcast to all clients
        socketIO.emit('referral_created', payload);
        
        // Also emit to specific station rooms
        if (referralData.from_station_id) {
            const fromStationId = referralData.from_station_id._id?.toString() || referralData.from_station_id.toString();
            socketIO.to(`station_${fromStationId}`).emit('referral_created', payload);
        }
        if (referralData.to_station_id) {
            const toStationId = referralData.to_station_id._id?.toString() || referralData.to_station_id.toString();
            socketIO.to(`station_${toStationId}`).emit('referral_created', payload);
        }
        
        console.log('📡 Broadcasted referral_created event');
    } catch (error) {
        console.error('❌ Error emitting referral_created event:', error.message);
    }
};

// Emit Referral Updated
export const emitReferralUpdated = (referralData) => {
    try {
        const socketIO = getIO();
        if (!socketIO) {
            console.warn('⚠️ Socket.IO not initialized. Skipping referral_updated event.');
            return;
        }

        const payload = {
            _id: referralData._id.toString(),
            data_id: referralData.data_id.toString(),
            data_type: referralData.data_type,
            from_station: referralData.from_station_id ? {
                _id: referralData.from_station_id._id?.toString() || referralData.from_station_id.toString(),
                name: referralData.from_station_id.name || null,
                location: referralData.from_station_id.location || null
            } : null,
            to_station: referralData.to_station_id ? {
                _id: referralData.to_station_id._id?.toString() || referralData.to_station_id.toString(),
                name: referralData.to_station_id.name || null,
                location: referralData.to_station_id.location || null
            } : null,
            reason: referralData.reason || null,
            status: referralData.status,
            response_notes: referralData.response_notes || null,
            referred_at: referralData.referred_at ? new Date(referralData.referred_at).toISOString() : null,
            responded_at: referralData.responded_at ? new Date(referralData.responded_at).toISOString() : null,
            updatedAt: referralData.updatedAt ? new Date(referralData.updatedAt).toISOString() : null
        };

        // Broadcast to all clients
        socketIO.emit('referral_updated', payload);
        
        // Also emit to specific station rooms
        if (referralData.from_station_id) {
            const fromStationId = referralData.from_station_id._id?.toString() || referralData.from_station_id.toString();
            socketIO.to(`station_${fromStationId}`).emit('referral_updated', payload);
        }
        if (referralData.to_station_id) {
            const toStationId = referralData.to_station_id._id?.toString() || referralData.to_station_id.toString();
            socketIO.to(`station_${toStationId}`).emit('referral_updated', payload);
        }
        
        console.log('📡 Broadcasted referral_updated event');
    } catch (error) {
        console.error('❌ Error emitting referral_updated event:', error.message);
    }
};

// Emit Referred Alert Received - Notifies target station about a referred alert
export const emitReferredAlertReceived = (alertData, referralInfo) => {
    try {
        const socketIO = getIO();
        if (!socketIO) {
            console.warn('⚠️ Socket.IO not initialized. Skipping referred_alert_received event.');
            return;
        }

        const { payload, stationId } = formatAlertPayload(alertData);
        
        const notification = {
            ...payload,
            referral: {
                referralId: referralInfo._id?.toString() || referralInfo.toString(),
                fromStation: referralInfo.from_station_id ? {
                    _id: referralInfo.from_station_id._id?.toString() || referralInfo.from_station_id.toString(),
                    name: referralInfo.from_station_id.name || null,
                    location: referralInfo.from_station_id.location || null
                } : null,
                reason: referralInfo.reason || null,
                referredAt: referralInfo.referred_at ? new Date(referralInfo.referred_at).toISOString() : null
            },
            isReferred: true,
            message: 'You have received a referred emergency alert',
            requiresAction: true
        };

        // Get target station ID
        const targetStationId = referralInfo.to_station_id?._id?.toString() || referralInfo.to_station_id?.toString();
        
        if (targetStationId) {
            // Emit to target station room
            socketIO.to(`station_${targetStationId}`).emit('referred_alert_received', notification);
            console.log(`📡 Broadcasted referred_alert_received event to station: ${targetStationId}`);
        }
        
        // Also broadcast to all clients (optional, for admin views)
        socketIO.emit('referred_alert_received', notification);
        
    } catch (error) {
        console.error('❌ Error emitting referred_alert_received event:', error.message);
    }
};

// Emit Referred Incident Received - Notifies target station about a referred incident
export const emitReferredIncidentReceived = (incidentData, referralInfo) => {
    try {
        const socketIO = getIO();
        if (!socketIO) {
            console.warn('⚠️ Socket.IO not initialized. Skipping referred_incident_received event.');
            return;
        }

        // Format incident payload similar to alert format
        const incidentPayload = {
            _id: incidentData._id.toString(),
            alertId: incidentData.alertId?._id?.toString() || incidentData.alertId?.toString() || null,
            station: incidentData.station ? {
                _id: incidentData.station._id?.toString() || incidentData.station.toString(),
                name: incidentData.station.name || null,
                location: incidentData.station.location || null
            } : null,
            departmentOnDuty: incidentData.departmentOnDuty?._id?.toString() || incidentData.departmentOnDuty?.toString() || null,
            unitOnDuty: incidentData.unitOnDuty?._id?.toString() || incidentData.unitOnDuty?.toString() || null,
            status: incidentData.status,
            dispatchedAt: incidentData.dispatchedAt ? new Date(incidentData.dispatchedAt).toISOString() : null,
            arrivedAt: incidentData.arrivedAt ? new Date(incidentData.arrivedAt).toISOString() : null,
            resolvedAt: incidentData.resolvedAt ? new Date(incidentData.resolvedAt).toISOString() : null,
            closedAt: incidentData.closedAt ? new Date(incidentData.closedAt).toISOString() : null,
            createdAt: incidentData.createdAt ? new Date(incidentData.createdAt).toISOString() : null,
            updatedAt: incidentData.updatedAt ? new Date(incidentData.updatedAt).toISOString() : null
        };
        
        const notification = {
            ...incidentPayload,
            referral: {
                referralId: referralInfo._id?.toString() || referralInfo.toString(),
                fromStation: referralInfo.from_station_id ? {
                    _id: referralInfo.from_station_id._id?.toString() || referralInfo.from_station_id.toString(),
                    name: referralInfo.from_station_id.name || null,
                    location: referralInfo.from_station_id.location || null
                } : null,
                reason: referralInfo.reason || null,
                referredAt: referralInfo.referred_at ? new Date(referralInfo.referred_at).toISOString() : null
            },
            isReferred: true,
            message: 'You have received a referred incident',
            requiresAction: true
        };

        // Get target station ID
        const targetStationId = referralInfo.to_station_id?._id?.toString() || referralInfo.to_station_id?.toString();
        
        if (targetStationId) {
            // Emit to target station room
            socketIO.to(`station_${targetStationId}`).emit('referred_incident_received', notification);
            console.log(`📡 Broadcasted referred_incident_received event to station: ${targetStationId}`);
        }
        
        // Also broadcast to all clients (optional, for admin views)
        socketIO.emit('referred_incident_received', notification);
        
    } catch (error) {
        console.error('❌ Error emitting referred_incident_received event:', error.message);
    }
};

