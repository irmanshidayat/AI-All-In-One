const Skripsi = require('../models/SkripsiModels');
const axios = require('axios');

// Load API credentials from environment variables with fallback values
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'fallback_key_for_development';
const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1';

// Debug mode untuk membantu troubleshooting
const DEBUG = true;

// Response caching to reduce API calls
const responseCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Daftar model yang tersedia di OpenRouter, akan digunakan sebagai fallback
const AVAILABLE_MODELS = [
  // Top-tier models (highest capability)
  'anthropic/claude-3-opus',
  'anthropic/claude-3-sonnet',
  'anthropic/claude-3-haiku',
  'google/gemini-pro',
  'google/palm-2-chat-bison',
  'meta-llama/llama-2-70b-chat',
  'mistralai/mixtral-8x7b-instruct',
  'mistralai/mistral-medium',
  'openai/gpt-4-turbo-preview',
  'openai/gpt-4',
  'openai/gpt-3.5-turbo'
];

// Fallback content untuk digunakan ketika API gagal
const getFallbackResponse = (type, title) => {
  switch(type) {
    case 'title':
      return `# Ide Judul Skripsi tentang ${title}\n\n1. "Analisis Pengaruh ${title} terhadap Perilaku Konsumen: Studi Kasus pada Generasi Z di Indonesia"\n\n2. "Optimalisasi Strategi ${title} untuk Peningkatan Engagement: Pendekatan Multi-Platform"\n\n3. "Transformasi Digital melalui ${title}: Tantangan dan Peluang bagi UMKM di Era Post-Pandemic"`;
    case 'bab1':
    case 'latar-belakang':
    case 'latar-belakang-lengkap':
      return `# Latar Belakang\n\nPenelitian tentang "${title}" menjadi sangat relevan di era digital saat ini. Perkembangan teknologi telah mengubah cara masyarakat berinteraksi, berkomunikasi, dan melakukan aktivitas sehari-hari. Fenomena ini menimbulkan berbagai dampak baik positif maupun negatif yang perlu dikaji secara komprehensif.\n\nDalam beberapa tahun terakhir, studi mengenai topik ini telah menarik perhatian banyak akademisi dan praktisi. Namun, masih terdapat kesenjangan penelitian yang perlu diisi, terutama dalam konteks Indonesia dengan keberagaman sosial budayanya.\n\nPenelitian ini bertujuan untuk menganalisis dan memberikan kontribusi pengetahuan baru dalam bidang tersebut, dengan harapan dapat memberikan manfaat praktis bagi berbagai pemangku kepentingan.`;
    default:
      return `# Konten untuk ${type} tentang "${title}"\n\nMaaf, koneksi ke AI tidak tersedia saat ini. Ini adalah konten template yang dapat Anda edit sesuai kebutuhan.\n\nBeberapa poin yang biasanya perlu dipertimbangkan:\n\n1. Latar belakang dan konteks penelitian\n2. Signifikansi dan relevansi topik\n3. Tujuan dan manfaat penelitian\n4. Metodologi dan pendekatan yang digunakan\n5. Hasil yang diharapkan dan implikasi`;
  }
};

/**
 * Fungsi untuk mencoba beberapa model AI secara bergantian sampai berhasil
 */
