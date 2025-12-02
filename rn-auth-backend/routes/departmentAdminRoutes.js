import express from 'express';
import {
    createDepartmentAdmin,
    loginDepartmentAdmin,
    logoutDepartmentAdmin,
    getAllDepartmentAdmins,
    getDepartmentAdminById,
    getCurrentDepartmentAdmin,
    updateDepartmentAdmin,
    deleteDepartmentAdmin,
    changePassword,
    resetTempPassword,
    getDepartmentAdminsByDepartment
} from '../controllers/departmentAdminController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Department Admin
 *     description: Department administrator management with authentication and department-specific management capabilities.
 */

/**
 * @swagger
 * /api/department-admin/register:
 *   post:
 *     summary: Register a new department admin
 *     tags: [Department Admin]
 *     description: Create a new department administrator account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - department_id
 *             properties:
 *               username:
 *                 type: string
 *                 example: dept_admin1
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@department1.gov.gh
 *               tempPassword:
 *                 type: string
 *                 format: password
 *                 description: Temporary password (valid for 7 days)
 *                 example: TEMP1234
 *               name:
 *                 type: string
 *                 example: Jane Smith
 *               department_id:
 *                 type: string
 *                 description: Department ID this admin will manage
 *     responses:
 *       201:
 *         description: Department admin created successfully with temporary password (valid for 7 days)
 *       400:
 *         description: Validation error or duplicate admin
 *       404:
 *         description: Department not found
 *       500:
 *         description: Server error
 */
router.post('/register', createDepartmentAdmin);

/**
 * @swagger
 * /api/department-admin/login:
 *   post:
 *     summary: Login department admin
 *     tags: [Department Admin]
 *     description: Authenticate and login a department administrator
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
 *                 example: dept_admin1
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
router.post('/login', loginDepartmentAdmin);

/**
 * @swagger
 * /api/department-admin/logout:
 *   post:
 *     summary: Logout department admin
 *     tags: [Department Admin]
 *     description: Logout a department administrator by clearing the authentication cookie
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       500:
 *         description: Server error
 */
router.post('/logout', logoutDepartmentAdmin);

/**
 * @swagger
 * /api/department-admin:
 *   get:
 *     summary: Get all department admins
 *     tags: [Department Admin]
 *     description: Retrieve all department administrator accounts
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: department_id
 *         schema:
 *           type: string
 *         description: Filter by department ID
 *     responses:
 *       200:
 *         description: List of department admins
 *       500:
 *         description: Server error
 */
router.get('/', getAllDepartmentAdmins);

/**
 * @swagger
 * /api/department-admin/department/{department_id}:
 *   get:
 *     summary: Get department admins by department ID
 *     tags: [Department Admin]
 *     description: Retrieve all department administrators for a specific department
 *     parameters:
 *       - in: path
 *         name: department_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Department ID
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of department admins for the department
 *       404:
 *         description: Department not found
 *       500:
 *         description: Server error
 */
router.get('/department/:department_id', getDepartmentAdminsByDepartment);

/**
 * @swagger
 * /api/department-admin/me:
 *   get:
 *     summary: Get current department admin profile
 *     tags: [Department Admin]
 *     description: Get the currently authenticated department admin's profile information
 *     responses:
 *       200:
 *         description: Department admin profile retrieved successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Department admin not found
 *       500:
 *         description: Server error
 */
router.get('/me', getCurrentDepartmentAdmin);

/**
 * @swagger
 * /api/department-admin/{id}:
 *   get:
 *     summary: Get department admin by ID
 *     tags: [Department Admin]
 *     description: Retrieve a specific department administrator by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Department Admin ID
 *     responses:
 *       200:
 *         description: Department admin details
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Department admin not found
 *       500:
 *         description: Server error
 */
router.get('/:id', getDepartmentAdminById);

/**
 * @swagger
 * /api/department-admin/{id}:
 *   patch:
 *     summary: Update department admin
 *     tags: [Department Admin]
 *     description: Update department administrator information
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Department Admin ID
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
 *               department_id:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Department admin updated successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Department admin or department not found
 *       500:
 *         description: Server error
 */
router.patch('/:id', updateDepartmentAdmin);

/**
 * @swagger
 * /api/department-admin/{id}:
 *   delete:
 *     summary: Delete department admin
 *     tags: [Department Admin]
 *     description: Delete a department administrator account
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Department Admin ID
 *     responses:
 *       200:
 *         description: Department admin deleted successfully
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Department admin not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', deleteDepartmentAdmin);

/**
 * @swagger
 * /api/department-admin/{id}/change-password:
 *   post:
 *     summary: Change or set department admin password
 *     tags: [Department Admin]
 *     description: Change password for a department administrator. Requires old password to verify identity.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Department Admin ID
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
 *         description: Department admin not found
 *       500:
 *         description: Server error
 */
router.post('/:id/change-password', changePassword);

/**
 * @swagger
 * /api/department-admin/{id}/reset-temp-password:
 *   post:
 *     summary: Reset temporary password for department admin
 *     tags: [Department Admin]
 *     description: Set a new temporary password for a department admin (admin function)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Department admin ID
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
 *         description: Department admin not found
 *       500:
 *         description: Server error
 */
router.post('/:id/reset-temp-password', resetTempPassword);

export default router;