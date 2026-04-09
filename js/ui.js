/* ═══════════════════════════════════════
   ui.js — UI 인터랙션, 미리보기, 이벤트
   ═══════════════════════════════════════ */

(function () {
  'use strict';

  // ── 상태 ──
  var state = {
    rawText: '',
    parsed: null,
    chapters: [],
    manualBreaks: new Set(),
    chapterNames: [],
    coverData: null,
    coverType: '',
  };

  // ── DOM ──
  var $ = function (id) { return document.getElementById(id); };

  // ── 초기화 ──
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

    // 챕터 모드
    document.querySelectorAll('input[name="chapter-mode"]').forEach(function (r) {
      r.addEventListener('change', onChapterModeChange);
    });
    ['group-size', 'fmt-dialogue'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', refreshAll);
    });

    // 챕터 형식 변경
    $('chapter-format').addEventListener('change', function () {
      onChapterFormatChange();
      refreshAll();
    });

    ['fmt-italic', 'fmt-speaker'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', refreshAll);
    });
    ['style-user-color', 'style-ai-color'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', refreshPreview);
    });

    // 줄간격 표시
    $('html-line-height').addEventListener('input', function () {
      $('html-lh-val').textContent = this.value;
    });

    // HTML 스타일 변경 → 미리보기 갱신
    ['html-font', 'html-line-height', 'html-padding', 'html-bg', 'html-text-color'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', refreshPreview);
    });

    // 내보내기 버튼
    $('btn-epub').addEventListener('click', exportEpub);
    $('btn-html-download').addEventListener('click', exportHtmlFile);
    $('btn-html-code').addEventListener('click', showHtmlCode);
    $('btn-copy-code').addEventListener('click', copyHtmlCode);
    $('btn-close-code').addEventListener('click', function () { $('code-area').classList.add('hidden'); });

    // 챕터 이름 편집 버튼
    var editBtn = $('btn-edit-chapters');
    if (editBtn) editBtn.addEventListener('click', openChapterModal);

    // 챕터 모달 버튼
    $('chapter-modal-cancel').addEventListener('click', closeChapterModal);
    $('chapter-modal-save').addEventListener('click', saveChapterNames);

    // 모달 오버레이 클릭 닫기
    $('chapter-modal').addEventListener('click', function (e) {
      if (e.target === $('chapter-modal')) closeChapterModal();
    });

    // 스피커 표시 토글
    $('fmt-speaker').addEventListener('change', function () {
      $('speaker-style-wrap').style.display = this.checked ? 'block' : 'none';
    });
  }

  // ── 파일 처리 ──
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

      $('file-name').textContent = '📄 ' + file.name;
      $('file-info').classList.remove('hidden');
      $('drop-zone').classList.add('hidden');

      if (state.parsed.header.title) {
        $('meta-title').value = state.parsed.header.title;
      }

      showPanels();
      refreshAll();

      showToast('✅ ' + state.parsed.turns.length + '개 턴 감지!');
    };
    reader.readAsText(file, 'UTF-8');
  }

  function clearFile() {
    state.rawText = '';
    state.parsed = null;
    state.chapters = [];
    state.manualBreaks = new Set();
    state.chapterNames = [];

    $('file-info').classList.add('hidden');
    $('drop-zone').classList.remove('hidden');
    $('file-input').value = '';

    hidePanels();
    $('empty-state').classList.remove('hidden');
    $('preview-area').classList.add('hidden');
    $('code-area').classList.add('hidden');
  }

  function showPanels() {
    ['meta-panel', 'chapter-panel', 'format-panel', 'html-style-panel', 'export-panel'].forEach(function (id) {
      $(id).classList.remove('hidden');
    });
    $('empty-state').classList.add('hidden');
    $('preview-area').classList.remove('hidden');
    onChapterFormatChange(); // 직접 입력이면 편집 버튼 보이기
  }

  function hidePanels() {
    ['meta-panel', 'chapter-panel', 'format-panel', 'html-style-panel', 'export-panel'].forEach(function (id) {
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

  // ── 챕터 모드 ──
  function onChapterModeChange() {
    var mode = document.querySelector('input[name="chapter-mode"]:checked').value;
    $('group-size-wrap').classList.toggle('hidden', mode !== 'group');
    refreshAll();
  }

  // ── 챕터 형식 변경 → '직접 입력' 시 편집 버튼 표시 ──
  function onChapterFormatChange() {
    var format = $('chapter-format').value;
    var editBtn = $('btn-edit-chapters');
    if (editBtn) {
      if (format === 'custom') {
        editBtn.classList.remove('hidden');
      } else {
        editBtn.classList.add('hidden');
      }
    }
  }

  // ── 챕터 이름 편집 모달 ──
  function openChapterModal() {
    if (!state.chapters.length) {
      showToast('❌ 먼저 파일을 업로드하세요');
      return;
    }

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

  function closeChapterModal() {
    $('chapter-modal').classList.add('hidden');
  }

  function saveChapterNames() {
    var inputs = $('chapter-list').querySelectorAll('input');
    inputs.forEach(function (input) {
      var idx = parseInt(input.dataset.idx);
      var val = input.value.trim();
      if (val) {
        state.chapterNames[idx] = val;
      }
    });
    closeChapterModal();
    refreshAll();
    showToast('✅ 챕터 이름 적용 완료!');
  }

  // ── 챕터 빌드 ──
  function buildChapters() {
    if (!state.parsed) return [];

    var turns = state.parsed.turns;
    var mode = document.querySelector('input[name="chapter-mode"]:checked').value;
    var format = $('chapter-format').value;
    var chapters = [];

    if (mode === 'per-turn') {
      for (var i = 0; i < turns.length; i++) {
        chapters.push({
          title: getChapterTitle(format, i, i, i),
          turns: [turns[i]]
        });
      }
    } else if (mode === 'group') {
      var size = parseInt($('group-size').value) || 10;
      for (var g = 0; g < turns.length; g += size) {
        var end = Math.min(g + size, turns.length);
        chapters.push({
          title: getChapterTitle(format, chapters.length, g, end - 1),
          turns: turns.slice(g, end)
        });
      }
    } else if (mode === 'manual') {
      var breakPoints = Array.from(state.manualBreaks).sort(function (a, b) { return a - b; });
      var prev = 0;
      for (var b = 0; b < breakPoints.length; b++) {
        chapters.push({
          title: getChapterTitle(format, chapters.length, prev, breakPoints[b] - 1),
          turns: turns.slice(prev, breakPoints[b])
        });
        prev = breakPoints[b];
      }
      if (prev < turns.length) {
        chapters.push({
          title: getChapterTitle(format, chapters.length, prev, turns.length - 1),
          turns: turns.slice(prev)
        });
      }
    }

    // 커스텀 이름 적용
    for (var c = 0; c < chapters.length; c++) {
      if (state.chapterNames[c]) {
        chapters[c].title = state.chapterNames[c];
      }
    }

    state.chapters = chapters;
    return chapters;
  }

  function getChapterTitle(format, idx, fromTurn, toTurn) {
    // custom 모드이고 이미 저장된 이름이 있으면 그걸 우선 사용
    if (format === 'custom' && state.chapterNames[idx]) {
      return state.chapterNames[idx];
    }
    switch (format) {
      case 'chapter': return 'Chapter ' + (idx + 1);
      case 'jang': return (idx + 1) + '장';
      case 'turn': return 'Turn ' + (fromTurn + 1) + '~' + (toTurn + 1);
      case 'custom': return (idx + 1) + '장'; // 기본값
      default: return 'Chapter ' + (idx + 1);
    }
  }

  // ── 옵션 수집 ──
  function getFormatOptions() {
    return {
      italic: $('fmt-italic').checked,
      dialogueStyle: $('fmt-dialogue').value,
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
    };
  }

  // ── 미리보기 ──
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

    // HTML 스타일 옵션 → 미리보기에도 반영
    var fontFamily = $('html-font').value;
    var lineHeight = parseFloat($('html-line-height').value);
    var bgColor = $('html-bg').value;
    var textColor = $('html-text-color').value;

    $('turn-count').textContent = state.parsed.turns.length + '개 턴 · ' + chapters.length + '개 챕터';

    var html = '';
    var globalTurnIdx = 0;

    for (var c = 0; c < chapters.length; c++) {
      html += '<div class="preview-chapter">';
      html += '<div class="preview-chapter-title">' + ChatFormatter.escapeHtml(chapters[c].title) + '</div>';

      for (var t = 0; t < chapters[c].turns.length; t++) {
        var turn = chapters[c].turns[t];

        html += '<div class="preview-turn">';
        for (var m = 0; m < turn.messages.length; m++) {
          var msg = turn.messages[m];

          if (showSpeaker) {
            var color = msg.speaker.type === 'user' ? userColor : aiColor;
            var bgc = msg.speaker.type === 'user' ? '#eff6ff' : '#f5f3ff';
            html += '<div class="preview-speaker" style="color:' + color + ';background:' + bgc + ';">[' + ChatFormatter.escapeHtml(msg.speaker.name) + ']</div>';
          }

          html += '<div class="preview-message">' + ChatFormatter.formatForPreview(msg.text, formatOpts) + '</div>';
        }
        html += '</div>';

        globalTurnIdx++;

        if (mode === 'manual' && globalTurnIdx < state.parsed.turns.length) {
          var isActive = state.manualBreaks.has(globalTurnIdx);
          html += '<button class="chapter-break-btn ' + (isActive ? 'active' : '') +
            '" data-turn-idx="' + globalTurnIdx + '">' +
            (isActive ? '✂️ 여기서 챕터 나눔' : '➕ 여기서 챕터 나누기') + '</button>';
        }
      }

      html += '</div>';
    }

    // HTML 스타일 미리보기에 반영
    var previewContent = $('preview-content');
    previewContent.innerHTML = html;
    previewContent.style.fontFamily = fontFamily;
    previewContent.style.lineHeight = lineHeight;
    previewContent.style.background = bgColor;
    previewContent.style.color = textColor;

    // manual 모드 버튼 이벤트
    if (mode === 'manual') {
      document.querySelectorAll('.chapter-break-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = parseInt(this.dataset.turnIdx);
          if (state.manualBreaks.has(idx)) {
            state.manualBreaks.delete(idx);
          } else {
            state.manualBreaks.add(idx);
          }
          refreshAll();
        });
      });
    }
  }

  // ── 내보내기: epub ──
  function exportEpub() {
    if (!state.chapters.length) { showToast('❌ 변환할 내용이 없습니다'); return; }

    showToast('📚 epub 생성 중...', 0);

    var opts = {
      title: $('meta-title').value || '채팅 백업',
      author: $('meta-author').value || '',
      coverData: state.coverData,
      coverType: state.coverType,
      showSpeaker: $('fmt-speaker').checked,
      formatOptions: getFormatOptions(),
    };

    EpubBuilder.build(state.chapters, opts).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = (opts.title || 'chat') + '.epub';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('✅ epub 저장 완료!');
    }).catch(function (e) {
      console.error(e);
      showToast('❌ epub 생성 오류: ' + e.message);
    });
  }

  // ── 내보내기: HTML 파일 ──
  function exportHtmlFile() {
    if (!state.chapters.length) { showToast('❌ 변환할 내용이 없습니다'); return; }
    var html = HtmlBuilder.build(state.chapters, getHtmlOptions());
    HtmlBuilder.download(html, $('meta-title').value || 'chat');
    showToast('✅ html 파일 저장 완료!');
  }

  // ── HTML 코드 보기 ──
  function showHtmlCode() {
    if (!state.chapters.length) { showToast('❌ 변환할 내용이 없습니다'); return; }
    var html = HtmlBuilder.build(state.chapters, getHtmlOptions());
    $('code-output').value = html;

    // 미리보기 숨기고 코드 영역 표시
    $('preview-area').classList.add('hidden');
    $('code-area').classList.remove('hidden');
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

  // ── 시작 ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
