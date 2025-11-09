import SuperAdmin from '../models/SuperAdmin.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Register SuperAdmin
export const createSuperAdmin = async (req, res) => {
    try {
        const { username, password, name, email, managedDepartments, managedStations } = req.body;

        if (!username || !password || !name || !email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username, password, name, and email are required' 
            });
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: 'Password must be at least 6 characters long' 
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const superAdmin = new SuperAdmin({ 
            username,
            password: hashedPassword,
            name,
            email,
            managedDepartments,
            managedStations,
            role: 'super_admin'
        });
        await superAdmin.save();

        // Return admin data without password
        const adminData = await SuperAdmin.findById(superAdmin._id)
            .select('-password')
            .populate('managedDepartments');

        res.status(201).json({ 
            success: true, 
            message: 'Super admin created successfully', 
            data: adminData 
        });
    } catch (error) {
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({ 
                success: false, 
                message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists` 
            });
        }
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Login SuperAdmin
export const loginSuperAdmin = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username and password are required' 
            });
        }

        // Find admin by username
        const admin = await SuperAdmin.findOne({ username: username.toLowerCase() });
        
        if (!admin) {
            return res.status(404).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        // Check if admin is active
        if (!admin.isActive) {
            return res.status(403).json({ 
                success: false, 
                message: 'Account is deactivated' 
            });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, admin.password);
        
        if (!isMatch) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: admin._id, username: admin.username, role: admin.role || 'super_admin' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Return token and admin data without password
        const adminData = await SuperAdmin.findById(admin._id)
            .select('-password')
            .populate('managedDepartments');

        res.status(200).json({ 
            success: true,
            message: 'Login successful',
            token,
            data: adminData
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Get All SuperAdmins
export const getAllSuperAdmins = async (req, res) => {
    try {
        const { isActive } = req.query;
        const filter = {};

        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const admins = await SuperAdmin.find(filter)
            .select('-password')
            .populate('managedDepartments')
            .sort({ name: 1 });
        
        res.status(200).json({ 
            success: true, 
            count: admins.length, 
            data: admins 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Get SuperAdmin By ID
export const getSuperAdminById = async (req, res) => {
    try {
        const admin = await SuperAdmin.findById(req.params.id)
            .select('-password')
            .populate('managedDepartments');

        if (!admin) {
            return res.status(404).json({ 
                success: false, 
                message: 'Super admin not found' 
            });
        }

        res.status(200).json({ 
            success: true, 
            data: admin 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Update SuperAdmin
export const updateSuperAdmin = async (req, res) => {
    try {
        const { username, password, name, email, managedDepartments, managedStations, isActive } = req.body;
        const updates = {};

        // Only update provided fields
        if (username !== undefined) updates.username = username.toLowerCase();
        if (name !== undefined) updates.name = name;
        if (email !== undefined) updates.email = email.toLowerCase();
        if (managedDepartments !== undefined) updates.managedDepartments = managedDepartments;
        if (managedStations !== undefined) updates.managedStations = managedStations;
        if (isActive !== undefined) updates.isActive = isActive;

        // Hash new password if provided
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Password must be at least 6 characters long' 
                });
            }
            updates.password = await bcrypt.hash(password, 10);
        }

        const admin = await SuperAdmin.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        )
        .select('-password')
        .populate('managedDepartments');

        if (!admin) {
            return res.status(404).json({ 
                success: false, 
                message: 'Super admin not found' 
            });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Super admin updated successfully', 
            data: admin 
        });
    } catch (error) {
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({ 
                success: false, 
                message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists` 
            });
        }
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Delete SuperAdmin
export const deleteSuperAdmin = async (req, res) => {
    try {
        const admin = await SuperAdmin.findByIdAndDelete(req.params.id);

        if (!admin) {
            return res.status(404).json({ 
                success: false, 
                message: 'Super admin not found' 
            });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Super admin deleted successfully' 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Change Password
export const changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ 
                success: false, 
                message: 'Old password and new password are required' 
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: 'New password must be at least 6 characters long' 
            });
        }

        const admin = await SuperAdmin.findById(req.params.id);

        if (!admin) {
            return res.status(404).json({ 
                success: false, 
                message: 'Super admin not found' 
            });
        }

        // Verify old password
        const isMatch = await bcrypt.compare(oldPassword, admin.password);
        
        if (!isMatch) {
            return res.status(401).json({ 
                success: false, 
                message: 'Old password is incorrect' 
            });
        }

        // Hash and update new password
        admin.password = await bcrypt.hash(newPassword, 10);
        await admin.save();

        res.status(200).json({ 
            success: true, 
            message: 'Password changed successfully' 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Add Department to SuperAdmin
export const addManagedDepartment = async (req, res) => {
    try {
        const { departmentId } = req.body;

        const admin = await SuperAdmin.findByIdAndUpdate(
            req.params.id,
            { $addToSet: { managedDepartments: departmentId } },
            { new: true }
        )
        .select('-password')
        .populate('managedDepartments');

        if (!admin) {
            return res.status(404).json({ 
                success: false, 
                message: 'Super admin not found' 
            });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Department added to super admin', 
            data: admin 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Remove Department from SuperAdmin
export const removeManagedDepartment = async (req, res) => {
    try {
        const { departmentId } = req.body;

        const admin = await SuperAdmin.findByIdAndUpdate(
            req.params.id,
            { $pull: { managedDepartments: departmentId } },
            { new: true }
        )
        .select('-password')
        .populate('managedDepartments');

        if (!admin) {
            return res.status(404).json({ 
                success: false, 
                message: 'Super admin not found' 
            });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Department removed from super admin', 
            data: admin 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

