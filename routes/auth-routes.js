import express from "express";
import passport from "../config/passport.js";
import env from "dotenv";


env.config();

const router = express.Router();

// Google Auth Route✅
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get("/google/callback", passport.authenticate("google", {
        successRedirect: process.env.FRONTEND_URL,
        failureRedirect: process.env.FRONTEND_URL + "/login",
    }),
);

// Github Auth Route
router.get('/github', passport.authenticate("github", { scope: ["user:email"] }));
router.get('/github/callback', passport.authenticate('github', {
    successRedirect: process.env.FRONTEND_URL,
    failureRedirect: process.env.FRONTEND_URL + "/login"
}));


export default router