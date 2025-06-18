import express from "express";
import passport from "../config/passport.js";
import env from "dotenv";

env.config();

const router = express.Router();

// Google Auth Route✅
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get("/google/callback",
    passport.authenticate("google", {
        successRedirect: "http://localhost:3000",
        failureRedirect: "http://localhost:3000/login"
    }),
);

// Github Auth Route
router.get('/github', passport.authenticate("github", { scope: ["user:email"] }));
router.get('/github/callback', passport.authenticate('github', {
    successRedirect: "http://localhost:3000",
    failureRedirect: "http://localhost:3000/login"
}));

router.get("/user", (req, res) => {
    // console.log(req.user);

    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
    }
    // console.log(req.user.id, '===user ID,');
    
    return res.json(req.user); // User data comes from Firestore via deserializeUser ✅
});


router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) return res.status(500).json({ type: false, message: "Error logging out" });
        res.clearCookie("connect.sid", { path: "/" }); // Clear session cookie
        res.status(200).json({ type: true, message: "Logged out successfully" });
    });
});

export default router