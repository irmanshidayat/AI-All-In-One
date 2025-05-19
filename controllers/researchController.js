const Research = require('../models/ResearchModels');
const User = require('../models/User');
const axios = require('axios');

// Fungsi untuk mengambil API_KEY dan API_URL dari env
const getGoogleScholarApiKey = () => {
  return process.env.GOOGLE_SCHOLAR_API_KEY;
};

const getGoogleScholarApiUrl = () => {
  return process.env.GOOGLE_SCHOLAR_API_URL || 'https://serpapi.com/search';
};

// Fungsi untuk mengambil API CORE key dari env
const getCoreApiKey = () => {
  return process.env.API_CORE_KEY;
};

// Tampilkan halaman utama riset jurnal
exports.getResearchPage = async (req, res) => {
  try {
    // Use the new findRecent method for MySQL
    const recentResearch = await Research.findRecent(5);
    res.render('dashboard/research', {
      title: 'Riset Jurnal',
      path: '/dashboard/research',
      user: req.user,
      recentResearch
    });
  } catch (error) {
    console.error('Error getting research page:', error);
    res.status(500).render('500', {
      title: 'Error',
      path: '/error',
      error: 'Terjadi kesalahan saat memuat halaman riset jurnal'
    });
  }
};

// Mencari jurnal berdasarkan query
exports.searchResearch = async (req, res) => {
  try {
    const { query, page = 1, limit = 12, api = "core" } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        message: "Parameter query diperlukan" 
      });
    }
    
    // Determine which API to use - default to CORE if not specified
    const useGoogleScholar = api === "google";
    
    if (useGoogleScholar) {
      // Google Scholar API path
      const apiKey = getGoogleScholarApiKey();
      
      if (!apiKey) {
        return res.status(400).json({ 
          success: false, 
          message: "API key Google Scholar tidak ditemukan" 
        });
      }
      
      const apiUrl = getGoogleScholarApiUrl();
      
      // Meningkatkan jumlah hasil yang diminta dari API
      const maxResultsPerPage = 100; // Memaksimalkan hasil per halaman dari API
      
      // Panggil API external dengan timeout yang lebih lama
      const response = await axios.get(apiUrl, {
        params: {
          q: query,
          api_key: apiKey,
          engine: 'google_scholar',
          page,
          num: maxResultsPerPage // Minta hasil maksimal dari API
        },
        timeout: 30000 // 30 seconds timeout
      });
      
      // Adaptasi respons dari SerpAPI
      let results = [];
      if (response.data.organic_results) {
        results = response.data.organic_results.map(item => ({
          id: `tmp_${Date.now()}_${Math.floor(Math.random() * 1000)}`, // Generate a temporary ID
          title: item.title || 'Judul tidak tersedia',
          authors: item.publication_info?.authors || [],
          abstract: item.snippet || 'Abstrak tidak tersedia',
          publishedDate: item.publication_info?.year ? new Date(item.publication_info.year, 0, 1) : new Date(),
          journal: item.publication_info?.summary || 'Tidak diketahui',
          doi: item.link || '',
          citations_supportive: item.cited_by?.value || 0,
          citations_contrasting: 0,
          citations_mentioning: 0,
          pdf_url: item.resources?.find(r => r.file_format === 'PDF')?.link || '',
          keywords: [],
          category: 'Penelitian'
        }));
      }
      
      // Total hasil yang ditemukan
      const totalResults = response.data.serpapi_pagination?.total_results || results.length;
      const totalPages = Math.ceil(totalResults / limit);
      
      // Implementasi paginasi di sisi server
      // Karena kita sudah mendapatkan data maksimal dari API
      // Kita bisa mengaplikasikan paginasi di sisi server
      const startIndex = (parseInt(page) - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedResults = results.slice(startIndex, endIndex);
      
      return res.json({ 
        success: true, 
        data: paginatedResults,
        pagination: {
          currentPage: parseInt(page),
          totalPages: totalPages,
          totalResults: totalResults,
          resultsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      });
    } else {
      // CORE API path
      // Gunakan CORE API untuk mencari jurnal
      const coreApiKey = getCoreApiKey();
      if (!coreApiKey) {
        return res.status(400).json({ 
          success: false, 
          message: "API CORE key tidak ditemukan" 
        });
      }
      
      // Konversi halaman ke offset untuk API CORE
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      // Langsung menggunakan axios untuk memanggil CORE API
      const url = "https://api.core.ac.uk/v3/search/works";
      const headers = {"Authorization": `Bearer ${coreApiKey}`};
      const params = {
        q: query, 
        limit: parseInt(limit), 
        offset: offset
      };
      
      const response = await axios.get(url, { headers, params });
      
      if (response.status !== 200) {
        throw new Error(`CORE API returned status ${response.status}`);
      }
      
      // Format respons agar konsisten dengan endpoint lainnya
      const totalResults = response.data.totalHits || 0;
      const totalPages = Math.ceil(totalResults / limit);
      
      // Transformasi data dari CORE API ke format yang konsisten
      // Menghasilkan ID sementara yang dimulai dengan 'tmp_' untuk menunjukkan bahwa ini bukan dari database
      const results = response.data.results ? response.data.results.map(item => {
        // Buat ID sementara yang unik
        const tempId = `tmp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        
        return {
          id: tempId,
          title: item.title || "Judul tidak tersedia",
          authors: item.authors?.map(author => author.name) || [],
          abstract: item.abstract || "Abstrak tidak tersedia",
          publishedDate: item.publishedDate || new Date(),
          journal: item.publisher || item.journalTitle || "Tidak diketahui",
          doi: item.doi || "",
          citations_supportive: item.citationCount || 0,
          citations_contrasting: 0,
          citations_mentioning: 0,
          pdf_url: item.downloadUrl || "",
          keywords: item.subjects || [],
          category: item.subjects && item.subjects.length > 0 ? item.subjects[0] : "Penelitian"
        };
      }) : [];
      
      return res.json({
        success: true,
        data: results,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalResults,
          resultsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      });
    }
  } catch (error) {
    console.error("Error searching research:", error);
    res.status(500).json({ 
      success: false, 
      message: "Terjadi kesalahan saat mencari jurnal: " + error.message
    });
  }
};

// Mencari jurnal berdasarkan subject dengan API CORE
exports.searchJournalsBySubject = async (req, res) => {
  try {
    const { subject, page = 1, limit = 10 } = req.query;
    
    if (!subject) {
      return res.status(400).json({
        success: false,
        message: "Parameter subject diperlukan"
      });
    }
    
    // Validasi API key
    const apiKey = getCoreApiKey();
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: "API CORE key tidak ditemukan"
      });
    }
    
    // Konversi halaman ke offset untuk API CORE
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Gunakan method searchBySubject dari model Research
    const result = await Research.searchBySubject(subject, parseInt(limit), offset);
    
    // Format respons agar konsisten dengan endpoint lainnya
    const totalResults = result.totalHits || 0;
    const totalPages = Math.ceil(totalResults / limit);
    
    // Transformasi data dari CORE API ke format yang konsisten
    const journals = result.results ? result.results.map(item => ({
      id: `tmp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      title: item.title || "Judul tidak tersedia",
      authors: item.authors || [],
      abstract: item.abstract || "Abstrak tidak tersedia",
      publishedDate: item.publishedDate || new Date(),
      journal: item.publisher || item.journalTitle || "Tidak diketahui",
      doi: item.doi || "",
      citations_supportive: item.citationCount || 0,
      citations_contrasting: 0,
      citations_mentioning: 0,
      pdf_url: item.downloadUrl || "",
      keywords: item.subjects || [],
      category: item.subjects && item.subjects.length > 0 ? item.subjects[0] : "Penelitian"
    })) : [];
    
    res.json({
      success: true,
      data: journals,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalResults,
        resultsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error("Error searching journals by subject:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mencari jurnal berdasarkan subject"
    });
  }
};

// Mencari jurnal berdasarkan DOI dengan API CORE
exports.searchWorksByDOI = async (req, res) => {
  try {
    const { doi } = req.query;
    
    if (!doi) {
      return res.status(400).json({
        success: false,
        message: 'Parameter DOI diperlukan'
      });
    }
    
    // Validasi API key
    const apiKey = getCoreApiKey();
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'API CORE key tidak ditemukan'
      });
    }
    
    // Gunakan method searchWorksByDOI dari model Research
    const result = await Research.searchWorksByDOI(doi);
    
    // Transformasi data dari CORE API ke format yang konsisten
    const works = result.results ? result.results.map(item => ({
      id: `core_${item.id || Date.now()}_${Math.floor(Math.random() * 1000)}`,
      title: item.title || 'Judul tidak tersedia',
      authors: item.authors?.map(author => author.name) || [],
      abstract: item.abstract || 'Abstrak tidak tersedia',
      publishedDate: item.publishedDate || new Date(),
      journal: item.publisher || item.journalTitle || 'Tidak diketahui',
      doi: item.doi || '',
      citations_supportive: item.citationCount || 0,
      citations_contrasting: 0,
      citations_mentioning: 0,
      pdf_url: item.downloadUrl || '',
      keywords: item.subjects || [],
      category: item.subjects && item.subjects.length > 0 ? item.subjects[0] : 'Penelitian'
    })) : [];
    
    res.json({
      success: true,
      data: works,
      totalResults: result.totalHits || 0
    });
  } catch (error) {
    console.error('Error searching works by DOI:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mencari jurnal berdasarkan DOI'
    });
  }
};

