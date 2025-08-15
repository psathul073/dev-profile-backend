import admin from "../config/firebase.js";

const db = admin.firestore();

const checkRateLimit = async (req, res, next) => {

    // No limit for internal frontend.
    // if (internalOrigins.includes(req.headers.origin)) return next();

    const apiKeyData = req.apiKeyData;
    const today = new Date().toISOString().split('T')[0];
    const limitPerDay = 100;

    let { requestsToday, lastRequestDate, userId } = apiKeyData;

    // Reset daily counter if date changed.
    if (lastRequestDate !== today) {
        requestsToday = 0;
        lastRequestDate = today;
    }

    // Req limit is exceeded.
    if (requestsToday >= limitPerDay) {
        return res.status(429).json({ error: "Daily API limit reached" });
    }

    try {
        // Update Firestore counter.
        const apiKeyRef = db.collection('apiKeys').doc(apiKeyData.id);

        await apiKeyRef.update({
            requestsToday: requestsToday + 1,
            lastRequestDate: today
        });

        req.userId = userId;

        next();

    } catch (error) {
        console.error("Error updating API Key:", error);
        res.status(500).json({ error: "Server Error" });
    }

}

export default checkRateLimit