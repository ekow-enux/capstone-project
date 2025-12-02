import mongoose from 'mongoose';

const unitAdminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        lowercase: true
    },
    tempPassword: {
        type: String,
        required: false,
        select: false // Don't include password in queries by default
    },
    password: {
        type: String,
        required: false,
        select: false // Don't include password in queries by default
    },
    tempPasswordExpiry: {
        type: Date,
        required: false
    },
    passwordResetRequired: {
        type: Boolean,
        default: true // Require password reset on first login if temp password was set
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    name: {
        type: String,
        required: false,
        trim: true
    },
    unit_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Unit',
        required: [true, 'Unit is required']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    role: {
        type: String,
        enum: ['unit_admin'],
        default: 'unit_admin'
    }
}, { 
    timestamps: true 
});

// Indexes for efficient queries
unitAdminSchema.index({ unit_id: 1 });
unitAdminSchema.index({ unit_id: 1, isActive: 1 }); // Compound index for active admins per unit
// Note: username and email already have unique indexes from schema definition, don't duplicate
unitAdminSchema.index({ role: 1, isActive: 1 }); // Compound index for role + active status queries

export default mongoose.model('UnitAdmin', unitAdminSchema);