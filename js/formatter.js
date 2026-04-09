/* ═══════════════════════════════════════
   formatter.js — 서식 변환
   *지문* ↔ 대사/텍스트 분리
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

      // ** (볼드/장식) 처리 — 무시하고 일반 텍스트로
      if (idxStar !== -1 && idxStar + 1 < remaining.length && remaining[idxStar + 1] === '*') {
        // *** 이상도 처리
        var starEnd = idxStar;
        while (starEnd < remaining.length && remaining[starEnd] === '*') starEnd++;
        var starCount = starEnd - idxStar;

        // 닫는 같은 수의 * 찾기
        var closePattern = '';
        for (var sc = 0; sc < starCount; sc++) closePattern += '\\*';
        var closeRegex = new RegExp(closePattern);
        var afterStars = remaining.substring(starEnd);
        var closeMatch = afterStars.match(closeRegex);

        if (closeMatch) {
          var beforeBold = remaining.substring(0, idxStar).trim();
          if (beforeBold) tokens.push({ type: 'text', content: beforeBold });
          var boldContent = afterStars.substring(0, closeMatch.index);
          if (boldContent.trim()) tokens.push({ type: 'text', content: boldContent.trim() });
          remaining = afterStars.substring(closeMatch.index + starCount);
          continue;
        } else {
          // 닫히지 않은 ** → 그냥 스킵
          var beforeUnclosed = remaining.substring(0, idxStar).trim();
          if (beforeUnclosed) tokens.push({ type: 'text', content: beforeUnclosed });
          remaining = remaining.substring(starEnd);
          continue;
        }
      }

      var starFirst = idxStar !== -1 && (idxQuote === -1 || idxStar < idxQuote);
      var quoteFirst = idxQuote !== -1 && (idxStar === -1 || idxQuote < idxStar);

      if (starFirst) {
        var before = remaining.substring(0, idxStar).trim();
        if (before) tokens.push({ type: 'text', content: before });
        remaining = remaining.substring(idxStar + 1);

        // 닫는 단일 * 찾기
        var closeIdx = -1;
        for (var ci = 0; ci < remaining.length; ci++) {
          if (remaining[ci] === '*') {
            // ** 스킵
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
          // 닫히지 않은 * → 끝까지 지문
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
        var closeChars = ['"', '\u201D', '"'];
        for (var qi = 0; qi < remaining.length; qi++) {
          if (closeChars.indexOf(remaining[qi]) !== -1) {
            closeQuoteIdx = qi;
            break;
          }
        }

        if (closeQuoteIdx !== -1) {
          var dialogue = remaining.substring(0, closeQuoteIdx);
          tokens.push({ type: 'dialogue', content: dialogue });
          remaining = remaining.substring(closeQuoteIdx + 1);
        } else {
          // 닫히지 않은 따옴표 → 줄 끝까지 대사
          var restLine = remaining;
          var nlIdx = restLine.indexOf('\n');
          if (nlIdx !== -1) {
            tokens.push({ type: 'dialogue', content: restLine.substring(0, nlIdx).trim() });
            remaining = restLine.substring(nlIdx);
          } else {
            tokens.push({ type: 'dialogue', content: restLine.trim() });
            remaining = '';
          }
        }
      }
    }

    return tokens;
  }

  /**
   * 토큰을 HTML로 조립
   */
  function tokensToHtml(tokens, opts) {
    var useItalic = opts.italic !== false;
    var dialogueStyle = opts.dialogueStyle || 'normal';
    var indentStage = opts.indentStage || false;
    var indentDialogue = opts.indentDialogue || false;
    var autoDialogue = opts.autoDialogue || false;

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
        // 일반 텍스트
        if (autoDialogue && tok.content.trim()) {
          // 비지문 텍스트 → 대사로 처리
          var adClass = indentDialogue ? ' class="indent"' : '';
          var adText = escapeHtml(tok.content);
          switch (dialogueStyle) {
            case 'bold':
              parts.push('<p' + adClass + '><strong>\u201C' + adText + '\u201D</strong></p>');
              break;
            case 'no-quote':
              parts.push('<p' + adClass + '>' + adText + '</p>');
              break;
            case 'normal':
            default:
              parts.push('<p' + adClass + '>\u201C' + adText + '\u201D</p>');
              break;
          }
        } else {
          parts.push('<p>' + escapeHtml(tok.content) + '</p>');
        }
      }
    }

    return parts.join('\n');
  }

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
