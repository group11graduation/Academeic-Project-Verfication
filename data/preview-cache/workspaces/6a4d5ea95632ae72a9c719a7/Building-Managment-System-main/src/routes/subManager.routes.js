const express = require("express");
const router = express.Router();

const controller = require("../controllers/subManager.controller");


const auth = require("../middleware/auth");
const role = require("../middleware/role");

// FLOOR
router.post("/floors", auth, role("SUB_MANAGER"), controller.createFloor);
router.patch("/floors/:id", auth, role("SUB_MANAGER"), controller.updateFloor);
router.delete("/floors/:id", auth, role("SUB_MANAGER"), controller.deleteFloor);

// ROOM
router.post("/rooms", auth, role("SUB_MANAGER"), controller.createRoom);
router.patch("/rooms/:id", auth, role("SUB_MANAGER"), controller.updateRoom);
router.delete("/rooms/:id", auth, role("SUB_MANAGER"), controller.deleteRoom);
// PERSON
router.post("/people", auth, role("SUB_MANAGER"), controller.createPerson);
router.patch("/people/:id", auth, role("SUB_MANAGER"), controller.updatePerson);
router.delete("/people/:id", auth, role("SUB_MANAGER"), controller.deletePerson);

module.exports = router;
