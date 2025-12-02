import Incident from '../models/Incident.js';
import EmergencyAlert from '../models/EmergencyAlert.js';
import Department from '../models/Department.js';
import Unit from '../models/Unit.js';
import Station from '../models/Station.js';
import mongoose from 'mongoose';
import { emitNewIncident, emitIncidentUpdated, emitIncidentDeleted } from '../services/socketService.js';

// Create Incident
export const createIncident = async (req, res) => {
    try {
        // Check if station is in commission before creating incident
        const {
            alertId,
            departmentOnDuty,
            unitOnDuty,
            status,
            dispatchedAt,
            arrivedAt,
            resolvedAt,
            closedAt
        } = req.body;
        
        if (alertId) {
            const alert = await EmergencyAlert.findById(alertId);
            if (alert) {
                const stationId = alert.station?._id || alert.station;
                if (stationId) {
                    const station = await Station.findById(stationId);
                    if (station && station.status === 'out of commission') {
                        return res.status(400).json({
                            success: false,
                            message: 'Cannot create incident: Station is out of commission'
                        });
                    }
                }
            }
        }

        // Validate required fields
        if (!alertId || !departmentOnDuty || !unitOnDuty) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: alertId, departmentOnDuty, unitOnDuty'
            });
        }

        // Validate ObjectIds
        if (!mongoose.Types.ObjectId.isValid(alertId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid alert ID format'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(departmentOnDuty)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid department ID format'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(unitOnDuty)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid unit ID format'
            });
        }

        // Check if alert exists
        const alert = await EmergencyAlert.findById(alertId);
        if (!alert) {
            return res.status(404).json({
                success: false,
                message: 'Alert not found'
            });
        }

        // Note: We no longer prevent creating incidents if one already exists for an alert
        // Multiple incidents can be created for the same alert if needed

        // Get station ID from the alert
        const alertStationId = alert.station?._id || alert.station;
        const incidentStationId = typeof alertStationId === 'string' 
            ? new mongoose.Types.ObjectId(alertStationId) 
            : alertStationId;

        // Create incident
        const incident = new Incident({
            alertId,
            station: incidentStationId, // Add station ID from alert
            departmentOnDuty,
            unitOnDuty,
            status: status || 'active',
            dispatchedAt,
            arrivedAt,
            resolvedAt,
            closedAt
        });

        await incident.save();

        // Update station's hasActiveIncident field
        try {
            const stationId = incidentStationId;
            if (stationId) {
                // Check if there are any active incidents for this station
                const activeIncidentsCount = await Incident.countDocuments({
                    station: stationId,
                    status: { $in: ['active', 'dispatched', 'on_scene'] }
                });
                
                await Station.findByIdAndUpdate(stationId, {
                    hasActiveIncident: activeIncidentsCount > 0
                });
                console.log(`✅ Updated station hasActiveIncident to ${activeIncidentsCount > 0}`);
            }
        } catch (stationUpdateError) {
            console.error('⚠️ Error updating station hasActiveIncident:', stationUpdateError.message);
            // Don't fail the request if station update fails
        }

        // Populate related data
        await incident.populate([
            { path: 'alertId', select: 'incidentType incidentName location station reporterId reporterType status priority' },
            { path: 'departmentOnDuty', select: 'name description' },
            { path: 'unitOnDuty', select: 'name isActive department' }
        ]);

        // Broadcast new incident via WebSocket
        try {
            emitNewIncident(incident);
        } catch (socketError) {
            console.error('⚠️ Failed to broadcast incident creation via WebSocket:', socketError.message);
        }

        res.status(201).json({
            success: true,
            message: 'Incident created successfully',
            data: incident
        });

    } catch (error) {
        console.error('❌ Create incident error:', error);
        
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

// Get All Incidents
export const getAllIncidents = async (req, res) => {
    try {
        const { status, departmentId, unitId, page = 1, limit = 10 } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (departmentId) filter.departmentOnDuty = departmentId;
        if (unitId) filter.unitOnDuty = unitId;

        const skip = (page - 1) * limit;

        const incidents = await Incident.find(filter)
            .populate('alertId', 'incidentType incidentName location station status priority')
            .populate('departmentOnDuty', 'name description')
            .populate('unitOnDuty', 'name isActive department')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Incident.countDocuments(filter);

        res.json({
            success: true,
            data: incidents,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        console.error('❌ Get all incidents error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Incident by ID
export const getIncidentById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid incident ID format'
            });
        }

        const incident = await Incident.findById(id)
            .populate('alertId')
            .populate('departmentOnDuty', 'name description')
            .populate('unitOnDuty', 'name isActive department');

        if (!incident) {
            return res.status(404).json({
                success: false,
                message: 'Incident not found'
            });
        }

        res.json({
            success: true,
            data: incident
        });

    } catch (error) {
        console.error('❌ Get incident by ID error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Incident by Alert ID
export const getIncidentByAlertId = async (req, res) => {
    try {
        const { alertId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(alertId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid alert ID format'
            });
        }

        const incident = await Incident.findOne({ alertId })
            .populate('alertId')
            .populate('departmentOnDuty', 'name description')
            .populate('unitOnDuty', 'name isActive department');

        if (!incident) {
            return res.status(404).json({
                success: false,
                message: 'Incident not found for this alert'
            });
        }

        res.json({
            success: true,
            data: incident
        });

    } catch (error) {
        console.error('❌ Get incident by alert ID error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update Incident
export const updateIncident = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid incident ID format'
            });
        }

        // If updating status, timestamps will be automatically set by pre-save middleware
        // But allow manual override if provided
        const incident = await Incident.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate([
            { path: 'alertId', select: 'incidentType incidentName location station status priority' },
            { path: 'departmentOnDuty', select: 'name description' },
            { path: 'unitOnDuty', select: 'name isActive department' }
        ]);

        if (!incident) {
            return res.status(404).json({
                success: false,
                message: 'Incident not found'
            });
        }

        // Update station's hasActiveIncident field based on incident status
        try {
            const stationId = incident.station;
            if (stationId) {
                // Check if there are any active incidents for this station
                const activeIncidentsCount = await Incident.countDocuments({
                    station: stationId,
                    status: { $in: ['active', 'dispatched', 'on_scene'] }
                });
                
                await Station.findByIdAndUpdate(stationId, {
                    hasActiveIncident: activeIncidentsCount > 0
                });
                console.log(`✅ Updated station hasActiveIncident to ${activeIncidentsCount > 0}`);
            }
        } catch (stationUpdateError) {
            console.error('⚠️ Error updating station hasActiveIncident:', stationUpdateError.message);
            // Don't fail the request if station update fails
        }

        // Broadcast updated incident via WebSocket
        try {
            emitIncidentUpdated(incident);
        } catch (socketError) {
            console.error('⚠️ Failed to broadcast incident update via WebSocket:', socketError.message);
        }

        res.json({
            success: true,
            message: 'Incident updated successfully',
            data: incident
        });

    } catch (error) {
        console.error('❌ Update incident error:', error);
        
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

// Update Incident Status
export const updateIncidentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, timestamp } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid incident ID format'
            });
        }

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        const validStatuses = ['active', 'dispatched', 'on_scene', 'resolved', 'closed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Status must be one of: ${validStatuses.join(', ')}`
            });
        }

        const incident = await Incident.findById(id);
        if (!incident) {
            return res.status(404).json({
                success: false,
                message: 'Incident not found'
            });
        }

        // Update status
        incident.status = status;
        
        // Set timestamp if provided, otherwise let pre-save middleware handle it
        const now = timestamp ? new Date(timestamp) : new Date();
        switch (status) {
            case 'dispatched':
                if (!incident.dispatchedAt) {
                    incident.dispatchedAt = now;
                }
                break;
            case 'on_scene':
                if (!incident.arrivedAt) {
                    incident.arrivedAt = now;
                }
                break;
            case 'resolved':
                if (!incident.resolvedAt) {
                    incident.resolvedAt = now;
                }
                break;
            case 'closed':
                if (!incident.closedAt) {
                    incident.closedAt = now;
                }
                break;
        }

        await incident.save();

        // Update station's hasActiveIncident field based on incident status
        try {
            const stationId = incident.station;
            if (stationId) {
                // Check if there are any active incidents for this station
                const activeIncidentsCount = await Incident.countDocuments({
                    station: stationId,
                    status: { $in: ['active', 'dispatched', 'on_scene'] }
                });
                
                await Station.findByIdAndUpdate(stationId, {
                    hasActiveIncident: activeIncidentsCount > 0
                });
                console.log(`✅ Updated station hasActiveIncident to ${activeIncidentsCount > 0}`);
            }
        } catch (stationUpdateError) {
            console.error('⚠️ Error updating station hasActiveIncident:', stationUpdateError.message);
            // Don't fail the request if station update fails
        }

        // Populate related data
        await incident.populate([
            { path: 'alertId', select: 'incidentType incidentName location station status priority' },
            { path: 'departmentOnDuty', select: 'name description' },
            { path: 'unitOnDuty', select: 'name isActive department' }
        ]);

        // Broadcast updated incident via WebSocket (turnout slip is already in incident.turnoutSlip)
        try {
            emitIncidentUpdated(incident);
        } catch (socketError) {
            console.error('⚠️ Failed to broadcast incident status update via WebSocket:', socketError.message);
        }

        res.json({
            success: true,
            message: 'Incident status updated successfully',
            data: incident
        });

    } catch (error) {
        console.error('❌ Update incident status error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete Incident
export const deleteIncident = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid incident ID format'
            });
        }

        const incident = await Incident.findById(id);

        if (!incident) {
            return res.status(404).json({
                success: false,
                message: 'Incident not found'
            });
        }

        // Get station ID before deleting
        const stationId = incident.station;

        // Delete the incident
        await Incident.findByIdAndDelete(id);

        // Update station's hasActiveIncident field
        if (stationId) {
            try {
                // Check if there are any active incidents for this station
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
        }

        // Broadcast deleted incident via WebSocket
        try {
            emitIncidentDeleted(id);
        } catch (socketError) {
            console.error('⚠️ Failed to broadcast incident deletion via WebSocket:', socketError.message);
        }

        res.json({
            success: true,
            message: 'Incident deleted successfully'
        });

    } catch (error) {
        console.error('❌ Delete incident error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Incidents by Department
export const getIncidentsByDepartment = async (req, res) => {
    try {
        const { departmentId } = req.params;
        const { status, page = 1, limit = 10 } = req.query;

        if (!mongoose.Types.ObjectId.isValid(departmentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid department ID format'
            });
        }

        const filter = { departmentOnDuty: departmentId };
        if (status) filter.status = status;

        const skip = (page - 1) * limit;

        const incidents = await Incident.find(filter)
            .populate('alertId', 'incidentType incidentName location station status priority')
            .populate('unitOnDuty', 'name isActive')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Incident.countDocuments(filter);

        res.json({
            success: true,
            data: incidents,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        console.error('❌ Get incidents by department error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Incidents by Unit
export const getIncidentsByUnit = async (req, res) => {
    try {
        const { unitId } = req.params;
        const { status, page = 1, limit = 10 } = req.query;

        if (!mongoose.Types.ObjectId.isValid(unitId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid unit ID format'
            });
        }

        const filter = { unitOnDuty: unitId };
        if (status) filter.status = status;

        const skip = (page - 1) * limit;

        const incidents = await Incident.find(filter)
            .populate('alertId', 'incidentType incidentName location station status priority')
            .populate('departmentOnDuty', 'name description')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Incident.countDocuments(filter);

        res.json({
            success: true,
            data: incidents,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        console.error('❌ Get incidents by unit error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Incident Statistics
export const getIncidentStats = async (req, res) => {
    try {
        const { departmentId, unitId, startDate, endDate } = req.query;

        const filter = {};
        if (departmentId) filter.departmentOnDuty = departmentId;
        if (unitId) filter.unitOnDuty = unitId;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const stats = await Incident.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalIncidents: { $sum: 1 },
                    activeIncidents: {
                        $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                    },
                    dispatchedIncidents: {
                        $sum: { $cond: [{ $eq: ['$status', 'dispatched'] }, 1, 0] }
                    },
                    onSceneIncidents: {
                        $sum: { $cond: [{ $eq: ['$status', 'on_scene'] }, 1, 0] }
                    },
                    resolvedIncidents: {
                        $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
                    },
                    closedIncidents: {
                        $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
                    },
                    avgResponseTime: {
                        $avg: {
                            $cond: [
                                { $and: [{ $ne: ['$dispatchedAt', null] }, { $ne: ['$arrivedAt', null] }] },
                                { $divide: [{ $subtract: ['$arrivedAt', '$dispatchedAt'] }, 60000] },
                                null
                            ]
                        }
                    },
                    avgResolutionTime: {
                        $avg: {
                            $cond: [
                                { $and: [{ $ne: ['$arrivedAt', null] }, { $ne: ['$resolvedAt', null] }] },
                                { $divide: [{ $subtract: ['$resolvedAt', '$arrivedAt'] }, 60000] },
                                null
                            ]
                        }
                    }
                }
            }
        ]);

        const result = stats[0] || {
            totalIncidents: 0,
            activeIncidents: 0,
            dispatchedIncidents: 0,
            onSceneIncidents: 0,
            resolvedIncidents: 0,
            closedIncidents: 0,
            avgResponseTime: null,
            avgResolutionTime: null
        };

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('❌ Get incident stats error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

