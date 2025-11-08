import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

// 🔑 Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// 🧱 Signup
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    console.log("🟢 REGISTER request received for:", email);
    console.log("➡️ Plain password:", password);

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      console.log("⚠️ User already exists");
      return res.status(400).json({ message: "User already exists" });
    }

    // ❌ Don't hash manually — model hook does it
    const user = await User.create({
      name,
      email,
      password, // plain text — hook will hash it
    });

    console.log("✅ User saved:", user);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("💥 Register error:", error);
    res.status(500).json({ message: error.message });
  }
};


// 🔑 Login
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("🟢 LOGIN attempt for:", email);
    console.log("➡️ Entered password:", password);

    const user = await User.findOne({ email });
    if (!user) {
      console.log("🔴 No user found with that email");
      return res.status(401).json({ message: "Invalid email or password" });
    }

    console.log("🧩 Stored hashed password in DB:", user.password);

    // use bcrypt directly or model method (either works)
    const isMatch = await bcrypt.compare(password, user.password);
    // const isMatch = await user.matchPassword(password);

    console.log("🟣 Compare result:", isMatch);

    if (!isMatch) {
      console.log("🔴 Passwords do not match!");
      return res.status(401).json({ message: "Invalid email or password" });
    }

    console.log("✅ Password matched successfully!");
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("💥 Login error:", error);
    res.status(500).json({ message: error.message });
  }
};




export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({
      email,
      resetToken: otp,
      resetTokenExpire: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired OTP" });

    // OTP verified, send back a temporary token (to authorize password reset)
    const tempToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "15m" });

    res.json({ message: "OTP verified", token: tempToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔁 Forgot Password via OTP (6-digit)
export const forgotPasswordOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetToken = otp;
    user.resetTokenExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Dev mode: just log OTP
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log(`OTP for ${email}: ${otp}`);
      return res.json({ message: "OTP generated (dev)" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    await transporter.sendMail({
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is ${otp}. It will expire in 10 minutes.`,
    });

    res.json({ message: "OTP sent to email" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};



// 🔒 Reset Password (by token or OTP)
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      console.log("❌ Invalid or expired token");
      return res.status(400).json({ message: "Invalid token" });
    }

    console.log("🔑 New password received:", newPassword);

    // ✅ Just assign plain password — model hook will hash it automatically
    user.password = newPassword;

    // 🧹 Clear OTP fields
    user.resetToken = undefined;
    user.resetTokenExpire = undefined;

    await user.save();
    console.log("✅ Password successfully reset for:", user.email);

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("💥 Reset Password Error:", err);
    res.status(500).json({ message: err.message });
  }
};
