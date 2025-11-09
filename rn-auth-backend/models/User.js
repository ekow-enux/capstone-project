import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, required: false },
    password: { type: String, required: true },
    address: { type: String },
    country: { type: String, default: 'Ghana' },
    dob: { type: Date },
    image: { type: String },
    ghanaPost: { type: String },
    role: {
        type: String,
        enum: ['user', 'super_admin'],
        default: 'user'
    },
    // OTP Verification Fields
    isPhoneVerified: { 
        type: Boolean, 
        default: false 
    },
    phoneVerifiedAt: { 
        type: Date 
    },
    // Password Reset Fields
    resetPasswordToken: { 
        type: String 
    },
    resetPasswordExpires: { 
        type: Date 
    },
    // Account Status
    isActive: { 
        type: Boolean, 
        default: true 
    },
    lastLoginAt: { 
        type: Date 
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

export default mongoose.model('User', userSchema);
