-- Create video_streaming table
CREATE TABLE IF NOT EXISTS video_streaming (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    avatar_id VARCHAR(255) NOT NULL,
    voice_id VARCHAR(255) NOT NULL,
    status ENUM('active', 'ended', 'error') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create video_streaming_text table for storing conversation history
CREATE TABLE IF NOT EXISTS video_streaming_text (
    id INT PRIMARY KEY AUTO_INCREMENT,
    streaming_id INT NOT NULL,
    text_content TEXT NOT NULL,
    text_type ENUM('talk', 'repeat') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (streaming_id) REFERENCES video_streaming(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;