import env from "dotenv";
import cloudinary from "../config/cloudinary.js";
import admin from "../config/firebase.js";

env.config();

const db = admin.firestore();

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

    const deletion = projectsSnap.docs.map( doc => doc.ref.delete());

    await Promise.all(deletion);
};

export { deleteUserImages, deleteUserProjects }