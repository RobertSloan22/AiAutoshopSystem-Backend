import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
	{
		fullName: {
			type: String,
			required: false,
			default: "",
		},
		username: {
			type: String,
			required: function() {
				return !this.googleId;
			},
			unique: true,
			sparse: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
		},
		password: {
			type: String,
			required: function() {
				return !this.googleId;
			},
			minlength: 6,
		},
		googleId: {
			type: String,
			unique: true,
			sparse: true,
		},
		authProvider: {
			type: String,
			enum: ["email", "google"],
			default: "email",
		},
		emailVerified: {
			type: Boolean,
			default: false,
		},
		gender: {
			type: String,
			required: false,
			enum: ["male", "female"],
			default: "male",
		},
		profilePic: {
			type: String,
			default: "",
		},
		lastLoginAt: {
			type: Date,
		},
		// createdAt, updatedAt => Member since <createdAt>
	},
	{ timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
