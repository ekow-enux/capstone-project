import express from 'express';
import {
    getTurnoutSlipByIncident,
    getFormattedTurnoutSlip,
    regenerateTurnoutSlip,
    getTurnoutSlipsByStation,
    getAllTurnoutSlips,
    getTurnoutSlipStats,
    exportTurnoutSlipAsPDF
} from '../controllers/turnoutSlipController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Turnout Slip
 *     description: Turnout slip management and retrieval endpoints
 */

/**
 * @swagger
 * /api/turnout-slips:
 *   get:
 *     summary: Get all turnout slips
 *     tags: [Turnout Slip]
 *     description: Retrieve all turnout slips with optional filters
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date (dispatched at)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date (dispatched at)
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *         description: Filter by priority level
 *       - in: query
 *         name: incidentType
 *         schema:
 *           type: string
 *         description: Filter by incident type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, dispatched, en-route, on-scene, resolved, cancelled]
 *         description: Filter by incident status
 *     responses:
 *       200:
 *         description: List of turnout slips
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: number
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Server error
 */
router.get('/', getAllTurnoutSlips);

/**
 * @swagger
 * /api/turnout-slips/incident/{incidentId}:
 *   get:
 *     summary: Get turnout slip by incident ID
 *     tags: [Turnout Slip]
 *     description: Retrieve the turnout slip for a specific incident
 *     parameters:
 *       - in: path
 *         name: incidentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Incident ID
 *     responses:
 *       200:
 *         description: Turnout slip retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       404:
 *         description: Incident or turnout slip not found
 *       500:
 *         description: Server error
 */
router.get('/incident/:incidentId', getTurnoutSlipByIncident);

/**
 * @swagger
 * /api/turnout-slips/incident/{incidentId}/formatted:
 *   get:
 *     summary: Get formatted turnout slip
 *     tags: [Turnout Slip]
 *     description: Get turnout slip formatted for display/printing
 *     parameters:
 *       - in: path
 *         name: incidentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Incident ID
 *     responses:
 *       200:
 *         description: Formatted turnout slip
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     formatted:
 *                       type: string
 *                       description: Plain text formatted turnout slip
 *                     raw:
 *                       type: object
 *                       description: Raw turnout slip data
 *       404:
 *         description: Incident or turnout slip not found
 *       500:
 *         description: Server error
 */
router.get('/incident/:incidentId/formatted', getFormattedTurnoutSlip);

/**
 * @swagger
 * /api/turnout-slips/incident/{incidentId}/regenerate:
 *   post:
 *     summary: Regenerate turnout slip
 *     tags: [Turnout Slip]
 *     description: Manually regenerate the turnout slip for an incident
 *     parameters:
 *       - in: path
 *         name: incidentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Incident ID
 *     responses:
 *       200:
 *         description: Turnout slip regenerated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       404:
 *         description: Incident or alert not found
 *       500:
 *         description: Server error
 */
router.post('/incident/:incidentId/regenerate', regenerateTurnoutSlip);

/**
 * @swagger
 * /api/turnout-slips/incident/{incidentId}/export-pdf:
 *   get:
 *     summary: Export turnout slip as PDF
 *     tags: [Turnout Slip]
 *     description: Export turnout slip as PDF document (placeholder - not yet implemented)
 *     parameters:
 *       - in: path
 *         name: incidentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Incident ID
 *     responses:
 *       200:
 *         description: PDF export (currently returns formatted text)
 *       404:
 *         description: Incident or turnout slip not found
 *       500:
 *         description: Server error
 */
router.get('/incident/:incidentId/export-pdf', exportTurnoutSlipAsPDF);

/**
 * @swagger
 * /api/turnout-slips/station/{stationId}:
 *   get:
 *     summary: Get turnout slips by station
 *     tags: [Turnout Slip]
 *     description: Retrieve all turnout slips for a specific station
 *     parameters:
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Station ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *         description: Filter by priority
 *       - in: query
 *         name: incidentType
 *         schema:
 *           type: string
 *         description: Filter by incident type
 *     responses:
 *       200:
 *         description: List of turnout slips for the station
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: number
 *                 data:
 *                   type: array
 *       500:
 *         description: Server error
 */
router.get('/station/:stationId', getTurnoutSlipsByStation);

/**
 * @swagger
 * /api/turnout-slips/station/{stationId}/stats:
 *   get:
 *     summary: Get turnout slip statistics
 *     tags: [Turnout Slip]
 *     description: Get statistical analysis of turnout slips for a station
 *     parameters:
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Station ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date
 *     responses:
 *       200:
 *         description: Turnout slip statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     byPriority:
 *                       type: object
 *                     byIncidentType:
 *                       type: object
 *                     byStatus:
 *                       type: object
 *                     averageCasualties:
 *                       type: number
 *                     totalCasualties:
 *                       type: number
 *       500:
 *         description: Server error
 */
router.get('/station/:stationId/stats', getTurnoutSlipStats);

export default router;