require('dotenv').config();
const path = require('path');
const roomsData = require(path.join(__dirname, '..', 'rooms.json'));

const rooms = roomsData.map(room => ({
    ...room,
    email: process.env[`ROOM_${room.id}_EMAIL`] || room.email
}));

module.exports = rooms;
