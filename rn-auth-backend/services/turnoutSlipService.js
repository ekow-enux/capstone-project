import EmergencyAlert from '../models/EmergencyAlert.js';
import User from '../models/User.js';
import FirePersonnel from '../models/FirePersonnel.js';

/**
 * Generate a turnout slip from emergency alert data
 * @param {Object} alert - The emergency alert object (should be populated with reporter details)
 * @returns {Object} - Turnout slip data
 */
export const generateTurnoutSlip = async (alert) => {
    try {
        // Ensure alert is populated with reporter details
        let populatedAlert = alert;
        if (!alert.reporterDetails) {
            populatedAlert = await EmergencyAlert.findById(alert._id)
                .populate({
                    path: 'reporterDetails',
                    select: alert.reporterType === 'User' 
                        ? 'name phone email address' 
                        : 'name phone rank department unit role station'
                });
        }

        // Extract reporter information
        const reporter = populatedAlert.reporterDetails || {};
        let reporterName = 'Unknown';
        let reporterPhone = 'N/A';
        let reporterLocation = 'N/A';

        if (populatedAlert.reporterType === 'User') {
            reporterName = reporter.name || 'Unknown User';
            reporterPhone = reporter.phone || 'N/A';
            reporterLocation = reporter.address || 'N/A';
        } else if (populatedAlert.reporterType === 'FirePersonnel') {
            reporterName = reporter.name || 'Unknown Personnel';
            reporterPhone = reporter.phone || 'N/A';
            // For fire personnel, we might not have a specific address, so use station info if available
            reporterLocation = 'Fire Personnel';
        }

        // Extract incident location information
        const incidentLocation = {
            coordinates: {
                latitude: populatedAlert.location?.coordinates?.latitude || null,
                longitude: populatedAlert.location?.coordinates?.longitude || null
            },
            locationUrl: populatedAlert.location?.locationUrl || null,
            locationName: populatedAlert.location?.locationName || 'Unknown Location'
        };

        // Build the turnout slip
        const turnoutSlip = {
            // Incident Information
            incidentName: populatedAlert.incidentName,
            incidentType: populatedAlert.incidentType,
            priority: populatedAlert.priority || 'high',
            description: populatedAlert.description || 'No description provided',
            
            // Reporter Information
            reporter: {
                name: reporterName,
                phone: reporterPhone,
                location: reporterLocation,
                type: populatedAlert.reporterType
            },
            
            // Incident Location
            incidentLocation: {
                name: incidentLocation.locationName,
                coordinates: incidentLocation.coordinates,
                url: incidentLocation.locationUrl,
                formattedAddress: incidentLocation.locationName
            },
            
            // Additional Details
            estimatedCasualties: populatedAlert.estimatedCasualties || 0,
            estimatedDamage: populatedAlert.estimatedDamage || 'minimal',
            
            // Timestamps
            reportedAt: populatedAlert.reportedAt || populatedAlert.createdAt,
            dispatchedAt: new Date(),
            
            // Alert Reference
            alertId: populatedAlert._id.toString(),
            stationId: populatedAlert.station?._id?.toString() || populatedAlert.station?.toString()
        };

        return turnoutSlip;
    } catch (error) {
        console.error('❌ Error generating turnout slip:', error);
        throw new Error(`Failed to generate turnout slip: ${error.message}`);
    }
};

/**
 * Format turnout slip for display/printing
 * @param {Object} turnoutSlip - The turnout slip object
 * @returns {string} - Formatted turnout slip text
 */
export const formatTurnoutSlipForDisplay = (turnoutSlip) => {
    const lines = [
        '═══════════════════════════════════════════',
        '           EMERGENCY TURNOUT SLIP          ',
        '═══════════════════════════════════════════',
        '',
        `INCIDENT: ${turnoutSlip.incidentName}`,
        `TYPE: ${turnoutSlip.incidentType}`,
        `PRIORITY: ${turnoutSlip.priority.toUpperCase()}`,
        '',
        '─────────────────────────────────────────',
        'REPORTER INFORMATION',
        '─────────────────────────────────────────',
        `Name: ${turnoutSlip.reporter.name}`,
        `Phone: ${turnoutSlip.reporter.phone}`,
        `Location: ${turnoutSlip.reporter.location}`,
        '',
        '─────────────────────────────────────────',
        'INCIDENT LOCATION',
        '─────────────────────────────────────────',
        `Address: ${turnoutSlip.incidentLocation.name}`,
        `Coordinates: ${turnoutSlip.incidentLocation.coordinates.latitude}, ${turnoutSlip.incidentLocation.coordinates.longitude}`,
        turnoutSlip.incidentLocation.url ? `Map URL: ${turnoutSlip.incidentLocation.url}` : '',
        '',
        '─────────────────────────────────────────',
        'ADDITIONAL DETAILS',
        '─────────────────────────────────────────',
        `Description: ${turnoutSlip.description}`,
        `Est. Casualties: ${turnoutSlip.estimatedCasualties}`,
        `Est. Damage: ${turnoutSlip.estimatedDamage}`,
        '',
        '─────────────────────────────────────────',
        'TIMESTAMPS',
        '─────────────────────────────────────────',
        `Reported: ${new Date(turnoutSlip.reportedAt).toLocaleString()}`,
        `Dispatched: ${new Date(turnoutSlip.dispatchedAt).toLocaleString()}`,
        '',
        '═══════════════════════════════════════════',
        `Alert ID: ${turnoutSlip.alertId}`,
        '═══════════════════════════════════════════'
    ].filter(line => line !== null && line !== undefined);

    return lines.join('\n');
};