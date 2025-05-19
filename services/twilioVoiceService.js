require('dotenv').config({ path: './twilio.env' });
const twilio = require('twilio');
const VoiceResponse = require('twilio').twiml.VoiceResponse;

class TwilioVoiceService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID, 
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  async makeCall(toNumber) {
    try {
      const call = await this.client.calls.create({
        to: toNumber,
        from: process.env.TWILIO_PHONE_NUMBER,
        twiml: '<Response><Say>Halo, ini adalah panggilan otomatis dari sistem kami.</Say></Response>'
      });
      return call;
    } catch (error) {
      console.error('Gagal membuat panggilan:', error);
      throw error;
    }
  }

  handleIncomingCall(req, res) {
    const twiml = new VoiceResponse();
    twiml.say('Terima kasih telah menghubungi kami. Anda akan segera dilayani.');
    
    // Contoh: Redirect ke menu atau agent
    twiml.redirect('/voice/menu');
    
    res.type('text/xml');
    res.send(twiml.toString());
  }

  createMenuResponse() {
    const twiml = new VoiceResponse();
    
    // Contoh menu sederhana menggunakan Gather
    const gather = twiml.gather({
      numDigits: 1,
      action: '/voice/handle-menu',
      method: 'POST'
    });
    
    gather.say('Selamat datang di layanan kami. ' + 
               'Tekan 1 untuk informasi umum. ' + 
               'Tekan 2 untuk berbicara dengan operator.');
    
    // Jika tidak ada input, ulangi menu
    twiml.redirect('/voice/menu');
    
    return twiml;
  }

  handleMenuSelection(digits) {
    const twiml = new VoiceResponse();
    
    switch(digits) {
      case '1':
        twiml.say('Anda memilih informasi umum.');
        twiml.pause({ length: 1 });
        twiml.say('Silakan kunjungi website kami untuk informasi lebih lanjut.');
        break;
      case '2':
        twiml.say('Mohon tunggu, kami akan menghubungkan Anda dengan operator.');
        // Contoh: transfer ke nomor operator
        twiml.dial('+628123456789');
        break;
      default:
        twiml.say('Pilihan tidak valid.');
        twiml.redirect('/voice/menu');
    }
    
    return twiml;
  }
}

module.exports = new TwilioVoiceService(); 