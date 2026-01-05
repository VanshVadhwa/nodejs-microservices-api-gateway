require('dotenv').config();
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const cors = require('cors');
const Product = require('./models/Product');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- ROUTES ---

// 1. Login (Mock)
app.post('/login', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });
    
    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, message: "Use this token in Authorization header: Bearer <token>" });
});

// 2. CRUD Operations
app.post('/products', async (req, res) => {
    try {
        const product = await Product.create(req.body);
        res.status(201).json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/products/:id', async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/products/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SELF-REGISTRATION ---
const registerWithGateway = async () => {
    const routes = [
        { path: '/login', method: 'POST', targetUrl: `http://localhost:${PORT}/login`, public: true },
        { path: '/products', method: 'GET', targetUrl: `http://localhost:${PORT}/products`, public: false },
        { path: '/products', method: 'POST', targetUrl: `http://localhost:${PORT}/products`, public: false },
        { path: '/products/:id', method: 'PUT', targetUrl: `http://localhost:${PORT}/products/:id`, public: false },
        { path: '/products/:id', method: 'DELETE', targetUrl: `http://localhost:${PORT}/products/:id`, public: false }
    ];

    try {
        await axios.post(process.env.GATEWAY_URL, { routes });
        console.log('✅ Connected & Registered with Gateway');
    } catch (error) {
        console.log('⚠️ Gateway offline. Retrying in 5s...');
        setTimeout(registerWithGateway, 5000);
    }
};

// --- INIT ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('📦 Connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`🚀 Business Service running on Port ${PORT}`);
            registerWithGateway();
        });
    })
    .catch(err => console.error('DB Error:', err));