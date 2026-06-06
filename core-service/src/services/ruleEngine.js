const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');

function buildCommand(event, action, replyMessage = null, priority = 'normal') {
  return {
    command_id: uuidv4(),
    event_id: event.event_id,
    action,
    comment_id: event.comment_id || null,
    post_id: event.post_id || null,
    sender_id: event.sender_id || null,
    sender_name: event.sender_name || null,
    reply_message: replyMessage,
    priority,
    pending_review: event.pending_review || false,
    retry_count: 0,
    original_event: event,
  };
}

function decideAction(event, analysis, spam, repeatSpamCount) {
  const { intent, sentiment } = analysis;
  const { isSpam, score: spamScore, reasons } = spam;

  if (event.pending_review) {
    logger.info('Event is pending review - will require manual approval', { eventId: event.event_id });
    return {
      command: buildCommand(event, 'pending_review', null, 'high'),
      skipAutomation: true,
    };
  }

  if (isSpam) {
    if (reasons.includes('malicious_link') || reasons.includes('suspicious_keywords')) {
      return {
        command: buildCommand(event, 'hide_comment', null, 'high'),
        additionalCommands: [buildCommand(event, 'pending_review', null, 'high')],
        skipAutomation: true,
      };
    }

    if (repeatSpamCount >= 3) {
      return {
        command: buildCommand(event, 'blacklist_user', null, 'high'),
        additionalCommands: [buildCommand(event, 'hide_comment', null, 'normal')],
        skipAutomation: true,
      };
    }

    return {
      command: buildCommand(event, 'hide_comment', null, 'normal'),
      skipAutomation: true,
    };
  }

  if (repeatSpamCount >= 3) {
    return {
      command: buildCommand(event, 'blacklist_user', null, 'high'),
      additionalCommands: [buildCommand(event, 'hide_comment', null, 'normal')],
      skipAutomation: true,
    };
  }

  // =========================================================
  // BAI 3: SENTIMENT-BASED AUTOMATION RULES
  // =========================================================
  //
  // Rule: "Tích cực" → Cảm ơn người dùng
  //   Rationale: Người dùng hài lòng → củng cố mối quan hệ bằng lời cảm ơn
  //   Example: "Shop hỗ trợ rất nhanh" → "Cảm ơn bạn đã ủng hộ shop!"
  //
  // Rule: "Tiêu cực" → Xin lỗi người dùng + flag admin
  //   Rationale: Người dùng không hài lòng → xin lỗi để giữ uy tín, đồng thời
  //              flag cho admin biết để can thiệp thủ công nếu cần
  //   Example: "Mình chờ quá lâu" → "Rất xin lỗi vì trải nghiệm chưa tốt..."
  //
  // Rule: "Trung lập" → Phản hồi trung lập / thông tin
  //   Rationale: Câu hỏi trung tính → cung cấp thông tin khách quan
  //
  // Rule: Spam → Ẩn bình luận
  //   Rationale: Nội dung quảng cáo lặp, link lạ → không phù hợp, ẩn đi
  // =========================================================

  if (intent === 'hỏi_giá') {
    logger.info('Automation: intent=hỏi_giá → auto_reply (giá)', { eventId: event.event_id });
    return {
      command: buildCommand(event, 'auto_reply', config.autoReply.gia, 'normal'),
      skipAutomation: false,
    };
  }

  if (sentiment === 'tiêu_cực') {
    logger.info('Automation: sentiment=tiêu_cực → auto_reply (xin lỗi) + flag_admin', { eventId: event.event_id });
    return {
      command: buildCommand(event, 'auto_reply', config.autoReply.tieuCuc, 'normal'),
      additionalCommands: [buildCommand(event, 'flag_admin', null, 'high')],
      skipAutomation: false,
    };
  }

  if (sentiment === 'tích_cực') {
    logger.info('Automation: sentiment=tích_cực → auto_reply (cảm ơn)', { eventId: event.event_id });
    return {
      command: buildCommand(event, 'auto_reply', config.autoReply.tichCuc, 'low'),
      skipAutomation: false,
    };
  }

  if (sentiment === 'trung_lập') {
    logger.info('Automation: sentiment=trung_lập → auto_reply (thông tin)', { eventId: event.event_id });
    return {
      command: buildCommand(event, 'auto_reply', config.autoReply.trungTinh, 'normal'),
      skipAutomation: false,
    };
  }

  if (intent === 'khiếu_nại') {
    logger.info('Automation: intent=khiếu_nại → auto_reply (xin lỗi) + flag_admin', { eventId: event.event_id });
    return {
      command: buildCommand(event, 'auto_reply', config.autoReply.tieuCuc, 'normal'),
      additionalCommands: [buildCommand(event, 'flag_admin', null, 'high')],
      skipAutomation: false,
    };
  }

  return {
    command: buildCommand(event, 'auto_reply', config.autoReply.khac, 'low'),
    skipAutomation: false,
  };
}

function getActionDescription(action) {
  const descriptions = {
    auto_reply: 'Send automatic reply to comment',
    hide_comment: 'Hide comment from public view',
    flag_admin: 'Flag for admin attention',
    pending_review: 'Mark for manual review',
    blacklist_user: 'Add user to internal blacklist',
    block_user_manual: 'Flag for manual Facebook block',
  };
  return descriptions[action] || action;
}

module.exports = { decideAction, buildCommand, getActionDescription };
