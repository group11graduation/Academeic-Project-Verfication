const Floor = require("../models/Floor");
const Room = require("../models/Room");
const Person = require("../models/Person");
const Building = require("../models/Building");
const User = require("../models/User");
const ActionRequest = require("../models/ActionRequest");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

// --- HELPER: HELO BUILDING-KA USER-KA ---
// Now supports optional buildingId parameter to filter by specific building
const getBuildingForUser = async (user, buildingId = null) => {
  try {
    if (!user) return null;
    
    // For SUB_MANAGER, we need to fetch the user from DB to get the building field
    if (user.role === "SUB_MANAGER") {
      const fullUser = await User.findById(user.id || user._id).select("building");
      if (!fullUser || !fullUser.building) {
        console.error("Sub-manager has no building assigned:", user.id);
        return null;
      }
      return await Building.findById(fullUser.building);
    }
    
    if (user.role === "MANAGER") {
      if (buildingId) {
        // If buildingId provided, verify it belongs to this manager
        return await Building.findOne({ _id: buildingId, manager: user.id || user._id });
      } else {
        // Otherwise get first building (backward compatibility)
        return await Building.findOne({ manager: user.id || user._id });
      }
    }
    
    return null;
  } catch (err) {
    console.error("Helper Error:", err);
    return null;
  }
};

// --- HELPER: MAAMULIDDA CODSIYADA (SUB-MANAGER ONLY) ---
const handleAction = async (req, res, targetType, actionType, targetId, payload = null) => {
  const user = req.user;
  if (user.role === "SUB_MANAGER" && (actionType === "UPDATE" || actionType === "DELETE")) {
    const building = await getBuildingForUser(user);
    if (!building) return res.status(400).json({ message: "Building configuration missing" });

    const request = new ActionRequest({
      requestedBy: user.id,
      building: building._id,
      actionType,
      targetType,
      targetId,
      payload,
      status: "PENDING"
    });

    await request.save();
    return res.status(202).json({
      message: "Codsigan wuxuu u baahan yahay ansixin Manager",
      isPending: true
    });
  }
  return false;
};

// --- SUB-MANAGER CONTROLLERS ---
exports.createSubManager = async (req, res) => {
  const { name, email, password, buildingLogo, buildingId } = req.body;
  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ message: "Email already exists" });

    // Use buildingId from request if provided (for multi-building support)
    const selectedBuildingId = buildingId || req.query.buildingId;
    const building = await getBuildingForUser(req.user, selectedBuildingId);
    if (!building) return res.status(400).json({ message: "Manager building not found" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const subManager = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "SUB_MANAGER",
      building: building._id,
      parentManager: req.user.id,
      buildingLogo: buildingLogo || "" // Add optional image field
    });
    await subManager.save();
    res.status(201).json({ message: "Sub-manager created", subManager });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getSubManagers = async (req, res) => {
  try {
    const buildingId = req.query.buildingId; // Optional building ID filter
    
    // Build query
    const query = { parentManager: req.user.id };
    
    // If buildingId is provided, filter by building
    if (buildingId) {
      // Verify the building belongs to this manager
      const building = await getBuildingForUser(req.user, buildingId);
      if (building) {
        query.building = building._id;
      }
    }
    
    const subManagers = await User.find(query).select("-password");
    res.json(subManagers);
  } catch (err) { res.status(500).json({ message: "Error fetching sub-managers" }); }
};


exports.updateSubManager = async (req, res) => {
  const { subManagerId } = req.params;
  const { name, email, password } = req.body;

  try {
    // 1. Hel Sub-manager-ka oo hubi inuu jiro
    const subManager = await User.findById(subManagerId);
    if (!subManager || subManager.role !== "SUB_MANAGER") {
      return res.status(404).json({ message: "Sub-manager not found" });
    }

    // 2. Hubi in Manager-ka codsanaya uu isagu leeyahay Sub-manager-kan
    if (subManager.parentManager.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to update this sub-manager" });
    }

    // 3. Cusboonaysii xogta
    if (name) subManager.name = name.trim();
    if (email) {
      const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: subManagerId } });
      if (existing) return res.status(400).json({ message: "Email already in use by another user" });
      subManager.email = email.toLowerCase().trim();
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      subManager.password = await bcrypt.hash(password, salt);
    }

    await subManager.save();
    res.json({ message: "Sub-manager updated successfully", subManager: { name: subManager.name, email: subManager.email } });
  } catch (err) {
    res.status(500).json({ message: "Server error during update", error: err.message });
  }
};