// Mencari jurnal berdasarkan judul dengan API CORE
exports.searchWorksByTitle = async (req, res) => {
  try {
    const { title, page = 1, limit = 10 } = req.query;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Parameter title diperlukan'
      });
    }
    
    // Validasi API key
    const apiKey = getCoreApiKey();
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'API CORE key tidak ditemukan'
      });
    }
    
    // Konversi halaman ke offset untuk API CORE
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Gunakan method searchWorksByTitle dari model Research
    const result = await Research.searchWorksByTitle(title, parseInt(limit), offset);
    
    // Format respons agar konsisten dengan endpoint lainnya
    const totalResults = result.totalHits || 0;
    const totalPages = Math.ceil(totalResults / limit);
    
    // Transformasi data dari CORE API ke format yang konsisten
    const works = result.results ? result.results.map(item => ({
      id: `core_${item.id || Date.now()}_${Math.floor(Math.random() * 1000)}`,
      title: item.title || 'Judul tidak tersedia',
      authors: item.authors?.map(author => author.name) || [],
      abstract: item.abstract || 'Abstrak tidak tersedia',
      publishedDate: item.publishedDate || new Date(),
      journal: item.publisher || item.journalTitle || 'Tidak diketahui',
      doi: item.doi || '',
      citations_supportive: item.citationCount || 0,
      citations_contrasting: 0,
      citations_mentioning: 0,
      pdf_url: item.downloadUrl || '',
      keywords: item.subjects || [],
      category: item.subjects && item.subjects.length > 0 ? item.subjects[0] : 'Penelitian'
    })) : [];
    
    res.json({
      success: true,
      data: works,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalResults,
        resultsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error searching works by title:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mencari jurnal berdasarkan judul'
    });
  }
};

