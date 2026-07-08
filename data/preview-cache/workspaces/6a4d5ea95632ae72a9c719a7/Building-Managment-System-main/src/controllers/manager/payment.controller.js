const RoomPayment = require("../../models/RoomPayment");
const Room = require("../../models/Room");
const Person = require("../../models/Person");
const Building = require("../../models/Building");
const User = require("../../models/User");
const Floor = require("../../models/Floor");

// Helper to get building for user (with optional buildingId for managers with multiple buildings)
const getBuildingForUser = async (user, buildingId = null) => {
  try {
    if (!user) return null;
    
    if (user.role === "SUB_MANAGER") {
      const fullUser = await User.findById(user.id || user._id).select("building");
      if (!fullUser || !fullUser.building) return null;
      return await Building.findById(fullUser.building);
    }
    
    if (user.role === "MANAGER") {
      // If buildingId is provided, verify it belongs to this manager
      if (buildingId) {
        const building = await Building.findOne({ _id: buildingId, manager: user.id || user._id });
        if (building) return building;
      }
      // Fall back to first building
      return await Building.findOne({ manager: user.id || user._id });
    }
    
    return null;
  } catch (err) {
    console.error("Helper Error:", err);
    return null;
  }
};

// Calculate next period based on frequency (for creating next payment)
const calculateNextPeriod = (frequency, currentDate = new Date()) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  
  if (frequency === "MONTHLY") {
    // Calculate next month
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear = year + 1;
    }
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
  } else if (frequency === "QUARTERLY") {
    // Calculate next quarter
    const currentQuarter = Math.ceil(month / 3);
    let nextQuarter = currentQuarter + 1;
    let nextYear = year;
    if (nextQuarter > 4) {
      nextQuarter = 1;
      nextYear = year + 1;
    }
    return `${nextYear}-Q${nextQuarter}`;
  } else if (frequency === "YEARLY") {
    // Next year
    return `${year + 1}`;
  }
  // ONE_TIME - use current period
  return `${year}-${String(month).padStart(2, '0')}`;
};

// Calculate next due date based on frequency
const calculateNextDueDate = (frequency, currentDate = new Date()) => {
  const nextDate = new Date(currentDate);
  const currentMonth = nextDate.getMonth();
  const currentYear = nextDate.getFullYear();
  const currentDay = nextDate.getDate();
  
  if (frequency === "MONTHLY") {
    // Set to same day next month
    nextDate.setMonth(currentMonth + 1);
    // Handle edge case where day doesn't exist in next month (e.g., Jan 31 -> Feb)
    if (nextDate.getDate() !== currentDay) {
      nextDate.setDate(0); // Last day of next month
    }
  } else if (frequency === "QUARTERLY") {
    // Set to end of next quarter (3 months from now)
    const nextQuarterMonth = currentMonth + 3;
    if (nextQuarterMonth >= 12) {
      nextDate.setFullYear(currentYear + 1);
      nextDate.setMonth(nextQuarterMonth - 12);
    } else {
      nextDate.setMonth(nextQuarterMonth);
    }
    // Set to last day of that month
    nextDate.setDate(0);
  } else if (frequency === "YEARLY") {
    // Set to same date next year
    nextDate.setFullYear(currentYear + 1);
    // Handle leap year edge case (Feb 29)
    if (nextDate.getDate() !== currentDay) {
      nextDate.setDate(0); // Last day of February
    }
  } else {
    // ONE_TIME - 30 days from now
    nextDate.setDate(nextDate.getDate() + 30);
  }
  
  return nextDate;
};

/**
 * Get all room payments for manager's building
 */
exports.getRoomPayments = async (req, res) => {
  try {
    const { status, personId, roomId, period, buildingId } = req.query;
    
    const building = await getBuildingForUser(req.user, buildingId);
    if (!building) return res.status(404).json({ message: "Building not found" });
    
    let query = { building: building._id };
    
    if (status) query.status = status;
    if (personId) query.person = personId;
    if (roomId) query.room = roomId;
    if (period) query.period = period;

    const payments = await RoomPayment.find(query)
      .populate("room", "roomNumber type floor")
      .populate("person", "name phone type")
      .populate("recordedBy", "name email")
      .populate({
        path: "room",
        populate: { path: "floor", select: "floorNumber" }
      })
      .sort({ dueDate: -1, createdAt: -1 });

    res.json(payments);
  } catch (err) {
    console.error("Get room payments error:", err);
    res.status(500).json({ message: "Error fetching room payments" });
  }
};

