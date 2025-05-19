CREATE TABLE IF NOT EXISTS `skripsi` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `chapter` VARCHAR(50) NOT NULL,
  `section` VARCHAR(50) NOT NULL,
  `content` TEXT NOT NULL,
  `sequence` INT(11) NOT NULL DEFAULT 0,
  `status` ENUM('draft', 'final') DEFAULT 'draft',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `skripsi_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  INDEX `idx_user_chapter` (`user_id`, `chapter`),
  INDEX `idx_user_section` (`user_id`, `chapter`, `section`),
  INDEX `idx_sequence` (`sequence`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;