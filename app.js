// Load environment variables from .env file
require('dotenv').config();
require('dotenv').config({ path: './twilio.env' });

const express = require('express');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const flash = require('connect-flash');

// Database Connection
const { connectDB } = require('./config/database');
const VoiceAgent = require('./models/VoiceAgentModels');

// Ngrok Service for automatic URL detection
const ngrokService = require('./services/ngrokService');

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Store active calls
const activeCallSessions = new Map();
// Store active call TwiML response objects to enable TTS during an active call
const activeCallTwiml = new Map();

// Konfigurasi CORS
app.use(cors({
  origin: [
    'http://localhost:3000',  // Contoh: frontend development
    'http://localhost:8080',  // Contoh: frontend development lain
    process.env.FRONTEND_URL  // URL frontend dari environment variable
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // <-- penting agar session/cookie dikirim!
}));

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join call room
  socket.on('join-call', (callId) => {
    socket.join(`call-${callId}`);
    console.log(`Socket ${socket.id} joined call ${callId}`);
  });

  // Handle user message
  socket.on('user-message', async (data) => {
    const { callId, message } = data;
    const roomId = `call-${callId}`;
    
    try {
      // Save to database
      await VoiceAgent.saveConversation({
        call_id: callId,
        sender_type: 'user',
        message_text: message,
        created_at: new Date()
      });

      // Broadcast message to all in room
      io.to(roomId).emit('message', {
        type: 'user',
        text: message,
        time: new Date(),
        callId
      });

    } catch (error) {
      console.error('Error saving user message:', error);
    }
  });

  // Handle agent message
  socket.on('agent-message', async (data) => {
    const { callId, message } = data;
    const roomId = `call-${callId}`;
    
    try {
      // Save to database
      await VoiceAgent.saveConversation({
        call_id: callId,
        sender_type: 'agent',
        message_text: message,
        created_at: new Date()
      });

      // Broadcast message to all in room
      io.to(roomId).emit('message', {
        type: 'agent',
        text: message,
        time: new Date(),
        callId
      });

    } catch (error) {
      console.error('Error saving agent message:', error);
    }
  });

  // Handle TTS on call
  socket.on('play-tts-on-call', async (data) => {
    const { callId, message } = data;
    
    try {
      console.log(`Receiving TTS request for call ${callId}: "${message}"`);
      
      // Get the database call record from the Twilio Call SID
      const callRecord = await VoiceAgent.getCallBySid(callId);
      
      if (!callRecord) {
        console.log(`No call record found for SID: ${callId}, trying as direct ID`);
        
        // If not found and it's numeric, try using it directly as ID
        if (!isNaN(callId)) {
          await VoiceAgent.saveConversation({
            call_id: callId,
            sender_type: 'agent',
            message_text: message,
            created_at: new Date()
          });
        } else {
          console.error(`Cannot save conversation: Call ID ${callId} not found in database`);
          return;
        }
      } else {
        // Save conversation using database ID
        await VoiceAgent.saveConversation({
          call_id: callRecord.id,  // Use internal database ID
          sender_type: 'agent',
          message_text: message,
          created_at: new Date()
        });
      }
      
      // Initialize VoiceAgent to access Twilio client - always use the original callId for Twilio
      const voiceAgent = new VoiceAgent();
      
      // Send TTS to the call using Twilio's TwiML
      const result = await voiceAgent.sendTtsToCall(callId, message);
      
      if (result.success) {
        console.log(`TTS sent to call ${callId} successfully`);
      } else {
        console.error(`Failed to send TTS to call ${callId}: ${result.error}`);
      }
    } catch (error) {
      console.error('Error sending TTS to call:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'voice-call-secret-key',
  resave: true,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 100 * 365 * 24 * 60 * 60 * 1000, // 100 years
    sameSite: 'lax'
  },
  name: 'sessionId' // Change default connect.sid to something less obvious
}));

// Add session debugging middleware
app.use((req, res, next) => {
  console.log('Session state:', {
    isLoggedIn: req.session.isLoggedIn,
    userId: req.session.userId,
    hasUser: !!req.session.user
  });
  next();
});

// Konfigurasi connect-flash
app.use(flash());

// Middleware to pass API keys to front-end
app.use((req, res, next) => {
  res.locals.twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  res.locals.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  res.locals.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
  res.locals.openrouterApiKey = process.env.OPENROUTER_API_KEY;
  res.locals.openrouterApiUrl = process.env.OPENROUTER_API_URL;
  next();
});

// Global middleware for flash messages
app.use((req, res, next) => {
  res.locals.error = req.flash('error');
  res.locals.success = req.flash('success');
  res.locals.message = req.flash('message');
  next();
});

// Middleware untuk menangani kesalahan parsing JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid JSON payload' 
    });
  }
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboardRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const researchRoutes = require('./routes/researchRoutes');
const skripsiRoutes = require('./routes/skripsiRoutes');
const videoStreamingRoutes = require('./routes/video-streamingRoutes');

