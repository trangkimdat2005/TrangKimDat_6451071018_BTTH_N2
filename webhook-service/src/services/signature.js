const crypto = require('crypto');
const logger = require('../utils/logger');

function verifySignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !rawBody) {
    logger.warn('Missing signature header or body');
    return false;
  }

  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex');

  try {
    const sigBuffer = Buffer.from(signatureHeader);
    const expectedBuffer = Buffer.from(expected);

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch (err) {
    logger.error('Signature verification error', { error: err.message });
    return false;
  }
}

module.exports = { verifySignature };
