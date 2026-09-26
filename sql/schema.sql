-- MySQL 5.7+ / InnoDB (locally verified on 8.4). Install into a new, dedicated database.
CREATE TABLE musicians (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 slug VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 profile JSON NOT NULL,
 visibility ENUM('draft','public','hidden') NOT NULL DEFAULT 'draft',
 is_verified BOOLEAN NOT NULL DEFAULT FALSE,
 version INT UNSIGNED NOT NULL DEFAULT 1,
 is_locked BOOLEAN NOT NULL DEFAULT FALSE,
 locked_at DATETIME NULL,
 locked_reason VARCHAR(200) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX musicians_visibility (visibility)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Current assignments only; assignment history is held in append-only audit logs.
CREATE TABLE musician_representatives (
 musician_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 discord_user_id VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 FOREIGN KEY (musician_id) REFERENCES musicians(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE profile_update_sessions (
 session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 discord_interaction_id VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 discord_user_id VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 musician_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 base_version INT UNSIGNED NOT NULL,
 submitted_payload JSON NOT NULL,
 validated_payload JSON NOT NULL,
 expires_at DATETIME NOT NULL,
 consumed_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (musician_id) REFERENCES musicians(id),
 INDEX sessions_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE musician_audit_logs (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 musician_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 actor_discord_user_id VARCHAR(20) NULL,
 actor_kind ENUM('self','operator','system') NOT NULL,
 action VARCHAR(40) NOT NULL,
 before_snapshot JSON NULL,
 after_snapshot JSON NULL,
 interaction_id VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NULL UNIQUE,
 result ENUM('succeeded','rejected','failed') NOT NULL,
 error_code VARCHAR(80) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (musician_id) REFERENCES musicians(id),
 INDEX audit_musician_date (musician_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TRIGGER audit_no_update BEFORE UPDATE ON musician_audit_logs
 FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit logs are append-only';
CREATE TRIGGER audit_no_delete BEFORE DELETE ON musician_audit_logs
 FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit logs are append-only';

CREATE TABLE rate_limits (
 bucket CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 hits INT UNSIGNED NOT NULL,
 expires_at DATETIME NOT NULL,
 INDEX rate_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