// Mencari jurnal berdasarkan nama penulis dengan API CORE
exports.searchWorksByAuthor = async (req, res) => {
  try {
    const { author, page = 1, limit = 10 } = req.query;
    
    if (!author) {
      return res.status(400).json({
        success: false,
        message: 'Parameter author diperlukan'
      });
    }
    
    // Validasi API key
    const apiKey = getCoreApiKey();
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'API CORE key tidak ditemukan'
      });
    }
    
    // Konversi halaman ke offset untuk API CORE
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Gunakan method searchWorksByAuthor dari model Research
    const result = await Research.searchWorksByAuthor(author, parseInt(limit), offset);
    
    // Format respons agar konsisten dengan endpoint lainnya
    const totalResults = result.totalHits || 0;
    const totalPages = Math.ceil(totalResults / limit);
    
    // Transformasi data dari CORE API ke format yang konsisten
    const works = result.results ? result.results.map(item => ({
      id: `core_${item.id || Date.now()}_${Math.floor(Math.random() * 1000)}`,
      title: item.title || 'Judul tidak tersedia',
      authors: item.authors?.map(author => author.name) || [],
      abstract: item.abstract || 'Abstrak tidak tersedia',
      publishedDate: item.publishedDate || new Date(),
      journal: item.publisher || item.journalTitle || 'Tidak diketahui',
      doi: item.doi || '',
      citations_supportive: item.citationCount || 0,
      citations_contrasting: 0,
      citations_mentioning: 0,
      pdf_url: item.downloadUrl || '',
      keywords: item.subjects || [],
      category: item.subjects && item.subjects.length > 0 ? item.subjects[0] : 'Penelitian'
    })) : [];
    
    res.json({
      success: true,
      data: works,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalResults,
        resultsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error searching works by author:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mencari jurnal berdasarkan penulis'
    });
  }
};

