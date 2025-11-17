import mongoose from 'mongoose';

const stationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: false,
        trim: true
    },
    call_sign: {
        type: String,
        required: false,
        trim: true,
        unique: true,
        sparse: true
    },
    location: {
        type: String,
        required: false,
        trim: true
    },
    location_url: {
        type: String,
        required: false,
        trim: true
    },
    lat: {
        type: Number,
        required: false,
        min: -90,
        max: 90
    },
    lng: {
        type: Number,
        required: false,
        min: -180,
        max: 180
    },
    region: {
        type: String,
        required: false,
        trim: true
    },
    phone_number: {
        type: String,
        required: false,
        trim: true
    },
    placeId: {
        type: String,
        required: false,
        trim: true,
        unique: true,
        sparse: true
    },
    status: {
        type: String,
        enum: ['in commission', 'out of commission'],
        default: 'in commission',
        required: false
    },
    hasActiveIncident: {
        type: Boolean,
        default: false,
        required: false
    },
    hasActiveAlert: {
        type: Boolean,
        default: false,
        required: false
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for departments in this station
stationSchema.virtual('departments', {
    ref: 'Department',
    localField: '_id',
    foreignField: 'station_id',
    options: { sort: { name: 1 } }
});

// Virtual for personnel in this station
stationSchema.virtual('personnel', {
    ref: 'FirePersonnel',
    localField: '_id',
    foreignField: 'station_id',
    options: { sort: { name: 1 } }
});

// Virtual for station admins in this station
stationSchema.virtual('stationAdmins', {
    ref: 'StationAdmin',
    localField: '_id',
    foreignField: 'station_id',
    options: { 
        sort: { name: 1 },
        match: { isActive: true } // Only active admins by default
    }
});

// Indexes for efficient queries
stationSchema.index({ region: 1 });
stationSchema.index({ lat: 1, lng: 1 }); // Compound index for coordinate queries
stationSchema.index({ phone_number: 1 }); // Index for phone number lookups
// Note: placeId already has unique index from schema definition, don't duplicate
stationSchema.index({ name: 1, region: 1 }); // Compound index for name + region queries
// Note: For geospatial queries ($near, $geoWithin), you would need to add a GeoJSON location field
// For now, the compound index on lat/lng will handle coordinate-based queries efficiently

export default mongoose.model('Station', stationSchema);