const tryModelsWithFallback = async (prompt, initialModel = null) => {
  // Cache check logic
  const cacheKey = prompt.substring(0, 100);
  if (responseCache.has(cacheKey)) {
    const cachedData = responseCache.get(cacheKey);
    if (Date.now() - cachedData.timestamp < CACHE_TTL) {
      if (DEBUG) console.log('Returning cached response for prompt');
      return cachedData.response;
    } else {
      responseCache.delete(cacheKey);
    }
  }

  let modelsToTry = [...AVAILABLE_MODELS];
  if (initialModel && !modelsToTry.includes(initialModel)) {
    modelsToTry.unshift(initialModel);
  }
  modelsToTry = [...new Set(modelsToTry)];

  let lastError = null;
  
  for (const model of modelsToTry) {
    try {
      if (DEBUG) console.log(`Trying model: ${model}`);
      
      const requestBody = {
        model: model,
        messages: [
          {
            role: "system",
            content: "You are an academic writing assistant that provides guidance in formal academic Indonesian language."
          },
          { 
            role: "user", 
            content: prompt 
          }
        ],
        max_tokens: 1500, // Reduced from 3000
        temperature: 0.7,
        stream: false
      };      const response = await axios.post(`${OPENROUTER_API_URL}/chat/completions`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-Title': 'Skripsi Generator',
          'OpenAI-Organization': 'skripsi-generator'
        },
        timeout: 60000, // 60 seconds timeout
        retry: 3,
        retryDelay: 2000
      });

      if (DEBUG) console.log(`Success with model: ${model}`);
      
      responseCache.set(cacheKey, {
        response: response,
        timestamp: Date.now()
      });
      
      return response;
    } catch (error) {      lastError = error;
      if (DEBUG) {
        console.error(`Failed with model ${model}:`, error.message);
        if (error.response) {
          console.error('Response Status:', error.response.status);
          console.error('Response Headers:', error.response.headers);
          console.error('Response Data:', error.response.data);
        }
        if (error.request) {
          console.error('Request Config:', error.request._options);
        }
      }
      
      // If it's a rate limit or auth error, break the loop
      if (error.response && (error.response.status === 429 || error.response.status === 401)) {
        console.error('Breaking model loop due to rate limit or auth error');
        break;
      }
      
      continue;
    }
  }

  // Fallback response logic
  if (DEBUG) console.log('All models failed, returning fallback response');
  
  const type = prompt.toLowerCase().includes('judul') ? 'title' : 
               prompt.toLowerCase().includes('latar belakang') ? 'latar-belakang' :
               'general';
  
  const titleMatch = prompt.match(/judul "(.*?)"/i) || prompt.match(/topik "(.*?)"/i);
  const title = titleMatch ? titleMatch[1] : 'penelitian';
  
  const fallbackContent = getFallbackResponse(type, title);
  
  return {
    data: {
      id: 'fallback-response',
      object: 'chat.completion',
      created: Date.now(),
      model: 'fallback-model',
      choices: [
        {
          message: {
            role: 'assistant',
            content: fallbackContent
          }
        }
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    }
  };
};

/**
 * Fungsi untuk mengekstrak konten dari respons API
 * @param {Object} response - Response dari OpenRouter API
 * @returns {string} - Extracted content
 */
const extractContentFromResponse = (response) => {
  if (!response || !response.data) {
    throw new Error('Format respons API tidak valid');
  }

  // Log response untuk debugging
  if (DEBUG) console.log('Response structure:', JSON.stringify(response.data, null, 2));

  let content = '';

  if (response.data.choices && response.data.choices.length > 0 && response.data.choices[0].message) {
    content = response.data.choices[0].message.content;
  } else if (response.data.choices && response.data.choices.length > 0 && response.data.choices[0].text) {
    content = response.data.choices[0].text;
  } else if (response.data.output) {
    content = response.data.output;
  } else if (response.data.completion) {
    content = response.data.completion;
  } else if (response.data.message) {
    content = response.data.message;
  } else if (response.data.result) {
    content = response.data.result;
  } else if (response.data.response) {
    content = response.data.response;
  } else if (response.data.text) {
    content = response.data.text;
  } else if (typeof response.data === 'string') {
    content = response.data;
  } else {
    // Fallback: ambil string pertama yang ditemukan
    const firstString = Object.values(response.data).find(v => typeof v === 'string');
    if (firstString) {
      content = firstString;
    } else {
      throw new Error('Format respons dari API tidak sesuai yang diharapkan');
    }
  }

  return content;
};

