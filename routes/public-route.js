import express from 'express';
import checkApiKey from '../middleware/checkApiKey.js';
import checkRateLimit from '../middleware/checkRateLimit.js';
import admin from '../config/firebase.js';

const publicRoute = express.Router();
const db = admin.firestore();

// Apply CORS to the router.
publicRoute.use(publicCors);

// For fetch all projects by API key.
router.get("/projects", checkApiKey, checkRateLimit, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const UID = req.userId;

        // Get projects based on the userId.
        const userProjectRef = db.collection('users').doc(UID).collection('projects').limit(Number(limit));

        // Get all projects
        const projectsSnapshot = await userProjectRef.get();
        const projects = projectsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        res.status(200).json({ type: true, ...projects });

    } catch (error) {
        res.status(500).json({ type: false, error: "Server error!" });
    }
});

export default publicRoute