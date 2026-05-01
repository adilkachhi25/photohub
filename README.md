# PhotoHub - Background Remover & Passport Photo Creator

A modern web application for removing image backgrounds and creating passport-sized photos with email OTP authentication.

## 🎯 Features

### Authentication
- **Email-based Login**: Users sign up/login with their email address
- **OTP Verification**: Secure one-time password (OTP) sent to email
- **Session Management**: Persistent user sessions with logout functionality
- **Input Validation**: Email format validation and OTP verification

### Image Processing
- **Background Removal**: Remove backgrounds from photos automatically
- **Passport Photo Creation**: Convert images to standard passport dimensions (4cm × 6cm / 151 × 227 pixels at 96 DPI)
- **Image Preview**: Real-time preview of processed images
- **Download**: Export images in PNG format

### User Interface
- **Modern Design**: Gradient backgrounds, glassmorphism effects, and smooth animations
- **Responsive Layout**: Works on desktop and mobile devices
- **Intuitive Workflow**: Step-by-step process for image editing
- **Visual Feedback**: Loading states, error messages, and success confirmations

## 🚀 Quick Start

### Option 1: Run Locally (Recommended)

1. **Open in Browser**
   - Simply open the `index.html` file in your web browser
   - No server or installation required!
   - Works completely offline (except for background removal API)

2. **Using Live Server (VS Code)**
   ```bash
   # Install Live Server extension in VS Code
   # Right-click on index.html → "Open with Live Server"
   ```

3. **Using Python HTTP Server**
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Then open: http://localhost:8000
   ```

4. **Using Node.js http-server**
   ```bash
   npm install -g http-server
   http-server
   
   # Then open: http://localhost:8080
   ```

### Option 2: Deploy Online

**Netlify (Easiest)**
1. Create a [Netlify](https://netlify.com) account
2. Drag and drop `index.html` to deploy
3. Get a live URL instantly

**GitHub Pages**
1. Create a GitHub repository
2. Upload `index.html`
3. Enable GitHub Pages in settings
4. Access via `username.github.io/repository-name`

**Vercel**
1. Create a [Vercel](https://vercel.com) account
2. Import your repository or upload files
3. Auto-deployed with HTTPS

## 🔐 Authentication Flow

### Demo Mode (Current)
The app runs in demo mode with simulated OTP:
1. Enter any valid email address
2. Click "Send OTP"
3. OTP is displayed in the success message (e.g., "OTP sent! (Demo: 123456)")
4. Enter the OTP code shown
5. Access the dashboard

### Production Setup (Backend Required)

To implement real email sending, you'll need a backend server:

#### Using Node.js/Express + Nodemailer

```javascript
// backend/routes/auth.js
const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();

// Configure email service
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD // Use App Password for Gmail
  }
});

// Store OTPs (use Redis in production)
const otpStore = new Map();

router.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  
  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Store OTP with expiry (5 minutes)
  otpStore.set(email, { otp, expires: Date.now() + 5 * 60 * 1000 });
  
  // Send email
  try {
    await transporter.sendMail({
      to: email,
      subject: 'PhotoHub - Verify your email',
      html: `
        <h2>Email Verification</h2>
        <p>Your OTP is: <strong>${otp}</strong></p>
        <p>This code expires in 5 minutes.</p>
      `
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send email' });
  }
});

router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const stored = otpStore.get(email);
  
  if (!stored || stored.otp !== otp || stored.expires < Date.now()) {
    return res.status(401).json({ error: 'Invalid OTP' });
  }
  
  otpStore.delete(email);
  // Create JWT token
  const token = jwt.sign({ email }, process.env.JWT_SECRET);
  res.json({ success: true, token });
});

