const { getPool } = require('../config/database');
const axios = require('axios');

/**
 * Research model for MySQL
 * Functions to interact with the research data in the MySQL database
 */
class Research {
  /**
   * Find recent research articles
   * @param {number} limit - Number of research articles to return
   * @returns {Promise<Array>} Array of research articles
   */
  static async findRecent(limit = 5) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      const [rows] = await pool.query(`
        SELECT * FROM researches 
        ORDER BY created_at DESC 
        LIMIT ?
      `, [limit]);
      
      return rows;
    } catch (error) {
      console.error('Error in findRecent:', error);
      throw error;
    }
  }
  
  /**
   * Find a research article by ID
   * @param {string} id - ID of the research article
   * @returns {Promise<Object|null>} Research article or null if not found
   */
  static async findById(id) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      const [rows] = await pool.query(`
        SELECT * FROM researches 
        WHERE id = ?
      `, [id]);
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error in findById:', error);
      throw error;
    }
  }
  
  /**
   * Insert multiple research articles
   * @param {Array} researches - Array of research article objects
   * @returns {Promise<boolean>} True if successful
   */
  static async insertMany(researches) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      // Start a transaction
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      
      try {
        for (const research of researches) {
          const authors = JSON.stringify(research.authors || []);
          const keywords = JSON.stringify(research.keywords || []);
          const supportive = research.citations?.supportive || 0;
          const contrasting = research.citations?.contrasting || 0;
          const mentioning = research.citations?.mentioning || 0;
          
          await connection.query(`
            INSERT INTO researches (
              title, authors, abstract, published_date, journal, doi, 
              citations_supportive, citations_contrasting, citations_mentioning,
              pdf_url, keywords, category, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
              title = VALUES(title),
              authors = VALUES(authors),
              abstract = VALUES(abstract),
              journal = VALUES(journal),
              pdf_url = VALUES(pdf_url),
              keywords = VALUES(keywords),
              category = VALUES(category)
          `, [
            research.title,
            authors,
            research.abstract,
            research.publishedDate,
            research.journal,
            research.doi,
            supportive,
            contrasting,
            mentioning,
            research.pdfUrl,
            keywords,
            research.category
          ]);
        }
        
        // Commit the transaction
        await connection.commit();
        connection.release();
        return true;
      } catch (err) {
        // Rollback the transaction on error
        await connection.rollback();
        connection.release();
        throw err;
      }
    } catch (error) {
      console.error('Error in insertMany:', error);
      throw error;
    }
  }
  
  /**
   * Find research articles by category
   * @param {string} category - Category of research
   * @param {number} page - Page number for pagination
   * @param {number} limit - Number of items per page
   * @returns {Promise<Array>} Array of research articles
   */
  static async findByCategory(category, page = 1, limit = 10) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      const offset = (page - 1) * limit;
      
      const [rows] = await pool.query(`
        SELECT * FROM researches 
        WHERE category = ? 
        ORDER BY published_date DESC
        LIMIT ? OFFSET ?
      `, [category, limit, offset]);
      
      return rows;
    } catch (error) {
      console.error('Error in findByCategory:', error);
      throw error;
    }
  }
  
  /**
   * Count research articles by category
   * @param {string} category - Category of research
   * @returns {Promise<number>} Count of research articles
   */
  static async countByCategory(category) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      const [rows] = await pool.query(`
        SELECT COUNT(*) as count 
        FROM researches 
        WHERE category = ?
      `, [category]);
      
      return rows[0].count;
    } catch (error) {
      console.error('Error in countByCategory:', error);
      throw error;
    }
  }
  
  /**
   * Save research article to user's favorites
   * @param {string} researchId - ID of the research article
   * @param {string} userId - ID of the user
   * @returns {Promise<{saved: boolean}>} Object indicating if research was saved or removed
   */
  static async toggleSave(researchId, userId) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      // Check if already saved
      const [existing] = await pool.query(`
        SELECT * FROM user_saved_researches 
        WHERE research_id = ? AND user_id = ?
      `, [researchId, userId]);
      
      if (existing.length > 0) {
        // If already saved, remove from favorites
        await pool.query(`
          DELETE FROM user_saved_researches 
          WHERE research_id = ? AND user_id = ?
        `, [researchId, userId]);
        return { saved: false };
      } else {
        // If not saved, add to favorites
        await pool.query(`
          INSERT INTO user_saved_researches (research_id, user_id, saved_at) 
          VALUES (?, ?, NOW())
        `, [researchId, userId]);
        return { saved: true };
      }
    } catch (error) {
      console.error('Error in toggleSave:', error);
      throw error;
    }
  }
  
  /**
   * Get user's saved research articles
   * @param {string} userId - ID of the user
   * @returns {Promise<Array>} Array of saved research articles
   */
  static async findSavedByUser(userId) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      const [rows] = await pool.query(`
        SELECT r.* 
        FROM researches r
        JOIN user_saved_researches usr ON r.id = usr.research_id
        WHERE usr.user_id = ?
        ORDER BY usr.saved_at DESC
      `, [userId]);
      
      return rows;
    } catch (error) {
      console.error('Error in findSavedByUser:', error);
      throw error;
    }
  }
  
  /**
   * Fetch the full content of a research article from its PDF URL or DOI
   * @param {string} researchId - ID of the research article
   * @param {string} pdfUrl - URL of the PDF
   * @param {string} doi - DOI of the article
   * @returns {Promise<string|null>} Full text content or null if not retrievable
   */
  static async fetchFullContent(researchId, pdfUrl, doi) {
    try {
      const pool = getPool();
      if (!pool) throw new Error('Database connection not established');
      
      // Check if we already have full content in the database
      const [existing] = await pool.query(`
        SELECT full_content FROM researches WHERE id = ? AND full_content IS NOT NULL
      `, [researchId]);
      
      if (existing.length > 0 && existing[0].full_content) {
        return existing[0].full_content;
      }
      
      // If we don't have content, try to fetch it using the PDF URL or DOI
      let content = null;
      
      if (pdfUrl) {
        try {
          // Use SerpAPI or another service to extract text from PDF
          const apiKey = process.env.GOOGLE_SCHOLAR_API_KEY;
          const apiUrl = process.env.GOOGLE_SCHOLAR_API_URL;
          
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
          const response = await axios.get(`https://api.crossref.org/works/${doi}`);
          if (response.data && response.data.message && response.data.message.abstract) {
            content = response.data.message.abstract;
          }
        } catch (doiError) {
          console.error('Error fetching content from DOI:', doiError);
        }
      }
      
      // If we got content, save it to database
      if (content) {
        await pool.query(`
          UPDATE researches SET full_content = ? WHERE id = ?
        `, [content, researchId]);
      }
      
      return content;
    } catch (error) {
      console.error('Error in fetchFullContent:', error);
      throw error;
    }
  }
  
  /**
   * Analyze research content with AI
   * @param {string} researchId - ID of the research article 
   * @param {string} question - User's question about the research
   * @returns {Promise<{answer: string}>} AI response to the question
   */
  static async analyzeWithAI(researchId, question) {
    try {
      // Get the research details including full content
      const research = await this.findById(researchId);
      if (!research) {
        throw new Error('Research not found');
      }
      
      // Fetch full content if we don't have it yet
      if (!research.full_content) {
        await this.fetchFullContent(researchId, research.pdf_url, research.doi);
        // Get the updated research with full content
        const updatedResearch = await this.findById(researchId);
        research.full_content = updatedResearch.full_content;
      }
      
      // Prepare content for analysis
      const context = research.full_content || research.abstract;
      
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
              content: `I have the following research paper. Please answer my question based on its content.\n\nTitle: ${research.title}\nAuthors: ${JSON.parse(research.authors).join(', ')}\n\nContent: ${context}\n\nMy question is: ${question}`
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
        return { answer: response.data.choices[0].message.content };
      } else {
        throw new Error('Invalid response from AI service');
      }
    } catch (error) {
      console.error('Error in analyzeWithAI:', error);
      throw error;
    }
  }

  /**
   * Search journals by subject using CORE API
   * @param {string} subject - Subject to search for
   * @param {number} limit - Number of results to return (default: 10)
   * @param {number} offset - Offset for pagination (default: 0)
   * @returns {Promise<Object>} CORE API response containing journal data
   */
  static async searchBySubject(subject, limit = 10, offset = 0) {
    try {
      const apiKey = process.env.API_CORE_KEY;
      if (!apiKey) throw new Error('API CORE key not found in environment variables');
      
      const url = "https://api.core.ac.uk/v3/search/journals";
      const headers = {"Authorization": `Bearer ${apiKey}`};
      const params = {
        q: `subjects:"${subject}"`, 
        limit: limit, 
        offset: offset
      };
      
      const response = await axios.get(url, { headers, params });
      
      if (response.status === 200) {
        return response.data;
      } else {
        console.error(`Error ${response.status}: ${response.statusText}`);
        throw new Error(`CORE API returned status ${response.status}`);
      }
    } catch (error) {
      console.error('Error in searchBySubject:', error);
      throw error;
    }
  }
  
  /**
   * Search works by DOI using CORE API
   * @param {string} doi - DOI to search for
   * @param {number} limit - Number of results to return (default: 1)
   * @returns {Promise<Object>} CORE API response containing work data
   */
  static async searchWorksByDOI(doi, limit = 1) {
    try {
      const apiKey = process.env.API_CORE_KEY;
      if (!apiKey) throw new Error('API CORE key not found in environment variables');
      
      const url = "https://api.core.ac.uk/v3/search/works";
      const headers = {"Authorization": `Bearer ${apiKey}`};
      const params = {
        q: `doi:"${doi}"`, 
        limit: limit
      };
      
      const response = await axios.get(url, { headers, params });
      
      if (response.status === 200) {
        return response.data;
      } else {
        console.error(`Error ${response.status}: ${response.statusText}`);
        throw new Error(`CORE API returned status ${response.status}`);
      }
    } catch (error) {
      console.error('Error in searchWorksByDOI:', error);
      throw error;
    }
  }
  
  /**
   * Search works by title using CORE API
   * @param {string} title - Title to search for
   * @param {number} limit - Number of results to return (default: 10)
   * @param {number} offset - Offset for pagination (default: 0)
   * @returns {Promise<Object>} CORE API response containing work data
   */
  static async searchWorksByTitle(title, limit = 10, offset = 0) {
    try {
      const apiKey = process.env.API_CORE_KEY;
      if (!apiKey) throw new Error('API CORE key not found in environment variables');
      
      const url = "https://api.core.ac.uk/v3/search/works";
      const headers = {"Authorization": `Bearer ${apiKey}`};
      const params = {
        q: `title:"${title}"`, 
        limit: limit,
        offset: offset
      };
      
      const response = await axios.get(url, { headers, params });
      
      if (response.status === 200) {
        return response.data;
      } else {
        console.error(`Error ${response.status}: ${response.statusText}`);
        throw new Error(`CORE API returned status ${response.status}`);
      }
    } catch (error) {
      console.error('Error in searchWorksByTitle:', error);
      throw error;
    }
  }
  
  /**
   * Search works by author name using CORE API
   * @param {string} author - Author name to search for
   * @param {number} limit - Number of results to return (default: 10)
   * @param {number} offset - Offset for pagination (default: 0)
   * @returns {Promise<Object>} CORE API response containing work data
   */
  static async searchWorksByAuthor(author, limit = 10, offset = 0) {
    try {
      const apiKey = process.env.API_CORE_KEY;
      if (!apiKey) throw new Error('API CORE key not found in environment variables');
      
      const url = "https://api.core.ac.uk/v3/search/works";
      const headers = {"Authorization": `Bearer ${apiKey}`};
      const params = {
        q: `authors:"${author}"`, 
        limit: limit,
        offset: offset
      };
      
      const response = await axios.get(url, { headers, params });
      
      if (response.status === 200) {
        return response.data;
      } else {
        console.error(`Error ${response.status}: ${response.statusText}`);
        throw new Error(`CORE API returned status ${response.status}`);
      }
    } catch (error) {
      console.error('Error in searchWorksByAuthor:', error);
      throw error;
    }
  }
  
  /**
   * Search works by fullText using CORE API
   * @param {string} text - Text to search for in fulltext content
   * @param {number} limit - Number of results to return (default: 10)
   * @param {number} offset - Offset for pagination (default: 0)
   * @returns {Promise<Object>} CORE API response containing work data
   */
  static async searchWorksByFullText(text, limit = 10, offset = 0) {
    try {
      const apiKey = process.env.API_CORE_KEY;
      if (!apiKey) throw new Error('API CORE key not found in environment variables');
      
      const url = "https://api.core.ac.uk/v3/search/works";
      const headers = {"Authorization": `Bearer ${apiKey}`};
      const params = {
        q: `fullText:"${text}"`, 
        limit: limit,
        offset: offset
      };
      
      const response = await axios.get(url, { headers, params });
      
      if (response.status === 200) {
        return response.data;
      } else {
        console.error(`Error ${response.status}: ${response.statusText}`);
        throw new Error(`CORE API returned status ${response.status}`);
      }
    } catch (error) {
      console.error('Error in searchWorksByFullText:', error);
      throw error;
    }
  }

  /**
   * Search outputs by query using CORE API
   * @param {string} query - General query to search for
   * @param {number} limit - Number of results to return (default: 10)
   * @param {number} offset - Offset for pagination (default: 0)
   * @returns {Promise<Object>} CORE API response containing output data
   */
  static async searchOutputs(query, limit = 10, offset = 0) {
    try {
      const apiKey = process.env.API_CORE_KEY;
      if (!apiKey) throw new Error('API CORE key not found in environment variables');
      
      const url = "https://api.core.ac.uk/v3/search/outputs";
      const headers = {"Authorization": `Bearer ${apiKey}`};
      const params = {
        q: query, 
        limit: limit, 
        offset: offset
      };
      
      const response = await axios.get(url, { headers, params });
      
      if (response.status === 200) {
        return response.data;
      } else {
        console.error(`Error ${response.status}: ${response.statusText}`);
        throw new Error(`CORE API returned status ${response.status}`);
      }
    } catch (error) {
      console.error('Error in searchOutputs:', error);
      throw error;
    }
  }
  
  /**
   * Search outputs by ID using CORE API
   * @param {string} id - CORE ID to search for
   * @returns {Promise<Object>} CORE API response containing output data
   */
  static async searchOutputById(id) {
    try {
      const apiKey = process.env.API_CORE_KEY;
      if (!apiKey) throw new Error('API CORE key not found in environment variables');
      
      const url = "https://api.core.ac.uk/v3/search/outputs";
      const headers = {"Authorization": `Bearer ${apiKey}`};
      const params = {
        q: `id:"${id}"`,
        limit: 1
      };
      
      const response = await axios.get(url, { headers, params });
      
      if (response.status === 200) {
        return response.data;
      } else {
        console.error(`Error ${response.status}: ${response.statusText}`);
        throw new Error(`CORE API returned status ${response.status}`);
      }
    } catch (error) {
      console.error('Error in searchOutputById:', error);
      throw error;
    }
  }
  
  /**
   * Search outputs by title using CORE API
   * @param {string} title - Title to search for
   * @param {number} limit - Number of results to return (default: 10)
   * @param {number} offset - Offset for pagination (default: 0)
   * @returns {Promise<Object>} CORE API response containing output data
   */
  static async searchOutputsByTitle(title, limit = 10, offset = 0) {
    try {
      const apiKey = process.env.API_CORE_KEY;
      if (!apiKey) throw new Error('API CORE key not found in environment variables');
      
      const url = "https://api.core.ac.uk/v3/search/outputs";
      const headers = {"Authorization": `Bearer ${apiKey}`};
      const params = {
        q: `title:"${title}"`, 
        limit: limit,
        offset: offset
      };
      
      const response = await axios.get(url, { headers, params });
      
      if (response.status === 200) {
        return response.data;
      } else {
        console.error(`Error ${response.status}: ${response.statusText}`);
        throw new Error(`CORE API returned status ${response.status}`);
      }
    } catch (error) {
      console.error('Error in searchOutputsByTitle:', error);
      throw error;
    }
  }
  
  /**
   * Search outputs by fulltext using CORE API
   * @param {string} keywords - Keywords to search for in fulltext
   * @param {number} limit - Number of results to return (default: 10)
   * @param {number} offset - Offset for pagination (default: 0)
   * @returns {Promise<Object>} CORE API response containing output data
   */
  static async searchOutputsByFullText(keywords, limit = 10, offset = 0) {
    try {
      const apiKey = process.env.API_CORE_KEY;
      if (!apiKey) throw new Error('API CORE key not found in environment variables');
      
      const url = "https://api.core.ac.uk/v3/search/outputs";
      const headers = {"Authorization": `Bearer ${apiKey}`};
      const params = {
        q: `fullText:"${keywords}"`,
        limit: limit,
        offset: offset
      };
      
      const response = await axios.get(url, { headers, params });
      
      if (response.status === 200) {
        return response.data;
      } else {
        console.error(`Error ${response.status}: ${response.statusText}`);
        throw new Error(`CORE API returned status ${response.status}`);
      }
    } catch (error) {
      console.error('Error in searchOutputsByFullText:', error);
      throw error;
    }
  }
  
  /**
   * Search outputs by author name using CORE API
   * @param {string} author - Author name to search for
   * @param {number} limit - Number of results to return (default: 10)
   * @param {number} offset - Offset for pagination (default: 0)
   * @returns {Promise<Object>} CORE API response containing output data
   */
  static async searchOutputsByAuthor(author, limit = 10, offset = 0) {
    try {
      const apiKey = process.env.API_CORE_KEY;
      if (!apiKey) throw new Error('API CORE key not found in environment variables');
      
      const url = "https://api.core.ac.uk/v3/search/outputs";
      const headers = {"Authorization": `Bearer ${apiKey}`};
      const params = {
        q: `authors:"${author}"`,
        limit: limit,
        offset: offset
      };
      
      const response = await axios.get(url, { headers, params });
      
      if (response.status === 200) {
        return response.data;
      } else {
        console.error(`Error ${response.status}: ${response.statusText}`);
        throw new Error(`CORE API returned status ${response.status}`);
      }
    } catch (error) {
      console.error('Error in searchOutputsByAuthor:', error);
      throw error;
    }
  }
}

module.exports = Research;