/* ═══════════════════════════════════════
   formatter.js — 서식 변환
   *이탤릭* → <em>, "대사" 스타일 등
   ═══════════════════════════════════════ */

var ChatFormatter = (function () {

  // *텍스트* → <em>텍스트</em>
  // 여러 줄에 걸친 *...*도 지원
  function convertItalic(text) {
    // 단일 줄: *텍스트*
    // 주의: ** (볼드)는 건너뛰기, 단일 *만 매치
    return text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/gs, '<em>$1</em>');
  }

  // "대사" 스타일 변환
  function convertDialogue(text, style) {
    switch (style) {
      case 'bold':
        return text.replace(/"([^"]+)"/g, '<strong>"$1"</strong>');
      case 'no-quote':
        return text.replace(/"([^"]+)"/g, '<span class="dialogue">$1</span>');
      case 'indent':
        return text.replace(/"([^"]+)"/g, '<p class="dialogue-indent">"$1"</p>');
      case 'normal':
      default:
        return text.replace(/"([^"]+)"/g, '<span class="dialogue">"$1"</span>');
    }
  }

  // 줄바꿈 → <br> 또는 <p>
  function convertLineBreaks(text) {
    // 연속 줄바꿈은 문단 구분
    var paragraphs = text.split(/\n{2,}/);
    var result = paragraphs.map(function (p) {
      return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
    }).join('\n');
    return result;
  }

  // HTML 이스케이프 (서식 변환 전)
  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // 메인 서식 변환
  function format(text, options) {
    if (!text) return '';

    var opts = options || {};
    var useItalic = opts.italic !== false;
    var dialogueStyle = opts.dialogueStyle || 'normal';

    // 1. HTML 이스케이프
    var result = escapeHtml(text);

    // 2. 이탤릭 변환
    if (useItalic) {
      result = convertItalic(result);
    }

    // 3. 대사 변환
    result = convertDialogue(result, dialogueStyle);

    // 4. 줄바꿈 처리
    result = convertLineBreaks(result);

    return result;
  }

  // epub용 포맷 (XHTML 호환)
  function formatForEpub(text, options) {
    return format(text, options);
  }

  // 미리보기용 (그대로)
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