/**
 * Create payment record (when tenant is assigned or payment is due)
 */
exports.createRoomPayment = async (req, res) => {
  try {
    const { roomId, personId, amount, frequency, dueDate, period, notes } = req.body;

    if (!roomId || !personId || !amount) {
      return res.status(400).json({ message: "Room, person, and amount are required" });
    }

    const building = await getBuildingForUser(req.user);
    if (!building) return res.status(404).json({ message: "Building not found" });

    // Verify room and person belong to this building
    const room = await Room.findById(roomId).populate("floor");
    const person = await Person.findById(personId);

    if (!room || !person) {
      return res.status(404).json({ message: "Room or person not found" });
    }

    if (room.building?.toString() !== building._id.toString() || 
        person.building?.toString() !== building._id.toString()) {
      return res.status(403).json({ message: "Room or person does not belong to your building" });
    }

    // Calculate period and due date if not provided
    const paymentFrequency = frequency || room.payment?.frequency || "MONTHLY";
    const paymentPeriod = period || calculateNextPeriod(paymentFrequency);
    const paymentDueDate = dueDate ? new Date(dueDate) : calculateNextDueDate(paymentFrequency);
    const paymentAmount = amount || room.payment?.amount || 0;

    // Check if payment already exists for this period
    const existingPayment = await RoomPayment.findOne({
      room: roomId,
      person: personId,
      period: paymentPeriod,
      status: { $in: ["PENDING", "OVERDUE", "PARTIAL"] }
    });

    if (existingPayment) {
      return res.status(400).json({ 
        message: `Payment for period ${paymentPeriod} already exists`,
        payment: existingPayment
      });
    }

    const payment = new RoomPayment({
      room: roomId,
      person: personId,
      building: building._id,
      amount: paymentAmount,
      currency: room.payment?.currency || "USD",
      dueDate: paymentDueDate,
      period: paymentPeriod,
      frequency: paymentFrequency,
      status: "PENDING",
      notes: notes || "",
      recordedBy: req.user.id
    });

    await payment.save();
    await payment.populate("room", "roomNumber type");
    await payment.populate("person", "name phone");
    await payment.populate("recordedBy", "name email");

    res.status(201).json(payment);
  } catch (err) {
    console.error("Create room payment error:", err);
    res.status(500).json({ message: "Error creating payment record", error: err.message });
  }
};

/**
 * Mark payment as paid (supports partial payments)
 */