exports.deleteSubManager = async (req, res) => {
  const { subManagerId } = req.params;

  try {
    const subManager = await User.findById(subManagerId);

    if (!subManager || subManager.role !== "SUB_MANAGER") {
      return res.status(404).json({ message: "Sub-manager not found" });
    }

    // Hubi in Manager-ka codsanaya uu yahay kii abuuray
    if (subManager.parentManager.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to delete this sub-manager" });
    }

    await User.findByIdAndDelete(subManagerId);
    res.json({ message: "Sub-manager deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error during deletion", error: err.message });
  }
};
// --- FLOOR CONTROLLERS ---
exports.getFloors = async (req, res) => {
  try {
    const buildingId = req.query.buildingId; // Optional building ID filter
    const building = await getBuildingForUser(req.user, buildingId);
    if (!building) return res.status(404).json({ message: "Building not found" });
    const floors = await Floor.find({ building: building._id }).sort({ floorNumber: 1 });
    res.json(floors);
  } catch (err) { res.status(500).json({ message: "Internal Server Error" }); }
};

exports.addFloor = async (req, res) => {
  try {
    // Get buildingId from request body or query (for multi-building support)
    const buildingId = req.body.buildingId || req.query.buildingId;
    const building = await getBuildingForUser(req.user, buildingId);
    if (!building) return res.status(400).json({ message: "Building missing" });
    
    // Check floor limit if set by admin
    if (building.floorLimit && building.floorLimit > 0) {
      const existingFloors = await Floor.countDocuments({ building: building._id });
      if (existingFloors >= building.floorLimit) {
        return res.status(400).json({ 
          message: `Floor limit reached! You have reached the maximum of ${building.floorLimit} floor${building.floorLimit !== 1 ? 's' : ''} for this building. Please contact your administrator to increase the floor limit if you need to add more floors.`,
          floorLimit: building.floorLimit,
          currentFloors: existingFloors,
          isLimitReached: true
        });
      }
    }
    
    const floor = new Floor({ floorNumber: req.body.floorNumber, building: building._id });
    await floor.save();
    res.status(201).json(floor);
  } catch (err) { 
    res.status(500).json({ message: "Error adding floor", error: err.message }); 
  }
};

exports.updateFloor = async (req, res) => {
  const { floorId } = req.params;
  try {
    const isPending = await handleAction(req, res, "FLOOR", "UPDATE", floorId, req.body);
    if (isPending) return;
    const floor = await Floor.findByIdAndUpdate(floorId, req.body, { new: true });
    res.json(floor);
  } catch (err) { res.status(500).json({ message: "Error updating floor" }); }
};

exports.deleteFloor = async (req, res) => {
  const { floorId } = req.params;
  try {
    const isPending = await handleAction(req, res, "FLOOR", "DELETE", floorId);
    if (isPending) return;
    await Floor.findByIdAndDelete(floorId);
    res.json({ message: "Floor deleted" });
  } catch (err) { res.status(500).json({ message: "Error deleting floor" }); }
};

// --- ROOM CONTROLLERS ---
exports.getRooms = async (req, res) => {
  try {
    const buildingId = req.query.buildingId; // Optional building ID filter
    const building = await getBuildingForUser(req.user, buildingId);
    if (!building) return res.status(404).json({ message: "Building not found" });
    const floors = await Floor.find({ building: building._id });
    const floorIds = floors.map(f => f._id);
    
    // Check if we should filter by available status only
    const availableOnly = req.query.availableOnly === 'true' || req.query.availableOnly === true;
    
    // Check for apartment filtering
    const isApartment = req.query.isApartment;
    const parentApartment = req.query.parentApartment;
    
    let query = { floor: { $in: floorIds } };
    if (availableOnly) {
      query.status = "AVAILABLE"; // Only get available rooms
    }
    
    // Filter by apartment status if specified
    if (isApartment === 'true' || isApartment === true) {
      query.isApartment = true;
    } else if (isApartment === 'false' || isApartment === false) {
      query.isApartment = { $ne: true }; // Regular rooms (not apartments)
    }
    
    // Filter by parent apartment if specified
    if (parentApartment) {
      query.parentApartment = parentApartment;
    }
    
    const rooms = await Room.find(query)
      .populate("floor", "floorNumber")
      .populate({
        path: "floor",
        populate: { path: "building", select: "name" }
      })
      .populate("parentApartment", "roomNumber");
    res.json(rooms);
  } catch (err) { 
    console.error("Get rooms error:", err);
    res.status(500).json({ message: "Error fetching rooms" }); 
  }
};

