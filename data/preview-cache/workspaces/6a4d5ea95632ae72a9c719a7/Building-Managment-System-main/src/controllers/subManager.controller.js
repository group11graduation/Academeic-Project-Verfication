const Floor = require("../models/Floor");
const Room = require("../models/Room");
const Person = require("../models/Person");


const ActionRequest = require("../models/ActionRequest");

// CREATE FLOOR (allowed)
exports.createFloor = async (req, res) => {
  try {
    const { floorNumber } = req.body;
    
    if (!req.user.building) {
      return res.status(400).json({ message: "User must be assigned to a building" });
    }

    const floor = await Floor.create({
      floorNumber: floorNumber || req.body.name, // Support both field names for backward compatibility
      building: req.user.building
    });

    res.status(201).json(floor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// UPDATE FLOOR (approval)
exports.updateFloor = async (req, res) => {
  try {
    const { floorId } = req.params;
    const { floorNumber } = req.body;

    const floor = await Floor.findById(floorId);
    if (!floor)
      return res.status(404).json({ message: "Floor not found" });

    // CREATE APPROVAL REQUEST
    await ActionRequest.create({
      actionType: "UPDATE",
      targetType: "FLOOR",
      targetId: floor._id,
      building: floor.building,     //  REQUIRED FIELD
      payload: { floorNumber },
      requestedBy: req.user.id,
      status: "PENDING"
    });

    res.json({
      message: "Floor update request sent for approval"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};

// DELETE FLOOR (approval only)
exports.deleteFloor = async (req, res) => {
  try {
    if (!req.user.building) {
      return res.status(400).json({ message: "User must be assigned to a building" });
    }

    await ActionRequest.create({
      requestedBy: req.user.id,
      building: req.user.building,
      actionType: "DELETE",
      targetType: "FLOOR",
      targetId: req.params.id
    });

    res.json({ message: "Floor delete request sent for approval" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


//rooms

// CREATE ROOM
exports.createRoom = async (req, res) => {
  try {
    if (!req.user.building) {
      return res.status(400).json({ message: "User must be assigned to a building" });
    }

    const room = await Room.create({
      ...req.body,
      building: req.user.building
    });

    res.status(201).json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// UPDATE ROOM (approval)
exports.updateRoom = async (req, res) => {
  try {
    if (!req.user.building) {
      return res.status(400).json({ message: "User must be assigned to a building" });
    }

    await ActionRequest.create({
      requestedBy: req.user.id,
      building: req.user.building,
      actionType: "UPDATE",
      targetType: "ROOM",
      targetId: req.params.id,
      payload: req.body
    });

    res.json({ message: "Room update request sent for approval" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// DELETE ROOM (approval)
exports.deleteRoom = async (req, res) => {
  try {
    if (!req.user.building) {
      return res.status(400).json({ message: "User must be assigned to a building" });
    }

    await ActionRequest.create({
      requestedBy: req.user.id,
      building: req.user.building,
      actionType: "DELETE",
      targetType: "ROOM",
      targetId: req.params.id
    });

    res.json({ message: "Room delete request sent for approval" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


//person

// ASSIGN PERSON
exports.createPerson = async (req, res) => {
  try {
    if (!req.user.building) {
      return res.status(400).json({ message: "User must be assigned to a building" });
    }

    const person = await Person.create({
      ...req.body,
      building: req.user.building
    });

    res.status(201).json(person);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// UPDATE PERSON (approval)
exports.updatePerson = async (req, res) => {
  try {
    if (!req.user.building) {
      return res.status(400).json({ message: "User must be assigned to a building" });
    }

    await ActionRequest.create({
      requestedBy: req.user.id,
      building: req.user.building,
      actionType: "UPDATE",
      targetType: "PERSON",
      targetId: req.params.id,
      payload: req.body
    });

    res.json({ message: "Person update request sent for approval" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// DELETE PERSON (approval)
exports.deletePerson = async (req, res) => {
  try {
    if (!req.user.building) {
      return res.status(400).json({ message: "User must be assigned to a building" });
    }

    await ActionRequest.create({
      requestedBy: req.user.id,
      building: req.user.building,
      actionType: "DELETE",
      targetType: "PERSON",
      targetId: req.params.id
    });

    res.json({ message: "Person delete request sent for approval" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
