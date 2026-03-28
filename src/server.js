require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Connect to Database
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/network', require('./routes/networkRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/funds', require('./routes/fundRoutes'));
app.use('/api/transfers', require('./routes/transferRoutes'));
app.use('/api/withdrawals', require('./routes/withdrawalRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/activations', require('./routes/activationRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/investments', require('./routes/investmentRoutes'));
app.use('/api/bots', require('./routes/botRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Basic Route
app.get('/', (req, res) => {
  res.json({ message: 'OrbitFX API is running...' });
});

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  const { processAllMonthlyRewards } = require('./services/directRewardCron');

  // ── Daily Cron: Process Monthly Salary Rewards ──
  // Runs immediately on startup, then every 24 hours
  processAllMonthlyRewards();
  setInterval(processAllMonthlyRewards, 24 * 60 * 60 * 1000);
  console.log('[Cron] Monthly reward scheduler started (Daily ROI is now MANUAL)');
});
