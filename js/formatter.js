/* ═══════════════════════════════════════
   formatter.js — 서식 변환
   *지문* ↔ "대사" 분리 + 줄바꿈 삽입
   ═══════════════════════════════════════ */

var ChatFormatter = (function () {

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * 토큰화: *지문*, "대사", 일반텍스트로 분리
   * 닫히지 않은 *도 처리 (끝까지 지문으로)
   */
  function tokenize(text) {
    var tokens = [];
    var remaining = text;

    while (remaining.length > 0) {
      var idxStar = remaining.indexOf('*');
      var idxQuote = -1;
      var quoteMatch = remaining.match(/[""\u201C\u201D]/);
      if (quoteMatch) idxQuote = quoteMatch.index;

      if (idxStar === -1 && idxQuote === -1) {
        var plain = remaining.trim();
        if (plain) tokens.push({ type: 'text', content: plain });
        break;
      }

      // ** (볼드) 처리
      if (idxStar !== -1 && remaining[idxStar + 1] === '*') {
        var endBold = remaining.indexOf('**', idxStar + 2);
        if (endBold !== -1) {
          var beforeBold = remaining.substring(0, idxStar).trim();
          if (beforeBold) tokens.push({ type: 'text', content: beforeBold });
          var boldContent = remaining.substring(idxStar + 2, endBold);
          tokens.push({ type: 'text', content: boldContent });
          remaining = remaining.substring(endBold + 2);
          continue;
        }
      }

      var starFirst = idxStar !== -1 && (idxQuote === -1 || idxStar < idxQuote);
      var quoteFirst = idxQuote !== -1 && (idxStar === -1 || idxQuote < idxStar);

      if (starFirst) {
        var before = remaining.substring(0, idxStar).trim();
        if (before) tokens.push({ type: 'text', content: before });
        remaining = remaining.substring(idxStar + 1);

        var closeIdx = -1;
        for (var ci = 0; ci < remaining.length; ci++) {
          if (remaining[ci] === '*') {
            if (ci + 1 < remaining.length && remaining[ci + 1] === '*') { ci++; continue; }
            if (ci > 0 && remaining[ci - 1] === '*') { continue; }
            closeIdx = ci;
            break;
          }
        }

        if (closeIdx !== -1) {
          var stage = remaining.substring(0, closeIdx).trim();
          if (stage) tokens.push({ type: 'stage', content: stage });
          remaining = remaining.substring(closeIdx + 1);
        } else {
          var stageAll = remaining.trim();
          if (stageAll) tokens.push({ type: 'stage', content: stageAll });
          remaining = '';
        }
      } else if (quoteFirst) {
        var beforeQ = remaining.substring(0, idxQuote).trim();
        if (beforeQ) tokens.push({ type: 'text', content: beforeQ });

        var openChar = remaining[idxQuote];
        remaining = remaining.substring(idxQuote + 1);

        var closeQuoteIdx = -1;
        var closeChars = ['"', '\u201D'];
        if (openChar === '"' || openChar === '\u201C') {
          for (var qi = 0; qi < remaining.length; qi++) {
            if (closeChars.indexOf(remaining[qi]) !== -1 || remaining[qi] === '"') {
              closeQuoteIdx = qi;
              break;
            }
          }
        }

        if (closeQuoteIdx !== -1) {
          var dialogue = remaining.substring(0, closeQuoteIdx);
          tokens.push({ type: 'dialogue', content: dialogue });
          remaining = remaining.substring(closeQuoteIdx + 1);
        } else {
          tokens.push({ type: 'text', content: openChar + remaining });
          remaining = '';
        }
      }
    }

    return tokens;
  }

  /**
   * 토큰을 HTML로 조립
   * 각 토큰 사이에 빈 줄 (\n\n) 삽입 → 소설 포맷
   */
  function tokensToHtml(tokens, opts) {
    var useItalic = opts.italic !== false;
    var dialogueStyle = opts.dialogueStyle || 'normal';
    var indentStage = opts.indentStage || false;
    var indentDialogue = opts.indentDialogue || false;

    var parts = [];
    for (var t = 0; t < tokens.length; t++) {
      var tok = tokens[t];

      if (tok.type === 'stage') {
        var stageClass = indentStage ? ' class="indent"' : '';
        if (useItalic) {
          parts.push('<p' + stageClass + '><em>' + escapeHtml(tok.content) + '</em></p>');
        } else {
          parts.push('<p' + stageClass + '>' + escapeHtml(tok.content) + '</p>');
        }
      } else if (tok.type === 'dialogue') {
        var dClass = indentDialogue ? ' class="indent"' : '';
        var dText = escapeHtml(tok.content);
        switch (dialogueStyle) {
          case 'bold':
            parts.push('<p' + dClass + '><strong>\u201C' + dText + '\u201D</strong></p>');
            break;
          case 'no-quote':
            parts.push('<p' + dClass + '>' + dText + '</p>');
            break;
          case 'normal':
          default:
            parts.push('<p' + dClass + '>\u201C' + dText + '\u201D</p>');
            break;
        }
      } else {
        // 일반 텍스트 — 따옴표 없는 대사일 수 있음
        parts.push('<p>' + escapeHtml(tok.content) + '</p>');
      }
    }

    return parts.join('\n');
  }

  // 메인 서식 변환
  function format(text, options) {
    if (!text) return '';
    var opts = options || {};
    var tokens = tokenize(text);
    return tokensToHtml(tokens, opts);
  }

  function formatForEpub(text, options) {
    return format(text, options);
  }

  function formatForPreview(text, options) {
    return format(text, options);
  }

  return {
    format: format,
    formatForEpub: formatForEpub,
    formatForPreview: formatForPreview,
    escapeHtml: escapeHtml
  };
})();
