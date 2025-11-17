import express from 'express';
import {
    createStation,
    bulkCreateStations,
    getAllStations,
    getStationById,
    updateStation,
    deleteStation
} from '../controllers/stationController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Stations
 *     description: Fire station management with intelligent upsert functionality. Prevents duplicates using coordinates, location, or phone number.
 */

/**
 * @swagger
 * /api/fire/stations:
 *   post:
 *     summary: Create a new fire station
 *     tags: [Stations]
 *     description: Create a new fire station with intelligent duplicate detection. Checks for duplicates using coordinates, location, or phone number.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StationCreateRequest'
 *           example:
 *             name: "Accra Central Fire Station"
 *             call_sign: "ACFS-001"
 *             location: "Central Business District, Accra"
 *             location_url: "https://maps.google.com/?q=5.6037,-0.1870"
 *             latitude: 5.6037
 *             longitude: -0.1870
 *             region: "Greater Accra"
 *             phone_number: "+233302123456"
 *             placeId: "ChIJN1t_tDeuEmsRUsoyG83frY4"
 *     responses:
 *       201:
 *         description: Station created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StationResponse'
 *       200:
 *         description: Station already exists and was updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StationResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 */
router.post('/', createStation);

/**
 * @swagger
 * /api/fire/stations/bulk:
 *   post:
 *     summary: Create or update multiple stations in bulk
 *     tags: [Stations]
 *     description: Process multiple stations at once. Each station is checked for duplicates and either created, updated, or skipped.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StationBulkRequest'
 *           example:
 *             stations:
 *               - name: "Accra Central Fire Station"
 *                 call_sign: "ACFS-001"
 *                 location: "Central Business District, Accra"
 *                 latitude: 5.6037
 *                 longitude: -0.1870
 *                 region: "Greater Accra"
 *                 phone_number: "+233302123456"
 *               - name: "Kumasi Fire Station"
 *                 call_sign: "KFS-001"
 *                 location: "Central Kumasi"
 *                 latitude: 6.6885
 *                 longitude: -1.6244
 *                 region: "Ashanti"
 *                 phone_number: "+233512345678"
 *     responses:
 *       200:
 *         description: Bulk operation completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StationBulkResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 */
router.post('/bulk', bulkCreateStations);

/**
 * @swagger
 * /api/fire/stations:
 *   get:
 *     summary: Get all fire stations
 *     tags: [Stations]
 *     description: Retrieve all fire stations with optional filtering and population of related data (departments, personnel, station admins).
 *     parameters:
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: Filter stations by region
 *         example: "Greater Accra"
 *       - in: query
 *         name: populate
 *         schema:
 *           type: string
 *         description: Comma-separated list of relations to populate (departments, personnel, stationAdmins)
 *         example: "departments,personnel,stationAdmins"
 *     responses:
 *       200:
 *         description: List of stations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: number
 *                   example: 10
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Station'
 *       500:
 *         description: Server error
 */
router.get('/', getAllStations);

/**
 * @swagger
 * /api/fire/stations/{id}:
 *   get:
 *     summary: Get a fire station by ID
 *     tags: [Stations]
 *     description: Retrieve a specific fire station by its ID with optional population of related data.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Station ID
 *         example: "507f1f77bcf86cd799439011"
 *       - in: query
 *         name: populate
 *         schema:
 *           type: string
 *         description: Comma-separated list of relations to populate (departments, personnel, stationAdmins)
 *         example: "departments,personnel,stationAdmins"
 *     responses:
 *       200:
 *         description: Station details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Station'
 *       404:
 *         description: Station not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 */
router.get('/:id', getStationById);

/**
 * @swagger
 * /api/fire/stations/{id}:
 *   patch:
 *     summary: Update a fire station
 *     tags: [Stations]
 *     description: Update an existing fire station. All fields are optional - only provided fields will be updated.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Station ID
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StationCreateRequest'
 *           example:
 *             name: "Accra Central Fire Station Updated"
 *             region: "Greater Accra Region"
 *             phone_number: "+233302123456"
 *     responses:
 *       200:
 *         description: Station updated successfully
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
 *                   example: "Station updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Station'
 *       404:
 *         description: Station not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 */
router.patch('/:id', updateStation);

/**
 * @swagger
 * /api/fire/stations/{id}:
 *   delete:
 *     summary: Delete a fire station
 *     tags: [Stations]
 *     description: Permanently delete a fire station by its ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Station ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Station deleted successfully
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
 *                   example: "Station deleted successfully"
 *       404:
 *         description: Station not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 */
router.delete('/:id', deleteStation);

export default router;
