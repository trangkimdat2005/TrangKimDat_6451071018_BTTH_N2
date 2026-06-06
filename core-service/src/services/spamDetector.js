const logger = require('../utils/logger');

const URL_PATTERNS = [
  /https?:\/\/[^\s]+/gi,
  /bit\.ly\//gi,
  /goo\.gl\//gi,
  /tinyurl\.com\//gi,
  /t\.co\//gi,
  /ow\.ly\//gi,
  /is\.gd\//gi,
  /buff\.ly\//gi,
  /adf\.ly\//gi,
];

const SUSPICIOUS_KEYWORDS = [
  'scam', 'hack', 'free money', 'click here now',
  'limited time offer', 'act now', 'urgent',
  'congratulations you won', 'your account',
];

function containsUrl(message) {
  for (const pattern of URL_PATTERNS) {
    if (pattern.test(message)) return true;
  }
  return false;
}

function isRepeatedContent(message, previousMessages = []) {
  const normalized = message.toLowerCase().trim();
  const count = previousMessages.filter(m => m.toLowerCase().trim() === normalized).length;
  return count >= 2;
}

function isExcessivePunctuation(message) {
  return /[!?]{3,}/.test(message);
}

function isExcessiveCaps(message) {
  const letters = message.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 5) return false;
  const upperCount = (message.match(/[A-Z]/g) || []).length;
  return upperCount / letters.length > 0.7;
}

function containsSuspiciousKeywords(message) {
  const lower = message.toLowerCase();
  return SUSPICIOUS_KEYWORDS.some(keyword => lower.includes(keyword));
}

function isMaliciousLink(message) {
  const lower = message.toLowerCase();
  const suspiciousDomains = [
    'bit.ly', 'goo.gl', 'tinyurl.com', 't.co',
    'ow.ly', 'is.gd', 'buff.ly', 'adf.ly',
    'phishing', 'login', 'verify-account',
  ];
  return suspiciousDomains.some(domain => lower.includes(domain));
}

function detectSpam(event) {
  const { message, sender_id } = event;
  const reasons = [];
  let score = 0;

  if (!message || message.trim().length === 0) {
    return { isSpam: false, score: 0, reasons: [] };
  }

  if (containsUrl(message)) {
    reasons.push('contains_url');
    score += 0.3;

    if (isMaliciousLink(message)) {
      reasons.push('malicious_link');
      score += 0.5;
    }
  }

  if (containsSuspiciousKeywords(message)) {
    reasons.push('suspicious_keywords');
    score += 0.4;
  }

  if (isExcessivePunctuation(message)) {
    reasons.push('excessive_punctuation');
    score += 0.2;
  }

  if (isExcessiveCaps(message)) {
    reasons.push('excessive_caps');
    score += 0.15;
  }

  if (message.length > 500) {
    reasons.push('excessive_length');
    score += 0.1;
  }

  score = Math.min(score, 1.0);

  const isSpam = score >= 0.4;

  logger.info('Spam detection result', {
    eventId: event.event_id,
    senderId: sender_id,
    score,
    reasons,
    isSpam,
  });

  return { isSpam, score, reasons };
}

module.exports = { detectSpam };
