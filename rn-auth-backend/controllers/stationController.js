import Station from '../models/Station.js';
import Incident from '../models/Incident.js';
import EmergencyAlert from '../models/EmergencyAlert.js';
import mongoose from 'mongoose';

// Helper function to validate coordinates
const validateCoordinates = (latitude, longitude) => {
    const errors = [];
    
    if (latitude !== undefined) {
        if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
            errors.push('Latitude must be a number between -90 and 90');
        }
    }
    
    if (longitude !== undefined) {
        if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
            errors.push('Longitude must be a number between -180 and 180');
        }
    }
    
    return errors;
};

// Helper function to map frontend coordinates to database fields
const mapCoordinates = (latitude, longitude) => {
    const mapped = {};
    
    if (latitude !== undefined) {
        mapped.lat = latitude;
    }
    
    if (longitude !== undefined) {
        mapped.lng = longitude;
    }
    
    return mapped;
};

// Helper function to find existing station
const findExistingStation = async (data) => {
    const { location, phone_number, latitude, longitude, placeId } = data;
    
    // Check by placeId first (most reliable for Google Places)
    if (placeId) {
        const station = await Station.findOne({ placeId });
        if (station) return station;
    }
    
    // Check by coordinates (most reliable for GPS)
    if (latitude !== undefined && longitude !== undefined) {
        const station = await Station.findOne({
            lat: latitude,
            lng: longitude
        });
        if (station) return station;
    }
    
    // Check by location
    if (location) {
        const station = await Station.findOne({
            location: { $regex: new RegExp(location, 'i') }
        });
        if (station) return station;
    }
    
    // Check by phone number
    if (phone_number) {
        const station = await Station.findOne({
            phone_number: phone_number
        });
        if (station) return station;
    }
    
    return null;
};

