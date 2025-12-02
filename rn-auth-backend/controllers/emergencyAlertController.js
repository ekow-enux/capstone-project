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
            console.log('🚨 ===== STARTING INCIDENT CREATION PROCESS =====');
            console.log(`📋 Alert ID: ${id}`);
            console.log(`📋 Alert Status Change: ${currentStatus} -> ${newStatus}`);
            
            try {
                // Always allow creating incident (don't check for existing incident for this specific alert)
                // Get the station from the currentAlert (before update) to ensure we have the ObjectId reference
                // Use currentAlert.station instead of emergencyAlert.station to avoid population issues
                console.log('🔍 Step 1: Extracting station ID from currentAlert...');
                let stationId = currentAlert.station;
                console.log(`   Raw stationId from currentAlert:`, stationId);
                console.log(`   stationId type: ${typeof stationId}`);
                console.log(`   stationId instanceof ObjectId: ${stationId instanceof mongoose.Types.ObjectId}`);
                
                // If station is populated as an object, extract _id
                if (stationId && typeof stationId === 'object' && stationId._id) {
                    console.log('   📍 Station is populated object, extracting _id...');
                    stationId = stationId._id;
                    console.log(`   Extracted _id: ${stationId}`);
                }
                
                // Convert to ObjectId if it's a string
                if (stationId && typeof stationId === 'string') {
                    console.log('   🔄 Converting string stationId to ObjectId...');
                    stationId = new mongoose.Types.ObjectId(stationId);
                    console.log(`   Converted to ObjectId: ${stationId}`);
                }
                
                // Ensure stationId is a valid ObjectId
                console.log('🔍 Step 2: Validating station ID...');
                console.log(`   Final stationId: ${stationId}`);
                console.log(`   stationId is valid: ${stationId ? mongoose.Types.ObjectId.isValid(stationId) : false}`);
                
                if (!stationId || !mongoose.Types.ObjectId.isValid(stationId)) {
                    console.error('❌ Cannot create incident: Alert missing station or invalid station ID');
                    console.error(`   💡 Station ID value: ${stationId}`);
                    console.error(`   💡 Station ID type: ${typeof stationId}`);
                    console.error('🚨 ===== INCIDENT CREATION FAILED - INVALID STATION ID =====');
                } else {
                    // Ensure stationId is an ObjectId instance for consistent querying
                    if (!(stationId instanceof mongoose.Types.ObjectId)) {
                        stationId = new mongoose.Types.ObjectId(stationId);
                    }
                    console.log(`🔍 Step 3: Looking for Operations department for station: ${stationId}`);
                    console.log(`   Station ID toString: ${stationId.toString()}`);
                    
                    // Query with station_id AND name contains "operations" (case-insensitive)
                    console.log('   🔄 Querying Department collection...');
                    const operationsDepartment = await Department.findOne({ 
                        station_id: stationId,
                        name: { $regex: /operations/i } // Case-insensitive regex to match "Operations", "Operations Deparment", etc.
                    });
                    
                    // Debug: Also check what departments exist for this station
                    const allDeptsForStation = await Department.find({ station_id: stationId });
                    console.log(`   📊 Found ${allDeptsForStation.length} total department(s) for station ${stationId}:`);
                    allDeptsForStation.forEach((dept, index) => {
                        console.log(`      ${index + 1}. Department: "${dept.name}" (ID: ${dept._id}, station_id: ${dept.station_id})`);
                    });

                    if (!operationsDepartment) {
                        console.error(`❌ Cannot create incident: Operations department not found for station ${stationId}`);
                        console.error(`   💡 Available departments for this station: ${allDeptsForStation.map(d => d.name).join(', ') || 'None'}`);
                        console.error(`   💡 Make sure there is an Operations department with station_id matching the alert's station`);
                        console.error('🚨 ===== INCIDENT CREATION FAILED - NO OPERATIONS DEPARTMENT =====');
                    } else {
                        console.log(`✅ Step 3 Complete: Found Operations department: ${operationsDepartment._id} for station ${stationId}`);
                        console.log(`   Department Name: "${operationsDepartment.name}"`);
                        console.log(`   Department station_id: ${operationsDepartment.station_id}`);
                        
                        // Find an active unit under the Operations department
                        console.log(`🔍 Step 4: Looking for active unit in Operations department...`);
                        console.log(`   Department ID: ${operationsDepartment._id}`);
                        
                        const activeUnit = await Unit.findOne({
                            department: operationsDepartment._id,
                            isActive: true
                        });
                        
                        console.log(`   📊 Active unit query result:`, activeUnit ? `Found ${activeUnit.name} (${activeUnit._id})` : 'No active unit found');
                        
                        // Check all units in department for debugging
                        const allUnitsInDept = await Unit.find({ department: operationsDepartment._id });
                        console.log(`   📊 Total units in Operations department: ${allUnitsInDept.length}`);
                        allUnitsInDept.forEach((unit, index) => {
                            console.log(`      ${index + 1}. Unit: "${unit.name}" (ID: ${unit._id}, isActive: ${unit.isActive})`);
                        });

                        if (!activeUnit) {
                            console.error(`❌ Cannot create incident: No active unit found in Operations department for station ${stationId}`);
                            console.error(`   💡 Make sure there is an active unit (isActive: true) in the Operations department`);
                            console.error('🚨 ===== INCIDENT CREATION FAILED - NO ACTIVE UNIT =====');
                        } else {
                            console.log(`✅ Step 4 Complete: Found active unit: ${activeUnit.name} (${activeUnit._id})`);
                            
                            // Create incident with status 'pending' when alert is accepted
                            // Use the stationId we already extracted and validated
                            console.log(`🔍 Step 5: Creating incident object...`);
                            const incidentData = {
                                alertId: id,
                                station: stationId, // Use the validated stationId
                                departmentOnDuty: operationsDepartment._id,
                                unitOnDuty: activeUnit._id,
                                status: 'pending' // Status is pending when alert is accepted
                            };
                            
                            console.log(`   📝 Incident data to create:`, {
                                alertId: incidentData.alertId,
                                station: incidentData.station.toString(),
                                departmentOnDuty: incidentData.departmentOnDuty.toString(),
                                unitOnDuty: incidentData.unitOnDuty.toString(),
                                status: incidentData.status
                            });
                            
                            const incident = new Incident(incidentData);
                            console.log(`   ✅ Incident object created (before save)`);
                            console.log(`   📋 Incident._id (generated): ${incident._id}`);
                            console.log(`   📋 Incident.alertId: ${incident.alertId}`);
                            console.log(`   📋 Incident.station: ${incident.station}`);
                            console.log(`   📋 Incident.departmentOnDuty: ${incident.departmentOnDuty}`);
                            console.log(`   📋 Incident.unitOnDuty: ${incident.unitOnDuty}`);
                            console.log(`   📋 Incident.status: ${incident.status}`);

                            console.log(`🔍 Step 6: Saving incident to database...`);
                            try {
                                await incident.save();
                                console.log('✅ Step 6 Complete: Incident saved successfully!');
                                console.log(`   ✅ Incident ID: ${incident._id}`);
                                console.log(`   📍 Station: ${stationId}`);
                                console.log(`   🏢 Department: Operations (${operationsDepartment._id})`);
                                console.log(`   🚒 Unit: ${activeUnit.name} (${activeUnit._id})`);
                                console.log('🚨 ===== INCIDENT CREATION SUCCESSFUL =====');
                                
                                // Update station's hasActiveIncident field
                                console.log(`🔍 Step 7: Updating station hasActiveIncident field...`);
                                try {
                                    const activeIncidentsCount = await Incident.countDocuments({
                                        station: stationId,
                                        status: { $in: ['pending', 'dispatched', 'active', 'on_scene'] }
                                    });
                                    
                                    console.log(`   📊 Active incidents count: ${activeIncidentsCount}`);
                                    
                                    await Station.findByIdAndUpdate(stationId, {
                                        hasActiveIncident: activeIncidentsCount > 0
                                    });
                                    console.log(`✅ Step 7 Complete: Updated station hasActiveIncident to ${activeIncidentsCount > 0}`);
                                } catch (stationUpdateError) {
                                    console.error('⚠️ Step 7 Failed: Error updating station hasActiveIncident:', stationUpdateError.message);
                                    console.error('   Error stack:', stationUpdateError.stack);
                                }
                                
                                // Broadcast new incident via WebSocket
                                console.log(`🔍 Step 8: Broadcasting incident via WebSocket...`);
                                try {
                                    emitNewIncident(incident);
                                    console.log(`✅ Step 8 Complete: Incident broadcasted via WebSocket`);
                                } catch (socketError) {
                                    console.error('⚠️ Step 8 Failed: Failed to broadcast incident creation via WebSocket:', socketError.message);
                                    console.error('   Error stack:', socketError.stack);
                                }
                            } catch (saveError) {
                                console.error('❌ Step 6 Failed: Error saving incident to database');
                                console.error(`   Error message: ${saveError.message}`);
                                console.error(`   Error name: ${saveError.name}`);
                                console.error(`   Error code: ${saveError.code}`);
                                if (saveError.errors) {
                                    console.error(`   Validation errors:`, JSON.stringify(saveError.errors, null, 2));
                                }
                                console.error(`   Error stack:`, saveError.stack);
                                console.error('🚨 ===== INCIDENT CREATION FAILED - SAVE ERROR =====');
                                throw saveError; // Re-throw to be caught by outer catch
                            }
                        }
                    }
                }
            } catch (incidentError) {
                console.error('❌ ===== INCIDENT CREATION FAILED - UNEXPECTED ERROR =====');
                console.error(`   Error message: ${incidentError.message}`);
                console.error(`   Error name: ${incidentError.name}`);
                console.error(`   Error code: ${incidentError.code || 'N/A'}`);
                if (incidentError.errors) {
                    console.error(`   Validation errors:`, JSON.stringify(incidentError.errors, null, 2));
                }
                console.error(`   Error stack:`, incidentError.stack);
                console.error('⚠️  Incident creation failed but alert update will continue...');
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
            console.log('🚨 ===== STARTING INCIDENT CREATION PROCESS (DISPATCH) =====');
            console.log(`📋 Alert ID: ${reportId}`);
            console.log(`📋 Alert Status Change: ${emergencyAlert.status} -> accepted`);
            
            try {
                // Always allow creating incident (don't check for existing incident for this specific alert)
                // Get the station from the alert - ensure it's an ObjectId
                // Handle both populated and non-populated station references
                console.log('🔍 Step 1: Extracting station ID from emergencyAlert...');
                let stationId = emergencyAlert.station;
                console.log(`   Raw stationId from emergencyAlert:`, stationId);
                console.log(`   stationId type: ${typeof stationId}`);
                console.log(`   stationId instanceof ObjectId: ${stationId instanceof mongoose.Types.ObjectId}`);
                
                // If station is populated as an object, extract _id
                if (stationId && typeof stationId === 'object' && stationId._id) {
                    console.log('   📍 Station is populated object, extracting _id...');
                    stationId = stationId._id;
                    console.log(`   Extracted _id: ${stationId}`);
                }
                
                // Convert to ObjectId if it's a string
                if (stationId && typeof stationId === 'string') {
                    console.log('   🔄 Converting string stationId to ObjectId...');
                    stationId = new mongoose.Types.ObjectId(stationId);
                    console.log(`   Converted to ObjectId: ${stationId}`);
                }
                
                // Ensure stationId is a valid ObjectId
                console.log('🔍 Step 2: Validating station ID...');
                console.log(`   Final stationId: ${stationId}`);
                console.log(`   stationId is valid: ${stationId ? mongoose.Types.ObjectId.isValid(stationId) : false}`);
                
                if (!stationId || !mongoose.Types.ObjectId.isValid(stationId)) {
                    console.error('❌ Cannot create incident: Alert missing station or invalid station ID');
                    console.error(`   💡 Station ID value: ${stationId}`);
                    console.error(`   💡 Station ID type: ${typeof stationId}`);
                    console.error('🚨 ===== INCIDENT CREATION FAILED - INVALID STATION ID =====');
                } else {
                    // Ensure stationId is an ObjectId instance for consistent querying
                    if (!(stationId instanceof mongoose.Types.ObjectId)) {
                        stationId = new mongoose.Types.ObjectId(stationId);
                    }
                    console.log(`🔍 Step 3: Looking for Operations department for station: ${stationId}`);
                    console.log(`   Station ID toString: ${stationId.toString()}`);
                    
                    // Query with station_id AND name contains "operations" (case-insensitive)
                    console.log('   🔄 Querying Department collection...');
                    const operationsDepartment = await Department.findOne({ 
                        station_id: stationId,
                        name: { $regex: /operations/i } // Case-insensitive regex to match "Operations", "Operations Deparment", etc.
                    });
                    
                    // Debug: Also check what departments exist for this station
                    const allDeptsForStation = await Department.find({ station_id: stationId });
                    console.log(`   📊 Found ${allDeptsForStation.length} total department(s) for station ${stationId}:`);
                    allDeptsForStation.forEach((dept, index) => {
                        console.log(`      ${index + 1}. Department: "${dept.name}" (ID: ${dept._id}, station_id: ${dept.station_id})`);
                    });

                    if (!operationsDepartment) {
                        console.error(`❌ Cannot create incident: Operations department not found for station ${stationId}`);
                        console.error(`   💡 Available departments for this station: ${allDeptsForStation.map(d => d.name).join(', ') || 'None'}`);
                        console.error(`   💡 Make sure there is an Operations department with station_id matching the alert's station`);
                        console.error('🚨 ===== INCIDENT CREATION FAILED - NO OPERATIONS DEPARTMENT =====');
                    } else {
                        console.log(`✅ Step 3 Complete: Found Operations department: ${operationsDepartment._id} for station ${stationId}`);
                        console.log(`   Department Name: "${operationsDepartment.name}"`);
                        console.log(`   Department station_id: ${operationsDepartment.station_id}`);
                        
                        // Find an active unit under the Operations department
                        console.log(`🔍 Step 4: Looking for active unit in Operations department...`);
                        console.log(`   Department ID: ${operationsDepartment._id}`);
                        
                        const activeUnit = await Unit.findOne({
                            department: operationsDepartment._id,
                            isActive: true
                        });
                        
                        console.log(`   📊 Active unit query result:`, activeUnit ? `Found ${activeUnit.name} (${activeUnit._id})` : 'No active unit found');
                        
                        // Check all units in department for debugging
                        const allUnitsInDept = await Unit.find({ department: operationsDepartment._id });
                        console.log(`   📊 Total units in Operations department: ${allUnitsInDept.length}`);
                        allUnitsInDept.forEach((unit, index) => {
                            console.log(`      ${index + 1}. Unit: "${unit.name}" (ID: ${unit._id}, isActive: ${unit.isActive})`);
                        });

                        if (!activeUnit) {
                            console.error(`❌ Cannot create incident: No active unit found in Operations department for station ${stationId}`);
                            console.error(`   💡 Make sure there is an active unit (isActive: true) in the Operations department`);
                            console.error('🚨 ===== INCIDENT CREATION FAILED - NO ACTIVE UNIT =====');
                        } else {
                            console.log(`✅ Step 4 Complete: Found active unit: ${activeUnit.name} (${activeUnit._id})`);
                            
                            // Create incident with status 'pending' when alert is accepted
                            // Use the stationId we already extracted and validated
                            console.log(`🔍 Step 5: Creating incident object...`);
                            const incidentData = {
                                alertId: reportId,
                                station: stationId, // Use the validated stationId
                                departmentOnDuty: operationsDepartment._id,
                                unitOnDuty: activeUnit._id,
                                status: 'pending' // Status is pending when alert is accepted
                            };
                            
                            console.log(`   📝 Incident data to create:`, {
                                alertId: incidentData.alertId,
                                station: incidentData.station.toString(),
                                departmentOnDuty: incidentData.departmentOnDuty.toString(),
                                unitOnDuty: incidentData.unitOnDuty.toString(),
                                status: incidentData.status
                            });
                            
                            const incident = new Incident(incidentData);
                            console.log(`   ✅ Incident object created (before save)`);
                            console.log(`   📋 Incident._id (generated): ${incident._id}`);
                            console.log(`   📋 Incident.alertId: ${incident.alertId}`);
                            console.log(`   📋 Incident.station: ${incident.station}`);
                            console.log(`   📋 Incident.departmentOnDuty: ${incident.departmentOnDuty}`);
                            console.log(`   📋 Incident.unitOnDuty: ${incident.unitOnDuty}`);
                            console.log(`   📋 Incident.status: ${incident.status}`);

                            console.log(`🔍 Step 6: Saving incident to database...`);
                            try {
                                await incident.save();
                                console.log('✅ Step 6 Complete: Incident saved successfully!');
                                console.log(`   ✅ Incident ID: ${incident._id}`);
                                console.log(`   📍 Station: ${stationId}`);
                                console.log(`   🏢 Department: Operations (${operationsDepartment._id})`);
                                console.log(`   🚒 Unit: ${activeUnit.name} (${activeUnit._id})`);
                                console.log('🚨 ===== INCIDENT CREATION SUCCESSFUL =====');
                                
                                // Update station's hasActiveIncident field
                                console.log(`🔍 Step 7: Updating station hasActiveIncident field...`);
                                try {
                                    const activeIncidentsCount = await Incident.countDocuments({
                                        station: stationId,
                                        status: { $in: ['pending', 'dispatched', 'active', 'on_scene'] }
                                    });
                                    
                                    console.log(`   📊 Active incidents count: ${activeIncidentsCount}`);
                                    
                                    await Station.findByIdAndUpdate(stationId, {
                                        hasActiveIncident: activeIncidentsCount > 0
                                    });
                                    console.log(`✅ Step 7 Complete: Updated station hasActiveIncident to ${activeIncidentsCount > 0}`);
                                } catch (stationUpdateError) {
                                    console.error('⚠️ Step 7 Failed: Error updating station hasActiveIncident:', stationUpdateError.message);
                                    console.error('   Error stack:', stationUpdateError.stack);
                                }
                                
                                // Broadcast new incident via WebSocket
                                console.log(`🔍 Step 8: Broadcasting incident via WebSocket...`);
                                try {
                                    emitNewIncident(incident);
                                    console.log(`✅ Step 8 Complete: Incident broadcasted via WebSocket`);
                                } catch (socketError) {
                                    console.error('⚠️ Step 8 Failed: Failed to broadcast incident creation via WebSocket:', socketError.message);
                                    console.error('   Error stack:', socketError.stack);
                                }
                            } catch (saveError) {
                                console.error('❌ Step 6 Failed: Error saving incident to database');
                                console.error(`   Error message: ${saveError.message}`);
                                console.error(`   Error name: ${saveError.name}`);
                                console.error(`   Error code: ${saveError.code}`);
                                if (saveError.errors) {
                                    console.error(`   Validation errors:`, JSON.stringify(saveError.errors, null, 2));
                                }
                                console.error(`   Error stack:`, saveError.stack);
                                console.error('🚨 ===== INCIDENT CREATION FAILED - SAVE ERROR =====');
                                throw saveError; // Re-throw to be caught by outer catch
                            }
                        }
                    }
                }
            } catch (incidentError) {
                console.error('❌ ===== INCIDENT CREATION FAILED - UNEXPECTED ERROR =====');
                console.error(`   Error message: ${incidentError.message}`);
                console.error(`   Error name: ${incidentError.name}`);
                console.error(`   Error code: ${incidentError.code || 'N/A'}`);
                if (incidentError.errors) {
                    console.error(`   Validation errors:`, JSON.stringify(incidentError.errors, null, 2));
                }
                console.error(`   Error stack:`, incidentError.stack);
                console.error('⚠️  Incident creation failed but alert dispatch will continue...');
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
