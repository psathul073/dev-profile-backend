import express from "express";
import passport from "./config/passport.js";
import session from "express-session";
import env from "dotenv";
import cors from "cors";
import authRoute from "./routes/auth-routes.js";
import protectedRoute from "./routes/protected-route.js";
import profileRoute from "./routes/profile-route.js";
import projectRoutes from "./routes/project-routes.js";
import publicRoute from "./routes/public-route.js";
import connectPgSimple from "connect-pg-simple";
import pkg from 'pg';


env.config();

const app = express();
const port = process.env.PORT;
const { Pool } = pkg;
const PgSession = connectPgSimple(session);

// Create new client.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' && {
        rejectUnauthorized: false,
    },
});

// Internal origins (no API key required).
const internalOrigins = [
    process.env.FRONTEND_URL // Prod frontend
];

// Cors setup ☑️
// CORS for private routes (only allowed own frontend).
const privateCors = cors({

    origin: (origin, callback) => {

        if (!origin || origin.includes('google') || origin.includes('github')) return callback(null, true); // (Postman, OAuth) / server-to-server,
        if (internalOrigins.includes(origin)) return callback(null, true); // For our frontend.
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
});

// CORS for public API (allow all origins).
const publicCors = cors({
    origin:  "*",
    allowedHeaders: ["Content-Type", "x-api-key"],
    credentials: false
});


app.use(express.json()); // Parses incoming JSON requests
app.set('trust proxy', 1); // Important for Render working...

app.use(session({
    store:  new PgSession({
        pool,
        tableName: 'session', // default
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30,
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "none",
    },
}));

// For development time ❌
// app.use(session({
//     secret: process.env.SESSION_SECRET,
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//         maxAge: 1000 * 60 * 60 * 24 * 30,
//         secure: false,         // ❌ not using HTTPS locally
//         httpOnly: true,
//         sameSite: "lax",       // ✅ lax works locally with http
//     },
// }));


app.use(passport.initialize());
app.use(passport.session());

// Private routes (only frontend allowed).
app.use('/auth', privateCors, authRoute);
app.use('/', privateCors, protectedRoute);
app.use('/user', privateCors, profileRoute);
app.use('/project', privateCors, projectRoutes);

// Public routes (API key + rate limit)
app.use('/api', publicCors, publicRoute );


// ⭐ Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
});

app.listen(port, () => console.log(`✅ Server running on port ${port}`));