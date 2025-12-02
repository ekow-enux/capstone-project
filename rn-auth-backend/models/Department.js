import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: false
    },
    station_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Station',
        required: [true, 'Station is required']
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for units
departmentSchema.virtual('units', {
    ref: 'Unit',
    localField: '_id',
    foreignField: 'department',
    options: { sort: { name: 1 } }
});

// Virtual for personnel in this department
departmentSchema.virtual('personnel', {
    ref: 'FirePersonnel',
    localField: '_id',
    foreignField: 'department',
    options: { sort: { name: 1 } }
});

// Virtual for department admins in this department
departmentSchema.virtual('departmentAdmins', {
    ref: 'DepartmentAdmin',
    localField: '_id',
    foreignField: 'department_id',
    options: {
        sort: { name: 1 },
        match: { isActive: true } // Only active admins by default
    }
});

// Indexes for efficient queries
departmentSchema.index({ name: 1, station_id: 1 }, { unique: true }); // Unique department name per station
departmentSchema.index({ station_id: 1 }); // Index for station-based queries

export default mongoose.model('Department', departmentSchema);

