import mongoose from 'mongoose';

const incidentSchema = new mongoose.Schema({
    alertId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmergencyAlert',
        required: [true, 'Alert ID is required']
    },
    station: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Station',
        required: [true, 'Station is required']
    },
    departmentOnDuty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: [true, 'Department on duty is required']
    },
    unitOnDuty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Unit',
        required: [true, 'Unit on duty is required']
    },
    status: {
        type: String,
        enum: {
            values: ['active', 'dispatched', 'on_scene', 'resolved', 'closed', 'referred'],
            message: 'Status must be one of: active, dispatched, on_scene, resolved, closed, referred'
        },
        default: 'active'
    },
    // Turnout slip - generated when incident is dispatched
    turnoutSlip: {
        type: mongoose.Schema.Types.Mixed,
        required: false,
        description: 'Turnout slip containing incident details, reporter info, and location data'
    },
    // Operational timestamps only
    dispatchedAt: {
        type: Date,
        required: false
    },
    arrivedAt: {
        type: Date,
        required: false
    },
    resolvedAt: {
        type: Date,
        required: false
    },
    closedAt: {
        type: Date,
        required: false
    },
    referred: {
        type: Boolean,
        default: false,
        required: false,
        description: 'Whether the incident has been referred to another station'
    },
    referredAt: {
        type: Date,
        required: false,
        description: 'Timestamp when the incident was referred'
    },
    referredToStation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Station',
        required: false,
        description: 'Station ID that this incident was referred to'
    },
    referReason: {
        type: String,
        trim: true,
        required: false,
        description: 'Reason for referring this incident'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for alert details
incidentSchema.virtual('alertDetails', {
    ref: 'EmergencyAlert',
    localField: 'alertId',
    foreignField: '_id',
    justOne: true
});

// Virtual for department details
incidentSchema.virtual('departmentDetails', {
    ref: 'Department',
    localField: 'departmentOnDuty',
    foreignField: '_id',
    justOne: true
});

// Virtual for unit details
incidentSchema.virtual('unitDetails', {
    ref: 'Unit',
    localField: 'unitOnDuty',
    foreignField: '_id',
    justOne: true
});

// Virtual for response time calculation (dispatched to arrived)
incidentSchema.virtual('responseTimeMinutes').get(function() {
    if (this.dispatchedAt && this.arrivedAt) {
        return Math.round((this.arrivedAt - this.dispatchedAt) / (1000 * 60));
    }
    return null;
});

// Virtual for resolution time calculation (arrived to resolved)
incidentSchema.virtual('resolutionTimeMinutes').get(function() {
    if (this.arrivedAt && this.resolvedAt) {
        return Math.round((this.resolvedAt - this.arrivedAt) / (1000 * 60));
    }
    return null;
});

// Virtual for total incident time (dispatched to closed)
incidentSchema.virtual('totalIncidentTimeMinutes').get(function() {
    if (this.dispatchedAt && this.closedAt) {
        return Math.round((this.closedAt - this.dispatchedAt) / (1000 * 60));
    }
    return null;
});

// Virtual for referred station details
incidentSchema.virtual('referredStationDetails', {
    ref: 'Station',
    localField: 'referredToStation',
    foreignField: '_id',
    justOne: true
});

// Indexes for efficient queries
incidentSchema.index({ alertId: 1 });
incidentSchema.index({ station: 1 }); // Index for station queries
incidentSchema.index({ station: 1, status: 1 }); // Compound index for station + status queries
incidentSchema.index({ departmentOnDuty: 1 });
incidentSchema.index({ unitOnDuty: 1 });
incidentSchema.index({ status: 1 });
incidentSchema.index({ createdAt: -1 });
incidentSchema.index({ dispatchedAt: -1 });
incidentSchema.index({ referred: 1 });
incidentSchema.index({ referredToStation: 1 });

// Pre-save middleware to update updatedAt
incidentSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Pre-save middleware to validate alert exists and set station if missing
incidentSchema.pre('save', async function(next) {
    try {
        const EmergencyAlert = mongoose.model('EmergencyAlert');
        const alert = await EmergencyAlert.findById(this.alertId);
        if (!alert) {
            throw new Error('Referenced alert does not exist');
        }
        
        // If station is not set, get it from the alert
        if (!this.station && alert.station) {
            const alertStationId = alert.station?._id || alert.station;
            this.station = typeof alertStationId === 'string' 
                ? new mongoose.Types.ObjectId(alertStationId) 
                : alertStationId;
            console.log('✅ Auto-set station field from alert:', this.station);
        }
        
        next();
    } catch (error) {
        next(error);
    }
});

// Pre-save middleware to validate department exists
incidentSchema.pre('save', async function(next) {
    try {
        const Department = mongoose.model('Department');
        const department = await Department.findById(this.departmentOnDuty);
        if (!department) {
            throw new Error('Referenced department does not exist');
        }
        next();
    } catch (error) {
        next(error);
    }
});

// Pre-save middleware to validate unit exists
incidentSchema.pre('save', async function(next) {
    try {
        const Unit = mongoose.model('Unit');
        const unit = await Unit.findById(this.unitOnDuty);
        if (!unit) {
            throw new Error('Referenced unit does not exist');
        }
        next();
    } catch (error) {
        next(error);
    }
});

// Pre-save middleware to automatically set timestamps and generate turnout slip based on status changes
incidentSchema.pre('save', async function(next) {
    try {
        // Only update if status is being modified
        if (this.isModified('status')) {
            const now = new Date();
            
            switch (this.status) {
                case 'dispatched':
                    if (!this.dispatchedAt) {
                        this.dispatchedAt = now;
                    }
                    // Generate turnout slip when status changes to dispatched
                    if (!this.turnoutSlip) {
                        try {
                            const EmergencyAlert = mongoose.model('EmergencyAlert');
                            const alert = await EmergencyAlert.findById(this.alertId)
                                .populate({
                                    path: 'reporterDetails',
                                    select: 'name phone email address rank department unit role station'
                                });
                            
                            if (alert) {
                                // Import the generateTurnoutSlip function dynamically
                                const { generateTurnoutSlip } = await import('../services/turnoutSlipService.js');
                                this.turnoutSlip = await generateTurnoutSlip(alert);
                                console.log('✅ Turnout slip generated and stored in incident');
                            }
                        } catch (turnoutSlipError) {
                            console.error('⚠️ Failed to generate turnout slip:', turnoutSlipError.message);
                            // Don't fail the save if turnout slip generation fails
                        }
                    }
                    break;
                case 'on_scene':
                    if (!this.arrivedAt) {
                        this.arrivedAt = now;
                    }
                    break;
                case 'resolved':
                    if (!this.resolvedAt) {
                        this.resolvedAt = now;
                    }
                    break;
                case 'closed':
                    if (!this.closedAt) {
                        this.closedAt = now;
                    }
                    break;
            }
        }
        next();
    } catch (error) {
        next(error);
    }
});

export default mongoose.model('Incident', incidentSchema);

