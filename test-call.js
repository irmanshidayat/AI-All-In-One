// File untuk menguji endpoint voice-agent/call
require('dotenv').config();
const VoiceAgent = require('./models/VoiceAgent');
const { connectDB } = require('./config/database');

async function testCall() {
  try {
    // 1. Koneksi ke database
    console.log('Menghubungkan ke database...');
    await connectDB();
    console.log('Koneksi berhasil');
    
    // 2. Ambil ID kontak pertama dari database
    console.log('Mengambil kontak dari database...');
    const contacts = await VoiceAgent.getAllContacts();
    if (!contacts || contacts.length === 0) {
      console.error('Tidak ada kontak di database');
      process.exit(1);
    }
    const contactId = contacts[0].id;
    console.log(`Menggunakan kontak dengan ID: ${contactId}, Nama: ${contacts[0].name}`);
    
    // 3. Ambil ID konfigurasi pertama dari database
    console.log('Mengambil konfigurasi agent dari database...');
    const configs = await VoiceAgent.getAllConfigs();
    if (!configs || configs.length === 0) {
      console.error('Tidak ada konfigurasi agent di database');
      process.exit(1);
    }
    const configId = configs[0].id;
    console.log(`Menggunakan konfigurasi dengan ID: ${configId}, Nama: ${configs[0].name}`);
    
    // 4. Simpan panggilan ke database (simulasi endoint /voice-agent/call)
    console.log('Menyimpan data panggilan...');
    const call = await VoiceAgent.saveCall({
      contact_id: contactId,
      config_id: configId,
      twilio_sid: 'TEST-' + Date.now(),
      status: 'initiated',
      duration: 0
    });
    console.log('Data panggilan berhasil disimpan:', call);
    
    // 5. Simpan pesan percakapan awal
    console.log('Menyimpan pesan percakapan...');
    const greeting = configs[0].greeting_template.replace('[nama]', contacts[0].name);
    const conversation = await VoiceAgent.saveConversation({
      call_id: call.id,
      sender_type: 'agent',
      message_text: greeting,
      created_at: new Date()
    });
    console.log('Pesan percakapan berhasil disimpan:', conversation);
    
    console.log('\nTes berhasil! Proses yang sama dengan endpoint /voice-agent/call telah berhasil dijalankan.');
    process.exit(0);
  } catch (error) {
    console.error('\nTes gagal dengan error:', error);
    process.exit(1);
  }
}

testCall();