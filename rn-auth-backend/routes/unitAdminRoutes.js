import express from 'express';
import {
    createUnitAdmin,
    loginUnitAdmin,
    logoutUnitAdmin,
    getAllUnitAdmins,
    getUnitAdminById,
    getCurrentUnitAdmin,
    updateUnitAdmin,
    deleteUnitAdmin,
    changePassword,
    resetTempPassword,
    getUnitAdminsByUnit
} from '../controllers/unitAdminController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Unit Admin
 *     description: Unit administrator management with authentication and unit-specific management capabilities.
 */

/**
 * @swagger
 * /api/unit-admin/register:
 *   post:
 *     summary: Register a new unit admin
 *     tags: [Unit Admin]
 *     description: Create a new unit administrator account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - unit_id
 *             properties:
 *               username:
 *                 type: string
 *                 example: unit_admin1
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@unit1.gov.gh
 *               tempPassword:
 *                 type: string
 *                 format: password
 *                 description: Temporary password (valid for 7 days)
 *                 example: TEMP1234
 *               name:
 *                 type: string
 *                 example: Bob Johnson
 *               unit_id:
 *                 type: string
 *                 description: Unit ID this admin will manage
 *     responses:
 *       201:
 *         description: Unit admin created successfully with temporary password (valid for 7 days)
 *       400:
 *         description: Validation error or duplicate admin
 *       404:
 *         description: Unit not found
 *       500:
 *         description: Server error
 */
router.post('/register', createUnitAdmin);

/**
 * @swagger
 * /api/unit-admin/login:
 *   post:
 *     summary: Login unit admin
 *     tags: [Unit Admin]
 *     description: Authenticate and login a unit administrator
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: unit_admin1
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePassword123!
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account deactivated or temporary password expired
 *       500:
 *         description: Server error
 */
router.post('/login', loginUnitAdmin);

/**
 * @swagger
 * /api/unit-admin/logout:
 *   post:
 *     summary: Logout unit admin
 *     tags: [Unit Admin]
 *     description: Logout a unit administrator by clearing the authentication cookie
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       500:
 *         description: Server error
 */
router.post('/logout', logoutUnitAdmin);

/**
 * @swagger
 * /api/unit-admin:
 *   get:
 *     summary: Get all unit admins
 *     tags: [Unit Admin]
 *     description: Retrieve all unit administrator accounts
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: unit_id
 *         schema:
 *           type: string
 *         description: Filter by unit ID
 *     responses:
 *       200:
 *         description: List of unit admins
 *       500:
 *         description: Server error
 */
router.get('/', getAllUnitAdmins);

/**
 * @swagger
 * /api/unit-admin/unit/{unit_id}:
 *   get:
 *     summary: Get unit admins by unit ID
 *     tags: [Unit Admin]
 *     description: Retrieve all unit administrators for a specific unit
 *     parameters:
 *       - in: path
 *         name: unit_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unit ID
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of unit admins for the unit
 *       404:
 *         description: Unit not found
 *       500:
 *         description: Server error
 */
router.get('/unit/:unit_id', getUnitAdminsByUnit);

/**
 * @swagger
 * /api/unit-admin/me:
 *   get:
 *     summary: Get current unit admin profile
 *     tags: [Unit Admin]
 *     description: Get the currently authenticated unit admin's profile information
 *     responses:
 *       200:
 *         description: Unit admin profile retrieved successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Unit admin not found
 *       500:
 *         description: Server error
 */
router.get('/me', getCurrentUnitAdmin);

/**
 * @swagger
 * /api/unit-admin/{id}:
 *   get:
 *     summary: Get unit admin by ID
 *     tags: [Unit Admin]
 *     description: Retrieve a specific unit administrator by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unit Admin ID
 *     responses:
 *       200:
 *         description: Unit admin details
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Unit admin not found
 *       500:
 *         description: Server error
 */
router.get('/:id', getUnitAdminById);

/**
 * @swagger
 * /api/unit-admin/{id}:
 *   patch:
 *     summary: Update unit admin
 *     tags: [Unit Admin]
 *     description: Update unit administrator information
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unit Admin ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *               unit_id:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Unit admin updated successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Unit admin or unit not found
 *       500:
 *         description: Server error
 */
router.patch('/:id', updateUnitAdmin);

/**
 * @swagger
 * /api/unit-admin/{id}:
 *   delete:
 *     summary: Delete unit admin
 *     tags: [Unit Admin]
 *     description: Delete a unit administrator account
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unit Admin ID
 *     responses:
 *       200:
 *         description: Unit admin deleted successfully
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Unit admin not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', deleteUnitAdmin);

/**
 * @swagger
 * /api/unit-admin/{id}/change-password:
 *   post:
 *     summary: Change or set unit admin password
 *     tags: [Unit Admin]
 *     description: Change password for a unit administrator. Requires old password to verify identity.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unit Admin ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 format: password
 *                 description: Current password (regular password or temp password)
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: New password (minimum 6 characters)
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Old password is incorrect
 *       403:
 *         description: Temporary password has expired
 *       404:
 *         description: Unit admin not found
 *       500:
 *         description: Server error
 */
router.post('/:id/change-password', changePassword);

/**
 * @swagger
 * /api/unit-admin/{id}/reset-temp-password:
 *   post:
 *     summary: Reset temporary password for unit admin
 *     tags: [Unit Admin]
 *     description: Set a new temporary password for a unit admin (admin function)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unit admin ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newTempPassword
 *             properties:
 *               newTempPassword:
 *                 type: string
 *                 description: New temporary password to set
 *     responses:
 *       200:
 *         description: Temporary password reset successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Unit admin not found
 *       500:
 *         description: Server error
 */
router.post('/:id/reset-temp-password', resetTempPassword);

export default router;