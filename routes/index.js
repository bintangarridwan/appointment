const express = require('express');
const router = express.Router();

const roomController = require('../controllers/roomController');
const userController = require('../controllers/userController');
const { publicGetMiddleware } = require('../middlewares/auth');
const { bookingLimiter, apiLimiter } = require('../config/limiter');

router.use(apiLimiter);
router.use(publicGetMiddleware);

router.get('/rooms', roomController.getRooms);
router.get('/config', roomController.getConfig);

router.get('/events', roomController.getAllEvents);
router.post('/rooms/:id/book', bookingLimiter, roomController.bookRoom);
router.delete('/events/:roomEmail/:eventId', roomController.deleteEvent);

const logController = require('../controllers/logController');
const adminController = require('../controllers/adminController');

router.get('/users/search', userController.searchUsers);
router.post('/users/schedule', userController.getSchedule);
router.get('/users/directory', userController.getDirectory);

router.get('/logs', logController.getLogsList);
router.post('/logs/login', logController.logLogin);

// Admin / Settings Routes
router.get('/settings/weekend', adminController.getWeekendSetting);
router.post('/settings/weekend', adminController.toggleWeekendSetting);
router.get('/settings/locks', adminController.getRoomLocks);
router.post('/settings/locks', adminController.addRoomLock);
router.delete('/settings/locks/:id', adminController.deleteRoomLock);

// Admin Users Routes
router.get('/settings/admins/check', adminController.checkAdminStatus);
router.get('/settings/admins', adminController.getAdminUsers);
router.post('/settings/admins', adminController.addAdminUser);
router.delete('/settings/admins/:email', adminController.deleteAdminUser);

module.exports = router;
