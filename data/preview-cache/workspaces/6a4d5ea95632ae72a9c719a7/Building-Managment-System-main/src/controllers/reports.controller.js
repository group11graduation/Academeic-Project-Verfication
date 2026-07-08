const Building = require("../models/Building");
const Floor = require("../models/Floor");
const Room = require("../models/Room");
const Person = require("../models/Person");
const Payment = require("../models/Payment");

// Get all buildings assigned to manager
exports.getManagerBuildings = async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    let buildings = [];
    if (userRole === "MANAGER") {
      // Manager: get all buildings where manager field points to this user
      buildings = await Building.find({ manager: userId }).select("_id name location brandingName brandingLogo");
    } else if (userRole === "SUB_MANAGER") {
      // Sub-manager: user has building field pointing to the building
      const User = require("../models/User");
      const user = await User.findById(userId).populate("building");
      if (user && user.building) {
        buildings = [user.building];
      }
    } else {
      return res.status(403).json({ message: "Unauthorized role" });
    }

    res.json(buildings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Manager Dashboard Report (works for both MANAGER and SUB_MANAGER)
// Now supports buildingId query parameter to filter by specific building
exports.getManagerReport = async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const buildingId = req.query.buildingId; // Optional building ID filter

  try {
    // Find building - different logic for MANAGER vs SUB_MANAGER
    let building;
    if (userRole === "MANAGER") {
      // Manager: building has manager field pointing to this user
      if (buildingId) {
        // If buildingId provided, verify it belongs to this manager
        building = await Building.findOne({ _id: buildingId, manager: userId });
      } else {
        // Otherwise get first building (backward compatibility)
      building = await Building.findOne({ manager: userId });
      }
    } else if (userRole === "SUB_MANAGER") {
      // Sub-manager: user has building field pointing to the building
      const User = require("../models/User");
      const user = await User.findById(userId).populate("building");
      if (!user || !user.building) {
        return res.status(400).json({ message: "Building not assigned to sub-manager" });
      }
      building = user.building;
    } else {
      return res.status(403).json({ message: "Unauthorized role" });
    }

    if (!building) return res.status(400).json({ message: "Building not found" });

    //  Get all floors in the building
    const floors = await Floor.find({ building: building._id });
    const floorIds = floors.map(f => f._id);

    //  Get all rooms in these floors
    const rooms = await Room.find({ floor: { $in: floorIds } });
    const totalRooms = rooms.length;

    //  Count occupied rooms
    const occupiedRooms = await Person.countDocuments({
      room: { $in: rooms.map(r => r._id) }
    });

    //  Count total people stored for this building
    const totalPeople = await Person.countDocuments({ building: building._id });

    //  Optionally, separate by type if needed
    const tenants = await Person.countDocuments({ building: building._id, type: "TENANT" });
    const staff = await Person.countDocuments({ building: building._id, type: "STAFF" });

    //  Return report with building details
    res.json({
      building: building.name,
      buildingId: building._id,
      brandingName: building.brandingName || building.name,
      brandingLogo: building.brandingLogo || "",
      totalFloors: floors.length,
      totalRooms,
      occupiedRooms,
      totalPeople,
      tenants,
      staff,
      floorLimit: building.floorLimit || 0,
      allowedRoomTypes: building.allowedRoomTypes || [] // Include allowed room types
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Manager Payment Tracking - Get payments for manager's building
// Now supports buildingId query parameter to filter by specific building
exports.getManagerPayments = async (req, res) => {
  const managerId = req.user.id;
  const buildingId = req.query.buildingId; // Optional building ID filter
  try {
    let building;
    if (buildingId) {
      // If buildingId provided, verify it belongs to this manager
      building = await Building.findOne({ _id: buildingId, manager: managerId });
    } else {
      // Otherwise get first building (backward compatibility)
      building = await Building.findOne({ manager: managerId });
    }
    if (!building) return res.status(400).json({ message: "Building not found" });

    const payments = await Payment.find({ building: building._id })
      .populate("manager", "name email")
      .sort({ nextDueDate: 1 });
    
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Manager Room Payments - Get room payments with apartment logic
// For apartments: if APARTMENT_LEVEL tracking, show apartment payment only
// If ROOM_LEVEL tracking, show individual room payments
// Works for both MANAGER and SUB_MANAGER
// Now supports buildingId query parameter to filter by specific building
exports.getManagerRoomPayments = async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const buildingId = req.query.buildingId; // Optional building ID filter
  try {
    // Find building - different logic for MANAGER vs SUB_MANAGER
    let building;
    if (userRole === "MANAGER") {
      if (buildingId) {
        // If buildingId provided, verify it belongs to this manager
        building = await Building.findOne({ _id: buildingId, manager: userId });
      } else {
        // Otherwise get first building (backward compatibility)
      building = await Building.findOne({ manager: userId });
      }
    } else if (userRole === "SUB_MANAGER") {
      const User = require("../models/User");
      const user = await User.findById(userId).populate("building");
      if (!user || !user.building) {
        return res.status(400).json({ message: "Building not assigned to sub-manager" });
      }
      building = user.building;
    } else {
      return res.status(403).json({ message: "Unauthorized role" });
    }
    
    if (!building) return res.status(400).json({ message: "Building not found" });

    const floors = await Floor.find({ building: building._id });
    const floorIds = floors.map(f => f._id);
    
    // Get all rooms
    const allRooms = await Room.find({ floor: { $in: floorIds } })
      .populate("floor", "floorNumber")
      .populate("parentApartment", "roomNumber type")
      .sort({ roomNumber: 1 });

    const roomPayments = [];
    const processedApartmentIds = new Set();

    // Process each room
    for (const room of allRooms) {
      const roomData = room.toObject();
      
      // If this is a child room of an apartment
      if (room.parentApartment) {
        const parentId = room.parentApartment._id.toString();
        const parentApartment = allRooms.find(r => r._id.toString() === parentId);
        
        if (parentApartment) {
          // Check payment tracking method
          if (parentApartment.paymentTracking === "APARTMENT_LEVEL") {
            // APARTMENT_LEVEL: Only show apartment payment, not individual rooms
            if (!processedApartmentIds.has(parentId)) {
              // Add apartment as a single payment entry
              const apartmentPayment = {
                ...parentApartment.toObject(),
                paymentSource: "APARTMENT",
                isApartment: true,
                childRooms: allRooms.filter(r => 
                  r.parentApartment && r.parentApartment._id.toString() === parentId
                ).length,
                displayName: `Apartment ${parentApartment.roomNumber}`,
                payment: parentApartment.payment || { amount: 0, frequency: "MONTHLY", currency: "USD" }
              };
              roomPayments.push(apartmentPayment);
              processedApartmentIds.add(parentId);
            }
            // Skip individual room - payment is tracked at apartment level
            continue;
          } else {
            // ROOM_LEVEL: Show individual room payment
            roomData.paymentSource = "ROOM";
            roomData.displayName = `Room ${room.roomNumber} (in ${parentApartment.roomNumber})`;
            roomData.payment = room.payment || { amount: 0, frequency: "MONTHLY", currency: "USD" };
            roomPayments.push(roomData);
          }
        }
      } else if (room.isApartment || (room.type && room.type.toLowerCase().includes("apartment"))) {
        // This is an apartment (parent) - always show it
        // Check both isApartment flag AND type containing "apartment"
        const childRooms = allRooms.filter(r => 
          r.parentApartment && r.parentApartment._id.toString() === room._id.toString()
        );
        
        // Calculate total payment including child rooms
        const childRoomsTotal = childRooms.reduce((sum, cr) => sum + (cr.payment?.amount || 0), 0);
        const apartmentPayment = room.payment?.amount || 0;
        const totalPayment = apartmentPayment + childRoomsTotal;
        
        roomData.paymentSource = "APARTMENT";
        roomData.isApartment = true; // Ensure this is set
        roomData.childRooms = childRooms.length;
        roomData.childRoomsList = childRooms.map((cr) => ({
          roomNumber: cr.roomNumber,
          type: cr.type,
          status: cr.status,
          payment: cr.payment
        }));
        roomData.childRoomsTotal = childRoomsTotal;
        roomData.displayName = `Apartment ${room.roomNumber}`;
        roomData.payment = {
          ...(room.payment || { frequency: "MONTHLY", currency: "USD" }),
          amount: totalPayment, // Total including child rooms
          originalAmount: apartmentPayment // Original apartment-only amount
        };
        roomData.capacity = room.capacity || childRooms.length; // Show capacity or actual room count
        roomPayments.push(roomData);
        processedApartmentIds.add(room._id.toString());
      } else {
        // Regular standalone room
        roomData.paymentSource = "ROOM";
        roomData.displayName = `Room ${room.roomNumber}`;
        roomData.payment = room.payment || { amount: 0, frequency: "MONTHLY", currency: "USD" };
        roomPayments.push(roomData);
      }
    }

    res.json(roomPayments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Manager Payment Stats (works for both MANAGER and SUB_MANAGER)
// Manager Payment Stats - Get payment statistics for manager's building
// Now supports buildingId query parameter to filter by specific building
exports.getManagerPaymentStats = async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const buildingId = req.query.buildingId; // Optional building ID filter
  try {
    // Find building - different logic for MANAGER vs SUB_MANAGER
    let building;
    if (userRole === "MANAGER") {
      if (buildingId) {
        // If buildingId provided, verify it belongs to this manager
        building = await Building.findOne({ _id: buildingId, manager: userId });
      } else {
        // Otherwise get first building (backward compatibility)
      building = await Building.findOne({ manager: userId });
      }
    } else if (userRole === "SUB_MANAGER") {
      const User = require("../models/User");
      const user = await User.findById(userId).populate("building");
      if (!user || !user.building) {
        return res.status(400).json({ message: "Building not assigned to sub-manager" });
      }
      building = user.building;
    } else {
      return res.status(403).json({ message: "Unauthorized role" });
    }
    
    if (!building) return res.status(400).json({ message: "Building not found" });

    // Building payments are admin payments - don't include in manager stats
    // const payments = await Payment.find({ building: building._id });
    // const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    // const paidCount = payments.filter(p => p.status === "PAID").length;
    // const pendingCount = payments.filter(p => p.status === "PENDING").length;
    // const overdueCount = payments.filter(p => p.status === "OVERDUE").length;
    
    // Manager only tracks room payments, not building payments (admin handles those)
    const totalAmount = 0; // Building payments are admin's responsibility
    const paidCount = 0;
    const pendingCount = 0;
    const overdueCount = 0;

    // Get room payment stats
    const floors = await Floor.find({ building: building._id }).sort({ floorNumber: 1 });
    const floorIds = floors.map(f => f._id);
    const rooms = await Room.find({ floor: { $in: floorIds } })
      .populate("floor", "floorNumber");
    
    // Calculate revenue by floor (handling apartments correctly)
    const revenueByFloor = floors.map(floor => {
      const floorRooms = rooms.filter(r => r.floor && r.floor._id.toString() === floor._id.toString());
      
      let floorRevenue = 0;
      const processedApartmentIds = new Set();
      
      // First pass: Handle parent apartments and regular rooms
      for (const room of floorRooms) {
        // Check if this is a parent apartment (not a child room)
        if (!room.parentApartment) {
          const isApartmentType = room.isApartment || (room.type && room.type.toLowerCase().includes("apartment"));
          
          if (isApartmentType) {
            // This is a parent apartment - count its payment
            const apartmentId = room._id.toString();
            if (!processedApartmentIds.has(apartmentId)) {
              if (room.payment && room.payment.amount) {
                floorRevenue += room.payment.amount;
              }
              processedApartmentIds.add(apartmentId);
            }
          } else {
            // Regular standalone room - count its payment
            if (room.payment && room.payment.amount) {
              floorRevenue += room.payment.amount;
            }
          }
        }
      }
      
      // Second pass: Handle child rooms (only if ROOM_LEVEL tracking)
      for (const room of floorRooms) {
        if (room.parentApartment) {
          const parentId = room.parentApartment.toString();
          const parentApartment = rooms.find(r => r._id.toString() === parentId);
          
          if (parentApartment) {
            // Check payment tracking method
            const paymentTracking = parentApartment.paymentTracking || "ROOM_LEVEL";
            
            if (paymentTracking === "ROOM_LEVEL") {
              // ROOM_LEVEL: Count individual child room payment
              if (room.payment && room.payment.amount) {
                floorRevenue += room.payment.amount;
              }
            }
            // If APARTMENT_LEVEL, payment was already counted in first pass
          }
        }
      }
      
      return {
        floorNumber: floor.floorNumber,
        revenue: floorRevenue,
        roomCount: floorRooms.length
      };
    });

    // Count apartments
    const apartments = rooms.filter(r => r.isApartment || (r.type && r.type.toLowerCase().includes("apartment")));
    const apartmentCount = apartments.length;

    // Count occupied persons
    const occupiedPersons = await Person.countDocuments({ 
      building: building._id,
      room: { $exists: true, $ne: null }
    });

    // Calculate total room revenue by summing floor revenues
    // This ensures total matches the sum of all floor revenues
    const totalRoomRevenue = revenueByFloor.reduce((sum, floor) => sum + (floor.revenue || 0), 0);

    res.json({
      totalPayments: 0, // Building payments are admin's responsibility
      totalAmount: 0, // Building payments excluded from manager view
      paidCount: 0,
      pendingCount: 0,
      overdueCount: 0,
      totalRoomRevenue, // Only room revenue for managers
      totalRooms: rooms.length,
      revenueByFloor,
      apartmentCount,
      occupiedPersons
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
