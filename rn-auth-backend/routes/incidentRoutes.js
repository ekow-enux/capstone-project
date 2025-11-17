import express from 'express';
import {
    createIncident,
    getAllIncidents,
    getIncidentById,
    getIncidentByAlertId,
    updateIncident,
    updateIncidentStatus,
    deleteIncident,
    getIncidentsByDepartment,
    getIncidentsByUnit,
    getIncidentStats
} from '../controllers/incidentController.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Incident:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Incident ID
 *           example: "507f1f77bcf86cd799439011"
 *         alertId:
 *           type: string
 *           description: Reference to Emergency Alert
 *           example: "507f1f77bcf86cd799439011"
 *         departmentOnDuty:
 *           type: string
 *           description: Department handling the incident
 *           example: "507f1f77bcf86cd799439012"
 *         unitOnDuty:
 *           type: string
 *           description: Unit handling the incident
 *           example: "507f1f77bcf86cd799439013"
 *         status:
 *           type: string
 *           enum: [active, dispatched, on_scene, resolved, closed]
 *           default: active
 *           example: "active"
 *         dispatchedAt:
 *           type: string
 *           format: date-time
 *           description: When unit left the station
 *         arrivedAt:
 *           type: string
 *           format: date-time
 *           description: When unit arrived at the scene
 *         resolvedAt:
 *           type: string
 *           format: date-time
 *           description: When the emergency was resolved
 *         closedAt:
 *           type: string
 *           format: date-time
 *           description: When the incident was closed
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     IncidentCreateRequest:
 *       type: object
 *       required:
 *         - alertId
 *         - departmentOnDuty
 *         - unitOnDuty
 *       properties:
 *         alertId:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *         departmentOnDuty:
 *           type: string
 *           example: "507f1f77bcf86cd799439012"
 *         unitOnDuty:
 *           type: string
 *           example: "507f1f77bcf86cd799439013"
 *         status:
 *           type: string
 *           enum: [active, dispatched, on_scene, resolved, closed]
 *           example: "created"
 *     
 *     IncidentStatusUpdate:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [active, dispatched, on_scene, resolved, closed]
 *           example: "dispatched"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Optional custom timestamp (defaults to now)
 *     
 *     IncidentStats:
 *       type: object
 *       properties:
 *         totalIncidents:
 *           type: number
 *           example: 150
 *         activeIncidents:
 *           type: number
 *           example: 5
 *         dispatchedIncidents:
 *           type: number
 *           example: 10
 *         onSceneIncidents:
 *           type: number
 *           example: 8
 *         resolvedIncidents:
 *           type: number
 *           example: 120
 *         closedIncidents:
 *           type: number
 *           example: 7
 *         avgResponseTime:
 *           type: number
 *           description: Average response time in minutes (dispatched to arrived)
 *           example: 12.5
 *         avgResolutionTime:
 *           type: number
 *           description: Average resolution time in minutes (arrived to resolved)
 *           example: 45.3
 */

/**
 * @swagger
 * tags:
 *   - name: Incidents
 *     description: Incident operational lifecycle management
 */

/**
 * @swagger
 * /api/incidents:
 *   post:
 *     summary: Create a new incident
 *     tags: [Incidents]
 *     description: Create a new incident from an emergency alert
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/IncidentCreateRequest'
 *     responses:
 *       201:
 *         description: Incident created successfully
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
 *                   example: "Incident created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Incident'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Alert not found
 *       500:
 *         description: Server error
 */
router.post('/', createIncident);

/**
 * @swagger
 * /api/incidents:
 *   get:
 *     summary: Get all incidents
 *     tags: [Incidents]
 *     description: Retrieve all incidents with optional filtering
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, dispatched, on_scene, resolved, closed]
 *         description: Filter by status
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *         description: Filter by department ID
 *       - in: query
 *         name: unitId
 *         schema:
 *           type: string
 *         description: Filter by unit ID
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
 *         description: Incidents retrieved successfully
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
 *                     $ref: '#/components/schemas/Incident'
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
router.get('/', getAllIncidents);

/**
 * @swagger
 * /api/incidents/stats:
 *   get:
 *     summary: Get incident statistics
 *     tags: [Incidents]
 *     description: Get comprehensive statistics about incidents
 *     parameters:
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *         description: Filter by department ID
 *       - in: query
 *         name: unitId
 *         schema:
 *           type: string
 *         description: Filter by unit ID
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
 *                   $ref: '#/components/schemas/IncidentStats'
 *       500:
 *         description: Server error
 */
