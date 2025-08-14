import admin from "../config/firebase.js";

const db = admin.firestore();

const checkRateLimit = async (req, res, next) => {

    const apiKey = req.headers["x-api-key"];

    const limitPerDay = 100;

    if (!apiKey) return res.status(401).json({ error: "API key required" });

    const apiKeyRef = db.collection('apiKeys').doc(apiKey);
    const keySnapshots = await apiKeyRef.get();


    if (!keySnapshots.exists) return res.status(403).json({ error: "Invalid API key" });

    const keyData = keySnapshots.data();

    const today = new Date().toISOString().split('T')[0];

    // Reset count for new day.
    if (keyData.lastRequestDate !== today) {
        keyData.requestsToday = 0;
        keyData.lastRequestDate = today;
    };

    // Req limit is exceeded.
    if (keyData.requestsToday >= limitPerDay) {
        throw new Error("API rate limit exceeded for today.");
    };

    // Increment usage.
    await apiKeyRef.set({
        ...keyData,
        requestsToday: keyData.requestsToday + 1,
    }, { merge: true });

    req.userId = keyData.userId;

    next();
}

export default checkRateLimit