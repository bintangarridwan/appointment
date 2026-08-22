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

router.get('/users/search', userController.searchUsers);
router.post('/users/schedule', userController.getSchedule);
router.get('/users/directory', userController.getDirectory);

router.get('/logs', logController.getLogsList);
router.post('/logs/login', logController.logLogin);

module.exports = router;
