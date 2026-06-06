const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { getCircuitBreaker } = require('./circuitBreaker');

const INTENT_PROMPT = `Analyze the following Facebook comment and determine the user intent and sentiment.

Comment: "{message}"
Sender: {sender_name}

Respond ONLY with valid JSON (no markdown, no explanation):
{{"intent": "hỏi_giá|hoi_thong_tin|khiếu_nại|khen|tương_tác_tích_cực|khác", "sentiment": "tích_cực|tiêu_cực|trung_lập", "confidence": 0.0-1.0}}

Intent definitions:
- hỏi_giá: asking about price, asking how much something costs
- hoi_thong_tin: asking for product info, size, availability, shipping
- khiếu_nại: complaining, reporting problems, asking for support
- khen: praising, complimenting products or service
- tương_tác_tích_cực: positive engagement like "hay quá", "tuyệt vời", reactions
- khác: anything that doesn't fit the above categories

Sentiment definitions:
- tích_cực: happy, satisfied, enthusiastic, grateful
- tiêu_cực: angry, frustrated, disappointed, complaining
- trung_lập: neutral, informational questions
`;

async function analyzeWithAI(event) {
  if (!config.openai.apiKey) {
    logger.warn('OpenAI API key not configured, using heuristic analysis');
    return heuristicAnalysis(event);
  }

  const prompt = INTENT_PROMPT
    .replace('{message}', event.message || '')
    .replace('{sender_name}', event.sender_name || 'Unknown');

  const circuitBreaker = getCircuitBreaker(
    'openai-api',
    config.circuitBreaker.openai.threshold,
    config.circuitBreaker.openai.resetTimeoutMs
  );

  try {
    const result = await circuitBreaker.execute(async () => {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: config.openai.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 200,
        },
        {
          headers: {
            'Authorization': `Bearer ${config.openai.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const content = response.data.choices[0]?.message?.content?.trim();

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        logger.warn('Failed to parse AI response as JSON, using heuristic', { content });
        return null;
      }

      const validIntents = ['hỏi_giá', 'hoi_thong_tin', 'khiếu_nại', 'khen', 'tương_tác_tích_cực', 'khác'];
      const validSentiments = ['tích_cực', 'tiêu_cực', 'trung_lập'];

      if (!validIntents.includes(parsed.intent)) parsed.intent = 'khác';
      if (parsed.sentiment === 'tiêu cực') parsed.sentiment = 'tiêu_cực';
      if (!validSentiments.includes(parsed.sentiment)) parsed.sentiment = 'trung_lập';

      return parsed;
    });

    if (!result) {
      return { ...heuristicAnalysis(event), source: 'heuristic_fallback' };
    }

    logger.info('AI analysis completed', {
      eventId: event.event_id,
      intent: result.intent,
      sentiment: result.sentiment,
      confidence: result.confidence,
      circuitState: circuitBreaker.getState(),
    });

    return {
      intent: result.intent,
      sentiment: result.sentiment,
      confidence: result.confidence || 0.5,
      source: 'ai',
    };
  } catch (err) {
    const cbState = circuitBreaker.getState();
    logger.error('AI analysis failed, falling back to heuristic', {
      eventId: event.event_id,
      error: err.message,
      circuitState: cbState,
    });
    return { ...heuristicAnalysis(event), source: 'heuristic_fallback' };
  }
}

function heuristicAnalysis(event) {
  const message = (event.message || '').toLowerCase();
  const intent = heuristicIntent(message);
  const sentiment = heuristicSentiment(message);

  return { intent, sentiment, confidence: 0.6, source: 'heuristic' };
}

function heuristicIntent(message) {
  const pricePatterns = [/gi[aá] bao nhiêu/, /gi[aá] /, /mấy tiền/, /bao nhiêu/, /price/i, /cost/i, /giá/];
  if (pricePatterns.some(p => p.test(message))) return 'hỏi_giá';

  const infoPatterns = [/size/, /m[aà]u/, /c[oó]/, /hàng/, /c[oó] sẵn/, /giao hàng/, /vận chuyển/, /thông tin/, /mô tả/];
  if (infoPatterns.some(p => p.test(message))) return 'hoi_thong_tin';

  const complaintPatterns = [/chưa nhận/, /không nhận/, /hàng hỏng/, /bị lỗi/, /tệ/, /dở/, /không hài lòng/, /khiếu nại/];
  if (complaintPatterns.some(p => p.test(message))) return 'khiếu_nại';

  const positivePatterns = [/hay quá/, /tuyệt vời/, /đẹp/, /ưng/, /hài lòng/];
  if (positivePatterns.some(p => p.test(message))) return 'khen';

  const engagePatterns = [/cảm ơn/, /thank/, /love/, /like/, /tuyệt/, /awesome/, /great/];
  if (engagePatterns.some(p => p.test(message))) return 'tương_tác_tích_cực';

  return 'khác';
}

function heuristicSentiment(message) {
  const negativePatterns = [/chưa/, /không/, /tệ/, /dở/, /hỏng/, /lỗi/, /buồn/, /giận/, /tức/, /thất vọng/];
  const positivePatterns = [/hay/, /đẹp/, /tuyệt/, /ưng/, /hài lòng/, /cảm ơn/, /love/, /great/, /awesome/];

  if (positivePatterns.some(p => p.test(message))) return 'tích_cực';
  if (negativePatterns.some(p => p.test(message))) return 'tiêu_cực';
  return 'trung_lập';
}

module.exports = { analyzeWithAI, heuristicAnalysis };