// Mencari jurnal berdasarkan teks dalam konten dengan API CORE
exports.searchWorksByFullText = async (req, res) => {
  try {
    const { text, page = 1, limit = 10 } = req.query;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Parameter text diperlukan'
      });
    }
    
    // Validasi API key
    const apiKey = getCoreApiKey();
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'API CORE key tidak ditemukan'
      });
    }
    
    // Konversi halaman ke offset untuk API CORE
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Gunakan method searchWorksByFullText dari model Research
    const result = await Research.searchWorksByFullText(text, parseInt(limit), offset);
    
    // Format respons agar konsisten dengan endpoint lainnya
    const totalResults = result.totalHits || 0;
    const totalPages = Math.ceil(totalResults / limit);
    
    // Transformasi data dari CORE API ke format yang konsisten
    const works = result.results ? result.results.map(item => ({
      id: `core_${item.id || Date.now()}_${Math.floor(Math.random() * 1000)}`,
      title: item.title || 'Judul tidak tersedia',
      authors: item.authors?.map(author => author.name) || [],
      abstract: item.abstract || 'Abstrak tidak tersedia',
      publishedDate: item.publishedDate || new Date(),
      journal: item.publisher || item.journalTitle || 'Tidak diketahui',
      doi: item.doi || '',
      citations_supportive: item.citationCount || 0,
      citations_contrasting: 0,
      citations_mentioning: 0,
      pdf_url: item.downloadUrl || '',
      keywords: item.subjects || [],
      category: item.subjects && item.subjects.length > 0 ? item.subjects[0] : 'Penelitian'
    })) : [];
    
    res.json({
      success: true,
      data: works,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalResults,
        resultsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error searching works by fulltext:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mencari jurnal berdasarkan konten teks'
    });
  }
};

// Mendapatkan detail jurnal
exports.getResearchDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if this is a temporary ID (starts with tmp_)
    if (id.startsWith('tmp_')) {
      // For temporary IDs, we need to get data from the session
      // However, since we don't store the full results in the session,
      // we'll respond with a message to perform a new search
      return res.json({
        success: true,
        data: {
          id: id,
          title: "Jurnal yang Anda pilih",
          abstract: "Silakan gunakan tombol pencarian untuk menemukan jurnal ini lagi.",
          isTempId: true
        }
      });
    }
    
    // For real IDs, use the database
    const research = await Research.findById(id);
    
    if (!research) {
      return res.status(404).json({ 
        success: false, 
        message: 'Jurnal tidak ditemukan' 
      });
    }
    
    res.json({ success: true, data: research });
  } catch (error) {
    console.error('Error getting research detail:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan saat mengambil detail jurnal' 
    });
  }
};

