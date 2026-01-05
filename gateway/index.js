require('dotenv').config();
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { match } = require('path-to-regexp');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-Memory Registry
let routeRegistry = [];

// --- REGISTRATION ENDPOINT ---
app.post('/register', (req, res) => {
    const { routes } = req.body;
    if (!routes) return res.status(400).send('No routes provided');

    routes.forEach(newRoute => {
        routeRegistry = routeRegistry.filter(r => !(r.path === newRoute.path && r.method === newRoute.method));
        routeRegistry.push(newRoute);
    });
    
    console.log(`🔄 Registry Updated: ${routeRegistry.length} routes active.`);
    res.sendStatus(200);
});

// --- REQUEST HANDLER ---
app.use(async (req, res, next) => {
    if (req.path === '/register') return next();

    // 1. Match Route
    let matchedRoute = null;
    let params = {};

    for (const route of routeRegistry) {
        if (route.method !== req.method) continue;
        
        // Exact match check
        if (route.path === req.path) {
            matchedRoute = route;
            break;
        }
        
        // Dynamic match check (using path-to-regexp logic)
        const matcher = match(route.path, { decode: decodeURIComponent });
        const result = matcher(req.path);
        if (result) {
            matchedRoute = route;
            params = result.params;
            break;
        }
    }

    if (!matchedRoute) {
        return res.status(404).json({ error: 'Endpoint not found or not registered via Gateway' });
    }

    // 2. Authentication
    if (!matchedRoute.public) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) return res.status(401).json({ error: 'Access Denied: No Token Provided' });

        try {
            jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(403).json({ error: 'Access Denied: Invalid Token' });
        }
    }

    // 3. Forward Request (Proxy)
    try {
        let targetUrl = matchedRoute.targetUrl;
        Object.keys(params).forEach(key => {
            targetUrl = targetUrl.replace(`:${key}`, params[key]);
        });

        console.log(`➡️ Proxying: ${req.method} ${req.path} -> ${targetUrl}`);

        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: { 'Content-Type': 'application/json' }
        });

        res.status(response.status).json(response.data);
    } catch (error) {
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            console.error('Proxy Error:', error.message);
            res.status(500).json({ error: 'Internal Service Error' });
        }
    }
});

app.listen(PORT, () => {
    console.log(`🛡️ Gateway Service running on Port ${PORT}`);
});