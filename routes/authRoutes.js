import express from "express";
import {
  registerUser,
  loginUser,
  resetPassword,
  forgotPasswordOTP,
  verifyOtp
} from "../controllers/authController.js";  // import the missing functions

const router = express.Router();

router.post("/signup", registerUser);
router.post("/login", loginUser);

// Add OTP routes
router.post("/forgot-password-otp", forgotPasswordOTP);
router.post("/verify-otp", verifyOtp);

router.post("/reset-password", resetPassword);

export default router;