router.get('/stats', getIncidentStats);

/**
 * @swagger
 * /api/incidents/alert/{alertId}:
 *   get:
 *     summary: Get incident by alert ID
 *     tags: [Incidents]
 *     description: Retrieve incident associated with a specific alert
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Incident retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Incident'
 *       400:
 *         description: Invalid alert ID
 *       404:
 *         description: Incident not found
 *       500:
 *         description: Server error
 */
router.get('/alert/:alertId', getIncidentByAlertId);

/**
 * @swagger
 * /api/incidents/department/{departmentId}:
 *   get:
 *     summary: Get incidents by department
 *     tags: [Incidents]
 *     description: Retrieve all incidents for a specific department
 *     parameters:
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Department ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, dispatched, on_scene, resolved, closed]
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
 *         description: Incidents retrieved successfully
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
 *                     $ref: '#/components/schemas/Incident'
 *                 pagination:
 *                   type: object
 *       400:
 *         description: Invalid department ID
 *       500:
 *         description: Server error
 */
router.get('/department/:departmentId', getIncidentsByDepartment);

/**
 * @swagger
 * /api/incidents/unit/{unitId}:
 *   get:
 *     summary: Get incidents by unit
 *     tags: [Incidents]
 *     description: Retrieve all incidents for a specific unit
 *     parameters:
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unit ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, dispatched, on_scene, resolved, closed]
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
 *         description: Incidents retrieved successfully
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
 *                     $ref: '#/components/schemas/Incident'
 *                 pagination:
 *                   type: object
 *       400:
 *         description: Invalid unit ID
 *       500:
 *         description: Server error
 */
router.get('/unit/:unitId', getIncidentsByUnit);

/**
 * @swagger
 * /api/incidents/{id}:
 *   get:
 *     summary: Get incident by ID
 *     tags: [Incidents]
 *     description: Retrieve a specific incident by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Incident ID
 *     responses:
 *       200:
 *         description: Incident retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Incident'
 *       400:
 *         description: Invalid incident ID
 *       404:
 *         description: Incident not found
 *       500:
 *         description: Server error
 */
router.get('/:id', getIncidentById);

/**
 * @swagger
 * /api/incidents/{id}:
 *   patch:
 *     summary: Update incident
 *     tags: [Incidents]
 *     description: Update an existing incident
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Incident ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               departmentOnDuty:
 *                 type: string
 *               unitOnDuty:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, dispatched, on_scene, resolved, closed]
 *               dispatchedAt:
 *                 type: string
 *                 format: date-time
 *               arrivedAt:
 *                 type: string
 *                 format: date-time
 *               resolvedAt:
 *                 type: string
 *                 format: date-time
 *               closedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Incident updated successfully
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
 *                   example: "Incident updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Incident'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Incident not found
 *       500:
 *         description: Server error
 */
router.patch('/:id', updateIncident);

/**
 * @swagger
 * /api/incidents/{id}/status:
 *   patch:
 *     summary: Update incident status
 *     tags: [Incidents]
 *     description: Update the status of an incident (automatically sets timestamps)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Incident ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/IncidentStatusUpdate'
 *     responses:
 *       200:
 *         description: Incident status updated successfully
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
 *                   example: "Incident status updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Incident'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Incident not found
 *       500:
 *         description: Server error
 */
router.patch('/:id/status', updateIncidentStatus);

/**
 * @swagger
 * /api/incidents/{id}:
 *   delete:
 *     summary: Delete incident
 *     tags: [Incidents]
 *     description: Delete an incident
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Incident ID
 *     responses:
 *       200:
 *         description: Incident deleted successfully
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
 *                   example: "Incident deleted successfully"
 *       400:
 *         description: Invalid incident ID
 *       404:
 *         description: Incident not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', deleteIncident);

export default router;