// Mendapatkan konten lengkap jurnal
exports.getResearchFullContent = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Handle temporary IDs differently
    if (id.startsWith('tmp_')) {
      // For temporary articles, use the provided details directly
      // Extract the DOI/link from the session or request
      const doi = req.query.doi || '';
      const pdfUrl = req.query.pdfUrl || '';
      const title = req.query.title || 'Jurnal';
      const abstract = req.query.abstract || '';
      
      // Try to fetch content from PDF or DOI directly
      let content = null;
      
      if (pdfUrl) {
        try {
          // Try to fetch from PDF URL using an API service
          const apiKey = getGoogleScholarApiKey();
          const apiUrl = getGoogleScholarApiUrl();
          
          const response = await axios.get(apiUrl, {
            params: {
              api_key: apiKey,
              engine: 'google_scholar_pdf',
              pdf_url: pdfUrl
            },
            timeout: 60000 // 60 seconds timeout
          });
          
          if (response.data && response.data.text) {
            content = response.data.text;
          }
        } catch (pdfError) {
          console.error('Error fetching PDF content:', pdfError);
        }
      }
      
      if (!content && doi) {
        try {
          // Try to fetch from DOI using CrossRef or similar API
          const response = await axios.get(`https://api.crossref.org/works/${doi.split('/').pop()}`);
          if (response.data && response.data.message && response.data.message.abstract) {
            content = response.data.message.abstract;
          }
        } catch (doiError) {
          console.error('Error fetching content from DOI:', doiError);
        }
      }
      
      // Return whatever content we found, or fallback to the abstract
      return res.json({
        success: true,
        data: {
          id: id,
          title: title,
          fullContent: content || abstract,
          isAbstractOnly: !content
        }
      });
    }
    
    // For regular IDs, use the database approach
    const research = await Research.findById(id);
    
    if (!research) {
      return res.status(404).json({ 
        success: false, 
        message: 'Jurnal tidak ditemukan' 
      });
    }
    
    // Jika jurnal sudah memiliki konten lengkap, kembalikan langsung
    if (research.full_content) {
      return res.json({
        success: true,
        data: {
          id: research.id,
          title: research.title,
          fullContent: research.full_content
        }
      });
    }
    
    // Jika tidak, coba ambil dari PDF atau DOI
    const content = await Research.fetchFullContent(id, research.pdf_url, research.doi);
    
    if (content) {
      return res.json({
        success: true,
        data: {
          id: research.id,
          title: research.title,
          fullContent: content
        }
      });
    } else {
      // Jika tidak berhasil mendapatkan konten lengkap, kembalikan abstract saja
      return res.json({
        success: true,
        data: {
          id: research.id,
          title: research.title,
          fullContent: research.abstract,
          isAbstractOnly: true
        }
      });
    }
  } catch (error) {
    console.error('Error getting research full content:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan saat mengambil konten jurnal' 
    });
  }
};

// Menganalisis jurnal dengan AI
exports.analyzeResearchWithAI = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, content, title } = req.body;
    
    if (!question) {
      return res.status(400).json({
        success: false,
        message: 'Pertanyaan tidak boleh kosong'
      });
    }
    
    // Handle temporary IDs differently
    if (id.startsWith('tmp_')) {
      // For temporary articles, we'll use the content provided in the request
      if (!content) {
        return res.status(400).json({
          success: false,
          message: 'Konten jurnal tidak tersedia'
        });
      }
      
      // Use OpenRouter API for AI analysis
      const openrouterApiKey = process.env.OPENROUTER_API_KEY;
      const openrouterApiUrl = process.env.OPENROUTER_API_URL;
      
      if (!openrouterApiKey || !openrouterApiUrl) {
        throw new Error('OpenRouter API credentials not found');
      }
      
      const response = await axios.post(
        `${openrouterApiUrl}/chat/completions`, 
        {
          model: "anthropic/claude-3-haiku",
          messages: [
            {
              role: "system",
              content: "You are an AI research assistant that helps analyze research papers. Your job is to provide accurate, helpful answers based on the research content provided. Be concise and informative."
            },
            {
              role: "user",
              content: `I have the following research paper. Please answer my question based on its content.\n\nTitle: ${title || 'Research Paper'}\n\nContent: ${content}\n\nMy question is: ${question}`
            }
          ],
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${openrouterApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data && response.data.choices && response.data.choices[0]) {
        return res.json({
          success: true,
          data: {
            question,
            answer: response.data.choices[0].message.content
          }
        });
      } else {
        throw new Error('Invalid response from AI service');
      }
    }
    
    // For regular IDs, use the database approach
    const research = await Research.findById(id);
    if (!research) {
      return res.status(404).json({ 
        success: false, 
        message: 'Jurnal tidak ditemukan' 
      });
    }
    
    const analysis = await Research.analyzeWithAI(id, question);
    
    res.json({
      success: true,
      data: {
        question,
        answer: analysis.answer
      }
    });
  } catch (error) {
    console.error('Error analyzing research with AI:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan saat menganalisis jurnal' 
    });
  }
};

