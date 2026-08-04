require('dotenv').config();
const roomsData = require('../rooms.json');


const rooms = roomsData.map(room => ({
    ...room,
    email: process.env[`ROOM_${room.id}_EMAIL`] || room.email
}));

module.exports = rooms;