// Chat consultation handler
async function generateConsultResponse(message, role = 'dosen', knowledgeBase = 'skripsi') {
  let systemPrompt = '';
  
  // Set role-specific prompt
  switch(role) {
      case 'dosen':
          systemPrompt = 'Anda adalah dosen pembimbing skripsi yang berpengalaman. Berikan saran dan masukan yang konstruktif dengan bahasa formal akademis.';
          break;
      case 'metodolog':
          systemPrompt = 'Anda adalah ahli metodologi penelitian. Fokus pada memberikan saran terkait metode, teknik pengumpulan data, dan analisis.';
          break;
      case 'reviewer':
          systemPrompt = 'Anda adalah reviewer skripsi. Berikan feedback kritis namun membangun terkait konten dan struktur penulisan.';
          break;
      default:
          systemPrompt = 'Anda adalah asisten penulisan skripsi yang membantu mahasiswa dengan saran yang praktis dan konstruktif.';
  }

  // Add knowledge base context
  switch(knowledgeBase) {
      case 'metodologi':
          systemPrompt += '\nFokus pada aspek metodologi penelitian, termasuk pendekatan, metode, teknik pengumpulan dan analisis data.';
          break;
      case 'teori':
          systemPrompt += '\nFokus pada aspek teoritis, kerangka pemikiran, dan landasan konseptual penelitian.';
          break;
      case 'analisis':
          systemPrompt += '\nFokus pada aspek analisis data, interpretasi hasil, dan pembahasan temuan penelitian.';
          break;
      case 'referensi':
          systemPrompt += '\nFokus pada penggunaan referensi, sitasi, dan penulisan daftar pustaka.';
          break;
      default:
          systemPrompt += '\nBerikan panduan umum terkait penulisan skripsi yang baik dan benar.';
  }

  try {
      // Prepare chat messages
      const messages = [
          {
              role: 'system',
              content: systemPrompt
          },
          {
              role: 'user',
              content: message
          }
      ];

      const response = await tryModelsWithFallback(messages[1].content);
      const content = extractContentFromResponse(response);

      return {
          success: true,
          data: content
      };
  } catch (error) {
      console.error('Error generating consultation response:', error);
      return {
          success: false,
          message: 'Gagal memproses konsultasi: ' + (error.message || 'Unknown error')
      };
  }
}

