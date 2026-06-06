CREATE TABLE IF NOT EXISTS idempotency_keys (
    command_id VARCHAR(100) PRIMARY KEY,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    comment_id VARCHAR(100) UNIQUE NOT NULL,
    post_id VARCHAR(100) NOT NULL,
    message TEXT,
    intent VARCHAR(50),
    sentiment VARCHAR(20),
    status VARCHAR(20) DEFAULT 'received',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_logs (
    id SERIAL PRIMARY KEY,
    method VARCHAR(10) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    facebook_request_payload TEXT,
    facebook_response_status INTEGER,
    facebook_response_body TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Event tracking (for tracking processing state)
CREATE TABLE IF NOT EXISTS event_tracking (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(100) UNIQUE NOT NULL,
    comment_id VARCHAR(100),
    post_id VARCHAR(100),
    sender_id VARCHAR(100),
    sender_name VARCHAR(255),
    message TEXT,
    status VARCHAR(30) DEFAULT 'received',
    intent VARCHAR(50),
    sentiment VARCHAR(20),
    spam_score DECIMAL(3,2),
    spam_reason TEXT,
    action_taken VARCHAR(50),
    reply_message TEXT,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    pending_review BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rate limiting tracking
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
    id SERIAL PRIMARY KEY,
    sender_id VARCHAR(100) NOT NULL,
    window_start TIMESTAMP NOT NULL,
    event_count INTEGER DEFAULT 1,
    UNIQUE(sender_id, window_start)
);

-- Internal user blacklist (for repeat offenders)
CREATE TABLE IF NOT EXISTS user_blacklist (
    id SERIAL PRIMARY KEY,
    sender_id VARCHAR(100) UNIQUE NOT NULL,
    sender_name VARCHAR(255),
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dead letter events (failed after all retries)
CREATE TABLE IF NOT EXISTS dead_letter_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(100),
    command_id VARCHAR(100),
    original_topic VARCHAR(100),
    payload JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Spam history (for repeat spam detection)
CREATE TABLE IF NOT EXISTS spam_history (
    id SERIAL PRIMARY KEY,
    sender_id VARCHAR(100) NOT NULL,
    comment_id VARCHAR(100),
    spam_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Command logs (for auditing commands sent to Kafka)
CREATE TABLE IF NOT EXISTS command_logs (
    id SERIAL PRIMARY KEY,
    command_id VARCHAR(100) UNIQUE NOT NULL,
    event_id VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    payload JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
