import express from 'express';

const router = express.Router();

router.get("/home", (req, res) => {

    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
    }

    return res.json(req.user); // User data comes from Firestore via deserializeUser ✅
});

export default router