const express = require('express');
const router = express.Router();

const roomController = require('../controllers/roomController');
const userController = require('../controllers/userController');
const { publicGetMiddleware, authMiddleware } = require('../middlewares/auth');
const { adminMiddleware } = require('../middlewares/admin');
const { bookingLimiter, apiLimiter } = require('../config/limiter');

router.use(apiLimiter);
router.use(publicGetMiddleware);

router.get('/rooms', roomController.getRooms);
router.get('/config', roomController.getConfig);

router.get('/events', roomController.getAllEvents);
router.post('/rooms/:id/book', bookingLimiter, roomController.bookRoom);
router.delete('/events/:roomEmail/:eventId', roomController.deleteEvent);
router.patch('/events/:roomEmail/:eventId', roomController.updateEvent);

const logController = require('../controllers/logController');
const adminController = require('../controllers/adminController');

router.get('/users/search', userController.searchUsers);
router.post('/users/schedule', userController.getSchedule);
router.get('/users/directory', userController.getDirectory);

router.get('/logs', adminMiddleware, logController.getLogsList);
router.post('/logs/login', logController.logLogin);

// Admin / Settings Routes
router.get('/settings/weekend', adminController.getWeekendSetting);
router.post('/settings/weekend', authMiddleware, adminMiddleware, adminController.toggleWeekendSetting);
router.get('/settings/locks', adminController.getRoomLocks);
router.post('/settings/locks', authMiddleware, adminMiddleware, adminController.addRoomLock);
router.delete('/settings/locks/:id', authMiddleware, adminMiddleware, adminController.deleteRoomLock);

// Admin Users Routes
router.get('/settings/admins/check', authMiddleware, adminController.checkAdminStatus);
router.get('/settings/admins', authMiddleware, adminMiddleware, adminController.getAdminUsers);
router.post('/settings/admins', authMiddleware, adminMiddleware, adminController.addAdminUser);
router.delete('/settings/admins/:email', authMiddleware, adminMiddleware, adminController.deleteAdminUser);

router.get('/analytics', adminMiddleware, adminController.getAnalytics);

module.exports = router;
