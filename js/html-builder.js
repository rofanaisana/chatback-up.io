/* ═══════════════════════════════════════
   html-builder.js — HTML 파일 생성
   테마 템플릿 + 상태창 블록 지원
   ═══════════════════════════════════════ */

var HtmlBuilder = (function () {

  function build(chapters, options) {
    var opts = options || {};
    var title = opts.title || '채팅 백업';
    var fontFamily = opts.fontFamily || "'Noto Sans KR', sans-serif";
    var lineHeight = opts.lineHeight || 1.8;
    var padding = opts.padding || 40;
    var bgColor = opts.bgColor || '#ffffff';
    var textColor = opts.textColor || '#1a1a1a';
    var showSpeaker = opts.showSpeaker !== false;
    var userColor = opts.userColor || '#2563eb';
    var aiColor = opts.aiColor || '#7c3aed';
    var formatOpts = opts.formatOptions || {};
    var tpl = opts.template || null;

    var textAlign = formatOpts.textAlign || 'left';
    var letterSpacing = formatOpts.letterSpacing || 0;

    var css = [
      '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&family=Noto+Serif+KR:wght@400;700&family=Nanum+Myeongjo:wght@400;700&display=swap");',
      '* { box-sizing: border-box; margin: 0; padding: 0; }',
      'body {',
      '  font-family: ' + fontFamily + ';',
      '  line-height: ' + lineHeight + ';',
      '  padding: ' + padding + 'px;',
      '  max-width: 800px;',
      '  margin: 0 auto;',
      '  background: ' + bgColor + ';',
      '  color: ' + textColor + ';',
      '  text-align: ' + textAlign + ';',
      '  letter-spacing: ' + letterSpacing + 'px;',
      '}',
      'h1 { font-size: 1.8em; margin-bottom: 0.5em; text-align: center; }',
      'h2 { font-size: 1.4em; margin: 2em 0 0.8em; padding-bottom: 0.3em; border-bottom: 2px solid #e2e8f0; }',
      'p { margin: 0.8em 0; }',
      'p.indent { text-indent: 1em; }',
      'em { font-style: italic; color: #555; }',
      'strong { font-weight: bold; }',
      '.speaker { font-size: 0.85em; font-weight: bold; margin-top: 1.2em; }',
      '.speaker-user { color: ' + userColor + '; }',
      '.speaker-ai { color: ' + aiColor + '; }',
      '.chapter { margin-bottom: 3em; }',
      '.toc { margin: 2em 0; padding: 1.5em; background: #f8f9fb; border-radius: 12px; }',
      '.toc h2 { border: none; margin-top: 0; }',
      '.toc ol { padding-left: 1.5em; }',
      '.toc li { margin: 0.3em 0; }',
      '.toc a { color: ' + userColor + '; text-decoration: none; }',
      '.toc a:hover { text-decoration: underline; }',
      // 상태창 블록
      '.status-block { font-family: monospace; font-size: 0.85em; white-space: pre-wrap; margin: 0.8em 0; }',
      '.status-block-raw { color: #64748b; }',
      '.status-block-code { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; color: #475569; }',
      '.status-block-box { border-radius: 8px; padding: 10px 12px; }',
    ];

    if (tpl) {
      css.push('.turn-card {');
      css.push('  background: ' + tpl.turnBg + ';');
      css.push('  border: ' + tpl.turnBorderWidth + 'px solid ' + tpl.turnBorder + ';');
      css.push('  border-radius: ' + tpl.turnRadius + 'px;');
      css.push('  padding: ' + tpl.turnPadding + 'px;');
      css.push('  margin-bottom: ' + tpl.turnGap + 'px;');
      css.push('}');
      css.push('.msg-card { border-radius: ' + tpl.msgRadius + 'px; padding: ' + tpl.msgPadding + 'px; margin-bottom: 8px; }');
      css.push('.msg-user { background: ' + tpl.userBg + '; color: ' + (tpl.userText || textColor) + '; border: 1px solid ' + (tpl.userBorder || 'transparent') + '; }');
      css.push('.msg-ai { background: ' + tpl.aiBg + '; color: ' + (tpl.aiText || textColor) + '; border: 1px solid ' + (tpl.aiBorder || 'transparent') + '; }');

      if (tpl.chapterDivider !== 'none') {
        var borderStyle = tpl.chapterDivider === 'double' ? '4px double #e2e8f0' :
                          tpl.chapterDivider === 'dashed' ? '2px dashed #e2e8f0' :
                          tpl.chapterDivider === 'dotted' ? '2px dotted #e2e8f0' :
                          '2px solid #e2e8f0';
        css.push('.chapter + .chapter { border-top: ' + borderStyle + '; padding-top: 2em; }');
      }
    }

    var cssStr = css.join('\n');

    // 목차
    var tocHtml = '<div class="toc"><h2>📑 목차</h2><ol>\n';
    for (var i = 0; i < chapters.length; i++) {
      var chTitle = chapters[i].title || ('Chapter ' + (i + 1));
      tocHtml += '  <li><a href="#chapter-' + (i + 1) + '">' + ChatFormatter.escapeHtml(chTitle) + '</a></li>\n';
    }
    tocHtml += '</ol></div>\n';

    // 본문
    var bodyHtml = '<h1>' + ChatFormatter.escapeHtml(title) + '</h1>\n' + tocHtml;

    for (var c = 0; c < chapters.length; c++) {
      var ch = chapters[c];
      var chapterTitle = ch.title || ('Chapter ' + (c + 1));

      bodyHtml += '<div class="chapter" id="chapter-' + (c + 1) + '">\n';
      bodyHtml += '<h2>' + ChatFormatter.escapeHtml(chapterTitle) + '</h2>\n';

      for (var t = 0; t < ch.turns.length; t++) {
        var turn = ch.turns[t];

        if (tpl) bodyHtml += '<div class="turn-card">\n';

        for (var m = 0; m < turn.messages.length; m++) {
          var msg = turn.messages[m];
          var msgClass = tpl ? ('msg-card ' + (msg.speaker.type === 'user' ? 'msg-user' : 'msg-ai')) : '';

          if (showSpeaker) {
            var sc = msg.speaker.type === 'user' ? 'speaker-user' : 'speaker-ai';
            bodyHtml += '<p class="speaker ' + sc + '">[' + ChatFormatter.escapeHtml(msg.speaker.name) + ']</p>\n';
          }

          if (tpl) bodyHtml += '<div class="' + msgClass + '">\n';
          bodyHtml += ChatFormatter.format(msg.text, formatOpts) + '\n';
          if (tpl) bodyHtml += '</div>\n';
        }

        if (tpl) bodyHtml += '</div>\n';
      }

      bodyHtml += '</div>\n';
    }

    var fullHtml =
      '<!DOCTYPE html>\n' +
      '<html lang="ko">\n' +
      '<head>\n' +
      '  <meta charset="UTF-8">\n' +
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '  <title>' + ChatFormatter.escapeHtml(title) + '</title>\n' +
      '  <style>\n' + cssStr + '\n  </style>\n' +
      '</head>\n' +
      '<body>\n' + bodyHtml + '</body>\n' +
      '</html>';

    return fullHtml;
  }

  function download(html, filename) {
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (filename || 'chat') + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { build: build, download: download };
})();
