import EmergencyAlert from '../models/EmergencyAlert.js';
import User from '../models/User.js';
import FirePersonnel from '../models/FirePersonnel.js';
import Department from '../models/Department.js';
import Unit from '../models/Unit.js';
import Station from '../models/Station.js';
import Incident from '../models/Incident.js';
import mongoose from 'mongoose';
import { emitNewAlert, emitAlertUpdated, emitAlertDeleted, emitNewIncident, emitActiveIncidentExists } from '../services/socketService.js';
import { createEmergencyAlertService } from '../services/emergencyAlertService.js';

// Create Emergency Alert
export const createEmergencyAlert = async (req, res) => {
    try {
        console.log('🚨 ===== EMERGENCY ALERT CREATION STARTED =====');
        console.log('🚨 CREATE EMERGENCY ALERT - Request Body:', JSON.stringify(req.body, null, 2));
        
        // Use the service function to create the alert
        const result = await createEmergencyAlertService(req.body);
        
        if (!result.success) {
            return res.status(result.error.statusCode).json({
                success: false,
                message: result.error.message,
                ...(result.error.stationStatus && { stationStatus: result.error.stationStatus }),
                ...(result.error.providedStation && { providedStation: result.error.providedStation })
            });
        }

        console.log('🚨 ===== EMERGENCY ALERT CREATION COMPLETED =====');

        res.status(201).json({
            success: true,
            message: 'Emergency alert created successfully',
            data: result.data
        });

    } catch (error) {
        console.error('❌ ===== EMERGENCY ALERT CREATION ERROR =====');
        console.error('❌ Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack?.split('\n').slice(0, 5) // First 5 lines of stack trace
        });
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            console.error('❌ Validation errors:', errors);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors
            });
        }

        console.error('❌ Unexpected error occurred during emergency alert creation');
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get All Emergency Alerts
export const getAllEmergencyAlerts = async (req, res) => {
    try {
        const emergencyAlerts = await EmergencyAlert.find({})
            .populate('station', 'name location lat lng phone_number')
            .populate('reporterDetails')
            .sort({ reportedAt: -1 });

        const total = emergencyAlerts.length;

        res.json({
            success: true,
            data: emergencyAlerts,
            total
        });

    } catch (error) {
        console.error('❌ Get all emergency alerts error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Emergency Alert by ID
export const getEmergencyAlertById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid emergency alert ID format'
            });
        }

        const emergencyAlert = await EmergencyAlert.findById(id)
            .populate('station', 'name location lat lng phone_number')
            .populate('reporterDetails')

        if (!emergencyAlert) {
            return res.status(404).json({
                success: false,
                message: 'Emergency alert not found'
            });
        }

        res.json({
            success: true,
            data: emergencyAlert
        });

    } catch (error) {
        console.error('❌ Get emergency alert by ID error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update Emergency Alert
export const updateEmergencyAlert = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        console.log('🔄 UPDATE EMERGENCY ALERT - ID:', id);
        console.log('📝 Update data:', updateData);

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid emergency alert ID format'
            });
        }

        // Get the current alert to check if status is changing to accepted
        const currentAlert = await EmergencyAlert.findById(id);
        if (!currentAlert) {
            return res.status(404).json({
                success: false,
                message: 'Emergency alert not found'
            });
        }

        // Normalize status values for comparison (handle case sensitivity and whitespace)
        const newStatus = updateData.status ? String(updateData.status).trim().toLowerCase() : null;
        const currentStatus = currentAlert.status ? String(currentAlert.status).trim().toLowerCase() : null;
        
        console.log(`🔍 Status check - Current: "${currentStatus}", New: "${newStatus}"`);
        
        // Check if status is changing to accepted
        const isStatusChangingToAccepted = newStatus === 'accepted' && currentStatus !== 'accepted';
        
        if (isStatusChangingToAccepted) {
            console.log('✅ Status is changing to accepted - will create incident');
        } else if (newStatus === 'accepted' && currentStatus === 'accepted') {
            console.log('ℹ️  Status is already accepted - skipping incident creation');
        } else if (newStatus !== 'accepted') {
            console.log(`ℹ️  Status is changing to "${newStatus}" (not accepted) - skipping incident creation`);
        }

        // If updating status to accepted, set dispatchedAt if not already set
        if (newStatus === 'accepted' && !updateData.dispatchedAt) {
            updateData.dispatchedAt = new Date();
            updateData.dispatched = true;
            // Ensure status is set to 'accepted' (normalized case)
            updateData.status = 'accepted';
        }
        
        // If updating status to rejected, set declinedAt if not already set
        if (newStatus === 'rejected' && !updateData.declinedAt) {
            updateData.declinedAt = new Date();
            updateData.declined = true;
            // Ensure status is set to 'rejected' (normalized case)
            updateData.status = 'rejected';
        }
        
        // If updating status to referred, set referredAt if not already set
        if (newStatus === 'referred' && !updateData.referredAt) {
            updateData.referredAt = new Date();
            updateData.referred = true;
            // Ensure status is set to 'referred' (normalized case)
            updateData.status = 'referred';
        }

        const emergencyAlert = await EmergencyAlert.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate([
            { path: 'station', select: 'name location lat lng phone_number' },
            { path: 'department', select: 'name description' },
            { path: 'unit', select: 'name isActive' },
            { path: 'reporterDetails' },
        ]);

        if (!emergencyAlert) {
            return res.status(404).json({
                success: false,
                message: 'Emergency alert not found'
            });
        }

        // If status changed to accepted, create an incident
        if (isStatusChangingToAccepted) {
            try {
                // Always allow creating incident (don't check for existing incident for this specific alert)
                // Get the station from the currentAlert (before update) to ensure we have the ObjectId reference
                // Use currentAlert.station instead of emergencyAlert.station to avoid population issues
                let stationId = currentAlert.station;
                
                // If station is populated as an object, extract _id
                if (stationId && typeof stationId === 'object' && stationId._id) {
                    stationId = stationId._id;
                }
                
                // Convert to ObjectId if it's a string
                if (stationId && typeof stationId === 'string') {
                    stationId = new mongoose.Types.ObjectId(stationId);
                }
                
                // Ensure stationId is a valid ObjectId
                if (!stationId || !mongoose.Types.ObjectId.isValid(stationId)) {
                    console.log('⚠️  Cannot create incident: Alert missing station or invalid station ID');
                    console.log(`   💡 Station ID value: ${stationId}`);
                } else {
                    // Ensure stationId is an ObjectId instance for consistent querying
                    if (!(stationId instanceof mongoose.Types.ObjectId)) {
                        stationId = new mongoose.Types.ObjectId(stationId);
                    }
                    console.log(`🔍 DEBUG [updateEmergencyAlert]: Looking for Operations department for station: ${stationId}`);
                    console.log(`🔍 DEBUG: Station ID type: ${typeof stationId}`);
                    console.log(`🔍 DEBUG: Station ID value: ${stationId}`);
                    console.log(`🔍 DEBUG: Station ID toString: ${stationId.toString()}`);
                    
                    // Query with station_id AND name contains "operations" (case-insensitive)
                    const operationsDepartment = await Department.findOne({ 
                        station_id: stationId,
                        name: { $regex: /operations/i } // Case-insensitive regex to match "Operations", "Operations Deparment", etc.
                    });
                    
                    // Debug: Also check what departments exist for this station
                    const allDeptsForStation = await Department.find({ station_id: stationId });
                    console.log(`🔍 DEBUG: Found ${allDeptsForStation.length} total department(s) for station ${stationId}:`);
                    allDeptsForStation.forEach((dept, index) => {
                        console.log(`   ${index + 1}. Department: "${dept.name}" (ID: ${dept._id})`);
                    });

                    if (!operationsDepartment) {
                        console.log(`⚠️  Cannot create incident: Operations department not found for station ${stationId}`);
                        console.log(`   💡 Available departments for this station: ${allDeptsForStation.map(d => d.name).join(', ') || 'None'}`);
                        console.log(`   💡 Make sure there is an Operations department with station_id matching the alert's station`);
                    } else {
                        console.log(`✅ Found Operations department: ${operationsDepartment._id} for station ${stationId}`);
                        
                        // Find an active unit under the Operations department
                        const activeUnit = await Unit.findOne({
                            department: operationsDepartment._id,
                            isActive: true
                        });

                        if (!activeUnit) {
                            console.log(`⚠️  Cannot create incident: No active unit found in Operations department for station ${stationId}`);
                            console.log(`   💡 Make sure there is an active unit (isActive: true) in the Operations department`);
                        } else {
                            console.log(`✅ Found active unit: ${activeUnit.name} (${activeUnit._id})`);
                            
                            // Create incident with status 'active' (default)
                            // Use the stationId we already extracted and validated
                            const incident = new Incident({
                                alertId: id,
                                station: stationId, // Use the validated stationId
                                departmentOnDuty: operationsDepartment._id,
                                unitOnDuty: activeUnit._id,
                                status: 'active' // Default status - active
                            });

                            await incident.save();
                            console.log('✅ Incident created automatically for accepted alert:', incident._id);
                            console.log(`   📍 Station: ${stationId}`);
                            console.log(`   🏢 Department: Operations (${operationsDepartment._id})`);
                            console.log(`   🚒 Unit: ${activeUnit.name} (${activeUnit._id})`);
                            
                            // Update station's hasActiveIncident field
                            try {
                                const activeIncidentsCount = await Incident.countDocuments({
                                    station: stationId,
                                    status: { $in: ['active', 'dispatched', 'on_scene'] }
                                });
                                
                                await Station.findByIdAndUpdate(stationId, {
                                    hasActiveIncident: activeIncidentsCount > 0
                                });
                                console.log(`✅ Updated station hasActiveIncident to ${activeIncidentsCount > 0}`);
                            } catch (stationUpdateError) {
                                console.error('⚠️ Error updating station hasActiveIncident:', stationUpdateError.message);
                            }
                            
                            // Broadcast new incident via WebSocket
                            try {
                                emitNewIncident(incident);
                            } catch (socketError) {
                                console.error('⚠️ Failed to broadcast incident creation via WebSocket:', socketError.message);
                            }
                        }
                    }
                }
            } catch (incidentError) {
                console.error('⚠️  Error creating incident for accepted alert:', incidentError.message);
                console.error('⚠️  Error details:', incidentError);
                // Don't fail the alert update if incident creation fails
            }
        }

        console.log('✅ Emergency alert updated successfully:', emergencyAlert._id);

        // Update station's hasActiveAlert field based on alert status
        try {
            const stationId = emergencyAlert.station?._id || emergencyAlert.station;
            if (stationId) {
                // Check if there are any active alerts for this station
                const activeAlertsCount = await EmergencyAlert.countDocuments({
                    station: stationId,
                    status: { $in: ['active', 'pending'] }
                });
                
                await Station.findByIdAndUpdate(stationId, {
                    hasActiveAlert: activeAlertsCount > 0
                });
                console.log(`✅ Updated station hasActiveAlert to ${activeAlertsCount > 0}`);
            }
        } catch (stationUpdateError) {
            console.error('⚠️ Error updating station hasActiveAlert:', stationUpdateError.message);
            // Don't fail the request if station update fails
        }

        // Broadcast updated alert via WebSocket
        try {
            emitAlertUpdated(emergencyAlert);
        } catch (socketError) {
            console.error('⚠️ Failed to broadcast alert update via WebSocket:', socketError.message);
        }

        res.json({
            success: true,
            message: 'Emergency alert updated successfully',
            data: emergencyAlert
        });

    } catch (error) {
        console.error('❌ Update emergency alert error:', error);
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors
            });
        }

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete Emergency Alert
export const deleteEmergencyAlert = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid emergency alert ID format'
            });
        }

        const emergencyAlert = await EmergencyAlert.findById(id);

        if (!emergencyAlert) {
            return res.status(404).json({
                success: false,
                message: 'Emergency alert not found'
            });
        }

        // Get station ID before deleting
        const stationId = emergencyAlert.station?._id || emergencyAlert.station;

        // Delete the alert
        await EmergencyAlert.findByIdAndDelete(id);

        console.log('🗑️ Emergency alert deleted successfully:', id);

        // Update station's hasActiveAlert field
        if (stationId) {
            try {
                // Check if there are any active alerts for this station
                const activeAlertsCount = await EmergencyAlert.countDocuments({
                    station: stationId,
                    status: { $in: ['active', 'pending'] }
                });
                
                await Station.findByIdAndUpdate(stationId, {
                    hasActiveAlert: activeAlertsCount > 0
                });
                console.log(`✅ Updated station hasActiveAlert to ${activeAlertsCount > 0}`);
            } catch (stationUpdateError) {
                console.error('⚠️ Error updating station hasActiveAlert:', stationUpdateError.message);
            }
        }

        // Broadcast deleted alert via WebSocket
        try {
            emitAlertDeleted(id);
        } catch (socketError) {
            console.error('⚠️ Failed to broadcast alert deletion via WebSocket:', socketError.message);
        }

        res.json({
            success: true,
            message: 'Emergency alert deleted successfully'
        });

    } catch (error) {
        console.error('❌ Delete emergency alert error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Emergency Alerts by Station
export const getEmergencyAlertsByStation = async (req, res) => {
    try {
        const { stationId } = req.params;
        const { status, priority, page = 1, limit = 10 } = req.query;

        if (!mongoose.Types.ObjectId.isValid(stationId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid station ID format'
            });
        }

        const filter = { station: stationId };
        if (status) filter.status = status;
        if (priority) filter.priority = priority;

        const skip = (page - 1) * limit;

        const emergencyAlerts = await EmergencyAlert.find(filter)
            .populate('reporterDetails')
            .sort({ reportedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await EmergencyAlert.countDocuments(filter);

        res.json({
            success: true,
            data: emergencyAlerts,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        console.error('❌ Get emergency alerts by station error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Emergency Alerts by User
export const getEmergencyAlertsByUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status, page = 1, limit = 10 } = req.query;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reporter ID format'
            });
        }

        const filter = { reporterId: userId };
        if (status) filter.status = status;

        const skip = (page - 1) * limit;

        const emergencyAlerts = await EmergencyAlert.find(filter)
            .populate('station', 'name location lat lng phone_number')
            .sort({ reportedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await EmergencyAlert.countDocuments(filter);

        res.json({
            success: true,
            data: emergencyAlerts,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        console.error('❌ Get emergency alerts by user error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Emergency Alerts Statistics
export const getEmergencyAlertStats = async (req, res) => {
    try {
        const { stationId, startDate, endDate } = req.query;

        const filter = {};
        if (stationId) filter.station = stationId;
        if (startDate || endDate) {
            filter.reportedAt = {};
            if (startDate) filter.reportedAt.$gte = new Date(startDate);
            if (endDate) filter.reportedAt.$lte = new Date(endDate);
        }

        const stats = await EmergencyAlert.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalAlerts: { $sum: 1 },
                    activeAlerts: {
                        $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                    },
                    acceptedAlerts: {
                        $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
                    },
                    rejectedAlerts: {
                        $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
                    },
                    referredAlerts: {
                        $sum: { $cond: [{ $eq: ['$status', 'referred'] }, 1, 0] }
                    },
                    highPriorityAlerts: {
                        $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
                    },
                    mediumPriorityAlerts: {
                        $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] }
                    },
                    lowPriorityAlerts: {
                        $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] }
                    },
                    fireIncidents: {
                        $sum: { $cond: [{ $eq: ['$incidentType', 'fire'] }, 1, 0] }
                    },
                    rescueIncidents: {
                        $sum: { $cond: [{ $eq: ['$incidentType', 'rescue'] }, 1, 0] }
                    },
                    medicalIncidents: {
                        $sum: { $cond: [{ $eq: ['$incidentType', 'medical'] }, 1, 0] }
                    },
                    otherIncidents: {
                        $sum: { $cond: [{ $eq: ['$incidentType', 'other'] }, 1, 0] }
                    }
                }
            }
        ]);

        const result = stats[0] || {
            totalAlerts: 0,
            activeAlerts: 0,
            acceptedAlerts: 0,
            rejectedAlerts: 0,
            referredAlerts: 0,
            highPriorityAlerts: 0,
            mediumPriorityAlerts: 0,
            lowPriorityAlerts: 0,
            fireIncidents: 0,
            rescueIncidents: 0,
            medicalIncidents: 0,
            otherIncidents: 0
        };

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('❌ Get emergency alert stats error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Dispatch Emergency Alert (active unit accepts and dispatches)
export const dispatchEmergencyAlert = async (req, res) => {
    try {
        const reportId = req.params.id;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(reportId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid emergency alert ID format'
            });
        }

        // Find the emergency alert
        const emergencyAlert = await EmergencyAlert.findById(reportId)
            .populate('unit')
            .populate('department');

        if (!emergencyAlert) {
            return res.status(404).json({
                success: false,
                message: 'Emergency alert not found'
            });
        }

        // Check if alert has been assigned to an active unit
        if (!emergencyAlert.unit || !emergencyAlert.unit.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Emergency alert must be assigned to an active unit before dispatch'
            });
        }

        // Check if alert has already been dispatched, declined, or referred
        if (emergencyAlert.dispatched) {
            return res.status(400).json({
                success: false,
                message: 'Emergency alert has already been dispatched'
            });
        }

        if (emergencyAlert.declined) {
            return res.status(400).json({
                success: false,
                message: 'Emergency alert has already been declined. Cannot dispatch a declined alert.'
            });
        }

        if (emergencyAlert.referred) {
            return res.status(400).json({
                success: false,
                message: 'Emergency alert has already been referred to another station. Cannot dispatch a referred alert.'
            });
        }

        // Check if status was already accepted
        const wasAlreadyAccepted = emergencyAlert.status === 'accepted';

        // Dispatch the alert
        emergencyAlert.dispatched = true;
        emergencyAlert.dispatchedAt = new Date();
        emergencyAlert.status = 'accepted'; // Update status to accepted
        await emergencyAlert.save();

        // If status changed to accepted, create an incident
        if (!wasAlreadyAccepted) {
            try {
                // Always allow creating incident (don't check for existing incident for this specific alert)
                // Get the station from the alert - ensure it's an ObjectId
                // Handle both populated and non-populated station references
                let stationId = emergencyAlert.station;
                
                // If station is populated as an object, extract _id
                if (stationId && typeof stationId === 'object' && stationId._id) {
                    stationId = stationId._id;
                }
                
                // Convert to ObjectId if it's a string
                if (stationId && typeof stationId === 'string') {
                    stationId = new mongoose.Types.ObjectId(stationId);
                }
                
                // Ensure stationId is a valid ObjectId
                if (!stationId || !mongoose.Types.ObjectId.isValid(stationId)) {
                    console.log('⚠️  Cannot create incident: Alert missing station or invalid station ID');
                    console.log(`   💡 Station ID value: ${stationId}`);
                } else {
                    // Ensure stationId is an ObjectId instance for consistent querying
                    if (!(stationId instanceof mongoose.Types.ObjectId)) {
                        stationId = new mongoose.Types.ObjectId(stationId);
                    }
                    console.log(`🔍 DEBUG [dispatchEmergencyAlert]: Looking for Operations department for station: ${stationId}`);
                    console.log(`🔍 DEBUG: Station ID type: ${typeof stationId}`);
                    console.log(`🔍 DEBUG: Station ID value: ${stationId}`);
                    console.log(`🔍 DEBUG: Station ID toString: ${stationId.toString()}`);
                    
                    // Query with station_id AND name contains "operations" (case-insensitive)
                    const operationsDepartment = await Department.findOne({ 
                        station_id: stationId,
                        name: { $regex: /operations/i } // Case-insensitive regex to match "Operations", "Operations Deparment", etc.
                    });
                    
                    // Debug: Also check what departments exist for this station
                    const allDeptsForStation = await Department.find({ station_id: stationId });
                    console.log(`🔍 DEBUG: Found ${allDeptsForStation.length} total department(s) for station ${stationId}:`);
                    allDeptsForStation.forEach((dept, index) => {
                        console.log(`   ${index + 1}. Department: "${dept.name}" (ID: ${dept._id})`);
                    });

                    if (!operationsDepartment) {
                        console.log(`⚠️  Cannot create incident: Operations department not found for station ${stationId}`);
                        console.log(`   💡 Available departments for this station: ${allDeptsForStation.map(d => d.name).join(', ') || 'None'}`);
                        console.log(`   💡 Make sure there is an Operations department with station_id matching the alert's station`);
                    } else {
                        console.log(`✅ Found Operations department: ${operationsDepartment._id} for station ${stationId}`);
                        
                        // Find an active unit under the Operations department
                        const activeUnit = await Unit.findOne({
                            department: operationsDepartment._id,
                            isActive: true
                        });

                        if (!activeUnit) {
                            console.log(`⚠️  Cannot create incident: No active unit found in Operations department for station ${stationId}`);
                            console.log(`   💡 Make sure there is an active unit (isActive: true) in the Operations department`);
                        } else {
                            console.log(`✅ Found active unit: ${activeUnit.name} (${activeUnit._id})`);
                            
                            // Create incident with status 'active' (default)
                            // Use the stationId we already extracted and validated
                            const incident = new Incident({
                                alertId: reportId,
                                station: stationId, // Use the validated stationId
                                departmentOnDuty: operationsDepartment._id,
                                unitOnDuty: activeUnit._id,
                                status: 'active' // Default status - active
                            });

                            await incident.save();
                            console.log('✅ Incident created automatically for dispatched alert:', incident._id);
                            console.log(`   📍 Station: ${stationId}`);
                            console.log(`   🏢 Department: Operations (${operationsDepartment._id})`);
                            console.log(`   🚒 Unit: ${activeUnit.name} (${activeUnit._id})`);
                            
                            // Update station's hasActiveIncident field
                            try {
                                const activeIncidentsCount = await Incident.countDocuments({
                                    station: stationId,
                                    status: { $in: ['active', 'dispatched', 'on_scene'] }
                                });
                                
                                await Station.findByIdAndUpdate(stationId, {
                                    hasActiveIncident: activeIncidentsCount > 0
                                });
                                console.log(`✅ Updated station hasActiveIncident to ${activeIncidentsCount > 0}`);
                            } catch (stationUpdateError) {
                                console.error('⚠️ Error updating station hasActiveIncident:', stationUpdateError.message);
                            }
                            
                            // Broadcast new incident via WebSocket
                            try {
                                emitNewIncident(incident);
                            } catch (socketError) {
                                console.error('⚠️ Failed to broadcast incident creation via WebSocket:', socketError.message);
                            }
                        }
                    }
                }
            } catch (incidentError) {
                console.error('⚠️  Error creating incident for dispatched alert:', incidentError.message);
                // Don't fail the dispatch if incident creation fails
            }
        }

        // Populate related data
        await emergencyAlert.populate([
            { path: 'station', select: 'name location lat lng phone_number placeId' },
            { path: 'department', select: 'name description' },
            { path: 'unit', select: 'name isActive' },
            { path: 'reporterDetails', select: 'name phone email' }
        ]);

        // Update station's hasActiveAlert field based on alert status
        try {
            const stationId = emergencyAlert.station?._id || emergencyAlert.station;
            if (stationId) {
                // Check if there are any active alerts for this station
                const activeAlertsCount = await EmergencyAlert.countDocuments({
                    station: stationId,
                    status: { $in: ['active', 'pending'] }
                });
                
                await Station.findByIdAndUpdate(stationId, {
                    hasActiveAlert: activeAlertsCount > 0
                });
                console.log(`✅ Updated station hasActiveAlert to ${activeAlertsCount > 0}`);
            }
        } catch (stationUpdateError) {
            console.error('⚠️ Error updating station hasActiveAlert:', stationUpdateError.message);
            // Don't fail the request if station update fails
        }

        // Broadcast updated alert via WebSocket
        try {
            emitAlertUpdated(emergencyAlert);
        } catch (socketError) {
            console.error('⚠️ Failed to broadcast alert update via WebSocket:', socketError.message);
        }

        res.status(200).json({
            success: true,
            message: 'Emergency alert dispatched successfully',
            data: emergencyAlert
        });
    } catch (error) {
        console.error('❌ Dispatch emergency alert error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Decline Emergency Alert (active unit declines)
export const declineEmergencyAlert = async (req, res) => {
    try {
        const reportId = req.params.id;
        const { reason } = req.body;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(reportId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid emergency alert ID format'
            });
        }

        // Validate reason is provided
        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Decline reason is required'
            });
        }

        // Find the emergency alert
        const emergencyAlert = await EmergencyAlert.findById(reportId)
            .populate('unit')
            .populate('department');

        if (!emergencyAlert) {
            return res.status(404).json({
                success: false,
                message: 'Emergency alert not found'
            });
        }

        // Check if alert has been assigned to an active unit
        if (!emergencyAlert.unit || !emergencyAlert.unit.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Emergency alert must be assigned to an active unit before declining'
            });
        }

        // Check if alert has already been dispatched, declined, or referred
        if (emergencyAlert.dispatched) {
            return res.status(400).json({
                success: false,
                message: 'Emergency alert has already been dispatched. Cannot decline a dispatched alert.'
            });
        }

        if (emergencyAlert.declined) {
            return res.status(400).json({
                success: false,
                message: 'Emergency alert has already been declined'
            });
        }

        if (emergencyAlert.referred) {
            return res.status(400).json({
                success: false,
                message: 'Emergency alert has already been referred. Cannot decline a referred alert.'
            });
        }

        // Decline the alert
        emergencyAlert.declined = true;
        emergencyAlert.declinedAt = new Date();
        emergencyAlert.declineReason = reason.trim();
        await emergencyAlert.save();

        // Populate related data
        await emergencyAlert.populate([
            { path: 'station', select: 'name location lat lng phone_number placeId' },
            { path: 'department', select: 'name description' },
            { path: 'unit', select: 'name isActive' },
            { path: 'reporterDetails', select: 'name phone email' }
        ]);

        res.status(200).json({
            success: true,
            message: 'Emergency alert declined successfully',
            data: emergencyAlert
        });
    } catch (error) {
        console.error('❌ Decline emergency alert error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Refer Emergency Alert to Another Station
export const referEmergencyAlert = async (req, res) => {
    try {
        const reportId = req.params.id;
        const { stationId, reason } = req.body;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(reportId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid emergency alert ID format'
            });
        }

        // Validate stationId is provided
        if (!stationId) {
            return res.status(400).json({
                success: false,
                message: 'Station ID is required'
            });
        }

        // Validate stationId format
        if (!mongoose.Types.ObjectId.isValid(stationId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid station ID format'
            });
        }

        // Validate reason is provided
        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Refer reason is required'
            });
        }

        // Check if referred station exists
        const referredStation = await Station.findById(stationId);
        if (!referredStation) {
            return res.status(404).json({
                success: false,
                message: 'Referred station not found'
            });
        }

        // Find the emergency alert
        const emergencyAlert = await EmergencyAlert.findById(reportId)
            .populate('unit')
            .populate('department');

        if (!emergencyAlert) {
            return res.status(404).json({
                success: false,
                message: 'Emergency alert not found'
            });
        }

        // Check if alert has been assigned to an active unit
        if (!emergencyAlert.unit || !emergencyAlert.unit.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Emergency alert must be assigned to an active unit before referring'
            });
        }

        // Check if trying to refer to the same station
        if (emergencyAlert.station.toString() === stationId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot refer emergency alert to the same station'
            });
        }

        // Check if alert has already been dispatched, declined, or referred
        if (emergencyAlert.dispatched) {
            return res.status(400).json({
                success: false,
                message: 'Emergency alert has already been dispatched. Cannot refer a dispatched alert.'
            });
        }

        if (emergencyAlert.declined) {
            return res.status(400).json({
                success: false,
                message: 'Emergency alert has already been declined. Cannot refer a declined alert.'
            });
        }

        if (emergencyAlert.referred) {
            return res.status(400).json({
                success: false,
                message: 'Emergency alert has already been referred to another station'
            });
        }

        // Refer the alert
        emergencyAlert.referred = true;
        emergencyAlert.referredAt = new Date();
        emergencyAlert.referredToStation = stationId;
        emergencyAlert.referReason = reason.trim();
        // Update the station to the referred station
        emergencyAlert.station = stationId;
        // Clear unit assignment as it will be reassigned by the new station
        emergencyAlert.unit = null;
        emergencyAlert.department = null;
        await emergencyAlert.save();

        // Populate related data
        await emergencyAlert.populate([
            { path: 'station', select: 'name location lat lng phone_number placeId' },
            { path: 'department', select: 'name description' },
            { path: 'unit', select: 'name isActive' },
            { path: 'referredStationDetails', select: 'name location lat lng phone_number placeId' },
            { path: 'reporterDetails', select: 'name phone email' }
        ]);

        res.status(200).json({
            success: true,
            message: 'Emergency alert referred successfully',
            data: emergencyAlert
        });
    } catch (error) {
        console.error('❌ Refer emergency alert error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
