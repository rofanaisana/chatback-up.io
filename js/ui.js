/* ═══════════════════════════════════════
   ui.js — UI 인터랙션, 미리보기, 이벤트
   페이지네이션 + 프리셋 + 테마 + 상태창
   localStorage 자동 저장
   ═══════════════════════════════════════ */

(function () {
  'use strict';

  var PREVIEW_PAGE_SIZE = 50;
  var STORAGE_KEY = 'chatbackup_settings';

  // ── 테마 프리셋 정의 ──
  var THEME_PRESETS = {
    none: null,
    newspaper: {
      turnBg: '#fdf6e3', turnBorder: '#2c2c2c', turnBorderWidth: 2, turnRadius: 0,
      turnPadding: 24, turnGap: 0,
      userBg: '#fdf6e3', userText: '#2c2c2c', userBorder: '#2c2c2c',
      aiBg: '#fdf6e3', aiText: '#2c2c2c', aiBorder: '#2c2c2c',
      msgRadius: 0, msgPadding: 16, chapterDivider: 'double',
      // html-style 오버라이드
      _html: { font: 'serif', bg: '#fdf6e3', textColor: '#2c2c2c', lineHeight: 1.7, padding: 48 }
    },
    notebook: {
      turnBg: '#fffef5', turnBorder: '#f0e68c', turnBorderWidth: 1, turnRadius: 0,
      turnPadding: 20, turnGap: 12,
      userBg: '#fffef5', userText: '#333', userBorder: '#f0e68c',
      aiBg: '#fffef5', aiText: '#333', aiBorder: '#f0e68c',
      msgRadius: 0, msgPadding: 12, chapterDivider: 'line',
      _html: { font: "'Noto Sans KR', sans-serif", bg: '#fffef5', textColor: '#333', lineHeight: 2.0, padding: 40 }
    },
    letter: {
      turnBg: '#fef7f0', turnBorder: '#d4a574', turnBorderWidth: 1, turnRadius: 12,
      turnPadding: 24, turnGap: 20,
      userBg: '#fff8f0', userText: '#5d4037', userBorder: '#d4a574',
      aiBg: '#fef7f0', aiText: '#5d4037', aiBorder: '#d4a574',
      msgRadius: 8, msgPadding: 16, chapterDivider: 'dashed',
      _html: { font: "'Noto Serif KR', serif", bg: '#fef7f0', textColor: '#5d4037', lineHeight: 1.9, padding: 48 }
    },
    book: {
      turnBg: '#f5f0e8', turnBorder: '#c8b898', turnBorderWidth: 0, turnRadius: 0,
      turnPadding: 16, turnGap: 8,
      userBg: '#f5f0e8', userText: '#3e2723', userBorder: '#c8b898',
      aiBg: '#f5f0e8', aiText: '#3e2723', aiBorder: '#c8b898',
      msgRadius: 0, msgPadding: 8, chapterDivider: 'line',
      _html: { font: "'Noto Serif KR', serif", bg: '#f5f0e8', textColor: '#3e2723', lineHeight: 2.0, padding: 60 }
    },
    blog: {
      turnBg: '#ffffff', turnBorder: '#4CAF50', turnBorderWidth: 2, turnRadius: 16,
      turnPadding: 24, turnGap: 20,
      userBg: '#e8f5e9', userText: '#1b5e20', userBorder: '#a5d6a7',
      aiBg: '#fff3e0', aiText: '#e65100', aiBorder: '#ffcc02',
      msgRadius: 12, msgPadding: 16, chapterDivider: 'dotted',
      _html: { font: "'Noto Sans KR', sans-serif", bg: '#ffffff', textColor: '#333', lineHeight: 1.8, padding: 40 }
    },
  };

  var state = {
    rawText: '',
    parsed: null,
    chapters: [],
    manualBreaks: new Set(),
    chapterNames: [],
    coverData: null,
    coverType: '',
    previewPage: 0,
    currentTheme: 'none',
  };

  var $ = function (id) { return document.getElementById(id); };

  function init() {
    loadSettingsFromStorage();
    bindEvents();
  }

  // ═══════════════════════════════════════
  // 설정 저장/불러오기 (localStorage)
  // ═══════════════════════════════════════
  var SAVEABLE_IDS = [
    'fmt-italic', 'fmt-auto-dialogue', 'fmt-dialogue', 'fmt-align',
    'fmt-letter-spacing', 'fmt-indent-stage', 'fmt-indent-dialogue',
    'fmt-speaker', 'style-user-color', 'style-ai-color',
    'html-font', 'html-line-height', 'html-padding', 'html-bg', 'html-text-color',
    'tpl-turn-bg', 'tpl-turn-border', 'tpl-turn-border-width', 'tpl-turn-radius',
    'tpl-turn-padding', 'tpl-turn-gap', 'tpl-user-bg', 'tpl-user-text', 'tpl-user-border',
    'tpl-ai-bg', 'tpl-ai-text', 'tpl-ai-border',
    'tpl-msg-radius', 'tpl-msg-padding', 'tpl-chapter-divider',
    'fmt-status-block', 'fmt-status-marker', 'fmt-status-end-marker', 'fmt-status-style',
    'fmt-status-bg', 'fmt-status-border', 'fmt-status-text',
    'chapter-format', 'group-size',
  ];

  function collectSettings() {
    var data = { _theme: state.currentTheme };
    SAVEABLE_IDS.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      if (el.type === 'checkbox') data[id] = el.checked;
      else data[id] = el.value;
    });
    // chapter-mode radio
    var mode = document.querySelector('input[name="chapter-mode"]:checked');
    if (mode) data['chapter-mode'] = mode.value;
    return data;
  }

  function applySettings(data) {
    if (!data) return;
    if (data._theme) state.currentTheme = data._theme;
    SAVEABLE_IDS.forEach(function (id) {
      var el = $(id);
      if (!el || data[id] === undefined) return;
      if (el.type === 'checkbox') el.checked = data[id];
      else el.value = data[id];
    });
    // chapter-mode radio
    if (data['chapter-mode']) {
      var radio = document.querySelector('input[name="chapter-mode"][value="' + data['chapter-mode'] + '"]');
      if (radio) radio.checked = true;
    }
    // UI 동기화
    $('fmt-ls-val').textContent = $('fmt-letter-spacing').value + 'px';
    $('html-lh-val').textContent = $('html-line-height').value;
    $('speaker-style-wrap').style.display = $('fmt-speaker').checked ? 'block' : 'none';
    $('status-block-options').classList.toggle('hidden', !$('fmt-status-block').checked);
    updateStatusBoxVisibility();
    $('group-size-wrap').classList.toggle('hidden',
      !document.querySelector('input[name="chapter-mode"][value="group"]').checked);

    // 테마 카드 활성화
    document.querySelectorAll('.theme-card').forEach(function (c) {
      c.classList.toggle('active', c.dataset.theme === state.currentTheme);
    });
    $('tpl-options').classList.toggle('hidden', state.currentTheme !== 'custom');
  }

  function saveSettingsToStorage() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(collectSettings())); } catch (e) {}
  }

  function loadSettingsFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) applySettings(JSON.parse(raw));
    } catch (e) {}
  }

  // ═══════════════════════════════════════
  // 이벤트 바인딩
  // ═══════════════════════════════════════
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

    // 프리셋
    $('btn-preset-save').addEventListener('click', downloadPreset);
    $('btn-preset-load').addEventListener('click', function () { $('preset-file-input').click(); });
    $('preset-file-input').addEventListener('change', loadPresetFile);

    // 표지
    $('cover-input').addEventListener('change', handleCover);
    $('cover-clear').addEventListener('click', clearCover);

    // 파싱 설정
    $('btn-reparse').addEventListener('click', reparseFile);

    // 챕터 모드
    document.querySelectorAll('input[name="chapter-mode"]').forEach(function (r) {
      r.addEventListener('change', function () { onChapterModeChange(); saveSettingsToStorage(); });
    });
    $('group-size').addEventListener('change', function () { refreshAll(); saveSettingsToStorage(); });
    $('chapter-format').addEventListener('change', function () {
      onChapterFormatChange();
      refreshAll();
      saveSettingsToStorage();
    });

    // 서식
    ['fmt-italic', 'fmt-speaker', 'fmt-indent-stage', 'fmt-indent-dialogue', 'fmt-auto-dialogue'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', function () { state.previewPage = 0; refreshAll(); saveSettingsToStorage(); });
    });
    ['fmt-dialogue', 'fmt-align'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', function () { state.previewPage = 0; refreshAll(); saveSettingsToStorage(); });
    });
    ['style-user-color', 'style-ai-color'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', function () { refreshPreview(); saveSettingsToStorage(); });
    });

    $('fmt-letter-spacing').addEventListener('input', function () {
      $('fmt-ls-val').textContent = this.value + 'px';
      refreshPreview(); saveSettingsToStorage();
    });
    $('html-line-height').addEventListener('input', function () {
      $('html-lh-val').textContent = this.value;
      refreshPreview(); saveSettingsToStorage();
    });

    ['html-font', 'html-padding', 'html-bg', 'html-text-color'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', function () { refreshPreview(); saveSettingsToStorage(); });
    });

    // 스피커 토글
    $('fmt-speaker').addEventListener('change', function () {
      $('speaker-style-wrap').style.display = this.checked ? 'block' : 'none';
    });

    // 상태창 토글
    $('fmt-status-block').addEventListener('change', function () {
      $('status-block-options').classList.toggle('hidden', !this.checked);
      state.previewPage = 0; refreshAll(); saveSettingsToStorage();
    });
    ['fmt-status-marker', 'fmt-status-end-marker'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', function () { state.previewPage = 0; refreshAll(); saveSettingsToStorage(); });
    });
    $('fmt-status-style').addEventListener('change', function () {
      updateStatusBoxVisibility();
      state.previewPage = 0; refreshAll(); saveSettingsToStorage();
    });
    ['fmt-status-bg', 'fmt-status-border', 'fmt-status-text'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', function () { refreshPreview(); saveSettingsToStorage(); });
    });

    // 테마 카드 클릭
    document.querySelectorAll('.theme-card').forEach(function (card) {
      card.addEventListener('click', function () { selectTheme(this.dataset.theme); });
    });

    // 커스텀 템플릿 옵션
    ['tpl-turn-bg', 'tpl-turn-border', 'tpl-turn-border-width', 'tpl-turn-radius',
     'tpl-turn-padding', 'tpl-turn-gap', 'tpl-user-bg', 'tpl-user-text', 'tpl-user-border',
     'tpl-ai-bg', 'tpl-ai-text', 'tpl-ai-border',
     'tpl-msg-radius', 'tpl-msg-padding', 'tpl-chapter-divider'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', function () { refreshPreview(); saveSettingsToStorage(); });
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
    $('btn-edit-chapters').addEventListener('click', openChapterModal);
    $('chapter-modal-cancel').addEventListener('click', closeChapterModal);
    $('chapter-modal-save').addEventListener('click', saveChapterNames);
    $('chapter-modal').addEventListener('click', function (e) {
      if (e.target === $('chapter-modal')) closeChapterModal();
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

  function updateStatusBoxVisibility() {
    var style = $('fmt-status-style').value;
    $('status-box-colors').classList.toggle('hidden', style !== 'box');
  }

  // ═══════════════════════════════════════
  // 테마 시스템
  // ═══════════════════════════════════════
  function selectTheme(name) {
    state.currentTheme = name;

    // 카드 활성화
    document.querySelectorAll('.theme-card').forEach(function (c) {
      c.classList.toggle('active', c.dataset.theme === name);
    });

    // 커스텀이면 옵션 표시
    $('tpl-options').classList.toggle('hidden', name !== 'custom');

    // 프리셋 적용
    var preset = THEME_PRESETS[name];
    if (preset) {
      // 템플릿 값 적용
      setVal('tpl-turn-bg', preset.turnBg);
      setVal('tpl-turn-border', preset.turnBorder);
      setVal('tpl-turn-border-width', preset.turnBorderWidth);
      setVal('tpl-turn-radius', preset.turnRadius);
      setVal('tpl-turn-padding', preset.turnPadding);
      setVal('tpl-turn-gap', preset.turnGap);
      setVal('tpl-user-bg', preset.userBg);
      setVal('tpl-user-text', preset.userText || '#1a1a1a');
      setVal('tpl-user-border', preset.userBorder || '#bfdbfe');
      setVal('tpl-ai-bg', preset.aiBg);
      setVal('tpl-ai-text', preset.aiText || '#1a1a1a');
      setVal('tpl-ai-border', preset.aiBorder || '#ddd6fe');
      setVal('tpl-msg-radius', preset.msgRadius);
      setVal('tpl-msg-padding', preset.msgPadding);
      setVal('tpl-chapter-divider', preset.chapterDivider);

      // HTML 스타일 오버라이드
      if (preset._html) {
        setVal('html-font', preset._html.font);
        setVal('html-bg', preset._html.bg);
        setVal('html-text-color', preset._html.textColor);
        setVal('html-line-height', preset._html.lineHeight);
        $('html-lh-val').textContent = preset._html.lineHeight;
        setVal('html-padding', preset._html.padding);
      }
    }

    refreshPreview();
    saveSettingsToStorage();
  }

  function setVal(id, val) {
    var el = $(id);
    if (el && val !== undefined) el.value = val;
  }

  // ═══════════════════════════════════════
  // 프리셋 다운로드/불러오기
  // ═══════════════════════════════════════
  function downloadPreset() {
    var data = collectSettings();
    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'chatbackup-preset.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📥 프리셋 다운로드 완료!');
  }

  function loadPresetFile() {
    var file = $('preset-file-input').files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        applySettings(data);
        saveSettingsToStorage();
        refreshAll();
        showToast('📤 프리셋 불러오기 완료!');
      } catch (err) {
        showToast('❌ 프리셋 파일 오류: ' + err.message);
      }
    };
    reader.readAsText(file, 'UTF-8');
    $('preset-file-input').value = '';
  }

  // ═══════════════════════════════════════
  // 파일
  // ═══════════════════════════════════════
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
    $('btn-edit-chapters').classList.add('hidden');
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
    $('btn-edit-chapters').classList.toggle('hidden', format !== 'custom');
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
    var statusOpts = {};
    if ($('fmt-status-block').checked) {
      statusOpts = {
        marker: $('fmt-status-marker').value,
        endMarker: $('fmt-status-end-marker').value,
        style: $('fmt-status-style').value,
        colors: {
          bg: $('fmt-status-bg').value,
          border: $('fmt-status-border').value,
          text: $('fmt-status-text').value,
        }
      };
    }
    return {
      italic: $('fmt-italic').checked,
      dialogueStyle: $('fmt-dialogue').value,
      textAlign: $('fmt-align').value,
      letterSpacing: parseFloat($('fmt-letter-spacing').value),
      indentStage: $('fmt-indent-stage').checked,
      indentDialogue: $('fmt-indent-dialogue').checked,
      autoDialogue: $('fmt-auto-dialogue').checked,
      statusBlock: statusOpts,
    };
  }

  function getTemplateOptions() {
    if (state.currentTheme === 'none') return null;

    // 프리셋이든 커스텀이든 현재 값 사용
    return {
      turnBg: $('tpl-turn-bg').value,
      turnBorder: $('tpl-turn-border').value,
      turnBorderWidth: parseInt($('tpl-turn-border-width').value) || 1,
      turnRadius: parseInt($('tpl-turn-radius').value) || 12,
      turnPadding: parseInt($('tpl-turn-padding').value) || 20,
      turnGap: parseInt($('tpl-turn-gap').value) || 16,
      userBg: $('tpl-user-bg').value,
      userText: $('tpl-user-text').value || '#1a1a1a',
      userBorder: $('tpl-user-border').value || '#bfdbfe',
      aiBg: $('tpl-ai-bg').value,
      aiText: $('tpl-ai-text').value || '#1a1a1a',
      aiBorder: $('tpl-ai-border').value || '#ddd6fe',
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

    var pageStart = state.previewPage * PREVIEW_PAGE_SIZE;
    var pageEnd = Math.min(pageStart + PREVIEW_PAGE_SIZE, totalTurns);

    var html = '';
    var globalTurnIdx = 0;

    for (var c = 0; c < chapters.length; c++) {
      var chTurns = chapters[c].turns;
      var chStart = globalTurnIdx;
      var chEnd = globalTurnIdx + chTurns.length;

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
            var mText = msg.speaker.type === 'user' ? tpl.userText : tpl.aiText;
            var mBorder = msg.speaker.type === 'user' ? tpl.userBorder : tpl.aiBorder;
            msgStyle = ' style="background:' + mBg + ';color:' + mText +
              ';border:1px solid ' + mBorder +
              ';border-radius:' + tpl.msgRadius + 'px;padding:' + tpl.msgPadding + 'px;margin-bottom:8px;"';
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

    if (totalPages > 1) {
      $('preview-pagination').classList.remove('hidden');
      $('page-info').textContent = (state.previewPage + 1) + ' / ' + totalPages + ' 페이지 (턴 ' + (pageStart + 1) + '~' + pageEnd + ')';
      $('prev-page').disabled = state.previewPage === 0;
      $('next-page').disabled = state.previewPage >= totalPages - 1;
    } else {
      $('preview-pagination').classList.add('hidden');
    }

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

  // ── 내보내기 ──
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
    var format = $('chapter-format').value;

    if (splitUnit === 'chapter') {
      for (var i = 0; i < state.chapters.length; i += splitSize) {
        chunks.push(state.chapters.slice(i, Math.min(i + splitSize, state.chapters.length)));
      }
    } else {
      var allTurns = state.parsed.turns;
      for (var t = 0; t < allTurns.length; t += splitSize) {
        var end = Math.min(t + splitSize, allTurns.length);
        chunks.push([{
          title: getChapterTitle(format, chunks.length, t, end - 1),
          turns: allTurns.slice(t, end)
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
