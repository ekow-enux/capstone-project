import mongoose from 'mongoose';

const unitSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Unit name is required'],
        trim: true
    },
    color: {
        type: String,
        default: '#000000'
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: [true, 'Department is required']
    },
    isActive: {
        type: Boolean,
        default: false,
        description: 'Indicates if this unit is currently on duty. Only one unit can be active per department.'
    },
    activatedAt: {
        type: Date,
        required: false,
        description: 'Timestamp when the unit was activated. Used for automatic deactivation at 8 AM the next day.'
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for personnel in this unit
unitSchema.virtual('personnel', {
    ref: 'FirePersonnel',
    localField: '_id',
    foreignField: 'unit',
    options: { sort: { name: 1 } }
});

// Virtual for unit admins in this unit
unitSchema.virtual('unitAdmins', {
    ref: 'UnitAdmin',
    localField: '_id',
    foreignField: 'unit_id',
    options: {
        sort: { name: 1 },
        match: { isActive: true } // Only active admins by default
    }
});

// Indexes for efficient queries
unitSchema.index({ name: 1, department: 1 }, { unique: true }); // Compound unique index
unitSchema.index({ department: 1, isActive: 1 }); // Compound index for active unit queries
unitSchema.index({ department: 1 }); // Index for department-based queries
unitSchema.index({ isActive: 1, activatedAt: 1 }); // Compound index for active unit queries with activation time

export default mongoose.model('Unit', unitSchema);

