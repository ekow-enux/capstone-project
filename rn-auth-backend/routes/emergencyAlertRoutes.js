import express from 'express';
import {
    createEmergencyAlert,
    getAllEmergencyAlerts,
    getEmergencyAlertById,
    updateEmergencyAlert,
    deleteEmergencyAlert,
    getEmergencyAlertsByStation,
    getEmergencyAlertsByUser,
    getEmergencyAlertStats,
    
} from '../controllers/emergencyAlertController.js';
const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     EmergencyAlert:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Emergency alert ID
 *           example: "507f1f77bcf86cd799439011"
 *         incidentType:
 *           type: string
 *           enum: [fire, rescue, medical, other]
 *           description: Type of incident
 *           example: "fire"
 *         incidentName:
 *           type: string
 *           description: Name/description of the incident
 *           example: "Building Fire at Central Market"
 *         location:
 *           type: object
 *           properties:
 *             coordinates:
 *               type: object
 *               properties:
 *                 latitude:
 *                   type: number
 *                   format: float
 *                   example: 5.6037
 *                 longitude:
 *                   type: number
 *                   format: float
 *                   example: -0.1870
 *             locationUrl:
 *               type: string
 *               example: "https://maps.google.com/?q=5.6037,-0.1870"
 *             locationName:
 *               type: string
 *               example: "Central Market, Accra"
 *         station:
 *           type: string
 *           description: Station ID
 *           example: "507f1f77bcf86cd799439011"
 *         department:
 *           type: string
 *           description: Department ID assigned to handle this report (automatically assigned to Operations department)
 *           example: "507f1f77bcf86cd799439012"
 *         unit:
 *           type: string
 *           description: Active unit ID assigned to handle this report (automatically assigned to active Operations unit)
 *           example: "507f1f77bcf86cd799439013"
 *         reporterId:
 *           type: string
 *           description: ID of the reporter (User or FirePersonnel)
 *           example: "507f1f77bcf86cd799439011"
 *         reporterType:
 *           type: string
 *           enum: [User, FirePersonnel]
 *           description: Type of reporter (automatically determined from ID)
 *           example: "User"
 *         reportedAt:
 *           type: string
 *           format: date-time
 *           description: When the report was created
 *         status:
 *           type: string
 *           enum: [active, accepted, rejected, referred]
 *           default: active
 *           example: "active"
 *         priority:
 *           type: string
 *           enum: [low, medium, high]
 *           default: high
 *           example: "high"
 *         description:
 *           type: string
 *           description: Additional details about the incident
 *         estimatedCasualties:
 *           type: number
 *           minimum: 0
 *           default: 0
 *         estimatedDamage:
 *           type: string
 *           enum: [minimal, moderate, severe, extensive]
 *           default: minimal
 *         responseTime:
 *           type: number
 *           description: Response time in minutes
 *         resolvedAt:
 *           type: string
 *           format: date-time
 *           description: When the incident was resolved
 *         notes:
 *           type: string
 *           description: Additional notes
 *         dispatched:
 *           type: boolean
 *           description: Whether the active unit has dispatched to handle this report
 *           default: false
 *         dispatchedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the unit dispatched
 *         declined:
 *           type: boolean
 *           description: Whether the active unit has declined this report
 *           default: false
 *         declinedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the unit declined
 *         declineReason:
 *           type: string
 *           description: Reason for declining the report
 *         referred:
 *           type: boolean
 *           description: Whether the report has been referred to another station
 *           default: false
 *         referredAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the report was referred
 *         referredToStation:
 *           type: string
 *           description: Station ID that this report was referred to
 *         referReason:
 *           type: string
 *           description: Reason for referring the report to another station
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     EmergencyAlertCreateRequest:
 *       type: object
 *       required:
 *         - incidentType
 *         - incidentName
 *         - location
 *         - station
 *         - userId
 *       properties:
 *         userId:
 *           type: string
 *           description: ID of the reporter (can be User ID or FirePersonnel ID - automatically detected)
 *           example: "507f1f77bcf86cd799439011"
 *         incidentType:
 *           type: string
 *           enum: [fire, rescue, medical, other]
 *           example: "fire"
 *         incidentName:
 *           type: string
 *           example: "Building Fire at Central Market"
 *         location:
 *           type: object
 *           required:
 *             - coordinates
 *           properties:
 *             coordinates:
 *               type: object
 *               required:
 *                 - latitude
 *                 - longitude
 *               properties:
 *                 latitude:
 *                   type: number
 *                   format: float
 *                   example: 5.6037
 *                 longitude:
 *                   type: number
 *                   format: float
 *                   example: -0.1870
 *             locationUrl:
 *               type: string
 *               example: "https://maps.google.com/?q=5.6037,-0.1870"
 *             locationName:
 *               type: string
 *               example: "Central Market, Accra"
 *         station:
 *           oneOf:
 *             - type: string
 *               description: Station ObjectId
 *               example: "507f1f77bcf86cd799439011"
 *             - type: object
 *               description: Station object with details (will be used to find the station)
 *               properties:
 *                 name:
 *                   type: string
 *                   example: "Ghana Fire Service Station - Madina"
 *                 address:
 *                   type: string
 *                   example: "Madina"
 *                 latitude:
 *                   type: number
 *                   example: 5.6819121
 *                 longitude:
 *                   type: number
 *                   example: -0.172234
 *                 placeId:
 *                   type: string
 *                   example: "ChIJBw0DsOac3w8RKsKHDk7AVeU"
 *                 phone:
 *                   type: string
 *                   example: "030 250 1744"
 *         description:
 *           type: string
 *           example: "Emergency alerted in 3-story building"
 *         estimatedCasualties:
 *           type: number
 *           minimum: 0
 *           example: 0
 *         estimatedDamage:
 *           type: string
 *           enum: [minimal, moderate, severe, extensive]
 *           example: "moderate"
 *         priority:
 *           type: string
 *           enum: [low, medium, high]
 *           example: "high"
 *         notes:
 *           type: string
 *           example: "Multiple units responding"
 *     
 *     EmergencyAlertStats:
 *       type: object
 *       properties:
 *         totalAlerts:
 *           type: number
 *           example: 150
 *         activeAlerts:
 *           type: number
 *           example: 5
 *         acceptedAlerts:
 *           type: number
 *           example: 3
 *         rejectedAlerts:
 *           type: number
 *           example: 2
 *         referredAlerts:
 *           type: number
 *           example: 1
 *         highPriorityAlerts:
 *           type: number
 *           example: 25
 *         mediumPriorityAlerts:
 *           type: number
 *           example: 50
 *         lowPriorityAlerts:
 *           type: number
 *           example: 75
 *         fireIncidents:
 *           type: number
 *           example: 80
 *         rescueIncidents:
 *           type: number
 *           example: 30
 *         medicalIncidents:
 *           type: number
 *           example: 25
 *         otherIncidents:
 *           type: number
 *           example: 15
 */

