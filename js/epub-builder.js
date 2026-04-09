/* ═══════════════════════════════════════
   epub-builder.js — epub 3.0 생성
   JSZip 사용
   ═══════════════════════════════════════ */

var EpubBuilder = (function () {

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function build(chapters, options) {
    var opts = options || {};
    var title = opts.title || '채팅 백업';
    var author = opts.author || '';
    var uuid = generateUUID();
    var coverData = opts.coverData || null;
    var coverType = opts.coverType || 'image/jpeg';
    var formatOpts = opts.formatOptions || {};
    var epubLineHeight = opts.lineHeight || 1.8;

    var textAlign = formatOpts.textAlign || 'left';
    var letterSpacing = formatOpts.letterSpacing || 0;
    var indentStage = formatOpts.indentStage || false;
    var indentDialogue = formatOpts.indentDialogue || false;

    var zip = new JSZip();

    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    zip.file('META-INF/container.xml',
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n' +
      '  <rootfiles>\n' +
      '    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n' +
      '  </rootfiles>\n' +
      '</container>'
    );

    var coverExt = 'jpg';
    if (coverType.indexOf('png') >= 0) coverExt = 'png';
    if (coverData) {
      zip.file('OEBPS/images/cover.' + coverExt, coverData, { binary: true });
    }

    // epub 스타일시트 (줄간격, 정렬, 자간, 들여쓰기 모두 반영)
    var epubCSS = [
      'body {',
      '  font-family: serif;',
      '  line-height: ' + epubLineHeight + ';',
      '  margin: 1em;',
      '  color: #1a1a1a;',
      '  text-align: ' + textAlign + ';',
      '  letter-spacing: ' + letterSpacing + 'px;',
      '}',
      'h1 { font-size: 1.5em; margin-bottom: 0.5em; border-bottom: 1px solid #ccc; padding-bottom: 0.3em; }',
      'h2 { font-size: 1.2em; margin: 1em 0 0.5em; }',
      'p { margin: 0.8em 0; text-indent: 0; }',
      'p.indent { text-indent: 1em; }',
      'em { font-style: italic; color: #444; }',
      'strong { font-weight: bold; }',
      '.speaker { font-size: 0.85em; font-weight: bold; margin-top: 1em; }',
      '.speaker-user { color: #2563eb; }',
      '.speaker-ai { color: #7c3aed; }',
    ].join('\n');
    zip.file('OEBPS/style.css', epubCSS);

    var chapterFiles = [];
    for (var i = 0; i < chapters.length; i++) {
      var ch = chapters[i];
      var filename = 'chapter' + (i + 1) + '.xhtml';
      var xhtml = buildChapterXHTML(ch, i + 1, formatOpts, opts.showSpeaker !== false);
      zip.file('OEBPS/' + filename, xhtml);
      chapterFiles.push({ filename: filename, title: ch.title || ('Chapter ' + (i + 1)) });
    }

    if (coverData) {
      var coverXHTML =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<!DOCTYPE html>\n' +
        '<html xmlns="http://www.w3.org/1999/xhtml">\n' +
        '<head><title>표지</title></head>\n' +
        '<body style="text-align:center;margin:0;padding:0;">\n' +
        '<img src="images/cover.' + coverExt + '" alt="표지" style="max-width:100%;max-height:100%;"/>\n' +
        '</body></html>';
      zip.file('OEBPS/cover.xhtml', coverXHTML);
    }

    var navItems = chapterFiles.map(function (cf) {
      return '      <li><a href="' + cf.filename + '">' + ChatFormatter.escapeHtml(cf.title) + '</a></li>';
    }).join('\n');

    var navXHTML =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<!DOCTYPE html>\n' +
      '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">\n' +
      '<head><title>목차</title></head>\n' +
      '<body>\n' +
      '  <nav epub:type="toc">\n' +
      '    <h1>목차</h1>\n' +
      '    <ol>\n' + navItems + '\n    </ol>\n' +
      '  </nav>\n' +
      '</body></html>';
    zip.file('OEBPS/nav.xhtml', navXHTML);

    var manifestItems = [];
    var spineItems = [];

    manifestItems.push('    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>');
    manifestItems.push('    <item id="style" href="style.css" media-type="text/css"/>');

    if (coverData) {
      manifestItems.push('    <item id="cover-img" href="images/cover.' + coverExt + '" media-type="' + coverType + '" properties="cover-image"/>');
      manifestItems.push('    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>');
      spineItems.push('    <itemref idref="cover"/>');
    }

    for (var j = 0; j < chapterFiles.length; j++) {
      var id = 'ch' + (j + 1);
      manifestItems.push('    <item id="' + id + '" href="' + chapterFiles[j].filename + '" media-type="application/xhtml+xml"/>');
      spineItems.push('    <itemref idref="' + id + '"/>');
    }

    var opf =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">\n' +
      '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n' +
      '    <dc:identifier id="uid">urn:uuid:' + uuid + '</dc:identifier>\n' +
      '    <dc:title>' + ChatFormatter.escapeHtml(title) + '</dc:title>\n' +
      '    <dc:language>ko</dc:language>\n' +
      (author ? '    <dc:creator>' + ChatFormatter.escapeHtml(author) + '</dc:creator>\n' : '') +
      '    <meta property="dcterms:modified">' + new Date().toISOString().replace(/\.\d+Z/, 'Z') + '</meta>\n' +
      '  </metadata>\n' +
      '  <manifest>\n' + manifestItems.join('\n') + '\n  </manifest>\n' +
      '  <spine>\n' + spineItems.join('\n') + '\n  </spine>\n' +
      '</package>';
    zip.file('OEBPS/content.opf', opf);

    return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
  }

  function buildChapterXHTML(chapter, chapterNum, formatOpts, showSpeaker) {
    var body = '<h1>' + ChatFormatter.escapeHtml(chapter.title || ('Chapter ' + chapterNum)) + '</h1>\n';

    for (var i = 0; i < chapter.turns.length; i++) {
      var turn = chapter.turns[i];
      for (var j = 0; j < turn.messages.length; j++) {
        var msg = turn.messages[j];

        if (showSpeaker) {
          var speakerClass = msg.speaker.type === 'user' ? 'speaker-user' : 'speaker-ai';
          body += '<p class="speaker ' + speakerClass + '">[' + ChatFormatter.escapeHtml(msg.speaker.name) + ']</p>\n';
        }

        body += ChatFormatter.formatForEpub(msg.text, formatOpts) + '\n';
      }
    }

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<!DOCTYPE html>\n' +
      '<html xmlns="http://www.w3.org/1999/xhtml">\n' +
      '<head>\n' +
      '  <title>' + ChatFormatter.escapeHtml(chapter.title || '') + '</title>\n' +
      '  <link rel="stylesheet" type="text/css" href="style.css"/>\n' +
      '</head>\n' +
      '<body>\n' + body + '</body>\n</html>';
  }

  return { build: build };
})();
