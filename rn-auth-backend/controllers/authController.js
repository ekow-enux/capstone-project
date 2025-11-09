import User from '../models/User.js';
import OTP from '../models/OTP.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import arkeselOTPService from '../services/arkeselOTPService.js';

export const register = async (req, res) => {
    try {
        const { name, phone, email, password, address, country, dob, image, ghanaPost, role } = req.body;
        console.log('request', req.body);

        // Validate required fields
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ message: 'Name is required' });
        }

        if (!phone || phone.trim().length === 0) {
            return res.status(400).json({ message: 'Phone number is required' });
        }

        // Validate phone format (basic check for international format)
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(phone.replace(/[\s-]/g, ''))) {
            return res.status(400).json({ message: 'Invalid phone number format. Use international format (e.g., +233201234567)' });
        }

        if (!password || password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        // Check if phone already exists
        const existing = await User.findOne({ phone });
        if (existing) return res.status(400).json({ message: 'Phone already in use' });

        // Hash password
        const hashed = await bcrypt.hash(password, 10);

        const userRole = typeof role === 'string' && ['user', 'super_admin'].includes(role.toLowerCase())
            ? role.toLowerCase()
            : 'user';

        // Create user - TEMPORARILY BYPASSING VERIFICATION
        const user = new User({ 
            name, 
            phone, 
            email, 
            password: hashed,
            address,
            country,
            dob,
            image,
            ghanaPost,
            role: userRole,
            isPhoneVerified: true, // TEMPORARILY SET TO TRUE - BYPASSING VERIFICATION
            isActive: true // TEMPORARILY SET TO TRUE - BYPASSING VERIFICATION
        });
        await user.save();

        // TEMPORARILY COMMENTED OUT - OTP VERIFICATION DISABLED
        // Send OTP for phone verification
        // const otpResult = await arkeselOTPService.generateOTP({
        //     phone_number: phone,
        //     purpose: 'registration',
        //     message: 'Your registration OTP code is %otp_code%. Valid for 5 minutes.'
        // });

        // if (!otpResult.success) {
        //     // If OTP fails, delete the user
        //     await User.findByIdAndDelete(user._id);
        //     return res.status(500).json({
        //         message: 'Failed to send OTP. Please try again.',
        //         error: otpResult.error
        //     });
        // }

        // Calculate expiry time
        // const expiryTime = new Date();
        // expiryTime.setMinutes(expiryTime.getMinutes() + 5);

        // Save OTP to database
        // const otp = new OTP({
        //     phone_number: otpResult.phone_number,
        //     otp_code: otpResult.data.code || 'GENERATED',
        //     expiry_time: expiryTime,
        //     purpose: 'registration',
        //     arkesel_response: otpResult.data
        // });

        // await otp.save();

        // Return success with token (TEMPORARILY BYPASSING OTP VERIFICATION)
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.status(201).json({ 
            message: 'User created successfully. OTP verification temporarily disabled.',
            token,
            user: {
                id: user._id,
                name: user.name,
                phone: user.phone,
                email: user.email,
                role: user.role,
                isPhoneVerified: user.isPhoneVerified,
                isActive: user.isActive
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const login = async (req, res) => {
    try {
        const { phone, password } = req.body;

        // Validate required fields
        if (!phone || phone.trim().length === 0) {
            return res.status(400).json({ message: 'Phone number is required' });
        }

        if (!password || password.trim().length === 0) {
            return res.status(400).json({ message: 'Password is required' });
        }

        const user = await User.findOne({ phone });
        if (!user) return res.status(404).json({ message: 'User not found' });

        // TEMPORARILY COMMENTED OUT - ALLOWING INACTIVE USERS TO LOGIN
        // Check if user account is active
        // if (!user.isActive) {
        //     return res.status(403).json({ 
        //         message: 'Account is not active. Please verify your phone number first.' 
        //     });
        // }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        // Update last login time
        user.lastLoginAt = new Date();
        await user.save();

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.status(200).json({ 
            token,
            user: {
                id: user._id,
                name: user.name,
                phone: user.phone,
                email: user.email,
                address: user.address,
                country: user.country,
                dob: user.dob,
                image: user.image,
                ghanaPost: user.ghanaPost,
                role: user.role,
                isPhoneVerified: user.isPhoneVerified,
                phoneVerifiedAt: user.phoneVerifiedAt,
                lastLoginAt: user.lastLoginAt
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Send OTP for registration
export const sendRegistrationOTP = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ message: 'Phone number is required' });
        }

        // Check if phone already exists
        const existing = await User.findOne({ phone });
        if (existing) {
            return res.status(400).json({ message: 'Phone number already registered' });
        }

        // Generate OTP using Arkesel service
        const otpResult = await arkeselOTPService.generateOTP({
            phone_number: phone,
            purpose: 'registration',
            message: 'Your registration OTP code is %otp_code%. Valid for 5 minutes.'
        });

        if (!otpResult.success) {
            return res.status(500).json({
                message: 'Failed to send OTP',
                error: otpResult.error
            });
        }

        // Calculate expiry time
        const expiryTime = new Date();
        expiryTime.setMinutes(expiryTime.getMinutes() + 5);

        // Save OTP to database
        const otp = new OTP({
            phone_number: otpResult.phone_number,
            otp_code: otpResult.data.code || 'GENERATED',
            expiry_time: expiryTime,
            purpose: 'registration',
            arkesel_response: otpResult.data
        });

        await otp.save();

        res.status(200).json({
            message: 'OTP sent successfully',
            phone_number: otpResult.phone_number,
            expires_at: expiryTime
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Forgot Password - Send OTP
export const forgotPassword = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ message: 'Phone number is required' });
        }

        // Check if user exists
        const user = await User.findOne({ phone });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate OTP using Arkesel service
        const otpResult = await arkeselOTPService.generateOTP({
            phone_number: phone,
            purpose: 'password_reset',
            message: 'Your password reset OTP code is %otp_code%. Valid for 5 minutes.'
        });

        if (!otpResult.success) {
            return res.status(500).json({
                message: 'Failed to send OTP',
                error: otpResult.error
            });
        }

        // Calculate expiry time
        const expiryTime = new Date();
        expiryTime.setMinutes(expiryTime.getMinutes() + 5);

        // Save OTP to database
        const otp = new OTP({
            phone_number: otpResult.phone_number,
            otp_code: otpResult.data.code || 'GENERATED',
            expiry_time: expiryTime,
            purpose: 'password_reset',
            arkesel_response: otpResult.data
        });

        await otp.save();

        res.status(200).json({
            message: 'Password reset OTP sent successfully',
            phone_number: otpResult.phone_number,
            expires_at: expiryTime
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Reset Password with OTP verification
export const resetPassword = async (req, res) => {
    try {
        const { phone, otp_code, new_password } = req.body;

        if (!phone || !otp_code || !new_password) {
            return res.status(400).json({ 
                message: 'Phone number, OTP code, and new password are required' 
            });
        }

        if (new_password.length < 6) {
            return res.status(400).json({ 
                message: 'New password must be at least 6 characters long' 
            });
        }

        // Check if user exists
        const user = await User.findOne({ phone });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify OTP
        const otp = await OTP.findOne({
            phone_number: phone,
            otp_code,
            purpose: 'password_reset',
            is_verified: false
        }).sort({ createdAt: -1 });

        if (!otp) {
            return res.status(400).json({ message: 'Invalid OTP code' });
        }

        if (otp.is_expired) {
            return res.status(400).json({ message: 'OTP has expired' });
        }

        if (otp.attempts >= 5) {
            return res.status(400).json({ 
                message: 'Too many verification attempts. Please request a new OTP.' 
            });
        }

        // Mark OTP as verified
        otp.is_verified = true;
        await otp.save();

        // Update user password
        const hashedPassword = await bcrypt.hash(new_password, 10);
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.status(200).json({
            message: 'Password reset successfully',
            phone_number: phone
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Verify Phone Number (for existing users)
// TEMPORARILY COMMENTED OUT - OTP VERIFICATION DISABLED
// export const verifyPhone = async (req, res) => {
//     try {
//         const { phone, otp_code } = req.body;

//         if (!phone || !otp_code) {
//             return res.status(400).json({ 
//                 message: 'Phone number and OTP code are required' 
//             });
//         }

//         // Check if user exists
//         const user = await User.findOne({ phone });
//         if (!user) {
//             return res.status(404).json({ message: 'User not found' });
//         }

//         if (user.isPhoneVerified) {
//             return res.status(400).json({ 
//                 message: 'Phone number is already verified' 
//             });
//         }

//         // Verify OTP
//         const otp = await OTP.findOne({
//             phone_number: phone,
//             otp_code,
//             purpose: 'phone_verification',
//             is_verified: false
//         }).sort({ createdAt: -1 });

//         if (!otp) {
//             return res.status(400).json({ message: 'Invalid OTP code' });
//         }

//         if (otp.is_expired) {
//             return res.status(400).json({ message: 'OTP has expired' });
//         }

//         if (otp.attempts >= 5) {
//             return res.status(400).json({ 
//                 message: 'Too many verification attempts. Please request a new OTP.' 
//             });
//         }

//         // Mark OTP as verified
//         otp.is_verified = true;
//         await otp.save();

//         // Update user verification status
//         user.isPhoneVerified = true;
//         user.phoneVerifiedAt = new Date();
//         user.isActive = true; // Activate the account
//         await user.save();

//         res.status(200).json({
//             message: 'Phone number verified successfully. You can now login.',
//             user: {
//                 id: user._id,
//                 name: user.name,
//                 phone: user.phone,
//                 email: user.email,
//                 isPhoneVerified: user.isPhoneVerified,
//                 phoneVerifiedAt: user.phoneVerifiedAt,
//                 isActive: user.isActive
//             }
//         });

//     } catch (err) {
//         res.status(500).json({ message: err.message });
//     }
// };
