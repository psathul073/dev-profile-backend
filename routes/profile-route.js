import express from "express";
import env from "dotenv";
import upload from '../middleware/multer.js';
import cloudinary from "../config/cloudinary.js";
import admin from "../config/firebase.js";
import { deleteUserImages, deleteUserProjects } from "../utils/deleteUserData.js";


env.config();

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true }); // To prevents undefined

const router = express.Router();

router.get("/user-data", (req, res) => {
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

router.post('/profile-update', upload.single('avatar'), async (req, res) => {

    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });

    try {
        // console.log(req.body, '--body');
        // console.log(req.file, '==file');

        const { name, gh, ig, yt, lk, x } = req.body;
        const path = req.file?.path;
        const filename = req.file?.filename;
        const userId = req.user.id;

        // Firestore reference
        const useRef = db.collection('users').doc(userId);  // current user.
        const doc = await useRef.get();

        if (!doc.exists) {
            return res.status(404).json({ type: false, message: "User not found" });
        };

        const existingData = doc.data();
        // 🔍 Check if this name is already used by someone else.
        const nameQuerySnapshot = await db
            .collection('users')
            .where('name', '==', name)
            .get();

        let nameExists = false;

        nameQuerySnapshot.forEach(doc => {
            if (doc.id !== userId) {
                nameExists = true; // Another user has this name.
            }
        });

        if (nameExists) {
            return res.status(400).json({ type: false, message: "Name is already taken" });
        };

        // Build new data 
        const newData = {
            ...(path && { avatar: path }),
            ...(filename && { avatarID: filename }),
            ...(name && { name }),
            links: {
                ...(gh && { gh }),
                ...(ig && { ig }),
                ...(yt ? { yt } : { yt: '' }),
                ...(lk && { lk }),
                ...(x ? { x } : { x: '' }),
            },
        };

        // Remove old picture in Cloudinary
        const oldPictureId = existingData?.avatarID ?? null;
        // console.log(oldPictureId, "old photo id");

        if (oldPictureId && req?.file) {
            try {
                const removeResult = await cloudinary.uploader.destroy(oldPictureId);
                console.log('✅ Deleted old profile picture :', removeResult);
            } catch (error) {
                console.error('❌ Error deleting old profile picture:', error);
            }
        }

        // Deep difference check.
        const isDataDifferent = (a, b) => {
            if (typeof a !== typeof b) return true;
            if (typeof a !== 'object' || a === null || b === null) return a !== b;

            const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
            for (let key of keys) {
                if (b[key] === undefined || b[key] === null) continue;
                if (isDataDifferent(a[key], b[key])) return true;
            }
            return false;
        };

        // Save only if different
        if (isDataDifferent(existingData, newData)) {

            await useRef.set(newData, { merge: true });
            console.log("✅ User updated.");
            res.status(200).json({ type: true, message: "User updated" });

        } else {
            console.log("ℹ️ No changes needed. Data already exists.");
            res.status(200).json({ type: true, message: "No changes needed. Data already exists." });
        }

    } catch (error) {
        console.error("Profile Error:", error);
        res.status(500).json({ type: false, error: "Server error" });
    }
});

router.delete('/delete-account', async (req, res) => {

    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const userId = req.user.id;
    try {

        const apiKeysQuery = await db.collection('apiKeys').where("userId", '==', userId).get();
        if (!apiKeysQuery.empty) {
            for (const docSnap of apiKeysQuery.docs) {
                await docSnap.ref.delete(); // Delete API Keys.
            }
        }

        await deleteUserImages(userId);  //🧹 Remove Cloudinary files.
        await deleteUserProjects(userId); // 📄 Remove Firestore projects.
        await db.collection('users').doc(userId).delete(); // 👤 Remove user profile.
        await admin.auth().deleteUser(userId); // 🔐 Remove Auth account

        res.status(200).json({ message: 'Account deleted successfully.' });

    } catch (error) {
        console.error("Account deletion Error:", error);
        res.status(500).json({ type: false, error: "Server error" });
    }
});

// Fetch user profile for public. ✅
router.get('/public-profile', async (req, res) => {

    const { username } = req.query;

    try {
        // Find userId by username.
        const userSnap = await db.collection('users').where('name', '==', username).limit(1).get();
        if (userSnap.empty) return res.status(404).json({ error: 'User not found' });

        const userId = userSnap.docs[0].id;
        // console.log(userId, '--user ID--');

        // Get user data based on userId.
        const useRef = db.collection('users').doc(userId);
        const doc = await useRef.get();
        const userData = doc.data();

        res.json({ ...userData });

    } catch (error) {
        console.error("Public Fetch Error:", error);
        res.status(500).json({ type: false, error: "Server error" });
    }
});

// Generate API Key.
router.get('/generate-key', async (req, res) => {
    try {
        if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });

        const userId = req.user.id;

        // Check if user already has an API key.
        const queryKeys = await db.collection('apiKeys').where("userId", '==', userId).get();

        if (!queryKeys.empty) {
            for (const docSnap of queryKeys.docs) {
                await docSnap.ref.delete();
            }
        }

        const apiKey = crypto.randomUUID(); // Unique key.

        const apiKeysRef = db.collection('apiKeys').doc(apiKey);
        await apiKeysRef.create({
            userId,
            createdAt: Date.now(),
            requestsToday: 0,
            lastRequestDate: new Date().toISOString().split("T")[0],
        });

        res.json({ success: true, apiKey });

    } catch (error) {
        console.error("API Key generation Error:", error);
        res.status(500).json({ type: false, error: "Server error" });
    }
});

export default router