// Menyimpan jurnal sebagai favorit
exports.saveResearch = async (req, res) => {
  try {
    // Periksa apakah user login
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Anda harus login untuk menyimpan jurnal'
      });
    }
    
    const { id } = req.params;
    const userId = req.user.id;
    
    // Use the new toggleSave method for MySQL
    const result = await Research.toggleSave(id, userId);
    
    return res.json({ 
      success: true, 
      message: result.saved ? 'Jurnal disimpan ke favorit' : 'Jurnal dihapus dari favorit',
      isSaved: result.saved
    });
  } catch (error) {
    console.error('Error saving research:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan saat menyimpan jurnal' 
    });
  }
};

// Mendapatkan jurnal yang disimpan
exports.getSavedResearch = async (req, res) => {
  try {
    // Periksa apakah user login
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Anda harus login untuk melihat jurnal tersimpan'
      });
    }
    
    const userId = req.user.id;
    // Use the new findSavedByUser method for MySQL
    const savedResearch = await Research.findSavedByUser(userId);
    
    res.json({ success: true, data: savedResearch });
  } catch (error) {
    console.error('Error getting saved research:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan saat mengambil jurnal tersimpan' 
    });
  }
};

// Mencari jurnal berdasarkan kategori
exports.getResearchByCategory = async (req, res) => {
  try {
    const { category, page = 1, limit = 10 } = req.query;
    
    // Use the new findByCategory and countByCategory methods for MySQL
    const research = await Research.findByCategory(category, page, parseInt(limit));
    const total = await Research.countByCategory(category);
    
    res.json({ 
      success: true, 
      data: research,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalResults: total
      }
    });
  } catch (error) {
    console.error('Error getting research by category:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan saat mengambil jurnal berdasarkan kategori' 
    });
  }
};

// Mencari jurnal menggunakan CORE outputs API
exports.searchOutputs = async (req, res) => {
  try {
    const { query, page = 1, limit = 12 } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        message: "Parameter query diperlukan" 
      });
    }
    
    // Validasi API key
    const apiKey = getCoreApiKey();
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: "API CORE key tidak ditemukan"
      });
    }
    
    // Konversi halaman ke offset untuk CORE API
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Gunakan method searchOutputs dari model Research
    const result = await Research.searchOutputs(query, parseInt(limit), offset);
    
    // Format respons agar konsisten dengan endpoint lainnya
    const totalResults = result.totalHits || 0;
    const totalPages = Math.ceil(totalResults / limit);
    
    // Transformasi data dari CORE API ke format yang konsisten
    const outputs = result.results ? result.results.map(item => {
      // Buat ID sementara yang unik
      const tempId = `tmp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      
      // Extract authors from contributors if available
      let authors = [];
      if (item.contributors && Array.isArray(item.contributors)) {
        authors = item.contributors
          .filter(c => c.roles?.includes('author'))
          .map(a => a.name || '');
      }
      
      return {
        id: tempId,
        title: item.title || "Judul tidak tersedia",
        authors: authors,
        abstract: item.abstract || "Abstrak tidak tersedia",
        publishedDate: item.publishedDate || item.acceptedDate || item.depositedDate || new Date(),
        journal: item.sourceFullTextUrls?.[0]?.name || item.publisher || "Tidak diketahui",
        doi: item.identifiers?.doi || "",
        citations_supportive: item.citationCount || 0,
        citations_contrasting: 0,
        citations_mentioning: 0,
        pdf_url: item.sourceFullTextUrls?.[0]?.url || item.downloadUrl || "",
        keywords: item.subjects || [],
        category: item.types?.[0] || (item.subjects && item.subjects.length > 0 ? item.subjects[0] : "Penelitian"),
        language: item.language || "en"
      };
    }) : [];
    
    return res.json({
      success: true,
      data: outputs,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalResults,
        resultsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error("Error searching outputs:", error);
    res.status(500).json({ 
      success: false, 
      message: "Terjadi kesalahan saat mencari jurnal outputs: " + error.message
    });
  }
};

// Mencari outputs berdasarkan ID dengan API CORE
exports.searchOutputById = async (req, res) => {
  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Parameter ID diperlukan"
      });
    }
    
    // Validasi API key
    const apiKey = getCoreApiKey();
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: "API CORE key tidak ditemukan"
      });
    }
    
    // Gunakan method searchOutputById dari model Research
    const result = await Research.searchOutputById(id);
    
    // Transformasi data dari CORE API ke format yang konsisten
    const outputs = result.results ? result.results.map(item => {
      const tempId = `tmp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      
      // Extract authors from contributors if available
      let authors = [];
      if (item.contributors && Array.isArray(item.contributors)) {
        authors = item.contributors
          .filter(c => c.roles?.includes('author'))
          .map(a => a.name || '');
      }
      
      return {
        id: tempId,
        title: item.title || "Judul tidak tersedia",
        authors: authors,
        abstract: item.abstract || "Abstrak tidak tersedia",
        publishedDate: item.publishedDate || item.acceptedDate || item.depositedDate || new Date(),
        journal: item.sourceFullTextUrls?.[0]?.name || item.publisher || "Tidak diketahui",
        doi: item.identifiers?.doi || "",
        citations_supportive: item.citationCount || 0,
        citations_contrasting: 0,
        citations_mentioning: 0,
        pdf_url: item.sourceFullTextUrls?.[0]?.url || item.downloadUrl || "",
        keywords: item.subjects || [],
        category: item.types?.[0] || (item.subjects && item.subjects.length > 0 ? item.subjects[0] : "Penelitian"),
        language: item.language || "en"
      };
    }) : [];
    
    res.json({
      success: true,
      data: outputs,
      totalResults: result.totalHits || 0
    });
  } catch (error) {
    console.error("Error searching outputs by ID:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mencari jurnal berdasarkan ID"
    });
  }
};

