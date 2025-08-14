import express from "express";
import env from "dotenv";
import upload from '../middleware/multer.js';
import cloudinary from "../config/cloudinary.js";
import admin from "../config/firebase.js";

env.config();

const db = admin.firestore();
// db.settings({ ignoreUndefinedProperties: true }); // To prevents undefined
const rtdb = admin.database(); // Realtime database.

const router = express.Router();

// Add project ✅
router.post('/add', upload.single('picture'), async (req, res) => {

    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });

    try {

        const { title, description, liveURL, demoURL, usedTec } = req.body;
        const path = req.file?.path;
        const filename = req.file?.filename;
        const userId = req.user.id;

        // Firestore reference.
        const snapshot = await db.collection('users').doc(userId).collection('projects').get();
        const projectRef = db.collection('users').doc(userId).collection('projects');
        const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Check project is already exists.
        const isExists = projects.some((project) => project.title.toLowerCase() === title.toLowerCase());

        if (!isExists) {
            await projectRef.add({
                title: title,
                picture: path,
                pictureID: filename,
                description: description,
                usedTec: usedTec ? JSON.parse(usedTec) : [],
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

    try {
        const { title, description, liveURL, demoURL, pictureID, projectID, usedTec } = req.body;

        const path = req.file?.path;
        const filename = req.file?.filename;
        const userId = req.user.id;

        // Remove old picture in Cloudinary
        const oldPictureId = pictureID ?? null;

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
            usedTec: JSON.parse(usedTec),
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

        const snapshot = await rtdb.ref(`projects/${projectID}/userLikes`).once("value");

        // Liked anonyms user deleted.
        if (snapshot.exists()) {
            const children = snapshot.val();
            // keys only.
            const keys = Object.keys(children);

            await Promise.all(
                keys.map(async (uid) => {
                    try {
                        const userRecord = await admin.auth().getUser(uid);
                        if (userRecord.providerData.length === 0) { // anonymous
                            await admin.auth().deleteUser(uid);
                            console.log(`Anonymous user ${uid} deleted ✅`);
                        }
                    } catch (err) {
                        console.warn(`Could not delete user ${uid}:`, err.message);
                    }
                })
            );
        }

        // Delete Likes.
        await rtdb.ref(`projects/${projectID}`).remove();

        // Delete doc.
        await db.collection('users').doc(userId).collection('projects').doc(projectID).delete();
        console.log(`Project ${projectID} deleted ✅`);

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


    try {

        const userProjectRef = db.collection('users').doc(userId).collection('projects');
        let query = userProjectRef.orderBy('createdAt', 'desc')
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(Number(limit));

        if (startAfter) {
            const { createdAt, id } = JSON.parse(startAfter);

            const timestamp = admin.firestore.Timestamp.fromMillis(Number(createdAt));
            query = query.startAfter(timestamp, id);
        };

        // Get all projects
        const snapshot = await query.get();
        const projects = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        // last project's createdAt to use in the next page
        const last = snapshot.docs[snapshot.docs.length - 1];
        const nextCursor = last ? JSON.stringify({
            createdAt: last.data().createdAt.toMillis(),
            id: last.id,
        }) : null;

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

        if (existingData) {
            res.status(200).json(existingData);
        }

    } catch (error) {
        console.error("Profile Error:", error);
        res.status(500).json({ type: false, error: "Server error" });
    }

});

// Fetch total project and Likes ✅
router.get('/counts', async (req, res) => {

    try {

        if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });

        const userId = req.user.id;
        const projectsRef = db.collection('users').doc(userId).collection('projects');
        const projectsSnapshot = await projectsRef.get();
        const totalProject = projectsSnapshot.size;

        const likes = Promise.all(projectsSnapshot.docs.map(async (doc) => {
            const data = doc.data();

            const likesSnap = await rtdb.ref(`projects/${doc.id}/totalLikes`).once('value');
            return {
                totalLikes: likesSnap.exists() ? likesSnap.val() : 0
            }
        }));
        const likeCount = await likes;
        const totalLikes = likeCount.reduce((sum, like) => sum + (like.totalLikes || 0), 0);

        res.status(200).json({
            totalProject,
            totalLikes
        });


    } catch (error) {
        console.error("Total count fetch Error:", error);
        res.status(500).json({ type: false, error: "Server error" });
    }
});

// Make project public ✅
router.put('/public', async (req, res) => {
    try {
        if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
        const userId = req.user.id;
        const { projectID } = req.query;

        const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectID);
        const projectSnapshot = await projectRef.get();

        if (projectSnapshot.exists) {
            projectRef.set({
                public: true,
            }, { merge: true });
        }

        return res.status(200).json({ type: true, message: "Project make to public!" });

    } catch (error) {
        console.error("Project to public Error:", error);
        res.status(500).json({ type: false, error: "Server error" });
    }
});

// Make project private ✅
router.put('/private', async (req, res) => {
    try {
        if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
        const userId = req.user.id;
        const { projectID } = req.query;
        const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectID);
        const projectSnapshot = await projectRef.get();

        if (projectSnapshot.exists) {
            projectRef.set({
                public: false,
            }, { merge: true });
        }

        return res.status(200).json({ type: true, message: "Project make to private!" });

    } catch (error) {
        console.error("Project to private Error:", error);
        res.status(500).json({ type: false, error: "Server error" });
    }
});

// Fetch all project for public. ✅
router.get('/public-all', async (req, res) => {
    const { username, limit = 10, startAfter } = req.query;

    try {

        // Find userId by username.
        const userSnap = await db.collection('users').where('name', '==', username).limit(Number(1)).get();
        if (userSnap.empty) return res.status(404).json({ error: 'User not found' });

        const userId = userSnap.docs[0].id;

        // Get projects based on the userId.
        const userProjectRef = db.collection('users').doc(userId).collection('projects');
        let query = userProjectRef.orderBy('createdAt', 'desc').where('public', '==', true).limit(Number(limit));

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