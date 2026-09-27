-- Additive migration for existing installations. No profile data is changed.
CREATE TABLE IF NOT EXISTS member_web_access (
 discord_user_id VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 generation INT UNSIGNED NOT NULL DEFAULT 1,
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL UNIQUE,
 token_expires_at DATETIME NOT NULL,
 musician_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 FOREIGN KEY (musician_id) REFERENCES musicians(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
