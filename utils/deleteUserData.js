import env from "dotenv";
import cloudinary from "../config/cloudinary.js";
import admin from "../config/firebase.js";

env.config();

const db = admin.firestore();
const rtdb = admin.database(); // Realtime database.

// Delete all project images and profile avatar. ☑️
const deleteUserImages = async (userId) => {
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) return;

    const userData = userSnap.data();

    // Delete user avatar.
    if (userData.avatarID) {
        await cloudinary.uploader.destroy(userData.avatarID);
    };
    // Delete all project images.
    const projectSnap = await userRef.collection('projects').get();

    const deletion = projectSnap.docs.map(doc => {
        const data = doc.data();
        if (data.pictureID) {
            return cloudinary.uploader.destroy(data.pictureID);
        }
    });

    // Delete them all at once!
    await Promise.all(deletion);

};

// Delete all project documents. ☑️
const deleteUserProjects = async (userId) => {

    const projectsSnap = await db.collection('users').doc(userId).collection('projects').get();

    const deletion = projectsSnap.docs.map(async (doc) => {
      
        const snapshot = await rtdb.ref(`projects/${doc.id}/userLikes`).once("value");

        if (snapshot.exists()) {
            const children = snapshot.val();
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

        // Remove project data.
        await rtdb.ref(`projects/${doc.id}`).remove();
        await doc.ref.delete();

        console.log(`Project ${doc.id} deleted ✅`);
    });

    await Promise.all(deletion);

};

export { deleteUserImages, deleteUserProjects }