/**
 * @swagger
 * tags:
 *   - name: Emergency Alerts
 *     description: Fire incident reporting and management
 */

/**
 * @swagger
 * /api/emergency/alerts:
 *   post:
 *     summary: Create a new emergency alert
 *     tags: [Emergency Alerts]
 *     description: Create a new fire incident report with location, station assignment, and priority. Automatically assigns to Operations department and active unit if available.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmergencyAlertCreateRequest'
 *           example:
 *             incidentType: "fire"
 *             incidentName: "Building Fire at Central Market"
 *             location:
 *               coordinates:
 *                 latitude: 5.6037
 *                 longitude: -0.1870
 *               locationUrl: "https://maps.google.com/?q=5.6037,-0.1870"
 *               locationName: "Central Market, Accra"
 *             station:
 *               name: "Ghana Fire Service Station - Madina"
 *               address: "Madina"
 *               latitude: 5.6819121
 *               longitude: -0.172234
 *               placeId: "ChIJBw0DsOac3w8RKsKHDk7AVeU"
 *               phone: "030 250 1744"
 *             userId: "507f1f77bcf86cd799439011"
 *             description: "Emergency alerted in 3-story building"
 *             priority: "high"
 *     responses:
 *       201:
 *         description: Emergency alert created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Emergency alert created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/EmergencyAlert'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post('/', createEmergencyAlert);

/**
 * @swagger
 * /api/emergency/alerts:
 *   get:
 *     summary: Get all emergency alerts
 *     tags: [Emergency Alerts]
 *     description: Retrieve all emergency alerts with optional filtering and pagination
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, accepted, rejected, referred]
 *         description: Filter by status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *         description: Filter by priority
 *       - in: query
 *         name: station
 *         schema:
 *           type: string
 *         description: Filter by station ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Emergency alerts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EmergencyAlert'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     current:
 *                       type: integer
 *                       example: 1
 *                     pages:
 *                       type: integer
 *                       example: 15
 *                     total:
 *                       type: integer
 *                       example: 150
 *       500:
 *         description: Server error
 */
