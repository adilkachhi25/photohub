# API Configuration Guide

This guide explains how to set up all APIs and services required for production deployment.

## 1. Email Service Configuration

### Option A: Using Nodemailer with Gmail

**Step 1: Enable 2-Step Verification on Google Account**
- Go to [myaccount.google.com](https://myaccount.google.com)
- Navigate to Security settings
- Enable "2-Step Verification"

**Step 2: Generate App Password**
- Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
- Select "Mail" and "Windows Computer"
- Google will generate a 16-character password
- Copy this password

**Step 3: Set Environment Variables**
```bash
# .env file
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-password
```

**Step 4: Backend Configuration**
```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Send OTP email
async function sendOtpEmail(email, otp) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'PhotoHub - Your OTP Code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #a855f7, #ec4899); 
                    color: white; padding: 20px; border-radius: 8px; }
          .otp-box { background: #f5f5f5; padding: 20px; margin: 20px 0; 
                     border-radius: 8px; text-align: center; }
          .otp-code { font-size: 32px; font-weight: bold; color: #a855f7; 
                      letter-spacing: 5px; }
          .footer { color: #666; font-size: 12px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>PhotoHub</h1>
            <p>Email Verification</p>
          </div>
          
          <h2>Hello!</h2>
          <p>You requested a verification code to access PhotoHub.</p>
          
          <div class="otp-box">
            <p>Your verification code is:</p>
            <div class="otp-code">${otp}</div>
            <p style="color: #666; margin-top: 10px;">Valid for 10 minutes</p>
          </div>
          
          <p>If you didn't request this code, you can safely ignore this email.</p>
          
          <div class="footer">
            <p>PhotoHub © 2024 | All rights reserved</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  return transporter.sendMail(mailOptions);
}
```

### Option B: Using SendGrid

**Step 1: Create SendGrid Account**
- Sign up at [sendgrid.com](https://sendgrid.com)
- Verify sender email
- Create API key

**Step 2: Set Environment Variables**
```bash
# .env file
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

**Step 3: Backend Configuration**
```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendOtpEmail(email, otp) {
  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'PhotoHub - Your OTP Code',
    html: `<h1>Your OTP: <strong>${otp}</strong></h1><p>Valid for 10 minutes</p>`
  };

  return sgMail.send(msg);
}
```

### Option C: Using AWS SES

**Step 1: Set Up AWS Account**
- Create [AWS account](https://aws.amazon.com)
- Navigate to SES service
- Verify your email/domain
- Request production access

**Step 2: Create IAM Credentials**
- Generate Access Key and Secret Key
- Store in environment variables

**Step 3: Backend Configuration**
```javascript
const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1'
});

const ses = new AWS.SES({ apiVersion: '2010-12-01' });

async function sendOtpEmail(email, otp) {
  const params = {
    Source: 'noreply@yourdomain.com',
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: 'PhotoHub - Your OTP Code' },
      Body: { Html: { Data: `Your OTP: <strong>${otp}</strong>` } }
    }
  };

  return ses.sendEmail(params).promise();
}
```

## 2. Background Removal API Configuration

### Option A: Remove.bg API

**Step 1: Get API Key**
- Visit [remove.bg/api](https://www.remove.bg/api)
- Sign up for free account
- Copy API key from dashboard

**Step 2: Environment Variables**
```bash
# .env file
REMOVE_BG_API_KEY=your-api-key-here
```

**Step 3: Frontend Integration**
```javascript
const handleRemoveBackground = async (imageData) => {
  const formData = new FormData();
  formData.append('image_file', imageData);
  formData.append('size', 'auto');

  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: {
      'X-Api-Key': 'YOUR_API_KEY'
    },
    body: formData
  });

  return response.blob();
};
```

**Pricing (Remove.bg):**
- Free: 50 API calls/month
- Starter: $9.99/month (500 calls)
- Pro: $19.99/month (2000 calls)

### Option B: Cloudinary API

**Step 1: Create Cloudinary Account**
- Sign up at [cloudinary.com](https://cloudinary.com)
- Navigate to dashboard
- Copy Cloud Name and API Key

**Step 2: Environment Variables**
```bash
# .env file
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

