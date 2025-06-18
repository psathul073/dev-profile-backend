import express from "express";
import passport from "./config/passport.js";
import session from "express-session";
import env from "dotenv";
import cors from "cors";
import authRoute from "./routes/auth-routes.js";
import protectedRoute from "./routes/protected-route.js";
import profileRoute from "./routes/profile-route.js";
import projectRoutes from "./routes/project-routes.js";
import connectPgSimple from "connect-pg-simple";
import pkg  from 'pg';


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

app.use(cors({
    origin: 'https://dev-profiles.netlify.app', // ✅ Frontend full URL with https
    credentials: true, // ✅ To send cookies
}));

app.use(express.json()); // Parses incoming JSON requests

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

// Routes
app.use('/auth', authRoute);
app.use('/', protectedRoute);
app.use('/api', profileRoute);
app.use('/project', projectRoutes);

// ⭐ Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
});

app.listen(port, () => console.log(`✅ Server running on port ${port}`));