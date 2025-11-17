import mongoose from 'mongoose';

const emergencyAlertSchema = new mongoose.Schema({
    incidentType: {
        type: String,
        required: [true, 'Incident type is required'],
        trim: true
    },
    incidentName: {
        type: String,
        required: [true, 'Incident name is required'],
        trim: true
    },
    location: {
        coordinates: {
            latitude: { 
                type: Number, 
                required: [true, 'Latitude is required'],
                min: -90,
                max: 90
            },
            longitude: { 
                type: Number, 
                required: [true, 'Longitude is required'],
                min: -180,
                max: 180
            }
        },
        locationUrl: { 
            type: String,
            trim: true
        },
        locationName: { 
            type: String,
            trim: true
        }
    },
    station: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Station',
        required: [true, 'Station is required']
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: false,
        description: 'Department assigned to handle this alert (typically Operations)'
    },
    unit: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Unit',
        required: false,
        description: 'Active unit assigned to handle this alert'
    },
    reporterId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'Reporter ID is required'],
        refPath: 'reporterType'
    },
    reporterType: {
        type: String,
        enum: ['User', 'FirePersonnel'],
        required: true
    },
    reportedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: {
            values: ['active', 'accepted', 'rejected', 'referred'],
            message: 'Status must be one of: active, accepted, rejected, referred'
        },
        default: 'active'
    },
    priority: {
        type: String,
        enum: {
            values: ['low', 'medium', 'high'],
            message: 'Priority must be one of: low, medium, high'
        },
        default: 'high'
    },
    // Additional fields for better reporting
    description: {
        type: String,
        trim: true
    },
    estimatedCasualties: {
        type: Number,
        min: 0,
        default: 0
    },
    estimatedDamage: {
        type: String,
        enum: ['minimal', 'moderate', 'severe', 'extensive'],
        default: 'minimal'
    },
    responseTime: {
        type: Number, // in minutes
        min: 0
    },
    resolvedAt: {
        type: Date
    },
    notes: {
        type: String,
        trim: true
    },
    // Action fields - only available after unit receives the alert
    dispatched: {
        type: Boolean,
        default: false,
        description: 'Whether the active unit has dispatched to handle this alert'
    },
    dispatchedAt: {
        type: Date,
        required: false,
        description: 'Timestamp when the unit dispatched'
    },
    declined: {
        type: Boolean,
        default: false,
        description: 'Whether the active unit has declined this alert'
    },
    declinedAt: {
        type: Date,
        required: false,
        description: 'Timestamp when the unit declined'
    },
    declineReason: {
        type: String,
        trim: true,
        required: false,
        description: 'Reason for declining the alert'
    },
    referred: {
        type: Boolean,
        default: false,
        description: 'Whether the alert has been referred to another station'
    },
    referredAt: {
        type: Date,
        required: false,
        description: 'Timestamp when the alert was referred'
    },
    referredToStation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Station',
        required: false,
        description: 'Station ID that this alert was referred to'
    },
    referReason: {
        type: String,
        trim: true,
        required: false,
        description: 'Reason for referring the alert to another station'
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for response time calculation
emergencyAlertSchema.virtual('responseTimeMinutes').get(function() {
    if (this.reportedAt && this.resolvedAt) {
        return Math.round((this.resolvedAt - this.reportedAt) / (1000 * 60));
    }
    return null;
});

// Virtual for station details
emergencyAlertSchema.virtual('stationDetails', {
    ref: 'Station',
    localField: 'station',
    foreignField: '_id',
    justOne: true
});

// Virtual for reporter details
emergencyAlertSchema.virtual('reporterDetails', {
    refPath: 'reporterType',
    localField: 'reporterId',
    foreignField: '_id',
    justOne: true
});

// Virtual for referred station details
emergencyAlertSchema.virtual('referredStationDetails', {
    ref: 'Station',
    localField: 'referredToStation',
    foreignField: '_id',
    justOne: true
});

// Indexes for efficient queries
emergencyAlertSchema.index({ station: 1 });
emergencyAlertSchema.index({ department: 1 });
emergencyAlertSchema.index({ unit: 1 });
emergencyAlertSchema.index({ reporterId: 1 });
emergencyAlertSchema.index({ reporterType: 1 });
emergencyAlertSchema.index({ status: 1 });
emergencyAlertSchema.index({ priority: 1 });
emergencyAlertSchema.index({ reportedAt: -1 });
emergencyAlertSchema.index({ dispatched: 1 });
emergencyAlertSchema.index({ declined: 1 });
emergencyAlertSchema.index({ referred: 1 });
emergencyAlertSchema.index({ referredToStation: 1 });
emergencyAlertSchema.index({ 'location.coordinates.latitude': 1, 'location.coordinates.longitude': 1 });

// Pre-save middleware to validate station exists
emergencyAlertSchema.pre('save', async function(next) {
    try {
        const Station = mongoose.model('Station');
        const station = await Station.findById(this.station);
        if (!station) {
            throw new Error('Referenced station does not exist');
        }
        next();
    } catch (error) {
        next(error);
    }
});

// Pre-save middleware to validate reporter exists
emergencyAlertSchema.pre('save', async function(next) {
    try {
        if (this.reporterType === 'User') {
            const User = mongoose.model('User');
            const user = await User.findById(this.reporterId);
            if (!user) {
                throw new Error('Referenced user does not exist');
            }
        } else if (this.reporterType === 'FirePersonnel') {
            const FirePersonnel = mongoose.model('FirePersonnel');
            const personnel = await FirePersonnel.findById(this.reporterId);
            if (!personnel) {
                throw new Error('Referenced fire personnel does not exist');
            }
        }
        next();
    } catch (error) {
        next(error);
    }
});

export default mongoose.model('EmergencyAlert', emergencyAlertSchema);