// Create Station (with upsert functionality)
export const createStation = async (req, res) => {
    try {
        // Log the incoming request body
        console.log('🚀 CREATE STATION - Request Body:', JSON.stringify(req.body, null, 2));
        
        const { name, location, location_url, phone_number, latitude, longitude, placeId, status } = req.body;
        
        // Log extracted values
        console.log('📋 Extracted values:', {
            name,
            location,
            location_url,
            phone_number,
            latitude,
            longitude,
            placeId
        });
        
        // Validate coordinates
        const coordinateErrors = validateCoordinates(latitude, longitude);
        if (coordinateErrors.length > 0) {
            console.log('❌ Coordinate validation errors:', coordinateErrors);
            return res.status(400).json({
                success: false,
                message: coordinateErrors.join(', ')
            });
        }
        
        // Check if station already exists
        const existingStation = await findExistingStation({ location, phone_number, latitude, longitude, placeId });
        
        if (existingStation) {
            console.log('🔄 Found existing station:', existingStation._id);
            
            // Update existing station with missing data
            const updateData = {};
            
            if (name && !existingStation.name) updateData.name = name;
            if (location && !existingStation.location) updateData.location = location;
            if (location_url && !existingStation.location_url) updateData.location_url = location_url;
            if (phone_number && !existingStation.phone_number) updateData.phone_number = phone_number;
            if (placeId && !existingStation.placeId) updateData.placeId = placeId;
            
            // Update coordinates
            const coordinateData = mapCoordinates(latitude, longitude);
            Object.assign(updateData, coordinateData);
            
            console.log('📝 Update data:', updateData);
            
            if (Object.keys(updateData).length > 0) {
                const updatedStation = await Station.findByIdAndUpdate(
                    existingStation._id,
                    updateData,
                    { new: true, runValidators: true }
                );
                
                console.log('✅ Station updated successfully:', updatedStation);
                
                return res.status(200).json({
                    success: true,
                    message: 'Station updated with missing data',
                    data: updatedStation,
                    action: 'updated'
                });
            } else {
                console.log('⏭️ Station already exists with all data, skipping update');
                
                return res.status(200).json({
                    success: true,
                    message: 'Station already exists with all data',
                    data: existingStation,
                    action: 'skipped'
                });
            }
        }
        
        // Create new station
        const stationData = {
            name,
            location,
            location_url,
            phone_number,
            placeId,
            status: status || 'in commission', // Default to 'in commission' if not provided
            hasActiveIncident: false,
            hasActiveAlert: false,
            ...mapCoordinates(latitude, longitude)
        };
        
        console.log('🆕 Creating new station with data:', stationData);
        
        const station = await Station.create(stationData);
        
        console.log('✅ Station created successfully:', station);
        
        res.status(201).json({
            success: true,
            message: 'Station created successfully',
            data: station,
            action: 'created'
        });
        
    } catch (error) {
        console.error('❌ Create station error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Call sign already exists'
            });
        }
        
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Bulk Create Stations (with upsert functionality)
export const bulkCreateStations = async (req, res) => {
    try {
        const { stations } = req.body;
        
        if (!Array.isArray(stations)) {
            return res.status(400).json({
                success: false,
                message: 'Stations must be an array'
            });
        }
        
        const results = {
            created: [],
            updated: [],
            skipped: [],
            errors: []
        };
        
        // Process stations in parallel for better performance
        const promises = stations.map(async (stationData, index) => {
            try {
                const { name, call_sign, location, location_url, latitude, longitude, region, phone_number } = stationData;
                
                // Validate coordinates
                const coordinateErrors = validateCoordinates(latitude, longitude);
                if (coordinateErrors.length > 0) {
                    results.errors.push({
                        index,
                        data: stationData,
                        error: coordinateErrors.join(', ')
                    });
                    return;
                }
                
                // Check if station already exists
                const existingStation = await findExistingStation({ location, phone_number, latitude, longitude });
                
                if (existingStation) {
                    // Update existing station
                    const updateData = {};
                    
                    if (name && !existingStation.name) updateData.name = name;
                    if (call_sign && !existingStation.call_sign) updateData.call_sign = call_sign;
                    if (location && !existingStation.location) updateData.location = location;
                    if (location_url && !existingStation.location_url) updateData.location_url = location_url;
                    if (region && !existingStation.region) updateData.region = region;
                    if (phone_number && !existingStation.phone_number) updateData.phone_number = phone_number;
                    
                    // Update coordinates
                    const coordinateData = mapCoordinates(latitude, longitude);
                    Object.assign(updateData, coordinateData);
                    
                    if (Object.keys(updateData).length > 0) {
                        const updatedStation = await Station.findByIdAndUpdate(
                            existingStation._id,
                            updateData,
                            { new: true, runValidators: true }
                        );
                        
                        results.updated.push({
                            index,
                            data: updatedStation,
                            action: 'updated'
                        });
                    } else {
                        results.skipped.push({
                            index,
                            data: existingStation,
                            action: 'skipped'
                        });
                    }
                } else {
                    // Create new station
                    const newStationData = {
                        name,
                        call_sign,
                        location,
                        location_url,
                        region,
                        phone_number,
                        ...mapCoordinates(latitude, longitude)
                    };
                    
                    const station = await Station.create(newStationData);
                    
                    results.created.push({
                        index,
                        data: station,
                        action: 'created'
                    });
                }
            } catch (error) {
                console.error(`Error processing station ${index}:`, error);
                
                if (error.code === 11000) {
                    results.errors.push({
                        index,
                        data: stations[index],
                        error: 'Call sign already exists'
                    });
                } else {
                    results.errors.push({
                        index,
                        data: stations[index],
                        error: error.message
                    });
                }
            }
        });
        
        await Promise.all(promises);
        
        res.status(200).json({
            success: true,
            message: `Bulk operation completed. Created: ${results.created.length}, Updated: ${results.updated.length}, Skipped: ${results.skipped.length}, Errors: ${results.errors.length}`,
            results
        });
        
    } catch (error) {
        console.error('Bulk create stations error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Helper function to add status information to stations
const addStationStatus = async (stations) => {
    // Simply return stations as-is, no transformation needed
    return stations.map(station => {
        return station.toObject ? station.toObject() : station;
    });
};

// Get All Stations
export const getAllStations = async (req, res) => {
    try {
        const stations = await Station.find({})
            .populate('departments')
            .populate('personnel')
            .sort({ name: 1 });
        
        // Add status information to each station
        const stationsWithStatus = await addStationStatus(stations);
        
        res.status(200).json({
            success: true,
            count: stationsWithStatus.length,
            data: stationsWithStatus
        });
        
    } catch (error) {
        console.error('Get all stations error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Station By ID
export const getStationById = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid station ID format'
            });
        }
        
        const station = await Station.findById(id)
            .populate('departments')
            .populate('personnel');
        
        if (!station) {
            return res.status(404).json({
                success: false,
                message: 'Station not found'
            });
        }
        
        // Add status information
        const stationsWithStatus = await addStationStatus([station]);
        const stationWithStatus = stationsWithStatus[0];
        
        res.status(200).json({
            success: true,
            data: stationWithStatus
        });
        
    } catch (error) {
        console.error('Get station by ID error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update Station
export const updateStation = async (req, res) => {
    try {
        const { id } = req.params;
        const { latitude, longitude, ...otherData } = req.body;
        
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid station ID format'
            });
        }
        
        // Validate coordinates
        const coordinateErrors = validateCoordinates(latitude, longitude);
        if (coordinateErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: coordinateErrors.join(', ')
            });
        }
        
        // Prepare update data
        const updateData = { ...otherData };
        
        // Map coordinates
        const coordinateData = mapCoordinates(latitude, longitude);
        Object.assign(updateData, coordinateData);
        
        const station = await Station.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );
        
        if (!station) {
            return res.status(404).json({
                success: false,
                message: 'Station not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Station updated successfully',
            data: station
        });
        
    } catch (error) {
        console.error('Update station error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Call sign already exists'
            });
        }
        
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete Station
export const deleteStation = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid station ID format'
            });
        }
        
        const station = await Station.findByIdAndDelete(id);
        
        if (!station) {
            return res.status(404).json({
                success: false,
                message: 'Station not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Station deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete station error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};