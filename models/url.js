const mongoose = require("mongoose");

const urlSchema = new mongoose.Schema(
  {
    shortId: { type: String, required: true, unique: true, trim: true },
    redirectURL: { type: String, required: true, trim: true },
    customAlias: { type: String, unique: true, sparse: true },
    topic: {
      type: String,
      enum: ["acquisition", "activation", "retention", "promotion", "referral"],
      default: "promotion",
    },
    visitHistory: [
      {
        timeStamp: { type: Number, required: true },
        userAgent: { type: String, required: false, trim: true },
        ip: { type: String, required: true, trim: true },
        geolocation: {
          country: { type: String, trim: true }, 
          region: { type: String, trim: true }, 
          city: { type: String, trim: true }, 
          lat: { type: Number, required: false }, 
          lon: { type: Number, required: false },
        },
      },
    ],
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // Make it required if necessary
    },
  },
  { timestamps: true }
);

const URL = mongoose.model("URL", urlSchema);

module.exports = URL;
