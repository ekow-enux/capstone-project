import FirePersonnel from '../models/FirePersonnel.js';
import Unit from '../models/Unit.js';
import Department from '../models/Department.js';
import Station from '../models/Station.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Helper function to extract user ID from token
const getUserIdFromToken = (req) => {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.fire_personnel_token;
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.id;
    } catch (err) {
        return null;
    }
};

// Create FirePersonnel
export const createFirePersonnel = async (req, res) => {
    try {
        const { serviceNumber, name, rank, unit, department, role, station_id, password } = req.body;
        
        if (!serviceNumber || !station_id || !department || !password) {
            return res.status(400).json({
                success: false,
                message: 'Service number, station_id, department, and password are required'
            });
        }
        
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Validate station_id
        if (!mongoose.Types.ObjectId.isValid(station_id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid station_id format'
            });
        }

        // Check if station exists
        const stationDoc = await Station.findById(station_id);
        if (!stationDoc) {
            return res.status(404).json({
                success: false,
                message: 'Station not found'
            });
        }

        // Validate department
        if (!mongoose.Types.ObjectId.isValid(department)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid department format'
            });
        }

        const departmentDoc = await Department.findById(department);
        if (!departmentDoc) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        // Validate that department belongs to the station
        if (departmentDoc.station_id.toString() !== station_id) {
            return res.status(400).json({
                success: false,
                message: 'Department does not belong to the specified station'
            });
        }

        // Validate unit if provided
        if (unit) {
            if (!mongoose.Types.ObjectId.isValid(unit)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid unit format'
                });
            }

            const unitDoc = await Unit.findById(unit);
            if (!unitDoc) {
                return res.status(404).json({
                    success: false,
                    message: 'Unit not found'
                });
            }

            // Validate that unit belongs to the specified department
            if (unitDoc.department.toString() !== department) {
                return res.status(400).json({
                    success: false,
                    message: 'Unit does not belong to the specified department'
                });
            }
        }

        const personnel = new FirePersonnel({
            serviceNumber,
            name, 
            rank, 
            unit, 
            department,
            role: role || 'Officer in charge (OIC)', 
            station_id, 
            password: hashedPassword
        });
        await personnel.save();

        const populatedPersonnel = await FirePersonnel.findById(personnel._id)
            .populate('rank')
            .populate({
                path: 'unit',
                populate: { path: 'department' }
            })
            .populate('department')
            .populate('station_id');

        res.status(201).json({
            success: true,
            message: 'Fire personnel created successfully.',
            data: populatedPersonnel
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get All FirePersonnel
export const getAllFirePersonnel = async (req, res) => {
    try {
        const { unit, department, station_id, rank } = req.query;
        const filter = {};

        if (unit) filter.unit = unit;
        if (department) {
            if (!mongoose.Types.ObjectId.isValid(department)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid department format'
                });
            }
            filter.department = department;
        }
        if (station_id) {
            if (!mongoose.Types.ObjectId.isValid(station_id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid station_id format'
                });
            }
            filter.station_id = station_id;
        }
        if (rank) filter.rank = rank;

        const personnel = await FirePersonnel.find(filter)
            .populate('rank')
            .populate({
                path: 'unit',
                populate: { path: 'department' }
            })
            .populate('department')
            .populate('station_id')
            .sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: personnel.length,
            data: personnel
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Current FirePersonnel (Me)
export const getCurrentFirePersonnel = async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'Unauthorized - Invalid or missing token' 
            });
        }

        const personnel = await FirePersonnel.findById(userId)
            .select('-password')
            .populate('rank')
            .populate({
                path: 'unit',
                populate: { path: 'department' }
            })
            .populate('department')
            .populate('station_id');

        if (!personnel) {
            return res.status(404).json({ 
                success: false, 
                message: 'Fire personnel not found' 
            });
        }

        res.status(200).json({ 
            success: true, 
            data: personnel
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Get FirePersonnel By ID
export const getFirePersonnelById = async (req, res) => {
    try {
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid personnel ID format'
            });
        }

        const personnel = await FirePersonnel.findById(req.params.id)
            .populate('rank')
            .populate({
                path: 'unit',
                populate: { path: 'department' }
            })
            .populate('department')
            .populate('station_id');

        if (!personnel) {
            return res.status(404).json({
                success: false,
                message: 'Fire personnel not found'
            });
        }

        res.status(200).json({
            success: true,
            data: personnel
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update FirePersonnel
export const updateFirePersonnel = async (req, res) => {
    try {
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid personnel ID format'
            });
        }

        // Get current personnel to check existing values
        const currentPersonnel = await FirePersonnel.findById(req.params.id);
        if (!currentPersonnel) {
            return res.status(404).json({
                success: false,
                message: 'Fire personnel not found'
            });
        }

        const { unit, department, station_id, role } = req.body;
        
        // Determine the station_id to use (new or existing)
        const targetStationId = station_id || currentPersonnel.station_id;
        const targetDepartment = department || currentPersonnel.department;
        const targetUnit = unit || currentPersonnel.unit;

        // Validate station_id if provided
        if (station_id) {
            if (!mongoose.Types.ObjectId.isValid(station_id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid station_id format'
                });
            }

            // Check if station exists
            const stationDoc = await Station.findById(station_id);
            if (!stationDoc) {
                return res.status(404).json({
                    success: false,
                    message: 'Station not found'
                });
            }
        }

        // Validate department if provided
        if (department) {
            if (!mongoose.Types.ObjectId.isValid(department)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid department format'
                });
            }

            const departmentDoc = await Department.findById(department);
            if (!departmentDoc) {
                return res.status(404).json({
                    success: false,
                    message: 'Department not found'
                });
            }

            // Validate that department belongs to the target station
            if (departmentDoc.station_id.toString() !== targetStationId.toString()) {
                return res.status(400).json({
                    success: false,
                    message: 'Department does not belong to the specified station'
                });
            }
        } else if (station_id) {
            // If station_id is being updated but department is not, validate existing department belongs to new station
            const departmentDoc = await Department.findById(currentPersonnel.department);
            if (departmentDoc && departmentDoc.station_id.toString() !== station_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Current department does not belong to the new station. Please update department as well.'
                });
            }
        }

        // Validate unit if provided
        if (unit) {
            if (!mongoose.Types.ObjectId.isValid(unit)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid unit format'
                });
            }

            const unitDoc = await Unit.findById(unit);
            if (!unitDoc) {
                return res.status(404).json({
                    success: false,
                    message: 'Unit not found'
                });
            }

            // Validate that unit belongs to the target department
            if (unitDoc.department.toString() !== targetDepartment.toString()) {
                return res.status(400).json({
                    success: false,
                    message: 'Unit does not belong to the specified department'
                });
            }
        } else if (department) {
            // If department is being updated but unit is not, validate existing unit belongs to new department
            if (currentPersonnel.unit) {
                const unitDoc = await Unit.findById(currentPersonnel.unit);
                if (unitDoc && unitDoc.department.toString() !== department) {
                    return res.status(400).json({
                        success: false,
                        message: 'Current unit does not belong to the new department. Please update unit as well.'
                    });
                }
            }
        }

        // Handle role as string
        const updateData = { ...req.body };
        if (role !== undefined) {
            updateData.role = role || 'Officer in charge (OIC)';
        }

        const personnel = await FirePersonnel.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        )
        .populate('rank')
        .populate({
            path: 'unit',
            populate: { path: 'department' }
        })
        .populate('department')
        .populate('station_id');

        if (!personnel) {
            return res.status(404).json({
                success: false,
                message: 'Fire personnel not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Fire personnel updated successfully',
            data: personnel
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete FirePersonnel
export const deleteFirePersonnel = async (req, res) => {
    try {
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid personnel ID format'
            });
        }

        const personnel = await FirePersonnel.findByIdAndDelete(req.params.id);

        if (!personnel) {
            return res.status(404).json({
                success: false,
                message: 'Fire personnel not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Fire personnel deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Personnel by Unit
export const getPersonnelByUnit = async (req, res) => {
    try {
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.unitId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid unit ID format'
            });
        }

        const personnel = await FirePersonnel.find({ unit: req.params.unitId })
            .populate('rank')
            .populate({
                path: 'unit',
                populate: { path: 'department' }
            })
            .populate('department')
            .populate('station_id')
            .sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: personnel.length,
            data: personnel
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Personnel by Department
export const getPersonnelByDepartment = async (req, res) => {
    try {
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.departmentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid department ID format'
            });
        }

        // Find personnel directly by department
        const personnel = await FirePersonnel.find({ department: req.params.departmentId })
            .populate('rank')
            .populate({
                path: 'unit',
                populate: { path: 'department' }
            })
            .populate('department')
            .populate('station_id')
            .sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: personnel.length,
            data: personnel
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Personnel by Station
export const getPersonnelByStation = async (req, res) => {
    try {
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.stationId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid station ID format'
            });
        }

        const personnel = await FirePersonnel.find({ station_id: req.params.stationId })
            .populate('rank')
            .populate({
                path: 'unit',
                populate: { path: 'department' }
            })
            .populate('department')
            .populate('station_id')
            .sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: personnel.length,
            data: personnel
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Login Fire Personnel
export const loginFirePersonnel = async (req, res) => {
    try {
        const { serviceNumber, password } = req.body || {};

        if (!serviceNumber || !password) {
            return res.status(400).json({
                success: false,
                message: 'Service number and password are required'
            });
        }

        // Normalize serviceNumber - trim and ensure consistent format
        const normalizedServiceNumber = String(serviceNumber || '').trim();

        // Find personnel by serviceNumber (case-insensitive if needed, but serviceNumber should be exact)
        const personnel = await FirePersonnel.findOne({ 
            serviceNumber: normalizedServiceNumber 
        })
            .select('+password')
            .populate('rank')
            .populate({
                path: 'unit',
                populate: { path: 'department' }
            })
            .populate('department')
            .populate('station_id');

        if (!personnel) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check password
        const passwordToCompare = String(password || '').trim();
        const isValidPassword = await bcrypt.compare(passwordToCompare, personnel.password);

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const token = jwt.sign(
            {
                id: personnel._id,
                serviceNumber: personnel.serviceNumber,
                role: 'fire_personnel'
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('fire_personnel_token', token, {
            httpOnly: true,
            secure: false, // Changed to match station admin
            sameSite: 'lax', // Changed to match station admin
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        const responseData = personnel.toObject();
        delete responseData.password;

        res.status(200).json({
            success: true,
            message: 'Login successful.',
            token,
            data: responseData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Logout Fire Personnel
export const logoutFirePersonnel = (req, res) => {
    res.clearCookie('fire_personnel_token', {
        httpOnly: true,
        secure: false, // Changed to match station admin
        sameSite: 'lax' // Changed to match station admin
    });

    res.status(200).json({
        success: true,
        message: 'Logged out successfully'
    });
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

        const personnel = await FirePersonnel.findById(req.params.id)
            .select('+password');

        if (!personnel) {
            return res.status(404).json({ 
                success: false, 
                message: 'Fire personnel not found' 
            });
        }

        // Verify old password
        const isValidPassword = await bcrypt.compare(oldPassword, personnel.password);
        
        if (!isValidPassword) {
            return res.status(401).json({ 
                success: false, 
                message: 'Old password is incorrect' 
            });
        }

        // Hash and update new password
        personnel.password = await bcrypt.hash(newPassword, 10);
        await personnel.save();

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