// Mencari outputs berdasarkan judul dengan API CORE
exports.searchOutputsByTitle = async (req, res) => {
  try {
    const { title, page = 1, limit = 10 } = req.query;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Parameter title diperlukan"
      });
    }
    
    // Validasi API key
    const apiKey = getCoreApiKey();
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: "API CORE key tidak ditemukan"
      });
    }
    
    // Konversi halaman ke offset untuk API CORE
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Gunakan method searchOutputsByTitle dari model Research
    const result = await Research.searchOutputsByTitle(title, parseInt(limit), offset);
    
    // Format respons agar konsisten dengan endpoint lainnya
    const totalResults = result.totalHits || 0;
    const totalPages = Math.ceil(totalResults / limit);
    
    // Transformasi data dari CORE API ke format yang konsisten
    const outputs = result.results ? result.results.map(item => {
      const tempId = `tmp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      
      // Extract authors from contributors if available
      let authors = [];
      if (item.contributors && Array.isArray(item.contributors)) {
        authors = item.contributors
          .filter(c => c.roles?.includes('author'))
          .map(a => a.name || '');
      }
      
      return {
        id: tempId,
        title: item.title || "Judul tidak tersedia",
        authors: authors,
        abstract: item.abstract || "Abstrak tidak tersedia",
        publishedDate: item.publishedDate || item.acceptedDate || item.depositedDate || new Date(),
        journal: item.sourceFullTextUrls?.[0]?.name || item.publisher || "Tidak diketahui",
        doi: item.identifiers?.doi || "",
        citations_supportive: item.citationCount || 0,
        citations_contrasting: 0,
        citations_mentioning: 0,
        pdf_url: item.sourceFullTextUrls?.[0]?.url || item.downloadUrl || "",
        keywords: item.subjects || [],
        category: item.types?.[0] || (item.subjects && item.subjects.length > 0 ? item.subjects[0] : "Penelitian"),
        language: item.language || "en"
      };
    }) : [];
    
    res.json({
      success: true,
      data: outputs,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalResults,
        resultsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error("Error searching outputs by title:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mencari jurnal berdasarkan judul"
    });
  }
};

// Mencari outputs berdasarkan konten fulltext dengan API CORE
exports.searchOutputsByFullText = async (req, res) => {
  try {
    const { keywords, page = 1, limit = 10 } = req.query;
    
    if (!keywords) {
      return res.status(400).json({
        success: false,
        message: "Parameter keywords diperlukan"
      });
    }
    
    // Validasi API key
    const apiKey = getCoreApiKey();
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: "API CORE key tidak ditemukan"
      });
    }
    
    // Konversi halaman ke offset untuk API CORE
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Gunakan method searchOutputsByFullText dari model Research
    const result = await Research.searchOutputsByFullText(keywords, parseInt(limit), offset);
    
    // Format respons agar konsisten dengan endpoint lainnya
    const totalResults = result.totalHits || 0;
    const totalPages = Math.ceil(totalResults / limit);
    
    // Transformasi data dari CORE API ke format yang konsisten
    const outputs = result.results ? result.results.map(item => {
      const tempId = `tmp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      
      // Extract authors from contributors if available
      let authors = [];
      if (item.contributors && Array.isArray(item.contributors)) {
        authors = item.contributors
          .filter(c => c.roles?.includes('author'))
          .map(a => a.name || '');
      }
      
      return {
        id: tempId,
        title: item.title || "Judul tidak tersedia",
        authors: authors,
        abstract: item.abstract || "Abstrak tidak tersedia",
        publishedDate: item.publishedDate || item.acceptedDate || item.depositedDate || new Date(),
        journal: item.sourceFullTextUrls?.[0]?.name || item.publisher || "Tidak diketahui",
        doi: item.identifiers?.doi || "",
        citations_supportive: item.citationCount || 0,
        citations_contrasting: 0,
        citations_mentioning: 0,
        pdf_url: item.sourceFullTextUrls?.[0]?.url || item.downloadUrl || "",
        keywords: item.subjects || [],
        category: item.types?.[0] || (item.subjects && item.subjects.length > 0 ? item.subjects[0] : "Penelitian"),
        language: item.language || "en"
      };
    }) : [];
    
    res.json({
      success: true,
      data: outputs,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalResults,
        resultsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error("Error searching outputs by fulltext:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mencari jurnal berdasarkan konten teks"
    });
  }
};

