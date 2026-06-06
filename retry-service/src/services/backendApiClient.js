const axios = require('axios');
const logger = require('../utils/logger');
const { getCircuitBreaker } = require('./circuitBreaker');
const config = require('../config');

async function callBackendAPI(command) {
  const url = `${config.backendApi.url}/api/internal/execute`;
  const body = { command };

  logger.info('[BackendAPI Client] Calling backend API', {
    commandId: command.command_id,
    action: command.action,
    url,
  });

  const response = await axios.post(url, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-API-Key': config.backendApi.internalApiKey,
    },
    timeout: 15000,
  });

  return response.data;
}

async function callBackendAPIWithCircuitBreaker(command) {
  const cb = getCircuitBreaker(
    'backend-api',
    config.retry.circuitBreakerThreshold,
    config.retry.circuitBreakerResetMs
  );

  return cb.execute(async () => {
    const result = await callBackendAPI(command);
    return result;
  });
}

module.exports = { callBackendAPI, callBackendAPIWithCircuitBreaker };
