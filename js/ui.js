/* ═══════════════════════════════════════
   ui.js — UI 인터랙션, 미리보기, 이벤트
   페이지네이션 + 분할저장 + 파싱설정
   ═══════════════════════════════════════ */

(function () {
  'use strict';

  var PREVIEW_PAGE_SIZE = 50; // 미리보기 한 페이지에 보여줄 턴 수

  var state = {
    rawText: '',
    parsed: null,
    chapters: [],
    manualBreaks: new Set(),
    chapterNames: [],
    coverData: null,
    coverType: '',
    previewPage: 0,
  };

  var $ = function (id) { return document.getElementById(id); };

  function init() {
    bindEvents();
  }

  function bindEvents() {
    // 파일 업로드
    var dropZone = $('drop-zone');
    var fileInput = $('file-input');
    dropZone.addEventListener('click', function () { fileInput.click(); });
    dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', function () { dropZone.classList.remove('drag-over'); });
    dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', function () { if (fileInput.files.length) handleFile(fileInput.files[0]); });
    $('file-clear').addEventListener('click', clearFile);

    // 표지
    $('cover-input').addEventListener('change', handleCover);
    $('cover-clear').addEventListener('click', clearCover);

    // 파싱 설정
    $('btn-reparse').addEventListener('click', reparseFile);

    // 챕터 모드
    document.querySelectorAll('input[name="chapter-mode"]').forEach(function (r) {
      r.addEventListener('change', onChapterModeChange);
    });
    ['group-size'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', refreshAll);
    });
    ['fmt-dialogue', 'fmt-align'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', function () { state.previewPage = 0; refreshAll(); });
    });

    $('chapter-format').addEventListener('change', function () {
      onChapterFormatChange();
      refreshAll();
    });

    ['fmt-italic', 'fmt-speaker', 'fmt-indent-stage', 'fmt-indent-dialogue', 'fmt-auto-dialogue'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', function () { state.previewPage = 0; refreshAll(); });
    });
    ['style-user-color', 'style-ai-color'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', refreshPreview);
    });

    $('fmt-letter-spacing').addEventListener('input', function () {
      $('fmt-ls-val').textContent = this.value + 'px';
      refreshPreview();
    });
    $('html-line-height').addEventListener('input', function () {
      $('html-lh-val').textContent = this.value;
      refreshPreview();
    });

    ['html-font', 'html-padding', 'html-bg', 'html-text-color'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', refreshPreview);
    });

    // 내보내기
    $('btn-epub').addEventListener('click', doExport.bind(null, 'epub'));
    $('btn-html-download').addEventListener('click', doExport.bind(null, 'html'));
    $('btn-html-code').addEventListener('click', showHtmlCode);
    $('btn-copy-code').addEventListener('click', copyHtmlCode);
    $('btn-back-preview').addEventListener('click', backToPreview);

    // 분할 저장 토글
    document.querySelectorAll('input[name="export-mode"]').forEach(function (r) {
      r.addEventListener('change', function () {
        $('split-options').classList.toggle('hidden', this.value !== 'split');
      });
    });

    // 챕터 편집
    var editBtn = $('btn-edit-chapters');
    if (editBtn) editBtn.addEventListener('click', openChapterModal);
    $('chapter-modal-cancel').addEventListener('click', closeChapterModal);
    $('chapter-modal-save').addEventListener('click', saveChapterNames);
    $('chapter-modal').addEventListener('click', function (e) {
      if (e.target === $('chapter-modal')) closeChapterModal();
    });

    // 스피커 토글
    $('fmt-speaker').addEventListener('change', function () {
      $('speaker-style-wrap').style.display = this.checked ? 'block' : 'none';
    });

    // 템플릿 토글
    $('tpl-enable').addEventListener('change', function () {
      $('tpl-options').classList.toggle('hidden', !this.checked);
      refreshPreview();
    });

    ['tpl-turn-bg', 'tpl-turn-border', 'tpl-turn-border-width', 'tpl-turn-radius',
     'tpl-turn-padding', 'tpl-turn-gap', 'tpl-user-bg', 'tpl-ai-bg',
     'tpl-msg-radius', 'tpl-msg-padding', 'tpl-chapter-divider'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', refreshPreview);
    });

    // 페이지네이션
    $('prev-page').addEventListener('click', function () {
      if (state.previewPage > 0) { state.previewPage--; refreshPreview(); }
    });
    $('next-page').addEventListener('click', function () {
      var totalTurns = state.parsed ? state.parsed.turns.length : 0;
      var maxPage = Math.ceil(totalTurns / PREVIEW_PAGE_SIZE) - 1;
      if (state.previewPage < maxPage) { state.previewPage++; refreshPreview(); }
    });
  }

  // ── 파일 ──
  function handleFile(file) {
    if (!file.name.endsWith('.txt')) {
      showToast('❌ txt 파일만 지원합니다');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      state.rawText = e.target.result;
      state.parsed = ChatParser.parse(state.rawText);
      state.manualBreaks = new Set();
      state.chapterNames = [];
      state.previewPage = 0;
      $('file-name').textContent = '📄 ' + file.name;
      $('file-info').classList.remove('hidden');
      $('drop-zone').classList.add('hidden');
      if (state.parsed.header.title) {
        $('meta-title').value = state.parsed.header.title;
      }
      updateDetectedInfo();
      showPanels();
      refreshAll();
      showToast('✅ ' + state.parsed.turns.length + '개 턴 감지!');
    };
    reader.readAsText(file, 'UTF-8');
  }

  function reparseFile() {
    if (!state.rawText) { showToast('❌ 먼저 파일을 업로드하세요'); return; }
    var opts = {};
    var sepVal = $('parse-turn-sep').value.trim();
    var userVal = $('parse-user-marker').value.trim();
    var aiVal = $('parse-ai-marker').value.trim();
    if (sepVal) opts.turnSeparator = sepVal;
    if (userVal) opts.userMarker = userVal;
    if (aiVal) opts.aiMarker = aiVal;

    state.parsed = ChatParser.parse(state.rawText, opts);
    state.manualBreaks = new Set();
    state.chapterNames = [];
    state.previewPage = 0;
    updateDetectedInfo();
    refreshAll();
    showToast('🔄 다시 파싱 완료! ' + state.parsed.turns.length + '개 턴');
  }

  function updateDetectedInfo() {
    if (!state.parsed) return;
    var p = state.parsed;
    $('detected-sep').textContent = p.detectedSep || '(자동 감지됨)';
    $('detected-user').textContent = p.detectedNames && p.detectedNames.user ? p.detectedNames.user : '-';
    $('detected-ai').textContent = p.detectedNames && p.detectedNames.ai ? p.detectedNames.ai : '-';
  }

  function clearFile() {
    state.rawText = '';
    state.parsed = null;
    state.chapters = [];
    state.manualBreaks = new Set();
    state.chapterNames = [];
    state.previewPage = 0;
    $('file-info').classList.add('hidden');
    $('drop-zone').classList.remove('hidden');
    $('file-input').value = '';
    hidePanels();
    $('empty-state').classList.remove('hidden');
    $('preview-area').classList.add('hidden');
    $('code-area').classList.add('hidden');
  }

  function showPanels() {
    ['parse-panel', 'meta-panel', 'chapter-panel', 'format-panel', 'html-style-panel', 'template-panel', 'export-panel'].forEach(function (id) {
      $(id).classList.remove('hidden');
    });
    $('empty-state').classList.add('hidden');
    $('preview-area').classList.remove('hidden');
    $('code-area').classList.add('hidden');
    onChapterFormatChange();
  }

  function hidePanels() {
    ['parse-panel', 'meta-panel', 'chapter-panel', 'format-panel', 'html-style-panel', 'template-panel', 'export-panel'].forEach(function (id) {
      $(id).classList.add('hidden');
    });
    var editBtn = $('btn-edit-chapters');
    if (editBtn) editBtn.classList.add('hidden');
  }

  // ── 표지 ──
  function handleCover() {
    var file = $('cover-input').files[0];
    if (!file) return;
    state.coverType = file.type;
    var reader = new FileReader();
    reader.onload = function (e) {
      state.coverData = e.target.result;
      $('cover-img').src = URL.createObjectURL(file);
      $('cover-preview').classList.remove('hidden');
    };
    reader.readAsArrayBuffer(file);
  }

  function clearCover() {
    state.coverData = null;
    state.coverType = '';
    $('cover-input').value = '';
    $('cover-preview').classList.add('hidden');
  }

  // ── 챕터 ──
  function onChapterModeChange() {
    var mode = document.querySelector('input[name="chapter-mode"]:checked').value;
    $('group-size-wrap').classList.toggle('hidden', mode !== 'group');
    state.previewPage = 0;
    refreshAll();
  }

  function onChapterFormatChange() {
    var format = $('chapter-format').value;
    var editBtn = $('btn-edit-chapters');
    if (editBtn) editBtn.classList.toggle('hidden', format !== 'custom');
  }

  function openChapterModal() {
    if (!state.chapters.length) { showToast('❌ 먼저 파일을 업로드하세요'); return; }
    var listEl = $('chapter-list');
    listEl.innerHTML = '';
    for (var i = 0; i < state.chapters.length; i++) {
      var item = document.createElement('div');
      item.className = 'chapter-item';
      var span = document.createElement('span');
      span.textContent = (i + 1) + '.';
      var input = document.createElement('input');
      input.type = 'text';
      input.value = state.chapterNames[i] || state.chapters[i].title;
      input.dataset.idx = i;
      input.placeholder = '챕터 이름 입력';
      item.appendChild(span);
      item.appendChild(input);
      listEl.appendChild(item);
    }
    $('chapter-modal').classList.remove('hidden');
  }

  function closeChapterModal() { $('chapter-modal').classList.add('hidden'); }

  function saveChapterNames() {
    var inputs = $('chapter-list').querySelectorAll('input');
    inputs.forEach(function (input) {
      var idx = parseInt(input.dataset.idx);
      var val = input.value.trim();
      if (val) state.chapterNames[idx] = val;
    });
    closeChapterModal();
    refreshAll();
    showToast('✅ 챕터 이름 적용 완료!');
  }

  function buildChapters() {
    if (!state.parsed) return [];
    var turns = state.parsed.turns;
    var mode = document.querySelector('input[name="chapter-mode"]:checked').value;
    var format = $('chapter-format').value;
    var chapters = [];

    if (mode === 'per-turn') {
      for (var i = 0; i < turns.length; i++) {
        chapters.push({ title: getChapterTitle(format, i, i, i), turns: [turns[i]] });
      }
    } else if (mode === 'group') {
      var size = parseInt($('group-size').value) || 10;
      for (var g = 0; g < turns.length; g += size) {
        var end = Math.min(g + size, turns.length);
        chapters.push({ title: getChapterTitle(format, chapters.length, g, end - 1), turns: turns.slice(g, end) });
      }
    } else if (mode === 'manual') {
      var breakPoints = Array.from(state.manualBreaks).sort(function (a, b) { return a - b; });
      var prev = 0;
      for (var b = 0; b < breakPoints.length; b++) {
        chapters.push({ title: getChapterTitle(format, chapters.length, prev, breakPoints[b] - 1), turns: turns.slice(prev, breakPoints[b]) });
        prev = breakPoints[b];
      }
      if (prev < turns.length) {
        chapters.push({ title: getChapterTitle(format, chapters.length, prev, turns.length - 1), turns: turns.slice(prev) });
      }
    }

    for (var c = 0; c < chapters.length; c++) {
      if (state.chapterNames[c]) chapters[c].title = state.chapterNames[c];
    }
    state.chapters = chapters;
    return chapters;
  }

  function getChapterTitle(format, idx, fromTurn, toTurn) {
    if (format === 'custom' && state.chapterNames[idx]) return state.chapterNames[idx];
    switch (format) {
      case 'chapter': return 'Chapter ' + (idx + 1);
      case 'jang': return (idx + 1) + '장';
      case 'turn': return 'Turn ' + (fromTurn + 1) + '~' + (toTurn + 1);
      case 'custom': return (idx + 1) + '장';
      default: return 'Chapter ' + (idx + 1);
    }
  }

  // ── 옵션 수집 ──
  function getFormatOptions() {
    return {
      italic: $('fmt-italic').checked,
      dialogueStyle: $('fmt-dialogue').value,
      textAlign: $('fmt-align').value,
      letterSpacing: parseFloat($('fmt-letter-spacing').value),
      indentStage: $('fmt-indent-stage').checked,
      indentDialogue: $('fmt-indent-dialogue').checked,
      autoDialogue: $('fmt-auto-dialogue').checked,
    };
  }

  function getTemplateOptions() {
    if (!$('tpl-enable').checked) return null;
    return {
      turnBg: $('tpl-turn-bg').value,
      turnBorder: $('tpl-turn-border').value,
      turnBorderWidth: parseInt($('tpl-turn-border-width').value) || 1,
      turnRadius: parseInt($('tpl-turn-radius').value) || 12,
      turnPadding: parseInt($('tpl-turn-padding').value) || 20,
      turnGap: parseInt($('tpl-turn-gap').value) || 16,
      userBg: $('tpl-user-bg').value,
      aiBg: $('tpl-ai-bg').value,
      msgRadius: parseInt($('tpl-msg-radius').value) || 8,
      msgPadding: parseInt($('tpl-msg-padding').value) || 12,
      chapterDivider: $('tpl-chapter-divider').value,
    };
  }

  function getHtmlOptions() {
    return {
      title: $('meta-title').value || '채팅 백업',
      fontFamily: $('html-font').value,
      lineHeight: parseFloat($('html-line-height').value),
      padding: parseInt($('html-padding').value),
      bgColor: $('html-bg').value,
      textColor: $('html-text-color').value,
      showSpeaker: $('fmt-speaker').checked,
      userColor: $('style-user-color').value,
      aiColor: $('style-ai-color').value,
      formatOptions: getFormatOptions(),
      template: getTemplateOptions(),
    };
  }

  // ── 미리보기 (페이지네이션) ──
  function refreshAll() {
    buildChapters();
    refreshPreview();
  }

  function refreshPreview() {
    if (!state.parsed) return;

    var chapters = state.chapters;
    var formatOpts = getFormatOptions();
    var showSpeaker = $('fmt-speaker').checked;
    var userColor = $('style-user-color').value;
    var aiColor = $('style-ai-color').value;
    var mode = document.querySelector('input[name="chapter-mode"]:checked').value;
    var tpl = getTemplateOptions();

    var fontFamily = $('html-font').value;
    var lineHeight = parseFloat($('html-line-height').value);
    var bgColor = $('html-bg').value;
    var textColor = $('html-text-color').value;
    var textAlign = formatOpts.textAlign || 'left';
    var letterSpacing = formatOpts.letterSpacing || 0;

    var totalTurns = state.parsed.turns.length;
    var totalPages = Math.max(1, Math.ceil(totalTurns / PREVIEW_PAGE_SIZE));
    if (state.previewPage >= totalPages) state.previewPage = totalPages - 1;

    $('turn-count').textContent = totalTurns + '개 턴 · ' + chapters.length + '개 챕터';

    // 페이지네이션: 현재 페이지에 해당하는 턴 범위
    var pageStart = state.previewPage * PREVIEW_PAGE_SIZE;
    var pageEnd = Math.min(pageStart + PREVIEW_PAGE_SIZE, totalTurns);

    // 어떤 챕터의 어떤 턴이 이 범위에 해당하는지 계산
    var html = '';
    var globalTurnIdx = 0;

    for (var c = 0; c < chapters.length; c++) {
      var chTurns = chapters[c].turns;
      var chStart = globalTurnIdx;
      var chEnd = globalTurnIdx + chTurns.length;

      // 이 챕터가 현재 페이지 범위와 겹치는지
      if (chEnd <= pageStart || chStart >= pageEnd) {
        globalTurnIdx += chTurns.length;
        continue;
      }

      html += '<div class="preview-chapter">';
      html += '<div class="preview-chapter-title">' + ChatFormatter.escapeHtml(chapters[c].title) + '</div>';

      for (var t = 0; t < chTurns.length; t++) {
        var absoluteIdx = globalTurnIdx + t;
        if (absoluteIdx < pageStart || absoluteIdx >= pageEnd) continue;

        var turn = chTurns[t];

        if (tpl) {
          html += '<div class="preview-turn" style="background:' + tpl.turnBg +
            ';border:' + tpl.turnBorderWidth + 'px solid ' + tpl.turnBorder +
            ';border-radius:' + tpl.turnRadius + 'px;padding:' + tpl.turnPadding +
            'px;margin-bottom:' + tpl.turnGap + 'px;">';
        } else {
          html += '<div class="preview-turn">';
        }

        for (var m = 0; m < turn.messages.length; m++) {
          var msg = turn.messages[m];
          var msgStyle = '';
          if (tpl) {
            var mBg = msg.speaker.type === 'user' ? tpl.userBg : tpl.aiBg;
            msgStyle = ' style="background:' + mBg + ';border-radius:' + tpl.msgRadius +
              'px;padding:' + tpl.msgPadding + 'px;margin-bottom:8px;"';
          }

          if (showSpeaker) {
            var color = msg.speaker.type === 'user' ? userColor : aiColor;
            var bgc = msg.speaker.type === 'user' ? '#eff6ff' : '#f5f3ff';
            html += '<div class="preview-speaker" style="color:' + color + ';background:' + bgc + ';">[' + ChatFormatter.escapeHtml(msg.speaker.name) + ']</div>';
          }

          html += '<div class="preview-message"' + msgStyle + '>' + ChatFormatter.formatForPreview(msg.text, formatOpts) + '</div>';
        }
        html += '</div>';

        if (mode === 'manual' && (absoluteIdx + 1) < totalTurns) {
          var isActive = state.manualBreaks.has(absoluteIdx + 1);
          html += '<button class="chapter-break-btn ' + (isActive ? 'active' : '') +
            '" data-turn-idx="' + (absoluteIdx + 1) + '">' +
            (isActive ? '✂️ 여기서 챕터 나눔' : '➕ 여기서 챕터 나누기') + '</button>';
        }
      }
      html += '</div>';

      globalTurnIdx += chTurns.length;
    }

    var previewContent = $('preview-content');
    previewContent.innerHTML = html;
    previewContent.style.fontFamily = fontFamily;
    previewContent.style.lineHeight = lineHeight;
    previewContent.style.background = bgColor;
    previewContent.style.color = textColor;
    previewContent.style.textAlign = textAlign;
    previewContent.style.letterSpacing = letterSpacing + 'px';

    // 페이지네이션 UI
    if (totalPages > 1) {
      $('preview-pagination').classList.remove('hidden');
      $('page-info').textContent = (state.previewPage + 1) + ' / ' + totalPages + ' 페이지 (턴 ' + (pageStart + 1) + '~' + pageEnd + ')';
      $('prev-page').disabled = state.previewPage === 0;
      $('next-page').disabled = state.previewPage >= totalPages - 1;
    } else {
      $('preview-pagination').classList.add('hidden');
    }

    // manual 모드 이벤트
    if (mode === 'manual') {
      document.querySelectorAll('.chapter-break-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = parseInt(this.dataset.turnIdx);
          if (state.manualBreaks.has(idx)) state.manualBreaks.delete(idx);
          else state.manualBreaks.add(idx);
          refreshAll();
        });
      });
    }
  }

  // ── 내보내기 (일괄 + 분할) ──
  function doExport(type) {
    if (!state.chapters.length) { showToast('❌ 변환할 내용이 없습니다'); return; }

    var exportMode = document.querySelector('input[name="export-mode"]:checked').value;

    if (exportMode === 'all') {
      if (type === 'epub') exportEpub(state.chapters);
      else exportHtmlFile(state.chapters);
    } else {
      exportSplit(type);
    }
  }

  function exportSplit(type) {
    var splitUnit = document.querySelector('input[name="split-unit"]:checked').value;
    var splitSize = parseInt($('split-size').value) || 10;
    var chunks = [];

    if (splitUnit === 'chapter') {
      for (var i = 0; i < state.chapters.length; i += splitSize) {
        chunks.push(state.chapters.slice(i, Math.min(i + splitSize, state.chapters.length)));
      }
    } else {
      // 턴 단위 분할
      var allTurns = state.parsed.turns;
      var format = $('chapter-format').value;
      for (var t = 0; t < allTurns.length; t += splitSize) {
        var end = Math.min(t + splitSize, allTurns.length);
        var slicedTurns = allTurns.slice(t, end);
        chunks.push([{
          title: getChapterTitle(format, chunks.length, t, end - 1),
          turns: slicedTurns
        }]);
      }
    }

    showToast('📦 ' + chunks.length + '개 파일 생성 중...', 0);
    var title = $('meta-title').value || 'chat';

    if (type === 'epub') {
      var promises = chunks.map(function (chunk, idx) {
        var opts = getEpubOptions();
        opts.title = title + ' (' + (idx + 1) + '/' + chunks.length + ')';
        return EpubBuilder.build(chunk, opts).then(function (blob) {
          return { blob: blob, filename: title + '_' + (idx + 1) + '.epub' };
        });
      });
      Promise.all(promises).then(function (results) {
        results.forEach(function (r) { downloadBlob(r.blob, r.filename); });
        showToast('✅ ' + results.length + '개 epub 저장 완료!');
      });
    } else {
      chunks.forEach(function (chunk, idx) {
        var htmlContent = HtmlBuilder.build(chunk, getHtmlOptions());
        var blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        downloadBlob(blob, title + '_' + (idx + 1) + '.html');
      });
      showToast('✅ ' + chunks.length + '개 html 저장 완료!');
    }
  }

  function getEpubOptions() {
    return {
      title: $('meta-title').value || '채팅 백업',
      author: $('meta-author').value || '',
      coverData: state.coverData,
      coverType: state.coverType,
      showSpeaker: $('fmt-speaker').checked,
      formatOptions: getFormatOptions(),
      lineHeight: parseFloat($('html-line-height').value),
    };
  }

  function exportEpub(chapters) {
    showToast('📚 epub 생성 중...', 0);
    var opts = getEpubOptions();
    EpubBuilder.build(chapters, opts).then(function (blob) {
      downloadBlob(blob, (opts.title || 'chat') + '.epub');
      showToast('✅ epub 저장 완료!');
    }).catch(function (e) {
      console.error(e);
      showToast('❌ epub 생성 오류: ' + e.message);
    });
  }

  function exportHtmlFile(chapters) {
    var html = HtmlBuilder.build(chapters, getHtmlOptions());
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, ($('meta-title').value || 'chat') + '.html');
    showToast('✅ html 파일 저장 완료!');
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── HTML 코드 보기 ──
  function showHtmlCode() {
    if (!state.chapters.length) { showToast('❌ 변환할 내용이 없습니다'); return; }
    var html = HtmlBuilder.build(state.chapters, getHtmlOptions());
    $('code-output').value = html;
    $('preview-area').classList.add('hidden');
    $('code-area').classList.remove('hidden');
  }

  function backToPreview() {
    $('code-area').classList.add('hidden');
    $('preview-area').classList.remove('hidden');
  }

  function copyHtmlCode() {
    var code = $('code-output');
    code.select();
    document.execCommand('copy');
    showToast('📋 복사 완료!');
  }

  // ── 토스트 ──
  function showToast(msg, duration) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    if (duration !== 0) {
      setTimeout(function () { t.classList.add('hidden'); }, duration || 3000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
