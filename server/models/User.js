const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    // System-level role (for authentication and authorization)
    systemRole: {
      type: String,
      enum: ["admin", "faculty", "clubLeader", "student"],
      default: "student",
    },
    // Club-specific role (for display within the club)
    clubRole: {
      type: String,
      enum: [
        "faculty",
        "president",
        "vice-president",
        "associate-president",
        "public-relations",
        "human-resources",
        "secretary",
        "treasurer",
        "documentation-head",
        "photography",
        "content-creation",
        "digital-head",
        "coordinator-incharge",
        "member",
      ],
      default: "member",
    },
    // Keep the old role field for backward compatibility
    role: {
      type: String,
      enum: ["admin", "faculty", "clubLeader", "student"],
      default: "student",
    },
    department: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
    },
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
    },
    // New fields for rewards system
    points: {
      type: Number,
      default: 0,
      min: 0
    },
    rewards: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reward",
    }],
    // Updated clubs field to include join date and role
    clubs: [{
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Club",
      },
      role: {
        type: String,
        enum: ["member", "leader"],
        default: "member",
      },
      joinDate: {
        type: Date,
        default: Date.now,
      }
    }],
    // Events attended by the user
    eventsAttended: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    }],
    // User ratings
    ratings: [{
      value: {
        type: Number,
        min: 1,
        max: 5,
      },
      reviewer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      date: {
        type: Date,
        default: Date.now,
      }
    }],
    joinDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "pending"],
      default: "active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
)

// Encrypt password using bcrypt
userSchema.pre("save", async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) return next()
  
  // Check if password is already hashed (bcrypt hashes start with $2a$ or $2b$)
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    return next()
  } catch (err) {
    return next(err)
  }
})

// Ensure club members have at least 10 points
userSchema.pre("save", async function (next) {
  // Check if user is a club member (has at least one club)
  if (this.clubs && this.clubs.length > 0 && this.points < 10) {
    this.points = 10;
    console.log(`User ${this.username} is a club member, setting points to 10`);
  }
  next();
})

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password)
}

// Method to set password without double hashing
userSchema.methods.setPassword = async function (plainTextPassword) {
  // Only hash if it's not already hashed
  if (!plainTextPassword.startsWith('$2a$') && !plainTextPassword.startsWith('$2b$')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(plainTextPassword, salt);
  } else {
    this.password = plainTextPassword;
  }
  return this.save();
}

// Method to add a club membership
userSchema.methods.addClub = function(clubId, role = 'member') {
  // Check if user is already a member of this club
  const existingMembership = this.clubs.find(c => c._id.toString() === clubId.toString());
  
  if (!existingMembership) {
    this.clubs.push({
      _id: clubId,
      role: role,
      joinDate: new Date()
    });
    
    // Ensure club members have at least 10 points
    if (this.points < 10) {
      this.points = 10;
    }
  }
  
  return this.save();
};

// Method to add an event attendance
userSchema.methods.addEventAttendance = function(eventId) {
  // Check if user has already attended this event
  const alreadyAttended = this.eventsAttended.some(e => e.toString() === eventId.toString());
  
  if (!alreadyAttended) {
    this.eventsAttended.push(eventId);
    // Add points for attending an event
    this.points += 10;
  }
  
  return this.save();
};

// Method to add a reward
userSchema.methods.addReward = function(rewardId, points = 0) {
  // Check if user already has this reward
  const alreadyHasReward = this.rewards.some(r => r.toString() === rewardId.toString());
  
  if (!alreadyHasReward) {
    this.rewards.push(rewardId);
    // Add points for the reward
    this.points += points;
  }
  
  return this.save();
};

// Method to add a rating
userSchema.methods.addRating = function(value, reviewerId) {
  // Check if the reviewer has already rated this user
  const existingRating = this.ratings.find(r => r.reviewer.toString() === reviewerId.toString());
  
  if (existingRating) {
    // Update existing rating
    existingRating.value = value;
    existingRating.date = new Date();
  } else {
    // Add new rating
    this.ratings.push({
      value: value,
      reviewer: reviewerId,
      date: new Date()
    });
  }
  
  return this.save();
};

// Method to calculate average rating
userSchema.methods.getAverageRating = function() {
  if (this.ratings.length === 0) return 0;
  
  const sum = this.ratings.reduce((total, rating) => total + rating.value, 0);
  return sum / this.ratings.length;
};

module.exports = mongoose.model("User", userSchema)