import mongoose from 'mongoose';

const departmentAdminSchema = new mongoose.Schema({
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
    department_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: [true, 'Department is required']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    role: {
        type: String,
        enum: ['department_admin'],
        default: 'department_admin'
    }
}, { 
    timestamps: true 
});

// Indexes for efficient queries
departmentAdminSchema.index({ department_id: 1 });
departmentAdminSchema.index({ department_id: 1, isActive: 1 }); // Compound index for active admins per department
// Note: username and email already have unique indexes from schema definition, don't duplicate
departmentAdminSchema.index({ role: 1, isActive: 1 }); // Compound index for role + active status queries

export default mongoose.model('DepartmentAdmin', departmentAdminSchema);