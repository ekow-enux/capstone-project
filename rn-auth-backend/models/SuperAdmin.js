import mongoose from 'mongoose';

const superAdminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: [true, 'Password is required']
    },
    name: {
        type: String,
        required: [true, 'Name is required']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    // Optional fields for managing departments and stations
    managedDepartments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department'
    }],
    managedStations: [{
        type: String
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    role: {
        type: String,
        enum: ['super_admin'],
        default: 'super_admin'
    }
}, { 
    timestamps: true 
});

// Indexes are automatically created by unique: true on username and email fields

export default mongoose.model('SuperAdmin', superAdminSchema);