exports.markPaymentAsPaid = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { paidAmount, paymentMethod, notes, buildingId } = req.body;

    const payment = await RoomPayment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Verify building access - use buildingId from body or query, or fall back to payment's building
    const targetBuildingId = buildingId || req.query.buildingId || payment.building;
    const building = await getBuildingForUser(req.user, targetBuildingId);
    if (!building || payment.building.toString() !== building._id.toString()) {
      return res.status(403).json({ message: "Unauthorized - payment does not belong to your building" });
    }

    // Validate paid amount
    const amountPaid = parseFloat(paidAmount) || 0;
    if (amountPaid <= 0) {
      return res.status(400).json({ message: "Paid amount must be greater than 0" });
    }

    // Calculate total paid (existing + new payment)
    const currentPaid = payment.paidAmount || 0;
    const totalPaid = currentPaid + amountPaid;
    const remainingAmount = payment.amount - totalPaid;

    // Check if overpaid
    if (totalPaid > payment.amount) {
      return res.status(400).json({ 
        message: `Overpayment detected. Amount due: $${payment.amount.toFixed(2)}, Already paid: $${currentPaid.toFixed(2)}, Remaining: $${(payment.amount - currentPaid).toFixed(2)}`,
        remainingAmount: (payment.amount - currentPaid).toFixed(2)
      });
    }

    // Update payment status and amounts
    const wasFullyPaid = payment.status === "PAID";
    const wasPartial = payment.status === "PARTIAL";
    
    if (totalPaid >= payment.amount) {
      // Fully paid
      payment.status = "PAID";
      payment.paidAmount = payment.amount; // Don't allow overpayment
      payment.paidDate = new Date();
    } else {
      // Partial payment
      payment.status = "PARTIAL";
      payment.paidAmount = totalPaid;
      if (!payment.paidDate) payment.paidDate = new Date();
    }

    // Update payment method if provided
    if (paymentMethod) payment.paymentMethod = paymentMethod;
    
    // Add notes with timestamp
    const timestamp = new Date().toLocaleString();
    const paymentNote = `[${timestamp}] Payment: $${amountPaid.toFixed(2)}${notes ? ` - ${notes}` : ''}`;
    payment.notes = (payment.notes || "") + (payment.notes ? "\n" : "") + paymentNote;

    await payment.save();

    // If payment just became fully paid (was not fully paid before), create next payment period
    const justBecameFullyPaid = payment.status === "PAID" && !wasFullyPaid;
    let nextPaymentCreated = false;
    
    if (justBecameFullyPaid && payment.frequency !== "ONE_TIME") {
      // Calculate next period based on the paid date (or due date if paid early)
      const baseDate = payment.paidDate || payment.dueDate || new Date();
      const nextPeriod = calculateNextPeriod(payment.frequency, baseDate);
      const nextDueDate = calculateNextDueDate(payment.frequency, baseDate);

      // Check if next payment already exists (check all statuses to avoid duplicates)
      const nextPaymentExists = await RoomPayment.findOne({
        room: payment.room,
        person: payment.person,
        period: nextPeriod
      });

      if (!nextPaymentExists) {
        // Get room to ensure we have the latest payment amount
        const Room = require("../models/Room");
        const room = await Room.findById(payment.room);
        const nextPaymentAmount = room?.payment?.amount || payment.amount;

        const nextPayment = new RoomPayment({
          room: payment.room,
          person: payment.person,
          building: payment.building,
          amount: nextPaymentAmount,
          currency: payment.currency,
          dueDate: nextDueDate,
          period: nextPeriod,
          frequency: payment.frequency,
          status: "PENDING", // Always create as PENDING status
          recordedBy: req.user.id
        });
        await nextPayment.save();
        nextPaymentCreated = true;
        
        console.log(`✅ Created next payment: Period ${nextPeriod}, Due: ${nextDueDate.toLocaleDateString()}, Status: PENDING`);
      } else {
        console.log(`⚠️ Next payment for period ${nextPeriod} already exists`);
      }
    }

    // Populate and return
    await payment.populate("room", "roomNumber type");
    await payment.populate({
      path: "room",
      populate: { path: "floor", select: "floorNumber" }
    });
    await payment.populate("person", "name phone");
    await payment.populate("recordedBy", "name email");

    res.json({
      ...payment.toObject(),
      remainingAmount: payment.status === "PARTIAL" ? (payment.amount - payment.paidAmount).toFixed(2) : 0,
      nextPaymentCreated: nextPaymentCreated,
      message: payment.status === "PAID" 
        ? (nextPaymentCreated 
          ? "Payment marked as fully paid. Next payment period created and set to PENDING." 
          : "Payment marked as fully paid.")
        : `Partial payment recorded. Remaining: $${(payment.amount - payment.paidAmount).toFixed(2)}`
    });
  } catch (err) {
    console.error("Mark payment as paid error:", err);
    res.status(500).json({ message: "Error updating payment", error: err.message });
  }
};

/**
 * Get payment statistics
 */