module.exports = router;
```

#### Update Frontend for Production

```javascript
// In the handleSendOtp function
const handleSendOtp = async (e) => {
  e.preventDefault();
  try {
    const response = await fetch('YOUR_API_URL/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (response.ok) {
      setIsOtpSent(true);
      setAuthStep('otp');
    }
  } catch (error) {
    setAuthError('Failed to send OTP');
  }
};
```

## 🎨 Background Removal API Integration

### Using Remove.bg API

The app is pre-configured to work with [remove.bg](https://remove.bg):

1. **Get API Key**
   - Visit [remove.bg](https://remove.bg/api)
   - Sign up for a free account (50 API calls/month)
   - Copy your API key

2. **Update the Code**
   ```javascript
   // In the handleRemoveBackground function
   const apiKey = 'YOUR_REMOVE_BG_API_KEY'; // Replace with your actual key
   
   const removeResponse = await fetch('https://api.remove.bg/v1.0/removebg', {
     method: 'POST',
     headers: {
       'X-Api-Key': apiKey,
     },
     body: formData,
   });
   ```

3. **Alternative APIs**
   - **Cloudinary**: Better for production (more reliable)
   - **Adobe Remove Background API**: Higher quality
   - **OpenAI Vision API**: Can remove backgrounds creatively

### Production Setup with Cloudinary

```javascript
const handleRemoveBackground = async () => {
  setIsProcessing(true);
  
  try {
    // Upload to Cloudinary
    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/image/upload`,
      {
        method: 'POST',
        body: formData
      }
    );
    
    const result = await cloudinaryResponse.json();
    
    // Use Cloudinary's built-in background removal
    const processedUrl = result.secure_url.replace(
      '/upload/',
      '/upload/e_background_removal/'
    );
    
    setProcessedImage(processedUrl);
  } catch (error) {
    setProcessingError('Failed to process image');
  } finally {
    setIsProcessing(false);
  }
};
```

## 📸 Passport Photo Specifications

The app creates passport photos with these specifications:

- **Dimensions**: 4cm × 6cm (standard international)
- **Resolution**: 151 × 227 pixels at 96 DPI
- **Format**: PNG with white background
- **Aspect Ratio**: 2:3 (portrait orientation)
- **Face Position**: Centered in frame
- **Background**: Pure white (#FFFFFF)

### Common Passport Photo Dimensions by Country:
- **USA/Canada**: 2×2 inches (51×51 mm)
- **UK/EU**: 35×45 mm (4×6 cm)
- **India**: 35×35 mm
- **Australia**: 35×45 mm
- **Japan**: 24×30 mm

You can customize dimensions by modifying this code:
```javascript
// Change these values for different sizes
canvas.width = 151;  // Change to desired width in pixels
canvas.height = 227; // Change to desired height in pixels
```

## 🛠️ Customization

### Change Color Scheme

Edit the gradient colors in `styles.dashboardPage`:

```javascript
dashboardPage: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)'
}
```

### Modify Button Styles

```javascript
buttonPrimary: {
    background: 'linear-gradient(135deg, #a855f7, #ec4899)', // Change gradient
    // ... other properties
}
```

### Add Features

Common additions:
- Image cropping before background removal
- Multiple image processing
- Batch processing
- Image filters
- Custom watermarks
- Download in different formats (JPG, WebP)

## 🔧 Dependencies

All dependencies are loaded from CDN:
- **React 18.2.0**: UI library
- **Babel**: JSX transpiler
- **Lucide Icons**: Icon library
- **No npm required!**

## 📱 Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Responsive design

## ⚙️ How It Works

### Image Processing Pipeline

1. **Upload**
   - User selects image
   - File is converted to base64 data URL
   - Preview is displayed

2. **Background Removal**
   - Image sent to Remove.bg API (with real API key)
   - Or simulated locally with canvas processing
   - Result displayed in preview

3. **Passport Photo Creation**
   - Original image loaded onto canvas
   - Canvas resized to 151×227 pixels
   - White background applied
   - Image centered and cropped to fit
   - Result converted to blob and displayed

4. **Download**
   - Image converted back to data URL
   - Download link created
   - File saved to user's device

## 🐛 Troubleshooting

### Images not uploading
- Check file size (max 10MB)
- Verify file is valid image format
- Check browser console for errors

### Background removal not working
- Ensure API key is valid (if using production API)
- Check internet connection
- In demo mode, it simulates the effect

### Can't download image
- Check browser's download settings
- Try different browser
- Ensure popup blockers are disabled

## 🚀 Performance Tips

1. **Image Optimization**: Compress images before upload
2. **Lazy Loading**: Load resources on demand
3. **Caching**: Browser caches processed images
4. **CDN**: All libraries loaded from CDN for speed

## 📄 License

This project is open source and available for personal and commercial use.

## 🤝 Contributing

To improve this project:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

For issues or questions:
- Check the troubleshooting section
- Review browser console for error messages
- Test with different images
- Try in incognito/private mode

## 🎓 Learning Resources

- [React Documentation](https://react.dev)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Remove.bg API Docs](https://www.remove.bg/api)
- [JavaScript File API](https://developer.mozilla.org/en-US/docs/Web/API/File)

---

**Built with ❤️ using React, Canvas, and modern web APIs**