exports.addRoom = async (req, res) => {
  try {
    const { roomNumber, type, capacity, floorId, payment, buildingId } = req.body;

    // 1. Hubi in xogta muhiimka ah ay timid
    if (!roomNumber || !floorId) {
      return res.status(400).json({ message: "roomNumber and floorId are required" });
    }

    // 2. Get building first (use buildingId from request if provided)
    const building = await getBuildingForUser(req.user, buildingId);
    if (!building) {
      return res.status(400).json({ message: "Building not found. Make sure you have a building assigned." });
    }

    // 3. Hubi in Floor-ku uu jiro and belongs to the selected building
    const floorExists = await Floor.findOne({ _id: floorId, building: building._id });
    if (!floorExists) {
      return res.status(400).json({ message: "Floor not found or does not belong to selected building. Please select a floor from the current building." });
    }

    // 4. Check allowed room types (skip validation for rooms inside apartments)
    const parentApartmentId = req.body.parentApartment || null;
    if (!parentApartmentId && building.allowedRoomTypes && building.allowedRoomTypes.length > 0) {
      if (!building.allowedRoomTypes.includes(type)) {
        return res.status(400).json({ 
          message: `Room type "${type}" is not allowed. Allowed types: ${building.allowedRoomTypes.join(", ")}` 
        });
      }
    }

    // 5. Handle apartment structure
    // Use explicit isApartment from request, or check if type contains "apartment"
    const isApartment = req.body.isApartment === true || (type && type.toLowerCase().includes("apartment"));
    const paymentTracking = req.body.paymentTracking || "ROOM_LEVEL";

    // 6. Abuur qolka with payment and apartment logic
    const room = new Room({
      roomNumber,
      type,
      capacity,
      floor: floorId,
      building: building._id, // Use verified building
      status: "AVAILABLE",
      payment: payment || { amount: 0, frequency: "MONTHLY", currency: "USD" },
      isApartment: isApartment,
      parentApartment: parentApartmentId,
      paymentTracking: paymentTracking
    });

    await room.save();
    await room.populate("floor", "floorNumber building");
    res.status(201).json(room);

  } catch (err) {
    console.error("ADD ROOM ERROR:", err);
    res.status(500).json({
      message: "Internal Server Error",
      error: err.message
    });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const isPending = await handleAction(req, res, "ROOM", "UPDATE", req.params.roomId, req.body);
    if (isPending) return;
    const room = await Room.findByIdAndUpdate(req.params.roomId, req.body, { new: true });
    res.json(room);
  } catch (err) { res.status(500).json({ message: "Error updating room" }); }
};

exports.deleteRoom = async (req, res) => {
  try {
    const isPending = await handleAction(req, res, "ROOM", "DELETE", req.params.roomId);
    if (isPending) return;
    await Room.findByIdAndDelete(req.params.roomId);
    res.json({ message: "Room deleted" });
  } catch (err) { res.status(500).json({ message: "Error deleting room" }); }
};

// --- PERSON CONTROLLERS ---
exports.getPeople = async (req, res) => {
  try {
    const buildingId = req.query.buildingId; // Optional building ID filter
    const building = await getBuildingForUser(req.user, buildingId);
    if (!building) return res.status(404).json({ message: "Building missing" });

    const people = await Person.find({ building: building._id })
      .populate({
        path: "room",
        select: "roomNumber",
        populate: {
          path: "floor",
          select: "floorNumber"
        }
      })
      .sort({ createdAt: -1 });

    res.json(people);
  } catch (err) {
    res.status(500).json({ message: "Error fetching people" });
  }
};