exports.getPaymentStats = async (req, res) => {
  try {
    const { buildingId } = req.query;
    const building = await getBuildingForUser(req.user, buildingId);
    if (!building) return res.status(404).json({ message: "Building not found" });

    const now = new Date();
    
    // Get all payments for this building
    const allPayments = await RoomPayment.find({ building: building._id });
    
    const totalAmount = allPayments.reduce((sum, p) => sum + p.amount, 0);
    const paidAmount = allPayments
      .filter(p => p.status === "PAID")
      .reduce((sum, p) => sum + (p.paidAmount || p.amount), 0);
    const pendingAmount = allPayments
      .filter(p => p.status === "PENDING")
      .reduce((sum, p) => sum + p.amount, 0);
    const overdueAmount = allPayments
      .filter(p => p.status === "OVERDUE" || (p.status === "PENDING" && new Date(p.dueDate) < now))
      .reduce((sum, p) => sum + p.amount, 0);

    const stats = {
      totalPayments: allPayments.length,
      totalAmount,
      paidAmount,
      pendingAmount,
      overdueAmount,
      paidCount: allPayments.filter(p => p.status === "PAID").length,
      pendingCount: allPayments.filter(p => p.status === "PENDING" && new Date(p.dueDate) >= now).length,
      overdueCount: allPayments.filter(p => p.status === "OVERDUE" || (p.status === "PENDING" && new Date(p.dueDate) < now)).length,
      partialCount: allPayments.filter(p => p.status === "PARTIAL").length
    };

    res.json(stats);
  } catch (err) {
    console.error("Get payment stats error:", err);
    res.status(500).json({ message: "Error fetching payment statistics" });
  }
};

/**
 * Auto-create payment records for all tenants (can be called periodically)
 */
exports.autoCreatePayments = async (req, res) => {
  try {
    const { buildingId } = req.body;
    const building = await getBuildingForUser(req.user, buildingId);
    if (!building) return res.status(404).json({ message: "Building not found" });

    const floors = await Floor.find({ building: building._id });
    const floorIds = floors.map(f => f._id);
    const rooms = await Room.find({ floor: { $in: floorIds }, status: "OCCUPIED" });
    
    const people = await Person.find({ 
      building: building._id,
      room: { $exists: true, $ne: null },
      type: "TENANT"
    });

    let created = 0;
    let skipped = 0;

    for (const person of people) {
      if (!person.room) continue;
      
      const room = rooms.find(r => r._id.toString() === person.room.toString());
      if (!room || !room.payment?.amount) continue;

      const frequency = room.payment.frequency || "MONTHLY";
      const period = calculateNextPeriod(frequency);
      const dueDate = calculateNextDueDate(frequency);

      // Check if payment already exists
      const exists = await RoomPayment.findOne({
        room: room._id,
        person: person._id,
        period: period
      });

      if (!exists) {
        const payment = new RoomPayment({
          room: room._id,
          person: person._id,
          building: building._id,
          amount: room.payment.amount,
          currency: room.payment.currency || "USD",
          dueDate: dueDate,
          period: period,
          frequency: frequency,
          status: "PENDING",
          recordedBy: req.user.id
        });
        await payment.save();
        created++;
      } else {
        skipped++;
      }
    }

    res.json({ 
      message: `Payment records processed`,
      created,
      skipped,
      total: people.length
    });
  } catch (err) {
    console.error("Auto-create payments error:", err);
    res.status(500).json({ message: "Error creating payment records", error: err.message });
  }
};

// Delete a room payment record
exports.deleteRoomPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { buildingId } = req.query;
    
    const building = await getBuildingForUser(req.user, buildingId);
    if (!building) return res.status(404).json({ message: "Building not found" });

    // Find the payment and verify it belongs to this building
    const payment = await RoomPayment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    // Verify the payment belongs to this manager's building
    if (payment.building.toString() !== building._id.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this payment" });
    }

    // Only allow deleting PENDING payments (not PAID ones)
    if (payment.status === "PAID") {
      return res.status(400).json({ message: "Cannot delete a paid payment record. Only pending payments can be deleted." });
    }

    await RoomPayment.findByIdAndDelete(paymentId);
    
    res.json({ message: "Payment record deleted successfully" });
  } catch (err) {
    console.error("Delete room payment error:", err);
    res.status(500).json({ message: "Error deleting payment record", error: err.message });
  }
};
