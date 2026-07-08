const mongoose = require("mongoose");

const newsSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  category: { 
    type: String, 
    enum: ["MAINTENANCE", "URGENT", "GENERAL", "EVENT"], 
    default: "GENERAL" 
  },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  targetRole: { type: String, enum: ["MANAGER", "ALL"], default: "ALL" }
}, { timestamps: true });

module.exports = mongoose.model("News", newsSchema);