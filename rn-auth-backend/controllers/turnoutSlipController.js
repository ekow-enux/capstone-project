import Incident from '../models/Incident.js';
import { generateTurnoutSlip, formatTurnoutSlipForDisplay } from '../services/turnoutSlipService.js';
import EmergencyAlert from '../models/EmergencyAlert.js';

/**
 * Get turnout slip by incident ID
 */
export const getTurnoutSlipByIncident = async (req, res) => {
    try {
        const { incidentId } = req.params;

        const incident = await Incident.findById(incidentId)
            .populate('alertId')
            .populate('departmentOnDuty')
            .populate('unitOnDuty');

        if (!incident) {
            return res.status(404).json({
                success: false,
                message: 'Incident not found'
            });
        }

        if (!incident.turnoutSlip) {
            return res.status(404).json({
                success: false,
                message: 'Turnout slip not found for this incident'
            });
        }

        res.status(200).json({
            success: true,
            data: incident.turnoutSlip
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get formatted turnout slip for display/printing
 */
export const getFormattedTurnoutSlip = async (req, res) => {
    try {
        const { incidentId } = req.params;

        const incident = await Incident.findById(incidentId);

        if (!incident) {
            return res.status(404).json({
                success: false,
                message: 'Incident not found'
            });
        }

        if (!incident.turnoutSlip) {
            return res.status(404).json({
                success: false,
                message: 'Turnout slip not found for this incident'
            });
        }

        const formattedText = formatTurnoutSlipForDisplay(incident.turnoutSlip);

        res.status(200).json({
            success: true,
            data: {
                formatted: formattedText,
                raw: incident.turnoutSlip
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Manually generate/regenerate turnout slip for an incident
 */
export const regenerateTurnoutSlip = async (req, res) => {
    try {
        const { incidentId } = req.params;

        const incident = await Incident.findById(incidentId);

        if (!incident) {
            return res.status(404).json({
                success: false,
                message: 'Incident not found'
            });
        }

        // Fetch the alert with populated reporter details
        const alert = await EmergencyAlert.findById(incident.alertId)
            .populate({
                path: 'reporterDetails',
                select: 'name phone email address rank department unit role station'
            });

        if (!alert) {
            return res.status(404).json({
                success: false,
                message: 'Associated emergency alert not found'
            });
        }

        // Generate new turnout slip
        const turnoutSlip = await generateTurnoutSlip(alert);

        // Update incident with new turnout slip
        incident.turnoutSlip = turnoutSlip;
        await incident.save();

        res.status(200).json({
            success: true,
            message: 'Turnout slip regenerated successfully',
            data: turnoutSlip
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get all turnout slips for a station
 */
export const getTurnoutSlipsByStation = async (req, res) => {
    try {
        const { stationId } = req.params;
        const { startDate, endDate, priority, incidentType } = req.query;

        // Build query
        const query = {
            'turnoutSlip.stationId': stationId,
            turnoutSlip: { $exists: true, $ne: null }
        };

        // Add date filters if provided
        if (startDate || endDate) {
            query['turnoutSlip.dispatchedAt'] = {};
            if (startDate) {
                query['turnoutSlip.dispatchedAt'].$gte = new Date(startDate);
            }
            if (endDate) {
                query['turnoutSlip.dispatchedAt'].$lte = new Date(endDate);
            }
        }

        // Add priority filter if provided
        if (priority) {
            query['turnoutSlip.priority'] = priority;
        }

        // Add incident type filter if provided
        if (incidentType) {
            query['turnoutSlip.incidentType'] = incidentType;
        }

        const incidents = await Incident.find(query)
            .select('turnoutSlip status createdAt updatedAt')
            .sort({ 'turnoutSlip.dispatchedAt': -1 });

        const turnoutSlips = incidents.map(incident => ({
            incidentId: incident._id,
            status: incident.status,
            turnoutSlip: incident.turnoutSlip,
            createdAt: incident.createdAt,
            updatedAt: incident.updatedAt
        }));

        res.status(200).json({
            success: true,
            count: turnoutSlips.length,
            data: turnoutSlips
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get all turnout slips (with filters)
 */
export const getAllTurnoutSlips = async (req, res) => {
    try {
        const { startDate, endDate, priority, incidentType, status } = req.query;

        // Build query
        const query = {
            turnoutSlip: { $exists: true, $ne: null }
        };

        // Add date filters if provided
        if (startDate || endDate) {
            query['turnoutSlip.dispatchedAt'] = {};
            if (startDate) {
                query['turnoutSlip.dispatchedAt'].$gte = new Date(startDate);
            }
            if (endDate) {
                query['turnoutSlip.dispatchedAt'].$lte = new Date(endDate);
            }
        }

        // Add priority filter if provided
        if (priority) {
            query['turnoutSlip.priority'] = priority;
        }

        // Add incident type filter if provided
        if (incidentType) {
            query['turnoutSlip.incidentType'] = incidentType;
        }

        // Add status filter if provided
        if (status) {
            query.status = status;
        }

        const incidents = await Incident.find(query)
            .select('turnoutSlip status createdAt updatedAt')
            .populate('departmentOnDuty', 'name')
            .populate('unitOnDuty', 'name')
            .sort({ 'turnoutSlip.dispatchedAt': -1 });

        const turnoutSlips = incidents.map(incident => ({
            incidentId: incident._id,
            status: incident.status,
            department: incident.departmentOnDuty,
            unit: incident.unitOnDuty,
            turnoutSlip: incident.turnoutSlip,
            createdAt: incident.createdAt,
            updatedAt: incident.updatedAt
        }));

        res.status(200).json({
            success: true,
            count: turnoutSlips.length,
            data: turnoutSlips
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get turnout slip statistics for a station
 */
export const getTurnoutSlipStats = async (req, res) => {
    try {
        const { stationId } = req.params;
        const { startDate, endDate } = req.query;

        // Build base query
        const query = {
            'turnoutSlip.stationId': stationId,
            turnoutSlip: { $exists: true, $ne: null }
        };

        // Add date filters if provided
        if (startDate || endDate) {
            query['turnoutSlip.dispatchedAt'] = {};
            if (startDate) {
                query['turnoutSlip.dispatchedAt'].$gte = new Date(startDate);
            }
            if (endDate) {
                query['turnoutSlip.dispatchedAt'].$lte = new Date(endDate);
            }
        }

        const incidents = await Incident.find(query).select('turnoutSlip status');

        // Calculate statistics
        const stats = {
            total: incidents.length,
            byPriority: {
                high: 0,
                medium: 0,
                low: 0
            },
            byIncidentType: {},
            byStatus: {
                active: 0,
                dispatched: 0,
                'en-route': 0,
                'on-scene': 0,
                resolved: 0,
                cancelled: 0
            },
            averageCasualties: 0,
            totalCasualties: 0
        };

        let totalCasualties = 0;

        incidents.forEach(incident => {
            const slip = incident.turnoutSlip;
            
            // Count by priority
            if (slip.priority) {
                stats.byPriority[slip.priority] = (stats.byPriority[slip.priority] || 0) + 1;
            }

            // Count by incident type
            if (slip.incidentType) {
                stats.byIncidentType[slip.incidentType] = (stats.byIncidentType[slip.incidentType] || 0) + 1;
            }

            // Count by status
            if (incident.status) {
                stats.byStatus[incident.status] = (stats.byStatus[incident.status] || 0) + 1;
            }

            // Sum casualties
            totalCasualties += slip.estimatedCasualties || 0;
        });

        stats.totalCasualties = totalCasualties;
        stats.averageCasualties = incidents.length > 0 ? (totalCasualties / incidents.length).toFixed(2) : 0;

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Export turnout slip as PDF (placeholder - requires PDF library)
 */
export const exportTurnoutSlipAsPDF = async (req, res) => {
    try {
        const { incidentId } = req.params;

        const incident = await Incident.findById(incidentId);

        if (!incident) {
            return res.status(404).json({
                success: false,
                message: 'Incident not found'
            });
        }

        if (!incident.turnoutSlip) {
            return res.status(404).json({
                success: false,
                message: 'Turnout slip not found for this incident'
            });
        }

        // TODO: Implement PDF generation using a library like pdfkit or puppeteer
        // For now, return formatted text
        const formattedText = formatTurnoutSlipForDisplay(incident.turnoutSlip);

        res.status(200).json({
            success: true,
            message: 'PDF export not yet implemented. Use formatted text instead.',
            data: {
                formatted: formattedText,
                raw: incident.turnoutSlip
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};