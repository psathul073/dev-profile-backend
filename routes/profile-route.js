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

router.post('/profile', upload.single('avatar'), async (req, res) => {

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
        await deleteUserImages(userId);  //🧹 Remove Cloudinary files
        await deleteUserProjects(userId); // 📄 Remove Firestore projects
        await db.doc(`users/${userId}`).delete(); // 👤 Remove user profile
        await admin.auth().deleteUser(userId); // 🔐 Remove Auth account
        res.status(200).json({ message: 'Account deleted successfully.' })
    } catch (error) {
        console.error("Account deletion Error:", error);
        res.status(500).json({ type: false, error: "Server error" });
    }
});


export default router