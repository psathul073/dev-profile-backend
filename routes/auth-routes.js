import express from "express";
import passport from "../config/passport.js";
import env from "dotenv";

env.config();

const router = express.Router();

// Google Auth Route✅
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get("/google/callback",
    passport.authenticate("google", {
        successRedirect: "https://dev-profiles.netlify.app/login",
        failureRedirect: "https://dev-profiles.netlify.app/login"
    }),
);

// Github Auth Route
router.get('/github', passport.authenticate("github", { scope: ["user:email"] }));
router.get('/github/callback', passport.authenticate('github', {
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

            res.redirect('/login');
        });
    });
});


export default router