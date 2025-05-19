-- Creates the research tables needed for the research feature

-- Table for storing research articles
CREATE TABLE IF NOT EXISTS `researches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `authors` JSON NOT NULL COMMENT 'JSON array of author names',
  `abstract` TEXT NOT NULL,
  `published_date` DATE NOT NULL,
  `journal` VARCHAR(255) NOT NULL,
  `doi` VARCHAR(255) UNIQUE,
  `citations_supportive` INT DEFAULT 0,
  `citations_contrasting` INT DEFAULT 0,
  `citations_mentioning` INT DEFAULT 0,
  `pdf_url` VARCHAR(255),
  `keywords` JSON COMMENT 'JSON array of keywords',
  `category` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_category` (`category`),
  INDEX `idx_published_date` (`published_date`),
  INDEX `idx_created_at` (`created_at`),
  FULLTEXT INDEX `idx_title_abstract` (`title`, `abstract`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for storing user saved research articles
CREATE TABLE IF NOT EXISTS `user_saved_researches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `research_id` INT NOT NULL,
  `saved_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `user_research_unique` (`user_id`, `research_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_research_id` (`research_id`),
  CONSTRAINT `fk_user_saved_researches_user_id` 
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) 
    ON DELETE CASCADE,
  CONSTRAINT `fk_user_saved_researches_research_id` 
    FOREIGN KEY (`research_id`) REFERENCES `researches` (`id`) 
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert some sample research data
INSERT INTO `researches` 
  (`title`, `authors`, `abstract`, `published_date`, `journal`, `category`, `keywords`) 
VALUES 
  ('Pengaruh Artificial Intelligence terhadap Masa Depan Pekerjaan',
   '["Dr. Ahmad Wijaya", "Prof. Siti Rahma"]',
   'Penelitian ini menganalisis dampak perkembangan AI terhadap berbagai sektor pekerjaan di Indonesia dalam 10 tahun ke depan.',
   '2024-01-15',
   'Jurnal Teknologi Indonesia',
   'Teknologi',
   '["AI", "Pekerjaan", "Indonesia", "Teknologi"]'),
   
  ('Kebijakan Publik dalam Era Digital: Tantangan dan Peluang',
   '["Prof. Budi Santoso", "Dr. Indah Permata"]',
   'Studi ini mengkaji transformasi kebijakan publik di era digital dan bagaimana pemerintah dapat beradaptasi dengan perubahan teknologi.',
   '2023-11-20',
   'Jurnal Kebijakan Publik',
   'Kebijakan',
   '["Kebijakan Publik", "Digital", "Transformasi", "Pemerintah"]'),
   
  ('Analisis Sentimen Media Sosial terhadap Kebijakan Kesehatan Nasional',
   '["Dr. Maya Kusuma", "Reza Pratama, M.Sc"]',
   'Penelitian ini menggunakan analisis sentimen untuk mengevaluasi respons publik terhadap kebijakan kesehatan nasional di berbagai platform media sosial.',
   '2024-02-05',
   'Indonesian Journal of Health Policy',
   'Kesehatan',
   '["Analisis Sentimen", "Media Sosial", "Kesehatan", "Kebijakan"]'),
   
  ('Inovasi Pembelajaran Berbasis AI di Sekolah Menengah Indonesia',
   '["Dr. Hendra Wijaya", "Prof. Lia Anggraini"]',
   'Studi ini meneliti implementasi sistem pembelajaran berbantuan kecerdasan buatan di sekolah menengah di Indonesia dan dampaknya terhadap hasil belajar siswa.',
   '2023-12-10',
   'Jurnal Pendidikan Nasional',
   'Pendidikan',
   '["Pendidikan", "AI", "Sekolah Menengah", "Inovasi"]'),
   
  ('Pengembangan Ekonomi Hijau untuk Pembangunan Berkelanjutan di Asia Tenggara',
   '["Prof. Darmawan Putra", "Dr. Anisa Widodo"]',
   'Penelitian ini menganalisis strategi pengembangan ekonomi hijau di negara-negara Asia Tenggara dan kontribusinya terhadap pembangunan berkelanjutan regional.',
   '2024-03-20',
   'Journal of Sustainable Development',
   'Ekonomi',
   '["Ekonomi Hijau", "Pembangunan Berkelanjutan", "Asia Tenggara", "Lingkungan"]');