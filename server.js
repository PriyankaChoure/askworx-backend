require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require("./config/db");
// const { body, validationResult } = require('express-validator');

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/users');
const subscriptionRoutes = require('./routes/subscriptions');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// 🔹 Connect Database
connectDB();

// ================= SECURITY =================

// Helmet
// Security middleware
app.use(helmet({
  // contentSecurityPolicy: {
  //   directives: {
  //     defaultSrc: ["'self'"],
  //     styleSrc: ["'self'", "'unsafe-inline'"],
  //     scriptSrc: ["'self'"],
  //     imgSrc: ["'self'", "data:", "https:"],
  //   },
  // },
  contentSecurityPolicy: false, // safer for React production builds
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting (general API)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Auth routes have stricter limits
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth attempts per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/refresh', authLimiter);

// ======== Body parsing middleware   =======================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============  API versioning   ============================
app.use('/api/v1', (req, res, next) => {
  req.apiVersion = 'v1';
  next();
});

// ============ Routes  =============================
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);

// =============  Health check =======================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ==============  404 handler ==============
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ==============  Global error handler ==============
app.use(errorHandler);

// ================= SERVER START =================

const server = app.listen(PORT, () => {
  // console.log("MONGO_URI:", process.env.MONGO_URI);
  console.log(
    `🚀 Server running on port ${PORT} in ${
      process.env.NODE_ENV || "development"
    } mode`
  );

  // schedule daily cleanup of expired subscriptions
  // const cron = require('node-cron');
  // const UserSubscription = require('./models/UserSubscription');
  // cron.schedule('0 0 * * *', async () => {
  //   try {
  //     const now = new Date();
  //     const result = await UserSubscription.updateMany(
  //       { isActive: true, toDate: { $lt: now } },
  //       { isActive: false }
  //     );
  //     if (result.modifiedCount) {
  //       console.log(`${result.modifiedCount} subscription(s) auto-expired`);
  //     }
  //   } catch (err) {
  //     console.error('Error running subscription cleanup job:', err);
  //   }
  // });
});

// // ==============   Graceful shutdown ==============
// process.on('SIGTERM', async () => {
//   console.log('SIGTERM received, shutting down gracefully');
//   await mongoose.connection.close();
//   console.log('MongoDB connection closed');
//   process.exit(0);
// });

// process.on('SIGINT', async () => {
//   console.log('SIGINT received, shutting down gracefully');
//   await mongoose.connection.close();
//   console.log('MongoDB connection closed');
//   process.exit(0);
// });

module.exports = app;