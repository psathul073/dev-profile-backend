import admin from "../config/firebase.js";

export const findOrCreateFirebaseUser = async ({ email, name, photoURL }) => {
    try {
        let firebaseUser;
        try {
            firebaseUser = await admin.auth().getUserByEmail(email);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                firebaseUser = await admin.auth().createUser({
                    email,
                    displayName: name,
                    photoURL,
                });
            } else {
                throw error;
            };
        };
        
        return firebaseUser;

    } catch (error) {
        throw error;
    }
};