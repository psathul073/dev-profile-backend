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


// Cors setup ☑️
// Internal origins.
const internalOrigins = [
    process.env.FRONTEND_URL, // Prod frontend
    "http://localhost:5173",
    "http://localhost:3000"
];


// ✅ Private CORS — only allow frontend.
const privateCors = cors({
    origin: (origin, callback) => {
        // Allow server-to-server requests or Postman (no origin)
        if (!origin) return callback(null, true);
        // Allow only internal origins
        if (internalOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
});

 const publicCors = cors({
    origin: true, // ✅ Allow all origins.
    credentials: true
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


// Public API routes (anyone can access)
app.use('/auth', publicCors, authRoute);
app.use('/api', publicCors, publicRoute);

app.use('/', privateCors, protectedRoute);
app.use('/u', privateCors, profileRoute);
app.use('/p', privateCors, projectRoutes);




// ⭐ Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
});

app.listen(port, () => console.log(`✅ Server running on port ${port}`));