const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    registrationNo: {
      type: String,
      required: true,
      unique: true, // enforced by a unique index in MongoDB
      trim: true,
      uppercase: true,
      maxlength: 50,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    batch: { type: String, required: true, trim: true, maxlength: 50 }, // batch or session
    department: { type: String, required: true, trim: true, maxlength: 100 }, // department or course
  },
  { timestamps: true } // createdAt / updatedAt
);

// Supports listing newest first and searching by name.
studentSchema.index({ createdAt: -1 });
studentSchema.index({ name: 1 });

module.exports = mongoose.model('Student', studentSchema);
