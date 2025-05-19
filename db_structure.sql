CREATE DATABASE IF NOT EXISTS voice_call;

USE voice_call;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin', 'manager') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Customer feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  feedback_text TEXT NOT NULL,
  sentiment ENUM('positive', 'neutral', 'negative'),
  category VARCHAR(100),
  status ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Response templates
CREATE TABLE IF NOT EXISTS response_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  template_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabel untuk menyimpan opsi suara TTS
CREATE TABLE IF NOT EXISTS `voice_tts_options` (
  `id` VARCHAR(255) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `language` VARCHAR(10) NOT NULL,
  `description` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel untuk menyimpan model AI yang tersedia
CREATE TABLE IF NOT EXISTS `ai_models` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` enum('free','paid') DEFAULT 'free',
  `description` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_model_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel untuk menyimpan konfigurasi sistem
CREATE TABLE IF NOT EXISTS `system_configs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `key` varchar(255) NOT NULL,
  `value` text NOT NULL,
  `description` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel untuk menyimpan konfigurasi agent
CREATE TABLE IF NOT EXISTS `agent_configs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `role` varchar(255) NOT NULL,
  `greeting_template` text NOT NULL,
  `ai_model` varchar(255) NOT NULL,
  `knowledge_base` text DEFAULT NULL,
  `tts_voice_id` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_agent_config_name` (`name`),
  CONSTRAINT `fk_agent_config_voice` FOREIGN KEY (`tts_voice_id`) REFERENCES `voice_tts_options` (`id`),
  CONSTRAINT `fk_agent_config_model` FOREIGN KEY (`ai_model`) REFERENCES `ai_models` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel untuk menyimpan kontak
CREATE TABLE IF NOT EXISTS `contacts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `status` ENUM('uncalled', 'called', 'failed', 'unreachable') DEFAULT 'uncalled',
  `last_call_date` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `phone` (`phone`),
  KEY `idx_contact_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel untuk menyimpan rekaman panggilan
CREATE TABLE IF NOT EXISTS `call_records` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `contact_id` int(11) NOT NULL,
  `config_id` int(11) NOT NULL,
  `twilio_sid` varchar(255) DEFAULT NULL,
  `status` varchar(50) NOT NULL,
  `duration` int(11) DEFAULT 0,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `contact_id` (`contact_id`),
  KEY `config_id` (`config_id`),
  KEY `idx_call_records_status` (`status`),
  KEY `idx_call_records_created` (`created_at`),
  CONSTRAINT `fk_call_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_call_config` FOREIGN KEY (`config_id`) REFERENCES `agent_configs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel untuk menyimpan percakapan panggilan
CREATE TABLE IF NOT EXISTS `call_conversations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `call_id` int(11) NOT NULL,
  `sender_type` enum('agent','user','system') NOT NULL,
  `message_text` text NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `call_id` (`call_id`),
  KEY `idx_conversation_sender` (`sender_type`),
  KEY `idx_conversation_created` (`created_at`),
  CONSTRAINT `fk_conversation_call` FOREIGN KEY (`call_id`) REFERENCES `call_records` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel untuk koneksi WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_connections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  qr_code TEXT,
  connection_status ENUM('disconnected', 'pending', 'connected') DEFAULT 'disconnected',
  last_connection DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY (user_id, phone_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel untuk percakapan WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  connection_id INT NOT NULL,
  contact_id INT,
  sender ENUM('customer', 'agent', 'system') NOT NULL,
  type ENUM('text', 'voice', 'image', 'document') NOT NULL,
  content TEXT NOT NULL,
  status ENUM('active', 'resolved', 'archived') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (connection_id) REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contoh data
INSERT INTO `voice_tts_options` (`id`, `name`, `language`, `description`) VALUES
('Polly.Rizwan', 'Rizwan (Indonesia)', 'id-ID', 'Suara pria Indonesia dari Amazon Polly'),
('Polly.Siti', 'Siti (Indonesia)', 'id-ID', 'Suara wanita Indonesia dari Amazon Polly');

-- Contoh data model AI
INSERT INTO `ai_models` (`id`, `name`, `type`, `description`) VALUES
('openai/gpt-3.5-turbo', 'OpenAI GPT-3.5 Turbo', 'free', 'Model GPT-3.5 dari OpenAI'),
('anthropic/claude-instant-v1', 'Anthropic Claude Instant', 'free', 'Model Claude Instant dari Anthropic'),
('google/palm-2-chat-bison', 'Google PaLM 2 Chat', 'free', 'Model PaLM 2 dari Google'),
('meta-llama/llama-2-13b-chat', 'Meta Llama 2 13B Chat', 'free', 'Model Llama 2 dari Meta'),
('mistralai/mistral-7b-instruct', 'Mistral 7B Instruct', 'free', 'Model Mistral 7B dari MistralAI');

-- Contoh data konfigurasi sistem
INSERT INTO `system_configs` (`key`, `value`, `description`) VALUES
('default_ai_model', 'openai/gpt-3.5-turbo', 'Model AI default untuk agent'),
('default_tts_voice', 'Polly.Siti', 'Suara TTS default untuk agent');

-- Insert sample user (password: admin123)
INSERT INTO users (username, email, password, role) VALUES
('admin', 'admin@example.com', '$2a$10$3QeB2/zWBSY/5HDfPjbQu.YJ0lgVjZkI9xKCoxhxFpDsNUOjHlv2a', 'admin');