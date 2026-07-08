const User = require("../models/User");
const News = require("../models/News"); // Import News model
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Login
// controllers/auth.controller.js

// controllers/auth.controller.js

exports.login = async (req, res) => {
  // 1. CLEAN THE DATA (The most important part)
  const email = req.body.email?.toLowerCase().trim();
  const { password } = req.body;

  try {
    // 2. SEARCH (This will now match the lowercase email in your DB)
    const user = await User.findOne({ email });

    if (!user) {
      // If this triggers, your frontend is sending the wrong email string
      return res.status(400).json({ message: "Account not found" });
    }

    // 3. PASSWORD VERIFICATION
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 4. GENERATE TOKEN
    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // 5. SUCCESS RESPONSE
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        email: user.email,
        buildingLogo: user.buildingLogo || "" // Include manager image
      }
    });

  } catch (err) {
    console.error("Login Crash:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};