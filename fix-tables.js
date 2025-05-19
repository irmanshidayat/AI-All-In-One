/**
 * Script to fix the voice tables structure
 */

// Load environment variables
require('dotenv').config({ path: './twilio.env' });
const { connectDB } = require('./config/database');

async function fixVoiceTables() {
  const pool = await connectDB();
  
  try {
    console.log('Checking voice tables structure...');
    
    // Check if voice_tts_options table exists
    const [voiceOptionsTable] = await pool.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'voice_call'}' 
      AND TABLE_NAME = 'voice_tts_options'
    `);
    
    if (voiceOptionsTable.length === 0) {
      console.log('Creating voice_tts_options table...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`voice_tts_options\` (
          \`id\` VARCHAR(255) PRIMARY KEY,
          \`name\` VARCHAR(255) NOT NULL,
          \`language\` VARCHAR(10) NOT NULL,
          \`description\` TEXT,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        
        INSERT INTO \`voice_tts_options\` (\`id\`, \`name\`, \`language\`, \`description\`) VALUES
        ('Polly.Rizwan', 'Rizwan (Indonesia)', 'id-ID', 'Suara pria Indonesia dari Amazon Polly'),
        ('Polly.Siti', 'Siti (Indonesia)', 'id-ID', 'Suara wanita Indonesia dari Amazon Polly');
      `);
      console.log('voice_tts_options table created successfully!');
    } else {
      console.log('voice_tts_options table already exists.');
    }
    
    // Check if agent_configs table has tts_voice_id column
    const [agentConfigColumns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'voice_call'}' 
      AND TABLE_NAME = 'agent_configs'
      AND COLUMN_NAME = 'tts_voice_id'
    `);
    
    if (agentConfigColumns.length === 0) {
      console.log('Adding tts_voice_id column to agent_configs table...');
      
      // First check if the table exists
      const [agentConfigTable] = await pool.query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'voice_call'}' 
        AND TABLE_NAME = 'agent_configs'
      `);
      
      if (agentConfigTable.length === 0) {
        console.log('Creating agent_configs table...');
        await pool.query(`
          CREATE TABLE IF NOT EXISTS \`agent_configs\` (
            \`id\` int(11) NOT NULL AUTO_INCREMENT,
            \`name\` varchar(255) NOT NULL,
            \`role\` varchar(255) NOT NULL,
            \`greeting_template\` text NOT NULL,
            \`ai_model\` varchar(255) NOT NULL,
            \`knowledge_base\` text DEFAULT NULL,
            \`tts_voice_id\` varchar(255) DEFAULT NULL,
            \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\` datetime DEFAULT NULL,
            PRIMARY KEY (\`id\`),
            KEY \`idx_agent_config_name\` (\`name\`),
            CONSTRAINT \`fk_agent_config_voice\` FOREIGN KEY (\`tts_voice_id\`) REFERENCES \`voice_tts_options\` (\`id\`),
            CONSTRAINT \`fk_agent_config_model\` FOREIGN KEY (\`ai_model\`) REFERENCES \`ai_models\` (\`id\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('agent_configs table created successfully!');
      } else {
        // Add the column to the existing table
        await pool.query(`
          ALTER TABLE \`agent_configs\` 
          ADD COLUMN \`tts_voice_id\` varchar(255) DEFAULT NULL,
          ADD CONSTRAINT \`fk_agent_config_voice\` FOREIGN KEY (\`tts_voice_id\`) REFERENCES \`voice_tts_options\` (\`id\`);
        `);
        console.log('tts_voice_id column added to agent_configs table!');
      }
    } else {
      console.log('agent_configs table already has tts_voice_id column.');
    }
    
    console.log('Database structure fixed successfully!');
  } catch (error) {
    console.error('Error fixing database structure:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the function
fixVoiceTables().catch(console.error);