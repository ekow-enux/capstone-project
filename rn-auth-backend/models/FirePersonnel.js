import mongoose from 'mongoose';

const firePersonnelSchema = new mongoose.Schema({
    serviceNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    
    name: {
        type: String,
        required: true
    },
    rank: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Rank',
        required: true
    },
    unit: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Unit',
        required: false
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: [true, 'Department is required']
    },
    role: {
        type: String,
        default: 'Officer in charge (OIC)',
        required: false
    },
    station_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Station',
        required: [true, 'Station is required']
    },
    password: {
        type: String,
        required: true,
        select: false // Don't include password in queries by default
    },
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Pre-save hook to validate department and unit relationship
firePersonnelSchema.pre('save', async function(next) {
    // Validate that department is provided
    if (!this.department) {
        return next(new Error('Department is required'));
    }
    
    // Validate that department exists
    try {
        const Department = mongoose.model('Department');
        const departmentDoc = await Department.findById(this.department);
        if (!departmentDoc) {
            return next(new Error('Department not found'));
        }
        
        // If unit is provided, validate that it belongs to the same department
        if (this.unit) {
            const Unit = mongoose.model('Unit');
            const unitDoc = await Unit.findById(this.unit);
            if (!unitDoc) {
                return next(new Error('Unit not found'));
            }
            if (unitDoc.department.toString() !== this.department.toString()) {
                return next(new Error('Unit does not belong to the specified department'));
            }
        }
    } catch (error) {
        return next(error);
    }
    
    next();
});

// Indexes for efficient queries
// Note: serviceNumber already has unique index from schema definition, don't duplicate
firePersonnelSchema.index({ serviceNumber: 1 }); // Index for serviceNumber lookups
firePersonnelSchema.index({ station_id: 1, unit: 1 }); // Compound index for station + unit queries
firePersonnelSchema.index({ station_id: 1, rank: 1 }); // Compound index for station + rank queries
firePersonnelSchema.index({ station_id: 1, department: 1 }); // Compound index for station + department queries
firePersonnelSchema.index({ rank: 1 });
firePersonnelSchema.index({ unit: 1 }); // Index for unit-based queries
firePersonnelSchema.index({ department: 1 }); // Index for department-based queries
firePersonnelSchema.index({ role: 1 }); // Index for role-based queries

export default mongoose.model('FirePersonnel', firePersonnelSchema);

