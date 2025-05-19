require('dotenv').config();
const http = require('http');
const ngrok = require('@ngrok/ngrok');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

let currentDisplayedUrl = null;
let ngrokListener = null;

// Create webserver
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('Selamat datang di Chatbot Dadan AI');
});

// Function to try available ports
async function findAvailablePort(startPort) {
    const tryPort = async (port) => {
        return new Promise((resolve, reject) => {
            server.listen(port)
                .once('listening', () => {
                    server.close(() => resolve(port));
                })
                .once('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        resolve(false);
                    } else {
                        reject(err);
                    }
                });
        });
    };

    // Try ports from startPort to startPort + 10
    for (let port = startPort; port < startPort + 10; port++) {
        const availablePort = await tryPort(port);
        if (availablePort) return availablePort;
    }
    throw new Error('No available ports found');
}

// Start server with available port
async function startServer() {
    try {
        const port = await findAvailablePort(3000);
        server.listen(port, () => {
            console.log(`Server berjalan di http://localhost:${port}`);
        });
        return port;
    } catch (err) {
        console.error('Error starting server:', err);
        process.exit(1);
    }
}

// Function to save URL to cache
function saveToCache(url) {
    if (url) {
        const cacheData = {
            url: url,
            timestamp: Date.now()
        };
        fs.writeFileSync('ngrok-cache.json', JSON.stringify(cacheData, null, 2));
    }
}

// Function to clear terminal
function clearTerminal() {
    process.stdout.write(process.platform === 'win32' ? '\x1Bc' : '\x1B[2J\x1B[3J\x1B[H');
}

// Function to display URL in terminal
function displayUrl(url) {
    clearTerminal();
    console.log('\x1b[36m%s\x1b[0m', '=== Chatbot Dadan AI - Ngrok Tunnel ===');
    console.log('\x1b[32m%s\x1b[0m', `Server berjalan di http://localhost:3000`);
    if (url) {
        console.log('\x1b[33m%s\x1b[0m', `Ngrok tunnel terbuka di: ${url}`);
    } else {
        console.log('\x1b[31m%s\x1b[0m', 'Ngrok tunnel tidak aktif.');
    }
    console.log('\x1b[36m%s\x1b[0m', '=====================================');
    currentDisplayedUrl = url;
}

// Function to get active ngrok URL with retries
async function getActiveNgrokUrl(retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get('http://127.0.0.1:4040/api/tunnels');
            const tunnels = response.data.tunnels;
            const httpsTunnel = tunnels.find(tunnel => tunnel.proto === 'https');
            if (httpsTunnel) {
                return httpsTunnel.public_url;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        } catch (error) {
            if (i === retries - 1) {
                return null;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return null;
}

// Function to check and update ngrok URL
async function checkAndUpdateNgrokUrl() {
    try {
        const activeUrl = await getActiveNgrokUrl();
        if (activeUrl && activeUrl !== currentDisplayedUrl) {
            console.log('\x1b[36m%s\x1b[0m', 'URL ngrok berubah, memperbarui tampilan...');
            saveToCache(activeUrl);
            displayUrl(activeUrl);
            
            // Emit event untuk notifikasi perubahan URL
            process.emit('ngrok-url-changed', activeUrl);
        }
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', 'Error checking ngrok URL:', error.message);
    }
}

// Function to start ngrok tunnel
async function startNgrok() {
    try {
        // Start server first and get the port
        const port = await startServer();
        
        // Check for existing ngrok tunnel first
        let initialUrl = await getActiveNgrokUrl();

        if (!initialUrl) {
            console.log('\x1b[36m%s\x1b[0m', 'Memulai tunnel ngrok baru...');
            ngrokListener = await ngrok.connect({
                addr: port,
                authtoken: process.env.AUTHTOKENS_NGROK,
                onStatusChange: async (status) => {
                    console.log('\x1b[36m%s\x1b[0m', `Status ngrok: ${status}`);
                    if (status === 'connected') {
                        await checkAndUpdateNgrokUrl();
                    } else if (status === 'disconnected') {
                        displayUrl(null);
                    }
                }
            });

            initialUrl = ngrokListener.url();
        } else {
            console.log('\x1b[33m%s\x1b[0m', 'Menggunakan tunnel ngrok yang sudah ada.');
        }

        // Set initial display
        saveToCache(initialUrl);
        displayUrl(initialUrl);

        // Set up more frequent URL checks with error handling
        const checkInterval = setInterval(async () => {
            try {
                await checkAndUpdateNgrokUrl();
            } catch (error) {
                console.error('\x1b[31m%s\x1b[0m', 'Error in URL check interval:', error.message);
            }
        }, 1000); // Check every second

        // Cleanup on process exit
        process.on('SIGINT', async () => {
            console.log('\nMenutup ngrok tunnel...');
            clearInterval(checkInterval);
            if (ngrokListener) {
                await ngrokListener.close();
            }
            await ngrok.kill();
            console.log('Ngrok tunnel ditutup.');
            process.exit(0);
        });

    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', 'Gagal memulai atau menghubungkan ke Ngrok:', error.message);
        displayUrl(null);
        // Still set up periodic check in case ngrok is started externally later
        setInterval(checkAndUpdateNgrokUrl, 1000);
    }
}

// Start the application
startNgrok();