const skripsiController = {
  // Display skripsi dashboard page
  getSkripsiPage: async (req, res) => {
    try {
      // Periksa apakah user tersedia dari session
      const userId = req.session.userId || (req.user ? req.user.id : null);
      
      if (!userId) {
        return res.render('dashboard/skripsi', {
          title: 'Buat Skripsi',
          path: '/dashboard/skripsi',
          user: null,
          skripsiList: [],
          message: req.flash('message'),
          error: req.flash('error'),
          openrouterApiKey: OPENROUTER_API_KEY,
          openrouterApiUrl: OPENROUTER_API_URL
        });
      }
      
      const userSkripsi = await Skripsi.getByUserId(userId);
      
      res.render('dashboard/skripsi', {
        title: 'Buat Skripsi',
        path: '/dashboard/skripsi',
        user: { id: userId },
        skripsiList: userSkripsi || [],
        message: req.flash('message'),
        error: req.flash('error'),
        openrouterApiKey: OPENROUTER_API_KEY,
        openrouterApiUrl: OPENROUTER_API_URL
      });
    } catch (error) {
      console.error('Error fetching skripsi page:', error);
      
      // Gunakan flash untuk menyimpan pesan error
      req.flash('error', 'Gagal memuat halaman skripsi');
      res.redirect('/dashboard');
    }
  },

  // Generate skripsi title based on topic
  generateTitle: async (req, res) => {
    try {
      const { topic } = req.body;
      
      if (!topic) {
        return res.status(400).json({
          success: false,
          message: 'Topik tidak boleh kosong'
        });
      }

      if (DEBUG) console.log('Generating title for topic:', topic);
      
      const prompt = `Berikan 3 ide judul skripsi akademik yang baik dan menarik tentang topik "${topic}". Format judul sebaiknya sesuai kaidah akademik dengan format "Judul Utama: Subjudul". Berikan juga penjelasan singkat mengapa judul tersebut baik untuk penelitian skripsi.`;
      
      // Menggunakan metode fallback untuk mencoba beberapa model
      const response = await tryModelsWithFallback(prompt);
      
      // Ekstrak konten dari respons
      const content = extractContentFromResponse(response);
      
      return res.status(200).json({
        success: true,
        data: content
      });
    } catch (error) {
      console.error('Error generating title:', error);
      
      // Menampilkan detail error untuk membantu debugging
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
      }
      
      return res.status(500).json({
        success: false,
        message: 'Gagal membuat judul skripsi: ' + (error.message || 'Unknown error')
      });
    }
  },

  // Improve skripsi title
  improveTitle: async (req, res) => {
    try {
      const { title } = req.body;
      
      if (!title) {
        return res.status(400).json({
          success: false,
          message: 'Judul tidak boleh kosong'
        });
      }

      if (DEBUG) console.log('Improving title:', title);

      const prompt = `Tolong perbaiki judul skripsi berikut agar lebih akademis, presisi, dan menarik: "${title}". Berikan penjelasan mengapa perbaikan tersebut dilakukan dan apa kelebihan dari judul yang sudah diperbaiki.`;

      // Menggunakan metode fallback untuk mencoba beberapa model
      const response = await tryModelsWithFallback(prompt);
      
      // Ekstrak konten dari respons
      const content = extractContentFromResponse(response);
      
      return res.status(200).json({
        success: true,
        data: content
      });
    } catch (error) {
      console.error('Error improving title:', error);
      
      // Menampilkan detail error untuk membantu debugging
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
      }
      
      return res.status(500).json({
        success: false,
        message: 'Gagal memperbaiki judul skripsi: ' + (error.message || 'Unknown error')
      });
    }
  },

  // Generate chapter content
  generateChapter: async (req, res) => {
    try {
      const { title, chapter, section, prompt, additionalInfo } = req.body;
      
      if (!title || !chapter || !section) {
        return res.status(400).json({
          success: false,
          message: 'Judul, bab, dan bagian tidak boleh kosong'
        });
      }

      // Get sequence number for this section
      const sequenceMap = Skripsi.getChapterSequenceMap();
      const sequence = sequenceMap[chapter]?.[section] || 0;

      let finalPrompt;
      if (prompt) {
        finalPrompt = prompt;
        if (additionalInfo && additionalInfo.trim() !== '') {
          finalPrompt += `\n\nInformasi Tambahan: ${additionalInfo.trim()}`;
        }
      } else {
        let basePrompt = '';
        switch (`${chapter}-${section}`) {
          case 'bab1-latar-belakang':
            finalPrompt = `Buatkan Latar Belakang yang komprehensif untuk skripsi dengan judul "${title}". Uraikan dengan bahasa akademis yang baik.`;
            break;
          case 'bab1-rumusan-masalah':
            finalPrompt = `Buatkan Rumusan Masalah yang jelas dan terukur untuk skripsi dengan judul "${title}". Format dalam poin-poin yang sistematis.`;
            break;
          case 'bab1-tujuan-penelitian':
            finalPrompt = `Buatkan Tujuan Penelitian yang spesifik untuk skripsi dengan judul "${title}". Sesuaikan dengan rumusan masalah.`;
            break;
          case 'bab1-manfaat-penelitian':
            finalPrompt = `Buatkan Manfaat Penelitian (teoritis dan praktis) untuk skripsi dengan judul "${title}".`;
            break;
          case 'bab2-landasan-teori':
            finalPrompt = `Buatkan Landasan Teori yang komprehensif untuk skripsi dengan judul "${title}". Fokus pada teori-teori utama yang relevan.`;
            break;
          case 'bab2-tinjauan-pustaka':
            finalPrompt = `Buatkan Tinjauan Pustaka yang sistematis untuk skripsi dengan judul "${title}". Sertakan sumber-sumber terkini.`;
            break;
          case 'bab2-penelitian-terdahulu':
            finalPrompt = `Buatkan review Penelitian Terdahulu yang relevan dengan skripsi berjudul "${title}". Minimal 5 penelitian dalam 5 tahun terakhir.`;
            break;
          case 'bab2-kerangka-pemikiran':
            finalPrompt = `Buatkan Kerangka Pemikiran yang logis untuk skripsi dengan judul "${title}". Jelaskan alur pemikiran penelitian.`;
            break;
          case 'bab2-hipotesis':
            finalPrompt = `Buatkan Hipotesis penelitian yang testable untuk skripsi dengan judul "${title}". Format dalam poin-poin yang jelas.`;
            break;
          case 'bab3-jenis-penelitian':
            finalPrompt = `Tentukan dan jelaskan Jenis Penelitian yang tepat untuk skripsi dengan judul "${title}". Sertakan alasan pemilihan metode.`;
            break;
          case 'bab3-populasi-sampel':
            finalPrompt = `Jelaskan Populasi dan Teknik Sampling yang sesuai untuk skripsi dengan judul "${title}". Sertakan perhitungan sampel jika relevan.`;
            break;
          case 'bab3-teknik-pengumpulan':
            finalPrompt = `Jelaskan Teknik Pengumpulan Data yang akan digunakan dalam skripsi "${title}". Sertakan instrumen penelitian.`;
            break;
          case 'bab3-teknik-analisis':
            finalPrompt = `Jelaskan Teknik Analisis Data yang akan digunakan dalam skripsi "${title}". Sertakan metode statistik jika relevan.`;
            break;
          case 'bab3-variabel-penelitian':
            finalPrompt = `Definisikan Variabel Penelitian untuk skripsi "${title}". Sertakan definisi operasional dan indikator pengukuran.`;
            break;
          case 'bab4-hasil-penelitian':
            finalPrompt = `Buatkan contoh format Hasil Penelitian untuk skripsi "${title}". Fokus pada penyajian data yang sistematis.`;
            break;
          case 'bab4-analisis-data':
            finalPrompt = `Buatkan contoh Analisis Data untuk skripsi "${title}". Sertakan metode analisis yang sesuai.`;
            break;
          case 'bab4-pembahasan':
            finalPrompt = `Buatkan format Pembahasan untuk skripsi "${title}". Jelaskan kaitan dengan teori dan penelitian terdahulu.`;
            break;
          case 'bab4-interpretasi':
            finalPrompt = `Buatkan Interpretasi hasil penelitian untuk skripsi "${title}". Jelaskan makna temuan penelitian.`;
            break;
          case 'bab5-kesimpulan':
            finalPrompt = `Buatkan format Kesimpulan untuk skripsi "${title}". Pastikan menjawab semua rumusan masalah.`;
            break;
          case 'bab5-saran':
            finalPrompt = `Buatkan Saran yang konstruktif untuk skripsi "${title}". Bagi dalam saran teoritis dan praktis.`;
            break;
          case 'bab5-rekomendasi':
            finalPrompt = `Buatkan Rekomendasi untuk penelitian selanjutnya terkait skripsi "${title}".`;
            break;
          case 'bab5-keterbatasan':
            finalPrompt = `Identifikasi Keterbatasan Penelitian dalam skripsi "${title}". Jelaskan implikasinya.`;
            break;
          default:
            basePrompt = `Buatkan konten untuk bagian "${section}" dari BAB "${chapter}" untuk skripsi dengan judul "${title}".`;
            if (additionalInfo && additionalInfo.trim() !== '') {
              basePrompt += `\n\nPertimbangkan informasi tambahan berikut: ${additionalInfo.trim()}`;
            }
            finalPrompt = basePrompt;
            if (!finalPrompt || section === 'unknown-section' || section.includes('unknown-') || section === `${chapter}-full` ){
              if(!prompt) {
                console.warn(`Warning: Generic or unknown section '${section}' for chapter '${chapter}' with no user prompt.`);
              }
            }
            break;
        }
        if (!prompt && finalPrompt && additionalInfo && additionalInfo.trim() !== '') {
          finalPrompt += `\n\nSertakan informasi tambahan berikut dalam pembuatan konten: ${additionalInfo.trim()}`;
        }
      }

      if (!finalPrompt || finalPrompt.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Prompt tidak dapat dibuat. Pastikan bab, bagian, dan judul valid.'
        });
      }

      // Menggunakan metode fallback untuk mencoba beberapa model
      const response = await tryModelsWithFallback(finalPrompt);
      
      if (!response || !response.data) {
        throw new Error('Respons dari OpenRouter kosong atau tidak valid');
      }

      // Ekstrak konten dari respons
      const content = extractContentFromResponse(response);

      if (!content) {
        return res.status(500).json({
          success: false,
          message: 'Gagal memproses respons dari OpenRouter'
        });
      }

      // Save to database if user is logged in
      let savedId = null;
      if (req.user) {
        savedId = await Skripsi.create(
          req.user.id, 
          title,
          chapter,
          section,
          content,
          sequence
        );
      }

      return res.status(200).json({
        success: true,
        data: content,
        savedId
      });

    } catch (error) {
      console.error('Error generating chapter:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal membuat konten skripsi: ' + (error.message || 'Unknown error')
      });
    }
},

  // AI consultation
  consultWithAI: async (req, res) => {
    try {
      const { question, title, context } = req.body;
      
      if (!question) {
        return res.status(400).json({
          success: false,
          message: 'Pertanyaan tidak boleh kosong'
        });
      }

      const prompt = `Sebagai Dosen pembimbing skripsi yang ahli, tolong bantu menjawab pertanyaan berikut tentang skripsi${title ? ' dengan judul "' + title + '"' : ''}: "${question}" ${context ? 'Konteks tambahan: ' + context : ''}. Berikan saran yang konstruktif dan akademis.`;

      // Menggunakan metode fallback untuk mencoba beberapa model
      const response = await tryModelsWithFallback(prompt);
      
      // Ekstrak konten dari respons
      const content = extractContentFromResponse(response);
      
      return res.status(200).json({
        success: true,
        data: content
      });
    } catch (error) {
      console.error('Error consulting with AI:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal berkonsultasi dengan Dosen AI: ' + (error.message || 'Unknown error')
      });
    }
  },

  // Save skripsi draft
  saveSkripsi: async (req, res) => {
    try {
      const userId = req.user.id;
      const { title, type, content } = req.body;
      
      if (!title || !type || !content) {
        return res.status(400).json({
          success: false,
          message: 'Semua bidang harus diisi'
        });
      }

      const skripsiId = await Skripsi.create(userId, title, type, content);
      
      return res.status(200).json({
        success: true,
        message: 'Skripsi berhasil disimpan',
        skripsiId
      });
    } catch (error) {
      console.error('Error saving skripsi:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal menyimpan skripsi'
      });
    }
  },

  // Get skripsi by ID
  getSkripsiById: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const skripsi = await Skripsi.getById(id);
      
      if (!skripsi || skripsi.user_id !== userId) {
        return res.status(404).json({
          success: false,
          message: 'Skripsi tidak ditemukan'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: skripsi
      });
    } catch (error) {
      console.error('Error fetching skripsi:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil data skripsi'
      });
    }
  },

  // Get list of skripsi
  getSkripsiList: async (req, res) => {
    try {
        const userId = req.user.id;
        const skripsiList = await Skripsi.getByUserId(userId);
        
        return res.status(200).json({
            success: true,
            data: skripsiList
        });
    } catch (error) {
        console.error('Error fetching skripsi list:', error);
        return res.status(500).json({
            success: false,
            message: 'Gagal mengambil daftar skripsi'
        });
    }
  },

  // Update skripsi
  updateSkripsi: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { title, type, content, status } = req.body;
      
      // Check if skripsi exists and belongs to user
      const skripsi = await Skripsi.getById(id);
      if (!skripsi || skripsi.user_id !== userId) {
        return res.status(404).json({
          success: false,
          message: 'Skripsi tidak ditemukan atau akses ditolak'
        });
      }
      
      const updated = await Skripsi.update(id, {
        title,
        type,
        content,
        status: status || 'draft'
      });
      
      if (!updated) {
        return res.status(500).json({
          success: false,
          message: 'Gagal memperbarui skripsi'
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Skripsi berhasil diperbarui'
      });
    } catch (error) {
      console.error('Error updating skripsi:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal memperbarui skripsi'
      });
    }
  },

  // Delete skripsi
  deleteSkripsi: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Check if skripsi exists and belongs to user
      const skripsi = await Skripsi.getById(id);
      if (!skripsi || skripsi.user_id !== userId) {
        return res.status(404).json({
          success: false,
          message: 'Skripsi tidak ditemukan atau akses ditolak'
        });
      }
      
      const deleted = await Skripsi.delete(id);
      
      if (!deleted) {
        return res.status(500).json({
          success: false,
          message: 'Gagal menghapus skripsi'
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Skripsi berhasil dihapus'
      });
    } catch (error) {
      console.error('Error deleting skripsi:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal menghapus skripsi'
      });
    }
  },

  // Upload reference file handler
  uploadReference: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Tidak ada file yang diunggah'
        });
      }
  
      // Store file info in session
      if (!req.session.references) {
        req.session.references = [];
      }
  
      // Keep only last 10 references
      if (req.session.references.length >= 10) {
        req.session.references.shift();
      }
  
      // Add new reference
      const fileInfo = {
        originalName: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype,
        uploadedAt: new Date()
      };
  
      req.session.references.push(fileInfo);
  
      return res.status(200).json({
        success: true,
        message: 'File berhasil diunggah',
        fileInfo: fileInfo
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengunggah file: ' + error.message
      });
    }
  },
  
  // Get references list handler
  getReferences: async (req, res) => {
    try {
      const references = req.session.references || [];
      return res.status(200).json({
        success: true,
        data: references
      });
    } catch (error) {
      console.error('Error getting references:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal mendapatkan daftar referensi'
      });
    }
  },

  // Get history for a specific chapter
  getChapterHistory: async (req, res) => {
    try {
      const { chapter } = req.params;
      const userId = req.user.id;

      const history = await Skripsi.getChapterHistory(userId, chapter);
      
      return res.status(200).json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Error getting chapter history:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil riwayat bab'
      });
    }
  },

  // Get history for a specific section
  getSectionHistory: async (req, res) => {
    try {
      const { chapter, section } = req.params;
      const userId = req.user.id;

      const history = await Skripsi.getSectionHistory(userId, chapter, section);
      
      return res.status(200).json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Error getting section history:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil riwayat bagian'
      });
    }
  },

  // Save content to history
  saveHistory: async (req, res) => {
    try {
        // Ensure req.user or req.session.userId is populated by isAuth
        const userId = (req.user && req.user.id) || req.session.userId; 
        
        if (!userId) {
            console.error('SaveHistory Error: User ID not found in request. isAuth middleware might have failed or was bypassed.');
            return res.status(401).json({ // Return 401 if no user ID
                success: false,
                message: 'Unauthorized: User ID not found'
            });
        }
        const { title, chapter, section, content } = req.body;

        console.log('Received data for saveHistory (controller):', { userId, title, chapter, section, contentLength: content?.length });

        if (!title || !chapter || !section || !content) {
            return res.status(400).json({
                success: false,
                message: 'Data tidak lengkap. Diperlukan: title, chapter, section, dan content'
            });
        }

        const savedId = await Skripsi.create(
            userId,
            title,
            chapter,
            section,
            content
        );

        if (!savedId) {
            return res.status(500).json({
                success: false,
                message: 'Gagal menyimpan konten, tidak ada ID yang dikembalikan.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Konten berhasil disimpan',
            data: { id: savedId }
        });
    } catch (error) {
        console.error('Error in skripsiController.saveHistory:', error);
        return res.status(500).json({
            success: false,
            message: 'Gagal menyimpan konten: ' + error.message
        });
    }
  },

  // Consultation endpoint
  consultWithAI: async (req, res) => {
    try {
        const { message, role, knowledgeBase } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'Pesan tidak boleh kosong'
            });
        }

        const response = await generateConsultResponse(message, role, knowledgeBase);
        return res.status(response.success ? 200 : 500).json(response);
    } catch (error) {
        console.error('Error in consultation:', error);
        return res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan dalam proses konsultasi'
        });
    }
  },

  // Make sure this is the actual save method being called by your route
  // (e.g., saveContent or saveHistory)
  saveContent: async (req, res) => { // Or saveHistory, whichever is used
    try {
      const userId = req.user?.id || req.session.userId;
      if (!userId) {
        // ... (error handling for unauthorized)
      }

      const { title, chapter, section, content } = req.body;
      
      console.log('Received data for saveContent (controller):', { userId, title, chapter, section, contentLength: content?.length });

      if (!title || !chapter || !section || !content) {
        // ... (error handling for missing fields)
      }

      // The 'sequence' logic is removed as the column is not in the table
      // const sequenceMap = Skripsi.getChapterSequenceMap();
      // const sequence = sequenceMap[chapter]?.[section] || 0;

      const skripsiId = await Skripsi.create(
        userId,
        title,
        chapter,
        section,
        content
        // sequence // Removed sequence from the call
      );

      return res.status(200).json({
        success: true,
        message: 'Konten berhasil disimpan',
        data: { id: skripsiId }
      });

    } catch (error) {
      console.error('Error in skripsiController.saveContent:', error);
      // ... (rest of your error logging)
      return res.status(500).json({
        success: false,
        message: 'Gagal menyimpan konten: Terjadi kesalahan pada server.'
      });
    }
  },

  // If you are using saveHistory, apply the same change:
  saveHistory: async (req, res) => {
    try {
        const userId = (req.user && req.user.id) || req.session.userId;
         if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: User ID not found'
            });
        }
        const { title, chapter, section, content } = req.body;

        console.log('Received data for saveHistory (controller):', { userId, title, chapter, section, contentLength: content?.length });

        if (!title || !chapter || !section || !content) {
            return res.status(400).json({
                success: false,
                message: 'Data tidak lengkap. Diperlukan: title, chapter, section, dan content'
            });
        }

        const savedId = await Skripsi.create(
            userId,
            title,
            chapter,
            section,
            content
        );

        if (!savedId) {
            return res.status(500).json({
                success: false,
                message: 'Gagal menyimpan konten, tidak ada ID yang dikembalikan.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Konten berhasil disimpan',
            data: { id: savedId }
        });
    } catch (error) {
        console.error('Error in skripsiController.saveHistory:', error);
        return res.status(500).json({
            success: false,
            message: 'Gagal menyimpan konten: ' + error.message
        });
    }
  }
};

module.exports = skripsiController;