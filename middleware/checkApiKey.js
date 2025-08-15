import admin from "../config/firebase.js";

const db = admin.firestore();

const checkApiKey = async (req, res, next) => {

    const apiKey = req.headers["x-api-key"];

    // Internal frontend? skip the API key ✅
    // if (internalOrigins.includes(req.headers.origin)) return next();

    // For missing API Key.
    if (!apiKey) return res.status(403).json({ error: "Missing API key" });

    try {

        const apiKeyRef = db.collection('apiKeys').doc(apiKey);
        const keySnapshots = await apiKeyRef.get();

        // For invalid keys.
        if (!keySnapshots.exists) return res.status(403).json({ error: "Invalid API key" });

        req.apiKeyData = {
            id: keySnapshots.id,
            ...keySnapshots.data()
        };

        next();

    } catch (error) {
        console.error("Error checking API key:", error);
        res.status(500).json({ error: "Server error" });
    }

};

export default checkApiKey;