// Mencari outputs berdasarkan penulis dengan API CORE
exports.searchOutputsByAuthor = async (req, res) => {
  try {
    const { author, page = 1, limit = 10 } = req.query;
    
    if (!author) {
      return res.status(400).json({
        success: false,
        message: "Parameter author diperlukan"
      });
    }
    
    // Validasi API key
    const apiKey = getCoreApiKey();
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: "API CORE key tidak ditemukan"
      });
    }
    
    // Konversi halaman ke offset untuk API CORE
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Gunakan method searchOutputsByAuthor dari model Research
    const result = await Research.searchOutputsByAuthor(author, parseInt(limit), offset);
    
    // Format respons agar konsisten dengan endpoint lainnya
    const totalResults = result.totalHits || 0;
    const totalPages = Math.ceil(totalResults / limit);
    
    // Transformasi data dari CORE API ke format yang konsisten
    const outputs = result.results ? result.results.map(item => {
      const tempId = `tmp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      
      // Extract authors from contributors if available
      let authors = [];
      if (item.contributors && Array.isArray(item.contributors)) {
        authors = item.contributors
          .filter(c => c.roles?.includes('author'))
          .map(a => a.name || '');
      }
      
      return {
        id: tempId,
        title: item.title || "Judul tidak tersedia",
        authors: authors,
        abstract: item.abstract || "Abstrak tidak tersedia",
        publishedDate: item.publishedDate || item.acceptedDate || item.depositedDate || new Date(),
        journal: item.sourceFullTextUrls?.[0]?.name || item.publisher || "Tidak diketahui",
        doi: item.identifiers?.doi || "",
        citations_supportive: item.citationCount || 0,
        citations_contrasting: 0,
        citations_mentioning: 0,
        pdf_url: item.sourceFullTextUrls?.[0]?.url || item.downloadUrl || "",
        keywords: item.subjects || [],
        category: item.types?.[0] || (item.subjects && item.subjects.length > 0 ? item.subjects[0] : "Penelitian"),
        language: item.language || "en"
      };
    }) : [];
    
    res.json({
      success: true,
      data: outputs,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalResults,
        resultsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error("Error searching outputs by author:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mencari jurnal berdasarkan penulis"
    });
  }
};