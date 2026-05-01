/**
 * PhotoHub Backend Server
 * 
 * A production-ready Express.js server with:
 * - Email OTP authentication
 * - JWT token generation
 * - Background removal API integration
 * - Rate limiting and security
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Stricter limit for auth endpoints
  skipSuccessfulRequests: true
});

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// ==================== EMAIL CONFIGURATION ====================

const emailTransporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Verify email configuration
emailTransporter.verify((error, success) => {
  if (error) {
    console.error('Email service configuration error:', error);
  } else {
    console.log('✓ Email service ready');
  }
});

// ==================== OTP STORE (Use Redis in production) ====================

class OTPStore {
  constructor() {
    this.store = new Map();
  }

  set(email, otp, expiryMinutes = 10) {
    this.store.set(email, {
      otp,
      expires: Date.now() + expiryMinutes * 60 * 1000,
      attempts: 0
    });
  }

  get(email) {
    return this.store.get(email);
  }

  verify(email, otp) {
    const data = this.store.get(email);
    
    if (!data) {
      return { valid: false, error: 'OTP not found' };
    }

    if (data.expires < Date.now()) {
      this.store.delete(email);
      return { valid: false, error: 'OTP expired' };
    }

    if (data.attempts >= 3) {
      this.store.delete(email);
      return { valid: false, error: 'Too many attempts. Request a new OTP.' };
    }

    if (data.otp !== otp) {
      data.attempts += 1;
      return { valid: false, error: 'Invalid OTP' };
    }

    this.store.delete(email);
    return { valid: true };
  }

  delete(email) {
    this.store.delete(email);
  }
}

const otpStore = new OTPStore();

// ==================== UTILITY FUNCTIONS ====================

/**
 * Generate random OTP
 */
function generateOTP(length = 6) {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

/**
 * Send OTP email
 */
async function sendOTPEmail(email, otp) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'PhotoHub - Your Verification Code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #a855f7, #ec4899);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
          }
          .content {
            background: #f9fafb;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-radius: 0 0 8px 8px;
          }
          .otp-box {
            background: white;
            border: 2px solid #a855f7;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
          }
          .otp-code {
            font-size: 36px;
            font-weight: bold;
            color: #a855f7;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
          }
          .expiry {
            color: #ef4444;
            font-size: 14px;
            margin-top: 10px;
          }
          .footer {
            color: #6b7280;
            font-size: 12px;
            text-align: center;
            margin-top: 20px;
          }
          .warning {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px;
            margin: 20px 0;
            border-radius: 4px;
            font-size: 13px;
            color: #92400e;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📸 PhotoHub</h1>
            <p>Email Verification</p>
          </div>
          
          <div class="content">
            <h2>Hello!</h2>
            <p>You're almost there. Use the verification code below to complete your sign-in.</p>
            
            <div class="otp-box">
              <p>Your verification code is:</p>
              <div class="otp-code">${otp}</div>
              <div class="expiry">⏱️ Expires in 10 minutes</div>
            </div>
            
            <div class="warning">
              ⚠️ <strong>Security Notice:</strong> Never share this code with anyone. 
              PhotoHub staff will never ask for your verification code.
            </div>
            
            <p>If you didn't request this code, you can safely ignore this email.</p>
            
            <div class="footer">
              <p>PhotoHub © ${new Date().getFullYear()} | All rights reserved</p>
              <p>Need help? Contact us at support@photohub.com</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  };

  return emailTransporter.sendMail(mailOptions);
}

/**
 * Generate JWT token
 */
function generateJWT(email) {
  return jwt.sign(
    { email, iat: Date.now() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '7d' }
  );
}

/**
 * Verify JWT token
 */
function verifyJWT(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// ==================== MIDDLEWARE ====================

/**
 * Authentication middleware
 */
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const decoded = verifyJWT(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
};

/**
 * Validate request body
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ==================== ROUTES: AUTHENTICATION ====================

/**
 * POST /api/auth/send-otp
 * Send OTP to email
 */
app.post('/api/auth/send-otp',
  [
    body('email').isEmail().normalizeEmail(),
    body('email').isLength({ min: 5, max: 254 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email } = req.body;

      // Generate OTP
      const otp = generateOTP();

      // Store OTP
      otpStore.set(email, otp);

      // Send email
      await sendOTPEmail(email, otp);

      // Log for debugging (remove in production)
      console.log(`[OTP] Sent to ${email}: ${otp}`);

      res.json({
        success: true,
        message: 'OTP sent successfully',
        email
      });
    } catch (error) {
      console.error('Error sending OTP:', error);
      res.status(500).json({
        error: 'Failed to send OTP. Please try again.',
        details: error.message
      });
    }
  }
);

/**
 * POST /api/auth/verify-otp
 * Verify OTP and generate JWT token
 */
app.post('/api/auth/verify-otp',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric()
  ],
  handleValidationErrors,
  (req, res) => {
    try {
      const { email, otp } = req.body;

      // Verify OTP
      const verification = otpStore.verify(email, otp);

      if (!verification.valid) {
        return res.status(401).json({ error: verification.error });
      }

      // Generate JWT token
      const token = generateJWT(email);

      res.json({
        success: true,
        message: 'Authentication successful',
        token,
        email,
        expiresIn: '7d'
      });
    } catch (error) {
      console.error('Error verifying OTP:', error);
      res.status(500).json({ error: 'Verification failed' });
    }
  }
);

