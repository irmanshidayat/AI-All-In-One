/**
 * Script to verify database tables and create any missing ones
 */

// Load environment variables
require('dotenv').config({ path: './twilio.env' });

const fs = require('fs');
const path = require('path');
const { connectDB } = require('./config/database');

async function checkAndCreateTables() {
  const pool = await connectDB();
  
  try {
    console.log('Checking if required tables exist...');
    
    // Check if ai_models table exists
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'voice_call'}' 
      AND TABLE_NAME = 'ai_models'
    `);
    
    if (tables.length === 0) {
      console.log('ai_models table not found! Creating required tables...');
      
      // Create only the ai_models table and insert data
      await pool.query(`
        -- Tabel untuk menyimpan model AI yang tersedia
        CREATE TABLE IF NOT EXISTS \`ai_models\` (
          \`id\` varchar(255) NOT NULL,
          \`name\` varchar(255) NOT NULL,
          \`type\` enum('free','paid') DEFAULT 'free',
          \`description\` text,
          \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime DEFAULT NULL,
          PRIMARY KEY (\`id\`),
          KEY \`idx_model_type\` (\`type\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        
        -- Contoh data model AI
        INSERT INTO \`ai_models\` (\`id\`, \`name\`, \`type\`, \`description\`) VALUES
        ('openai/gpt-3.5-turbo', 'OpenAI GPT-3.5 Turbo', 'free', 'Model GPT-3.5 dari OpenAI'),
        ('anthropic/claude-instant-v1', 'Anthropic Claude Instant', 'free', 'Model Claude Instant dari Anthropic'),
        ('google/palm-2-chat-bison', 'Google PaLM 2 Chat', 'free', 'Model PaLM 2 dari Google'),
        ('meta-llama/llama-2-13b-chat', 'Meta Llama 2 13B Chat', 'free', 'Model Llama 2 dari Meta'),
        ('mistralai/mistral-7b-instruct', 'Mistral 7B Instruct', 'free', 'Model Mistral 7B dari MistralAI');
      `);
      
      console.log('ai_models table created successfully!');
    } else {
      console.log('All required tables already exist.');
    }
  } catch (error) {
    console.error('Error checking or creating database tables:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the function
checkAndCreateTables().catch(console.error);