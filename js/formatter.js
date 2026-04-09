/* ═══════════════════════════════════════
   formatter.js — 서식 변환
   *지문* ↔ 대사/텍스트 분리
   상태창 영역 별도 처리
   ═══════════════════════════════════════ */

var ChatFormatter = (function () {

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * 상태창 영역 분리
   * statusMarker: 상태창 시작 기준 텍스트
   * statusEndMarker: 상태창 끝 기준 텍스트 (없으면 메시지 끝까지)
   * 반환: { body: 본문 텍스트, statusBlocks: [상태창 텍스트들] }
   */
  function separateStatusBlocks(text, statusMarker, statusEndMarker) {
    if (!statusMarker || !text) return { body: text, statusBlocks: [] };

    var blocks = [];
    var bodyParts = [];
    var remaining = text;

    while (remaining.length > 0) {
      var startIdx = remaining.indexOf(statusMarker);
      if (startIdx === -1) {
        bodyParts.push(remaining);
        break;
      }

      // 시작 마커 전까지는 본문
      if (startIdx > 0) {
        bodyParts.push(remaining.substring(0, startIdx));
      }

      var afterMarker = remaining.substring(startIdx);

      if (statusEndMarker && statusEndMarker.trim()) {
        // 끝 마커가 있으면 그 사이만 상태창
        var markerAfterStart = afterMarker.substring(statusMarker.length);
        var endIdx = markerAfterStart.indexOf(statusEndMarker);
        if (endIdx !== -1) {
          blocks.push(afterMarker.substring(0, statusMarker.length + endIdx + statusEndMarker.length));
          remaining = markerAfterStart.substring(endIdx + statusEndMarker.length);
        } else {
          // 끝 마커 못 찾으면 나머지 전부 상태창
          blocks.push(afterMarker);
          remaining = '';
        }
      } else {
        // 끝 마커 없으면 나머지 전부 상태창
        blocks.push(afterMarker);
        remaining = '';
      }
    }

    return { body: bodyParts.join(''), statusBlocks: blocks };
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

      // ** (볼드/장식) 처리
      if (idxStar !== -1 && idxStar + 1 < remaining.length && remaining[idxStar + 1] === '*') {
        var starEnd = idxStar;
        while (starEnd < remaining.length && remaining[starEnd] === '*') starEnd++;
        var starCount = starEnd - idxStar;

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

        remaining = remaining.substring(idxQuote + 1);

        var closeQuoteIdx = -1;
        var closeChars = ['"', '\u201D', '\u201C', '"'];
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
        if (autoDialogue && tok.content.trim()) {
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

  /**
   * 상태창 블록을 HTML로 변환
   */
  function statusBlockToHtml(rawText, style, colors) {
    var escaped = escapeHtml(rawText);
    style = style || 'raw';
    colors = colors || {};

    switch (style) {
      case 'hide':
        return '';
      case 'code':
        return '<div class="status-block status-block-code">' + escaped + '</div>';
      case 'box':
        var bg = colors.bg || '#f8f9fb';
        var border = colors.border || '#e2e8f0';
        var textCol = colors.text || '#64748b';
        return '<div class="status-block status-block-box" style="background:' + bg +
          ';border:1px solid ' + border + ';color:' + textCol + ';">' + escaped + '</div>';
      case 'raw':
      default:
        return '<div class="status-block status-block-raw">' + escaped + '</div>';
    }
  }

  function format(text, options) {
    if (!text) return '';
    var opts = options || {};

    // 상태창 분리
    var statusOpts = opts.statusBlock || {};
    var separated = separateStatusBlocks(text, statusOpts.marker, statusOpts.endMarker);

    // 본문 서식 변환
    var bodyTokens = tokenize(separated.body);
    var bodyHtml = tokensToHtml(bodyTokens, opts);

    // 상태창 HTML
    if (separated.statusBlocks.length > 0 && statusOpts.style !== 'hide') {
      for (var i = 0; i < separated.statusBlocks.length; i++) {
        bodyHtml += '\n' + statusBlockToHtml(separated.statusBlocks[i], statusOpts.style, statusOpts.colors);
      }
    }

    return bodyHtml;
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
    escapeHtml: escapeHtml,
    separateStatusBlocks: separateStatusBlocks,
    statusBlockToHtml: statusBlockToHtml
  };
})();