**Step 3: Frontend Integration**
```javascript
const handleRemoveBackground = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'your-upload-preset');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/image/upload`,
    {
      method: 'POST',
      body: formData
    }
  );

  const result = await response.json();
  
  // Use Cloudinary's transformation for background removal
  const processedUrl = result.secure_url.replace(
    '/upload/',
    '/upload/e_background_removal:white/'
  );

  return processedUrl;
};
```

**Advantages:**
- Built-in background removal transformation
- Free tier: 25 monthly transformation credits
- Better performance for repeated processing
- CDN delivery included

### Option C: OpenAI Vision API

**Step 1: Get OpenAI API Key**
- Visit [platform.openai.com](https://platform.openai.com)
- Create API key
- Set usage limits and billing

**Step 2: Environment Variables**
```bash
# .env file
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
```

**Step 3: Backend Integration**
```javascript
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function removeBackgroundWithGPT(imageUrl) {
  const response = await openai.chat.completions.create({
    model: "gpt-4-vision-preview",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: imageUrl }
          },
          {
            type: "text",
            text: "Remove the background from this image and return just the subject on a white background."
          }
        ]
      }
    ]
  });

  return response.choices[0].message.content;
}
```

## 3. Database Configuration (Optional)

### MongoDB Atlas Setup

**Step 1: Create MongoDB Account**
- Sign up at [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
- Create a cluster (free tier available)
- Create database user

**Step 2: Get Connection String**
```bash
# .env file
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
```

**Step 3: Mongoose Configuration**
```javascript
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// User schema for storing OTP and user data
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  otp: String,
  otpExpiry: Date,
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
```

## 4. JWT Secret Configuration

**Generate a secure JWT secret:**

```bash
# Node.js command
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output example:
# 7f3c8e2a1b9d4f6c5e3a2b1d4f6c8e9a

# Add to .env
JWT_SECRET=7f3c8e2a1b9d4f6c5e3a2b1d4f6c8e9a
```

## 5. Environment Variables Template

Create a `.env` file in your project root:

```bash
# Email Service
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRY=7d

# Background Removal API (Choose one)
REMOVE_BG_API_KEY=your-remove-bg-key
# OR
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-key
CLOUDINARY_API_SECRET=your-cloudinary-secret
# OR
OPENAI_API_KEY=sk-your-openai-key

# Server Configuration
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
```

## 6. Security Best Practices

### 1. Protect API Keys
```javascript
// Use environment variables, never hardcode
const apiKey = process.env.API_KEY;

// Add to .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

### 2. Add CORS Configuration
```javascript
const cors = require('cors');

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));
```

### 3. Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 4. Validate Input
```javascript
const { body, validationResult } = require('express-validator');

router.post('/send-otp', [
  body('email').isEmail(),
  body('email').normalizeEmail()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // Process request
});
```

## 7. Deployment Checklist

- [ ] All API keys in environment variables
- [ ] CORS properly configured
- [ ] Database connection tested
- [ ] Email service tested
- [ ] Rate limiting enabled
- [ ] Input validation enabled
- [ ] HTTPS enabled
- [ ] SSL certificate valid
- [ ] Environment set to "production"
- [ ] Error logging configured
- [ ] Monitoring setup (Sentry, DataDog, etc.)

## 8. Testing APIs Locally

```bash
# Install Postman or use curl

# Test email sending
curl -X POST http://localhost:5000/api/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Test OTP verification
curl -X POST http://localhost:5000/api/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"123456"}'

# Test background removal
curl -X POST http://localhost:5000/api/remove-background \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@path/to/image.jpg"
```

---

For questions or issues with API setup, refer to the official documentation:
- [Remove.bg API](https://www.remove.bg/api)
- [Cloudinary API](https://cloudinary.com/documentation)
- [SendGrid API](https://docs.sendgrid.com)
- [AWS SES](https://docs.aws.amazon.com/ses)
- [OpenAI API](https://platform.openai.com/docs)
