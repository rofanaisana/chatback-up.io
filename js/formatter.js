/* ═══════════════════════════════════════
   formatter.js — 서식 변환
   *지문* ↔ "대사" 분리 + 줄바꿈 삽입
   ═══════════════════════════════════════ */

var ChatFormatter = (function () {

  // HTML 이스케이프
  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * 핵심 변환: *지문*과 "대사"를 분리하여 소설 포맷으로 재구성
   *
   * 입력: *그는 고개를 돌렸다.* "뭐야, 너." *낮은 목소리였다.*
   * 출력:
   *   그는 고개를 돌렸다.
   *   "뭐야, 너."
   *   낮은 목소리였다.
   *
   * - 닫히지 않은 *도 처리 (*부터 끝까지 지문으로 간주)
   * - "대사"와 지문 사이에 줄바꿈 삽입
   * - 이탤릭 옵션 ON이면 지문에 <em> 적용
   */
  function convertNovelStyle(text, useItalic) {
    if (!text) return '';

    // 토큰화: *지문*, "대사", 나머지 텍스트로 분리
    // 패턴: *...* (닫힘) 또는 *...(EOF) (닫히지 않음) 또는 "..."
    var tokens = [];
    var remaining = text;

    while (remaining.length > 0) {
      // 가장 먼저 나오는 * 또는 " 찾기
      var idxStar = remaining.indexOf('*');
      var idxQuote = -1;

      // " 또는 " 찾기 (큰따옴표 종류)
      var quoteMatch = remaining.match(/[""\u201C\u201D]/);
      if (quoteMatch) idxQuote = quoteMatch.index;

      // 둘 다 없으면 나머지 전체가 일반 텍스트
      if (idxStar === -1 && idxQuote === -1) {
        var plain = remaining.trim();
        if (plain) tokens.push({ type: 'text', content: plain });
        break;
      }

      // ** (볼드 마크다운) 건너뛰기
      if (idxStar !== -1 && remaining[idxStar + 1] === '*') {
        // **...** 패턴 — 통째로 텍스트로 취급
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

      // 어느 것이 먼저 오는지
      var starFirst = idxStar !== -1 && (idxQuote === -1 || idxStar < idxQuote);
      var quoteFirst = idxQuote !== -1 && (idxStar === -1 || idxQuote < idxStar);

      if (starFirst) {
        // * 앞의 텍스트 → 일반 텍스트
        var before = remaining.substring(0, idxStar).trim();
        if (before) tokens.push({ type: 'text', content: before });

        remaining = remaining.substring(idxStar + 1);

        // 닫는 * 찾기 (** 제외)
        var closeIdx = -1;
        for (var ci = 0; ci < remaining.length; ci++) {
          if (remaining[ci] === '*') {
            // **가 아닌 단일 *인지 확인
            if (ci + 1 < remaining.length && remaining[ci + 1] === '*') {
              ci++; // ** 건너뛰기
              continue;
            }
            if (ci > 0 && remaining[ci - 1] === '*') {
              continue; // ** 의 두번째
            }
            closeIdx = ci;
            break;
          }
        }

        if (closeIdx !== -1) {
          // 닫힌 지문
          var stage = remaining.substring(0, closeIdx).trim();
          if (stage) tokens.push({ type: 'stage', content: stage });
          remaining = remaining.substring(closeIdx + 1);
        } else {
          // 닫히지 않은 지문 — 끝까지 지문으로 처리
          var stageAll = remaining.trim();
          if (stageAll) tokens.push({ type: 'stage', content: stageAll });
          remaining = '';
        }

      } else if (quoteFirst) {
        // " 앞의 텍스트 → 일반 텍스트
        var beforeQ = remaining.substring(0, idxQuote).trim();
        if (beforeQ) tokens.push({ type: 'text', content: beforeQ });

        var openChar = remaining[idxQuote];
        remaining = remaining.substring(idxQuote + 1);

        // 닫는 따옴표 찾기
        var closeQuoteIdx = -1;
        var closeChars = ['"', '\u201D']; // " 또는 "
        if (openChar === '"' || openChar === '\u201C') {
          // 둘 다 매칭
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
          // 닫히지 않은 따옴표 → 대사 아닌 일반 텍스트로
          tokens.push({ type: 'text', content: openChar + remaining });
          remaining = '';
        }
      }
    }

    // 토큰 → HTML로 조립 (각 토큰 사이에 줄바꿈)
    var parts = [];
    for (var t = 0; t < tokens.length; t++) {
      var tok = tokens[t];
      if (tok.type === 'stage') {
        // 지문
        if (useItalic) {
          parts.push('<em>' + escapeHtml(tok.content) + '</em>');
        } else {
          parts.push(escapeHtml(tok.content));
        }
      } else if (tok.type === 'dialogue') {
        // 대사 — 따옴표 감싸서 출력
        parts.push(escapeHtml('"' + tok.content + '"'));
      } else {
        // 일반 텍스트
        parts.push(escapeHtml(tok.content));
      }
    }

    return parts.join('\n');
  }

  // "대사" 스타일 변환 (HTML 태그 적용 후)
  function applyDialogueStyle(html, style) {
    switch (style) {
      case 'bold':
        return html.replace(/&quot;([^&]*?)&quot;/g, '<strong>&quot;$1&quot;</strong>')
                    .replace(/"([^"<]*?)"/g, '<strong>"$1"</strong>');
      case 'no-quote':
        return html.replace(/&quot;([^&]*?)&quot;/g, '<span class="dialogue">$1</span>')
                    .replace(/"([^"<]*?)"/g, '<span class="dialogue">$1</span>');
      case 'indent':
        return html.replace(/&quot;([^&]*?)&quot;/g, '<span class="dialogue-indent">&quot;$1&quot;</span>')
                    .replace(/"([^"<]*?)"/g, '<span class="dialogue-indent">"$1"</span>');
      case 'normal':
      default:
        return html;
    }
  }

  // 줄바꿈 → <p>/<br>
  function convertLineBreaks(text) {
    var paragraphs = text.split(/\n{2,}/);
    var result = paragraphs.map(function (p) {
      return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
    }).join('\n');
    return result;
  }

  // 메인 서식 변환
  function format(text, options) {
    if (!text) return '';

    var opts = options || {};
    var useItalic = opts.italic !== false;
    var dialogueStyle = opts.dialogueStyle || 'normal';

    // 1. 소설 스타일 변환 (*지문*, "대사" 분리 + 줄바꿈)
    var result = convertNovelStyle(text, useItalic);

    // 2. 대사 스타일 적용
    result = applyDialogueStyle(result, dialogueStyle);

    // 3. 줄바꿈 → HTML
    result = convertLineBreaks(result);

    return result;
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
