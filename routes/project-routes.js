import express from "express";
import env from "dotenv";
import upload from '../middleware/multer.js';
import cloudinary from "../config/cloudinary.js";
import admin from "../config/firebase.js";

env.config();

const db = admin.firestore();
// db.settings({ ignoreUndefinedProperties: true }); // To prevents undefined

const router = express.Router();

// Add project ✅
router.post('/add', upload.single('picture'), async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
        // console.log(req.body, '--body');
        // console.log(req.file, '==file');

        const { title, description, liveURL, demoURL } = req.body;
        const path = req.file?.path;
        const filename = req.file?.filename;
        const userId = req.user.id;

        // Firestore reference.
        const snapshot = await db.collection('users').doc(userId).collection('projects').get();
        const projectRef = db.collection('users').doc(userId).collection('projects');
        const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // console.log(projects, '--projects');

        // Check project is already exists.
        const isExists = projects.some((project) => project.title.toLowerCase() === title.toLowerCase());
        // console.log(isExists, '--Exist');

        if (!isExists) {
            await projectRef.add({
                title: title,
                picture: path,
                pictureID: filename,
                description: description,
                demoURL: demoURL,
                liveURL: liveURL,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        return res.status(200).json({ message: 'Project is successfully added.' })

    } catch (error) {
        console.error("Profile Error:", error);
        res.status(500).json({ type: false, error: "Server error" });
    }
});

// Update project ✅
router.put('/update', upload.single('picture'), async (req, res) => {

    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });

    // console.log(req.body, '--body');
    // console.log(req.file, '==file');
    try {
        const { title, description, liveURL, demoURL, pictureID, projectID } = req.body;

        const path = req.file?.path;
        const filename = req.file?.filename;
        const userId = req.user.id;


        // Remove old picture in Cloudinary
        const oldPictureId = pictureID ?? null;
        // console.log(oldPictureId, "old photo id");

        if (oldPictureId && req?.file) {
            try {
                const removeResult = await cloudinary.uploader.destroy(oldPictureId);
                console.log('✅ Deleted old profile picture :', removeResult);
            } catch (error) {
                console.error('❌ Error deleting old profile picture:', error);
            }
        };

        const newData = {
            title: title,
            description: description,
            liveURL,
            demoURL,
            picture: path,
            pictureID: filename,
        };


        // Firestore reference
        await db.collection('users').doc(userId).collection('projects').doc(projectID).update(newData);

        res.status(200).json({ message: 'Project updated successfully' })

    } catch (error) {
        console.error("Profile Error:", error);
        res.status(500).json({ type: false, error: "Server error" });
    }

});

// Delete project ✅
router.delete('/delete', async (req, res) => {
    console.log(req.query, '==id');
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    try {
        const userId = req.user.id;
        const { projectID, pictureID } = req.query;
        const oldPictureId = pictureID ?? null;

        // Remove old picture in Cloudinary
        if (oldPictureId) {
            try {
                const removeResult = await cloudinary.uploader.destroy(oldPictureId);
                console.log('✅ Deleted old profile picture :', removeResult);
            } catch (error) {
                console.error('❌ Error deleting old profile picture:', error);
            }
        };

        // Delete doc
        await db.collection('users').doc(userId).collection('projects').doc(projectID).delete();
        res.status(200).json({ message: 'Project deleted successfully' })

    } catch (error) {
        console.error("Profile Error:", error);
        res.status(500).json({ type: false, error: "Server error" });
    }

});

// Fetch all projects ✅
router.get('/get', async (req, res) => {

    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });

    const { limit = 5, startAfter } = req.query;
    const userId = req.user.id;

    // console.log(startAfter, '--next');

    try {

        const userProjectRef = db.collection('users').doc(userId).collection('projects');
        let query = userProjectRef.orderBy('createdAt', 'desc').limit(Number(limit));

        if (startAfter) {
            const timestamp = admin.firestore.Timestamp.fromMillis(Number(startAfter));
            query = query.startAfter(timestamp);
        };

        // Get all projects
        const snapshot = await query.get();
        const projects = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        // last project's createdAt to use in the next page
        const last = snapshot.docs[snapshot.docs.length - 1];
        const nextCursor = last?.data()?.createdAt?.toMillis() || null;

        res.json({ projects, nextCursor });


    } catch (error) {
        console.error("Profile Error:", error);
        res.status(500).json({ type: false, error: "Server error" });
    };

});

// Fetch single project ✅
router.get('/single', async (req, res) => {
    // console.log(req.query, '--project id');

    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });

    const { projectID } = req.query;
    const userId = req.user.id;

    try {
        // Firestore reference
        const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectID);
        const doc = await projectRef.get();
        const existingData = doc.data();
        console.log(existingData);

        if (existingData) {
            res.status(200).json(existingData);
        }

    } catch (error) {
        console.error("Profile Error:", error);
        res.status(500).json({ type: false, error: "Server error" });
    }

});

// Fetch all project for public. ✅
router.get('/public-all', async (req, res) => {
    const { username, limit = 5, startAfter } = req.query;
    // console.log(username, '==username');
    try {

        // Find userId by username.
        const userSnap = await db.collection('users').where('name', '==', username).limit(1).get();
        if (userSnap.empty) return res.status(404).json({ error: 'User not found' });

        const userId = userSnap.docs[0].id;
        // console.log(userId, '--user ID--');

        // Get projects based on the userId.
        const userProjectRef = db.collection('users').doc(userId).collection('projects');
        let query = userProjectRef.orderBy('createdAt', 'desc').limit(Number(limit));

        // IF true skip all documents before that timestamp.
        if (startAfter) {
            const timestamp = admin.firestore.Timestamp.fromMillis(Number(startAfter));
            query = query.startAfter(timestamp);
        };

        // Get all projects
        const snapshot = await query.get();
        const projects = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        // last project's createdAt to use in the next page
        const last = snapshot.docs[snapshot.docs.length - 1];
        const nextCursor = last?.data()?.createdAt?.toMillis() || null;

        res.json({ projects, nextCursor });

    } catch (error) {
        console.error("Public Fetch Error:", error);
        res.status(500).json({ type: false, error: "Server error" });
    }

});

// Fetch single project for public. ✅
router.get('/public-single', async (req, res) => {
    // console.log(req.query, 'username and project id--');
    const { username, projectID } = req.query;

    try {

        // Find userId by username.
        const userSnap = await db.collection('users').where('name', '==', username).limit(1).get();
        if (userSnap.empty) return res.status(404).json({ error: 'User not found' });

        const userId = userSnap.docs[0].id;
        // console.log(userId, '--user ID--');

        // Firestore reference
        const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectID);
        const doc = await projectRef.get();
        const project = doc.data();

        if (project) {
            res.status(200).json({ ...project });
        }

    } catch (error) {
        console.error("Public Fetch Error:", error);
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


export default router;