/* ═══════════════════════════════════════
   formatter.js — 서식 변환
   *지문* ↔ 대사/텍스트 분리
   상태창 영역 별도 처리
   대사 볼드 독립 토글
   ═══════════════════════════════════════ */

var ChatFormatter = (function () {

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

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

      if (startIdx > 0) {
        bodyParts.push(remaining.substring(0, startIdx));
      }

      var afterMarker = remaining.substring(startIdx);

      if (statusEndMarker && statusEndMarker.trim()) {
        var markerAfterStart = afterMarker.substring(statusMarker.length);
        var endIdx = markerAfterStart.indexOf(statusEndMarker);
        if (endIdx !== -1) {
          blocks.push(afterMarker.substring(0, statusMarker.length + endIdx + statusEndMarker.length));
          remaining = markerAfterStart.substring(endIdx + statusEndMarker.length);
        } else {
          blocks.push(afterMarker);
          remaining = '';
        }
      } else {
        blocks.push(afterMarker);
        remaining = '';
      }
    }

    return { body: bodyParts.join(''), statusBlocks: blocks };
  }

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

    // 후처리: 지문(stage) 사이에 끼어 있는 text → dialogue로 변환
    if (tokens.length > 0) {
      var hasAnyStage = false;
      for (var si = 0; si < tokens.length; si++) {
        if (tokens[si].type === 'stage') { hasAnyStage = true; break; }
      }
      if (hasAnyStage) {
        for (var ti = 0; ti < tokens.length; ti++) {
          if (tokens[ti].type !== 'text') continue;
          var prevIsStage = false;
          var nextIsStage = false;
          for (var pi = ti - 1; pi >= 0; pi--) {
            if (tokens[pi].type === 'stage') { prevIsStage = true; break; }
            if (tokens[pi].type === 'dialogue') break;
          }
          for (var ni = ti + 1; ni < tokens.length; ni++) {
            if (tokens[ni].type === 'stage') { nextIsStage = true; break; }
            if (tokens[ni].type === 'dialogue') break;
          }
          if (prevIsStage || nextIsStage) {
            tokens[ti].type = 'dialogue';
          }
        }
      }
    }

    return tokens;
  }

  function buildDialogueHtml(text, dialogueStyle, dialogueBold, cssClass) {
    var escaped = escapeHtml(text);
    var inner;
    if (dialogueStyle === 'no-quote') {
      inner = escaped;
    } else {
      inner = '\u201C' + escaped + '\u201D';
    }
    if (dialogueBold) {
      inner = '<strong>' + inner + '</strong>';
    }
    var cls = cssClass ? ' class="' + cssClass + '"' : '';
    return '<p' + cls + '>' + inner + '</p>';
  }

  function buildStageHtml(text, useItalic, cssClass) {
    var escaped = escapeHtml(text);
    var inner = useItalic ? '<em>' + escaped + '</em>' : escaped;
    var cls = cssClass ? ' class="' + cssClass + '"' : '';
    return '<p' + cls + '>' + inner + '</p>';
  }

  function tokensToHtml(tokens, opts) {
    var useItalic = opts.italic !== false;
    var dialogueStyle = opts.dialogueStyle || 'normal';
    var dialogueBold = opts.dialogueBold || false;
    var indentStage = opts.indentStage || false;
    var indentDialogue = opts.indentDialogue || false;
    var autoDialogue = opts.autoDialogue || false;

    var parts = [];
    for (var t = 0; t < tokens.length; t++) {
      var tok = tokens[t];

      if (tok.type === 'stage') {
        parts.push(buildStageHtml(tok.content, useItalic, indentStage ? 'indent' : ''));
      } else if (tok.type === 'dialogue') {
        parts.push(buildDialogueHtml(tok.content, dialogueStyle, dialogueBold, indentDialogue ? 'indent' : ''));
      } else {
        if (autoDialogue && tok.content.trim()) {
          parts.push(buildDialogueHtml(tok.content, dialogueStyle, dialogueBold, indentDialogue ? 'indent' : ''));
        } else {
          parts.push('<p>' + escapeHtml(tok.content) + '</p>');
        }
      }
    }

    return parts.join('\n');
  }

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

    var statusOpts = opts.statusBlock || {};
    var separated = separateStatusBlocks(text, statusOpts.marker, statusOpts.endMarker);

    var bodyTokens = tokenize(separated.body);
    var bodyHtml = tokensToHtml(bodyTokens, opts);

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
