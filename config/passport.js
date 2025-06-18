import admin from "./firebase.js";
import passport from "passport";
import env from 'dotenv';
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GithubStrategy } from "passport-github2";
import { findOrCreateFirebaseUser } from "../utils/firebaseUser.js";

env.config();
const db = admin.firestore();

// Google strategy ✅
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:5000/auth/google/callback",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    scope: ["profile", "email"],
}, async (accessToken, refreshToken, profile, done) => {
    try {

        const email = profile.emails?.[0]?.value;
        var randomNum = Math.floor(1000 + Math.random() * 9000);

        const firebaseUser = await findOrCreateFirebaseUser({
            email,
            name: profile.displayName,
            photoURL: profile.photos?.[0]?.value || null,
        });

        const uid = firebaseUser.uid;

        const userRef = db.collection("users").doc(uid);
        const doc = await userRef.get();

        if (!doc.exists) {
            await userRef.set({
                id: uid,
                googleId: profile.id,
                provider: "google",
                name: profile.displayName + randomNum,
                email,
                avatar: profile.photos?.[0]?.value || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        // ✅ return user obj
        const user = {
            id: uid,
            email,
            name: profile.displayName + randomNum,
        };

        done(null, user); // ✅ Now serializeUser will receive `user.id`
    } catch (error) {
        console.log(error, '-google');
        done(error, null);
    }
}));

// Github strategy
passport.use(new GithubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "http://localhost:5000/auth/github/callback",
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const rawEmail = profile.emails?.[0]?.value;
        let email = rawEmail;
        var randomNum = Math.floor(1000 + Math.random() * 9000);

        if (!email || !email.includes("@")) {
            // fallback to fake email if none available
            email = `${profile.username || profile.id}@githubuser.dev`;
        };

        const firebaseUser = await findOrCreateFirebaseUser({
            email,
            name: profile.displayName  || profile.username ,
            photoURL: profile.photos?.[0]?.value || null,
        });

        const uid = firebaseUser.uid;

        // Store in Firestore
        const userRef = db.collection("users").doc(uid);
        const doc = await userRef.get();
        // console.log(profile);

        if (!doc.exists) {
            await userRef.set({
                id: uid,
                githubId: profile.id,
                provider: "github",
                name: profile.displayName + randomNum || profile.username + randomNum,
                email,
                avatar: profile.photos?.[0]?.value || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            })
        };

        const user = {
            id: uid,
            email,
            name: profile.displayName,
        };
        done(null, user);

    } catch (error) {
        console.log(error, 'github');
        done(error, null);
    }
}));


// Serialize user
passport.serializeUser((user, done) => {
    done(null, user?.id); // Firebase UID
});
passport.deserializeUser(async (id, done) => {
    try {
        const userDoc = await db.collection("users").doc(id).get();
        if (userDoc.exists) {
            done(null, userDoc.data());
        } else {
            done(null, null);
        }
    } catch (err) {
        done(err, null);
    }
});

export default passport