app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes); 
app.use('/voice', voiceRoutes);
app.use('/dashboard/research', researchRoutes);
app.use('/dashboard/skripsi', skripsiRoutes);
app.use('/dashboard/video-streaming', videoStreamingRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Application error:', err);
  res.status(500).render('500', { 
    title: 'Server Error',
    message: 'Terjadi kesalahan pada server'
  });
});

// Connect to MySQL and start server
const PORT = process.env.PORT || 3000;
const ALTERNATIVE_PORTS = [3001, 3002, 3003, 3004];

// Improved approach: Connect to database before starting server
(async function startServer() {
  try {
    // Connect to database first
    await connectDB();
    console.log('Database connected successfully');

    // Setup ngrok URL update listener
    ngrokService.on('url-updated', (newUrl) => {
      if (newUrl && newUrl !== process.env.BASE_URL) {
        console.log('Ngrok URL updated:', newUrl);
        process.env.BASE_URL = newUrl;
        // Emit event untuk komponen yang perlu tahu tentang perubahan URL
        io.emit('base-url-changed', newUrl);
      }
    });

    // Initial ngrok URL setup
    try {
      const ngrokUrl = await ngrokService.getPublicUrl();
      console.log(`Detected ngrok URL: ${ngrokUrl}`);
      
      // Set BASE_URL environment variable
      process.env.BASE_URL = ngrokUrl;
      
      // Start periodic URL check
      setInterval(async () => {
        try {
          const currentUrl = await ngrokService.getPublicUrl();
          if (currentUrl && currentUrl !== process.env.BASE_URL) {
            process.env.BASE_URL = currentUrl;
            console.log('BASE_URL updated to:', currentUrl);
            io.emit('base-url-changed', currentUrl);
          }
        } catch (error) {
          console.warn('Error checking ngrok URL:', error.message);
        }
      }, 5000); // Check every 5 seconds
      
      console.log('Initial BASE_URL set to:', process.env.BASE_URL);
    } catch (ngrokError) {
      console.warn('Failed to detect initial ngrok URL:', ngrokError.message);
      console.warn('Using default BASE_URL:', process.env.BASE_URL || 'http://localhost:' + PORT);
    }
    
    // Make ngrok service available in app
    app.set('ngrokService', ngrokService);
    
    // Function to attempt starting server on a port
    const attemptListen = (port, remainingPorts = []) => {
      server.listen(port)
        .on('listening', () => {
          console.log(`Server running on port ${port}`);
          console.log(`Local URL: http://localhost:${port}`);
          console.log(`Public URL: ${process.env.BASE_URL}`);
        })
        .on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} is busy, trying next port...`);
            if (remainingPorts.length > 0) {
              const nextPort = remainingPorts.shift();
              attemptListen(nextPort, remainingPorts);
            } else {
              console.error('All ports are busy. Please close some applications or specify a different port.');
              process.exit(1);
            }
          } else {
            console.error('Server error:', err);
            process.exit(1);
          }
        });
    };
    
    // Try the main port first, then alternatives if needed
    attemptListen(PORT, ALTERNATIVE_PORTS);
    
  } catch (err) {
    console.error('Failed to connect to database:', err);
    console.log('Application will start with limited functionality.');
    
    // Start the server anyway, but some features may not work
    attemptListen(PORT, ALTERNATIVE_PORTS);
  }
})();

module.exports = app;