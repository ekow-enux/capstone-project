import express from 'express';
import {
    createReferral,
    getAllReferrals,
    getReferralById,
    updateReferral,
    deleteReferral,
    getReferralsByData
} from '../controllers/referralController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Referrals
 *     description: Referral management for Emergency Alerts and Incidents
 */

/**
 * @swagger
 * /api/referrals:
 *   post:
 *     summary: Create a new referral
 *     tags: [Referrals]
 *     description: Create a referral for an Emergency Alert or Incident. Checks target station status, active alerts, and active incidents.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - data_id
 *               - data_type
 *               - from_station_id
 *               - to_station_id
 *             properties:
 *               data_id:
 *                 type: string
 *                 description: ID of the Emergency Alert or Incident being referred
 *                 example: "691ad2f5291e7868809ee6b7"
 *               data_type:
 *                 type: string
 *                 enum: [EmergencyAlert, Incident]
 *                 description: Type of data being referred
 *                 example: "EmergencyAlert"
 *               from_station_id:
 *                 type: string
 *                 description: ID of the station making the referral
 *                 example: "69049470ee691673e388de18"
 *               to_station_id:
 *                 type: string
 *                 description: ID of the station receiving the referral
 *                 example: "69049470ee691673e388de19"
 *               reason:
 *                 type: string
 *                 description: Reason for the referral
 *                 example: "Station overloaded, need assistance"
 *     responses:
 *       201:
 *         description: Referral created successfully
 *       400:
 *         description: Validation error or target station has active alerts/incidents
 *       404:
 *         description: Referenced data or station not found
 */
router.post('/', createReferral);

/**
 * @swagger
 * /api/referrals:
 *   get:
 *     summary: Get all referrals
 *     tags: [Referrals]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, rejected]
 *       - in: query
 *         name: data_type
 *         schema:
 *           type: string
 *           enum: [EmergencyAlert, Incident]
 *       - in: query
 *         name: from_station_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: to_station_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of referrals
 */
router.get('/', getAllReferrals);

/**
 * @swagger
 * /api/referrals/:id:
 *   get:
 *     summary: Get referral by ID
 *     tags: [Referrals]
 *   patch:
 *     summary: Update referral (accept/reject)
 *     tags: [Referrals]
 *   delete:
 *     summary: Delete referral
 *     tags: [Referrals]
 */
router.get('/:id', getReferralById);
router.patch('/:id', updateReferral);
router.delete('/:id', deleteReferral);

/**
 * @swagger
 * /api/referrals/data/:data_type/:data_id:
 *   get:
 *     summary: Get all referrals for a specific alert or incident
 *     tags: [Referrals]
 */
router.get('/data/:data_type/:data_id', getReferralsByData);

export default router;

