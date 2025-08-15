import express from "express";
import passport from "../config/passport.js";
import env from "dotenv";
import cors from "cors";

env.config();

const router = express.Router();

// Google Auth Route✅
router.get("/google", cors(), passport.authenticate("google", { scope: ["profile", "email"] }));

router.get("/google/callback",
    cors(), // Allow all origins for Google login start.
    passport.authenticate("google", {
        successRedirect: process.env.FRONTEND_URL,
        failureRedirect: process.env.FRONTEND_URL + "/login",
    }),
);

// Github Auth Route
router.get('/github', cors(), passport.authenticate("github", { scope: ["user:email"] }));
router.get('/github/callback', cors(), passport.authenticate('github', {
    successRedirect: process.env.FRONTEND_URL,
    failureRedirect: process.env.FRONTEND_URL + "/login"
}));

router.get("/user", (req, res) => {
    // console.log(req.user);

    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
    }
    // console.log(req.user.id, '===user ID,');

    return res.json(req.user); // User data comes from Firestore via deserializeUser ✅
});

router.get('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) return next(err);

        req.session.destroy(err => {
            if (err) return next(err);

            res.clearCookie('connect.sid', {
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
            });

            // res.redirect('/login');
            res.status(200).json({ type: true, message: "Logged out successfully" });
        });
    });
});


export default router