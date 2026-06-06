const axios = require('axios');
const config = require('../config');
const db = require('../db');
const logger = require('../utils/logger');

const FACEBOOK_ERROR_CODES = {
  TOKEN_EXPIRED: 190,
  RATE_LIMIT: 4,
  APP_RATE_LIMIT: 613,
};

function isRetryableError(error) {
  if (!error.response) return true;
  const status = error.response.status;
  const fbErrorCode = error.response.data?.error?.error_subcode || error.response.data?.error?.code;
  if (status >= 500) return true;
  if (status === 429) return true;
  if (fbErrorCode === FACEBOOK_ERROR_CODES.APP_RATE_LIMIT) return true;
  if (fbErrorCode === FACEBOOK_ERROR_CODES.TOKEN_EXPIRED) return false;
  return false;
}

function getErrorCode(error) {
  if (!error.response) return 'NETWORK_ERROR';
  const fbError = error.response.data?.error;
  if (!fbError) return `HTTP_${error.response.status}`;
  const subcode = fbError.error_subcode;
  if (subcode === FACEBOOK_ERROR_CODES.TOKEN_EXPIRED) return 'TOKEN_EXPIRED';
  if (subcode === FACEBOOK_ERROR_CODES.RATE_LIMIT) return 'RATE_LIMIT';
  if (subcode === FACEBOOK_ERROR_CODES.APP_RATE_LIMIT) return 'APP_RATE_LIMIT';
  return fbError.type || `ERROR_${fbError.code || 'UNKNOWN'}`;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function logToDatabase({ method, endpoint, requestPayload, responseStatus, responseBody, errorMessage }) {
  try {
    await db.query(
      `INSERT INTO api_logs (method, endpoint, facebook_request_payload, facebook_response_status, facebook_response_body, error_message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        method,
        endpoint,
        requestPayload ? JSON.stringify(requestPayload).substring(0, 2000) : null,
        responseStatus || null,
        responseBody ? JSON.stringify(responseBody).substring(0, 2000) : null,
        errorMessage || null,
      ]
    );
  } catch (err) {
    logger.error('Failed to log API call to database', { error: err.message });
  }
}

async function facebookRequest(method, endpoint, data = null, retryCount = 0, maxRetries = 3) {
  const url = `${config.facebook.baseUrl}/${endpoint}`;
  const tokenParam = `access_token=${config.facebook.pageAccessToken}`;

  let requestUrl = url;
  if (method === 'GET' && data) {
    const qs = new URLSearchParams(data).toString();
    requestUrl = `${url}?${tokenParam}&${qs}`;
  } else {
    requestUrl = `${url}?${tokenParam}`;
  }

  const headers = {
    'Content-Type': 'application/json',
  };

    const requestPayload = { method, url: requestUrl, data };

  try {
    logger.info(`Facebook API request`, { method, endpoint, retryCount });

    let response;
    if (method === 'GET') {
      response = await axios.get(requestUrl, { headers });
    } else if (method === 'POST') {
      response = await axios.post(requestUrl, data, { headers });
    } else if (method === 'DELETE') {
      response = await axios.delete(requestUrl, { headers });
    } else {
      response = await axios({ method, url: requestUrl, data, headers });
    }

    const fbResponse = response.data;
    const fbStatus = response.status;

    logger.info(`Facebook API response`, { endpoint, status: fbStatus, retryCount });
    await logToDatabase({
      method,
      endpoint,
      requestPayload: data,
      responseStatus: fbStatus,
      responseBody: fbResponse,
    });

    return fbResponse;
  } catch (error) {
    const fbError = error.response?.data?.error;
    const fbStatus = error.response?.status;
    const errorCode = getErrorCode(error);
    const errorMessage = fbError ? `${fbError.message} (code: ${fbError.code}, subcode: ${fbError.error_subcode})` : error.message;

    logger.error(`Facebook API error`, {
      endpoint,
      status: fbStatus,
      errorCode,
      errorMessage,
      retryCount,
      isRetryable: isRetryableError(error),
    });

    await logToDatabase({
      method,
      endpoint,
      requestPayload: data,
      responseStatus: fbStatus || null,
      responseBody: fbError || null,
      errorMessage,
    });

    if (retryCount >= maxRetries) {
      const finalError = new Error(`Facebook API error after ${maxRetries} retries: ${errorMessage}`);
      finalError.code = errorCode;
      finalError.status = fbStatus || 500;
      finalError.retryable = isRetryableError(error);
      throw finalError;
    }

    if (!isRetryableError(error)) {
      const nonRetryableError = new Error(`Non-retryable Facebook API error: ${errorMessage}`);
      nonRetryableError.code = errorCode;
      nonRetryableError.status = fbStatus || 400;
      nonRetryableError.retryable = false;
      throw nonRetryableError;
    }

    const delay = Math.pow(2, retryCount) * 1000;
    logger.info(`Retrying Facebook API request in ${delay}ms`, { retryCount: retryCount + 1, maxRetries });
    await sleep(delay);

    return facebookRequest(method, endpoint, data, retryCount + 1, maxRetries);
  }
}

async function getPosts(params = {}) {
  const queryParams = {
    limit: params.limit || 25,
  };

  if (params.since) {
    queryParams.since = Math.floor(new Date(params.since).getTime() / 1000);
  }
  if (params.until) {
    queryParams.until = Math.floor(new Date(params.until + 'T23:59:59').getTime() / 1000);
  }

  const data = await facebookRequest('GET', 'me/posts', queryParams);
  return {
    success: true,
    data: data.data || [],
    paging: data.paging || null,
  };
}

async function createPost(message, options = {}) {
  const postData = { message, ...options };
  const data = await facebookRequest('POST', 'me/feed', postData);

  if (!data.id) {
    throw new Error('Failed to create post: no post ID returned');
  }

  logger.info(`Post created successfully`, { postId: data.id });

  return {
    success: true,
    data: {
      post_id: data.id,
      post_id_based_on_api: data,
    },
  };
}

async function getComments(postId, params = {}) {
  const fields = 'id,message,from,created_time,like_count';
  const queryParams = {
    fields,
    limit: params.limit || 25,
    order: params.order || 'chronological',
    ...(params.after && { after: params.after }),
    ...(params.before && { before: params.before }),
  };

  const data = await facebookRequest('GET', `${postId}/comments`, queryParams);

  const normalizedComments = (data.data || []).map(comment => ({
    id: comment.id,
    message: comment.message,
    from: comment.from,
    created_time: comment.created_time,
    like_count: comment.like_count,
  }));

  await db.query(
    `INSERT INTO comments (comment_id, post_id, message, status)
     SELECT $1, $2, $3, 'received'
     ON CONFLICT (comment_id) DO NOTHING`,
    [postId, postId, null]
  );

  return {
    success: true,
    data: normalizedComments,
    paging: data.paging || null,
  };
}

async function hideComment(commentId) {
  const data = await facebookRequest('POST', `${commentId}`, { is_hidden: true });
  return { success: true, data };
}

async function deleteComment(commentId) {
  await facebookRequest('DELETE', `${commentId}`);
  return { success: true, data: { deleted: true, commentId } };
}

module.exports = {
  getPosts,
  createPost,
  getComments,
  hideComment,
  deleteComment,
  facebookRequest,
};