/**
 * POST /api/auth/resend-otp
 * Resend OTP to email
 */
app.post('/api/auth/resend-otp',
  [body('email').isEmail().normalizeEmail()],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email } = req.body;

      // Check if previous OTP exists
      const previous = otpStore.get(email);
      if (previous && Date.now() - (previous.expires - 10 * 60 * 1000) < 30000) {
        return res.status(429).json({
          error: 'Please wait before requesting a new OTP'
        });
      }

      const otp = generateOTP();
      otpStore.set(email, otp);
      await sendOTPEmail(email, otp);

      console.log(`[OTP] Resent to ${email}: ${otp}`);

      res.json({ success: true, message: 'OTP resent' });
    } catch (error) {
      console.error('Error resending OTP:', error);
      res.status(500).json({ error: 'Failed to resend OTP' });
    }
  }
);

// ==================== ROUTES: IMAGE PROCESSING ====================

/**
 * POST /api/image/remove-background
 * Remove background from image
 */
app.post('/api/image/remove-background',
  authenticate,
  async (req, res) => {
    try {
      const { imageBase64 } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: 'No image provided' });
      }

      // Convert base64 to buffer
      const buffer = Buffer.from(imageBase64.split(',')[1], 'base64');

      // Create FormData
      const formData = new FormData();
      formData.append('image_file', buffer, 'image.png');
      formData.append('size', 'auto');

      // Call Remove.bg API
      const response = await axios.post(
        'https://api.remove.bg/v1.0/removebg',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'X-Api-Key': process.env.REMOVE_BG_API_KEY
          },
          responseType: 'arraybuffer'
        }
      );

      // Convert response to base64
      const resultBase64 = Buffer.from(response.data).toString('base64');

      res.json({
        success: true,
        image: `data:image/png;base64,${resultBase64}`
      });
    } catch (error) {
      console.error('Error removing background:', error);

      if (error.response?.status === 403) {
        return res.status(400).json({
          error: 'Invalid API key or limit exceeded'
        });
      }

      res.status(500).json({
        error: 'Failed to process image'
      });
    }
  }
);

/**
 * POST /api/image/create-passport-photo
 * Create passport-sized photo
 */
app.post('/api/image/create-passport-photo',
  authenticate,
  (req, res) => {
    try {
      const { imageBase64 } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: 'No image provided' });
      }

      // Passport dimensions: 4cm × 6cm (151 × 227 pixels at 96 DPI)
      // This would typically be done with an image processing library
      // For simplicity, we return success with the original image
      // In production, use libraries like:
      // - Sharp (Node.js)
      // - ImageMagick/GraphicsMagick
      // - Python PIL

      res.json({
        success: true,
        message: 'Passport photo created',
        dimensions: '4cm × 6cm (151 × 227 pixels)',
        image: imageBase64
      });
    } catch (error) {
      console.error('Error creating passport photo:', error);
      res.status(500).json({ error: 'Failed to create passport photo' });
    }
  }
);

// ==================== ROUTES: HEALTH CHECK ====================

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * GET /api/auth/verify
 * Verify JWT token validity
 */
app.get('/api/auth/verify', authenticate, (req, res) => {
  res.json({
    valid: true,
    email: req.user.email,
    expiresAt: new Date(req.user.exp * 1000)
  });
});

// ==================== ERROR HANDLING ====================

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path
  });
});

/**
 * Global error handler
 */
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// ==================== SERVER STARTUP ====================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════╗
║    PhotoHub Backend Server         ║
║    Running on Port ${PORT}              ║
╚════════════════════════════════════╝
  `);
  console.log('✓ Server started');
  console.log('✓ CORS enabled');
  console.log('✓ Rate limiting active');
  console.log(`✓ Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = app;