router.get('/',  getAllEmergencyAlerts);

/**
 * @swagger
 * /api/emergency/alerts/stats:
 *   get:
 *     summary: Get emergency alert statistics
 *     tags: [Emergency Alerts]
 *     description: Get comprehensive statistics about emergency alerts
 *     parameters:
 *       - in: query
 *         name: stationId
 *         schema:
 *           type: string
 *         description: Filter by station ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for statistics (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for statistics (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/EmergencyAlertStats'
 *       500:
 *         description: Server error
 */
router.get('/stats', getEmergencyAlertStats);

/**
 * @swagger
 * /api/emergency/alerts/station/{stationId}:
 *   get:
 *     summary: Get emergency alerts by station
 *     tags: [Emergency Alerts]
 *     description: Retrieve all emergency alerts for a specific station
 *     parameters:
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Station ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, accepted, rejected, referred]
 *         description: Filter by status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *         description: Filter by priority
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Emergency alerts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EmergencyAlert'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     current:
 *                       type: integer
 *                       example: 1
 *                     pages:
 *                       type: integer
 *                       example: 5
 *                     total:
 *                       type: integer
 *                       example: 50
 *       400:
 *         description: Invalid station ID
 *       500:
 *         description: Server error
 */
router.get('/station/:stationId', getEmergencyAlertsByStation);

/**
 * @swagger
 * /api/emergency/alerts/user/{userId}:
 *   get:
 *     summary: Get emergency alerts by user
 *     tags: [Emergency Alerts]
 *     description: Retrieve all emergency alerts created by a specific user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, accepted, rejected, referred]
 *         description: Filter by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Emergency alerts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EmergencyAlert'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     current:
 *                       type: integer
 *                       example: 1
 *                     pages:
 *                       type: integer
 *                       example: 3
 *                     total:
 *                       type: integer
 *                       example: 25
 *       400:
 *         description: Invalid user ID
 *       500:
 *         description: Server error
 */
router.get('/user/:userId', getEmergencyAlertsByUser);

/**
 * @swagger
 * /api/emergency/alerts/{id}:
 *   get:
 *     summary: Get emergency alert by ID
 *     tags: [Emergency Alerts]
 *     description: Retrieve a specific emergency alert by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Emergency alert ID
 *     responses:
 *       200:
 *         description: Emergency alert retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/EmergencyAlert'
 *       400:
 *         description: Invalid emergency alert ID
 *       404:
 *         description: Emergency alert not found
 *       500:
 *         description: Server error
 */
router.get('/:id', getEmergencyAlertById);

/**
 * @swagger
 * /api/emergency/alerts/{id}:
 *   patch:
 *     summary: Update emergency alert
 *     tags: [Emergency Alerts]
 *     description: Update an existing emergency alert
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Emergency alert ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, accepted, rejected, referred]
 *                 example: "accepted"
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 example: "high"
 *               description:
 *                 type: string
 *                 example: "Updated description"
 *               notes:
 *                 type: string
 *                 example: "Additional notes"
 *     responses:
 *       200:
 *         description: Emergency alert updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Emergency alert updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/EmergencyAlert'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Emergency alert not found
 *       500:
 *         description: Server error
 */
router.patch('/:id', updateEmergencyAlert);

/**
 * @swagger
 * /api/emergency/alerts/{id}:
 *   delete:
 *     summary: Delete emergency alert
 *     tags: [Emergency Alerts]
 *     description: Delete a emergency alert
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Emergency alert ID
 *     responses:
 *       200:
 *         description: Emergency alert deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Emergency alert deleted successfully"
 *       400:
 *         description: Invalid emergency alert ID
 *       404:
 *         description: Emergency alert not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', deleteEmergencyAlert);

export default router;
