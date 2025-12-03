import Referral from '../models/Referral.js';
import Station from '../models/Station.js';
import EmergencyAlert from '../models/EmergencyAlert.js';
import Incident from '../models/Incident.js';
import mongoose from 'mongoose';
import { 
    emitReferralCreated, 
    emitReferralUpdated, 
    emitAlertUpdated, 
    emitIncidentUpdated,
    emitReferredAlertReceived,
    emitReferredIncidentReceived
} from '../services/socketService.js';

// Create Referral
export const createReferral = async (req, res) => {
    try {
        const {
            data_id,
            data_type,
            from_station_id,
            to_station_id,
            reason
        } = req.body;

        // Validate required fields
        if (!data_id || !data_type || !from_station_id || !to_station_id) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: data_id, data_type, from_station_id, to_station_id'
            });
        }

        // Validate data_type
        if (!['EmergencyAlert', 'Incident'].includes(data_type)) {
            return res.status(400).json({
                success: false,
                message: 'data_type must be either "EmergencyAlert" or "Incident"'
            });
        }

        // Validate ObjectIds
        if (!mongoose.Types.ObjectId.isValid(data_id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid data_id format'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(from_station_id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid from_station_id format'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(to_station_id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid to_station_id format'
            });
        }

        // Check if from_station and to_station are the same
        if (from_station_id.toString() === to_station_id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot refer to the same station'
            });
        }

        // Verify the referenced data exists
        let referencedData = null;
        if (data_type === 'EmergencyAlert') {
            referencedData = await EmergencyAlert.findById(data_id);
            if (!referencedData) {
                return res.status(404).json({
                    success: false,
                    message: 'Emergency alert not found'
                });
            }
        } else if (data_type === 'Incident') {
            referencedData = await Incident.findById(data_id);
            if (!referencedData) {
                return res.status(404).json({
                    success: false,
                    message: 'Incident not found'
                });
            }
        }

        // Verify from_station exists
        const fromStation = await Station.findById(from_station_id);
        if (!fromStation) {
            return res.status(404).json({
                success: false,
                message: 'From station not found'
            });
        }

        // Verify to_station exists and check its status
        const toStation = await Station.findById(to_station_id);
        if (!toStation) {
            return res.status(404).json({
                success: false,
                message: 'To station not found'
            });
        }

        // Check if to_station is out of commission
        if (toStation.status === 'out of commission') {
            return res.status(400).json({
                success: false,
                message: 'Cannot refer: Target station is out of commission',
                stationStatus: {
                    status: toStation.status,
                    isActive: false,
                    hasActiveAlert: toStation.hasActiveAlert || false,
                    hasActiveIncident: toStation.hasActiveIncident || false
                }
            });
        }

        // Check if to_station has an active alert
        if (toStation.hasActiveAlert) {
            const activeAlert = await EmergencyAlert.findOne({
                station: to_station_id,
                status: { $in: ['active', 'pending'] }
            });

            if (activeAlert) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot refer: Target station already has an active alert',
                    stationStatus: {
                        status: toStation.status,
                        isActive: toStation.status === 'in commission',
                        hasActiveAlert: true,
                        hasActiveIncident: toStation.hasActiveIncident || false,
                        activeAlertId: activeAlert._id.toString()
                    }
                });
            }
        }

        // Check if to_station has an active incident
        if (toStation.hasActiveIncident) {
            const activeIncident = await Incident.findOne({
                station: to_station_id,
                status: { $in: ['pending', 'dispatched', 'active', 'on_scene'] }
            });

            if (activeIncident) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot refer: Target station already has an active incident',
                    stationStatus: {
                        status: toStation.status,
                        isActive: toStation.status === 'in commission',
                        hasActiveAlert: toStation.hasActiveAlert || false,
                        hasActiveIncident: true,
                        activeIncidentId: activeIncident._id.toString()
                    }
                });
            }
        }

        // Check if a pending referral already exists for this data
        const existingReferral = await Referral.findOne({
            data_id,
            data_type,
            status: 'pending'
        });

        if (existingReferral) {
            return res.status(400).json({
                success: false,
                message: 'A pending referral already exists for this ' + data_type.toLowerCase()
            });
        }

        // Create the referral
        const referral = new Referral({
            data_id,
            data_type,
            from_station_id,
            to_station_id,
            reason,
            status: 'pending',
            referred_at: new Date()
        });

        await referral.save();

        // Update the original alert/incident to mark it as referred
        const referredAt = new Date();
        if (data_type === 'EmergencyAlert') {
            const updatedAlert = await EmergencyAlert.findByIdAndUpdate(
                data_id,
                {
                    referred: true,
                    referredAt: referredAt,
                    referredToStation: to_station_id,
                    referReason: reason,
                    status: 'referred' // Update status to 'referred'
                },
                { new: true, runValidators: true }
            ).populate([
                { path: 'station', select: 'name location lat lng phone_number placeId' },
                { path: 'referredStationDetails', select: 'name location lat lng phone_number placeId' },
                { path: 'reporterDetails', select: 'name phone email' }
            ]);
            
            console.log('✅ Updated EmergencyAlert as referred:', data_id);
            
            // Broadcast updated alert via WebSocket
            try {
                emitAlertUpdated(updatedAlert);
                // Notify target station about the referred alert
                emitReferredAlertReceived(updatedAlert, referral);
            } catch (updateError) {
                console.error('⚠️ Failed to broadcast updated alert via WebSocket:', updateError.message);
            }
        } else if (data_type === 'Incident') {
            // Update incident status to 'referred' and set referral fields
            const updatedIncident = await Incident.findByIdAndUpdate(
                data_id,
                {
                    referred: true,
                    referredAt: referredAt,
                    referredToStation: to_station_id,
                    referReason: reason,
                    status: 'referred' // Update status to 'referred'
                },
                { new: true, runValidators: true }
            ).populate([
                { path: 'alertId', select: 'incidentType incidentName location station status priority' },
                { path: 'departmentOnDuty', select: 'name description' },
                { path: 'unitOnDuty', select: 'name isActive department' },
                { path: 'referredStationDetails', select: 'name location lat lng phone_number placeId' }
            ]);
            
            console.log('✅ Updated Incident as referred:', data_id);
            
            // Broadcast updated incident via WebSocket
            try {
                emitIncidentUpdated(updatedIncident);
                // Notify target station about the referred incident
                emitReferredIncidentReceived(updatedIncident, referral);
            } catch (updateError) {
                console.error('⚠️ Failed to broadcast updated incident via WebSocket:', updateError.message);
            }
        }

        // Fetch and populate the referral from database
        const populatedReferral = await Referral.findById(referral._id)
            .populate('from_station_id', 'name location phone_number')
            .populate('to_station_id', 'name location phone_number')
            .populate('referenced_data');

        // Broadcast referral creation via WebSocket
        try {
            emitReferralCreated(populatedReferral);
        } catch (socketError) {
            console.error('⚠️ Failed to broadcast referral creation via WebSocket:', socketError.message);
        }

        res.status(201).json({
            success: true,
            message: 'Referral created successfully',
            data: populatedReferral
        });

    } catch (error) {
        console.error('❌ Create referral error:', error);
        
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

// Get All Referrals
export const getAllReferrals = async (req, res) => {
    try {
        const { status, data_type, from_station_id, to_station_id, page = 1, limit = 10 } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (data_type) filter.data_type = data_type;
        if (from_station_id) filter.from_station_id = from_station_id;
        if (to_station_id) filter.to_station_id = to_station_id;

        const skip = (page - 1) * limit;

        const referrals = await Referral.find(filter)
            .populate('from_station_id', 'name location phone_number')
            .populate('to_station_id', 'name location phone_number')
            .populate('referenced_data')
            .sort({ referred_at: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Referral.countDocuments(filter);

        res.json({
            success: true,
            data: referrals,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        console.error('❌ Get all referrals error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Referral by ID
export const getReferralById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid referral ID format'
            });
        }

        const referral = await Referral.findById(id)
            .populate('from_station_id', 'name location phone_number')
            .populate('to_station_id', 'name location phone_number')
            .populate('referenced_data');

        if (!referral) {
            return res.status(404).json({
                success: false,
                message: 'Referral not found'
            });
        }

        res.json({
            success: true,
            data: referral
        });

    } catch (error) {
        console.error('❌ Get referral by ID error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update Referral (Accept/Reject)
export const updateReferral = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, response_notes } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid referral ID format'
            });
        }

        // Validate status if provided
        if (status && !['pending', 'accepted', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status must be one of: pending, accepted, rejected'
            });
        }

        const referral = await Referral.findById(id);
        if (!referral) {
            return res.status(404).json({
                success: false,
                message: 'Referral not found'
            });
        }

        // If status is being changed to accepted or rejected, set responded_at
        const updateData = {};
        if (status && status !== referral.status) {
            updateData.status = status;
            if (status === 'accepted' || status === 'rejected') {
                updateData.responded_at = new Date();
            }
        }

        if (response_notes !== undefined) {
            updateData.response_notes = response_notes;
        }

        const updatedReferral = await Referral.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate([
            { path: 'from_station_id', select: 'name location phone_number' },
            { path: 'to_station_id', select: 'name location phone_number' },
            { path: 'referenced_data' }
        ]);

        // Broadcast referral update via WebSocket
        try {
            emitReferralUpdated(updatedReferral);
        } catch (socketError) {
            console.error('⚠️ Failed to broadcast referral update via WebSocket:', socketError.message);
        }

        res.json({
            success: true,
            message: 'Referral updated successfully',
            data: updatedReferral
        });

    } catch (error) {
        console.error('❌ Update referral error:', error);
        
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

// Delete Referral
export const deleteReferral = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid referral ID format'
            });
        }

        const referral = await Referral.findByIdAndDelete(id);

        if (!referral) {
            return res.status(404).json({
                success: false,
                message: 'Referral not found'
            });
        }

        res.json({
            success: true,
            message: 'Referral deleted successfully'
        });

    } catch (error) {
        console.error('❌ Delete referral error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Referrals by Data (Alert or Incident)
export const getReferralsByData = async (req, res) => {
    try {
        const { data_id, data_type } = req.params;

        if (!mongoose.Types.ObjectId.isValid(data_id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid data_id format'
            });
        }

        if (!['EmergencyAlert', 'Incident'].includes(data_type)) {
            return res.status(400).json({
                success: false,
                message: 'data_type must be either "EmergencyAlert" or "Incident"'
            });
        }

        const referrals = await Referral.find({
            data_id,
            data_type
        })
            .populate('from_station_id', 'name location phone_number')
            .populate('to_station_id', 'name location phone_number')
            .sort({ referred_at: -1 });

        res.json({
            success: true,
            data: referrals
        });

    } catch (error) {
        console.error('❌ Get referrals by data error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