exports.assignPerson = async (req, res) => {
  // Hubi in 'room' uu yahay magaca aad ka soo dirayso Frontend-ka
  const { name, phone, type, room, roomId, buildingId } = req.body; 
  const roomToAssign = room || roomId; // Support both 'room' and 'roomId'

  try {
    // Use buildingId from request body if provided, otherwise get from user
    const selectedBuildingId = buildingId || req.query.buildingId;
    const building = await getBuildingForUser(req.user, selectedBuildingId);
    if (!building) return res.status(404).json({ message: "Building not found" });

    const person = new Person({
      name,
      phone,
      type,
      room: roomToAssign, // Halkan waa inuu ahaadaa ObjectId-ga qolka
      building: building._id // Always use the verified building from getBuildingForUser
    });

    await person.save();

    // Marka qofka la deajiyo, qolka xaaladiisa beddel to OCCUPIED
    if (roomToAssign) {
      await Room.findByIdAndUpdate(roomToAssign, { status: "OCCUPIED" });
      
      // Auto-create payment record if person is a TENANT and room has payment info
      if (type === "TENANT") {
        const roomData = await Room.findById(roomToAssign);
        if (roomData && roomData.payment && roomData.payment.amount > 0) {
          const RoomPayment = require("../models/RoomPayment");
          
          // Calculate period and due date based on current date
          const frequency = roomData.payment.frequency || "MONTHLY";
          const now = new Date();
          let period = "";
          let dueDate = new Date(now);
          
          // Set due date to end of current period + 1 period
          if (frequency === "MONTHLY") {
            // Due date is next month (same day, or last day of month if day doesn't exist)
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            period = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
            
            // Set due date to same day next month
            dueDate = new Date(currentYear, currentMonth + 1, now.getDate());
            // If day doesn't exist in next month (e.g., Jan 31 -> Feb 31), use last day of month
            if (dueDate.getMonth() !== (currentMonth + 1) % 12) {
              dueDate = new Date(currentYear, currentMonth + 2, 0); // Last day of next month
            }
          } else if (frequency === "QUARTERLY") {
            // Due date is end of current quarter + 1 quarter
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            const quarter = Math.ceil((currentMonth + 1) / 3);
            period = `${currentYear}-Q${quarter}`;
            
            // Set due date to end of next quarter
            const nextQuarterMonth = (quarter * 3) % 12; // Month at end of next quarter
            const nextQuarterYear = quarter === 4 ? currentYear + 1 : currentYear;
            dueDate = new Date(nextQuarterYear, nextQuarterMonth, 0); // Last day of quarter
          } else if (frequency === "YEARLY") {
            // Due date is same date next year
            period = `${now.getFullYear()}`;
            dueDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
          } else {
            // ONE_TIME - due date is 30 days from now
            period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            dueDate.setDate(dueDate.getDate() + 30);
          }
          
          // Check if payment already exists
          const existingPayment = await RoomPayment.findOne({
            room: roomToAssign,
            person: person._id,
            period: period
          });
          
          if (!existingPayment) {
            const payment = new RoomPayment({
              room: roomToAssign,
              person: person._id,
              building: building._id,
              amount: roomData.payment.amount,
              currency: roomData.payment.currency || "USD",
              dueDate: dueDate,
              period: period,
              frequency: frequency,
              status: "PENDING",
              recordedBy: req.user.id
            });
            await payment.save();
          }
        }
      }
    }

    res.status(201).json(person);
  } catch (err) {
    console.error("Assign person error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.updatePerson = async (req, res) => {
  try {
    const isPending = await handleAction(req, res, "PERSON", "UPDATE", req.params.personId, req.body);
    if (isPending) return;
    
    const person = await Person.findById(req.params.personId);
    if (!person) return res.status(404).json({ message: "Person not found" });
    
    const oldRoomId = person.room;
    const newRoomId = req.body.room || req.body.roomId;
    
    // Update person
    const updatedPerson = await Person.findByIdAndUpdate(req.params.personId, req.body, { new: true });
    
    // Handle room status changes
    if (oldRoomId && oldRoomId.toString() !== newRoomId?.toString()) {
      // Free up old room
      await Room.findByIdAndUpdate(oldRoomId, { status: "AVAILABLE" });
    }
    
    if (newRoomId && newRoomId.toString() !== oldRoomId?.toString()) {
      // Occupy new room
      await Room.findByIdAndUpdate(newRoomId, { status: "OCCUPIED" });
    }
    
    res.json(updatedPerson);
  } catch (err) { 
    console.error("Update person error:", err);
    res.status(500).json({ message: "Error updating person" }); 
  }
};

exports.deletePerson = async (req, res) => {
  try {
    const isPending = await handleAction(req, res, "PERSON", "DELETE", req.params.personId);
    if (isPending) return;
    const person = await Person.findById(req.params.personId);
    if (person && person.room) await Room.findByIdAndUpdate(person.room, { status: "AVAILABLE" });
    await Person.findByIdAndDelete(req.params.personId);
    res.json({ message: "Person record deleted" });
  } catch (err) { res.status(500).json({ message: "Error" }); }
};

// --- APPROVALS (MANAGER ONLY) ---
exports.getPendingRequests = async (req, res) => {
  try {
    const building = await getBuildingForUser(req.user);
    const requests = await ActionRequest.find({
      building: building._id,
      status: "PENDING"
    }).populate("requestedBy", "name email");
    res.json(requests);
  } catch (err) { res.status(500).json({ message: "Error fetching requests" }); }
};

exports.reviewRequest = async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;
  try {
    const request = await ActionRequest.findById(id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (status === "APPROVED") {
      const { targetType, targetId, actionType, payload } = request;
      let Model;
      if (targetType === "FLOOR") Model = Floor;
      else if (targetType === "ROOM") Model = Room;
      else if (targetType === "PERSON") Model = Person;

      if (actionType === "UPDATE") await Model.findByIdAndUpdate(targetId, payload);
      else if (actionType === "DELETE") await Model.findByIdAndDelete(targetId);
    }
    request.status = status;
    request.reason = reason;
    await request.save();
    res.json({ message: `Request ${status}` });
  } catch (err) { res.status(500).json({ message: "Error processing request" }); }
};