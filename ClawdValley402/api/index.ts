import express from 'express';
import cors from 'cors';

const app = express();

// Configure CORS
app.use(cors({
    origin: [
        'http://localhost:3000',
        'https://agentripe.vercel.app',
        'https://agentripe-8ot3.vercel.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X402-Payment', 'X402-Redeem-Token']
}));

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Express + CORS is working!' });
});

app.post('/demo/execute', (req, res) => {
    res.json({
        message: 'Demo endpoint working!',
        body: req.body,
        timestamp: new Date().toISOString()
    });
});

export default app;
