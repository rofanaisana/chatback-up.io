/* ═══════════════════════════════════════
   parser.js — txt 파일 파싱
   ═══════════════════════════════════════ */

var ChatParser = (function () {

  // 턴 감지 정규식 패턴들
  var TURN_PATTERNS = [
    /\[\s*Turn\s+(\d+)\s*\]/i,
    /Turn\s+(\d+)/i,
    /(\d+)\s*턴/,
    /※\s*(\d+)\s*턴/,
    /─+\s*\[\s*Turn\s+(\d+)\s*\]/i,
    /#{1,3}\s*Turn\s+(\d+)/i,
    /#{1,3}\s*(\d+)\s*턴/,
  ];

  // 헤더 정보 파싱
  function parseHeader(text) {
    var lines = text.split('\n');
    var header = { title: '', date: '', messageCount: 0 };

    for (var i = 0; i < Math.min(lines.length, 10); i++) {
      var line = lines[i];
      if (/^📖/.test(line)) header.title = line.replace(/^📖\s*/, '').trim();
      if (/^📅/.test(line)) header.date = line.replace(/^📅\s*저장 시각:\s*/, '').trim();
      if (/^💬/.test(line)) {
        var m = line.match(/(\d+)/);
        if (m) header.messageCount = parseInt(m[1]);
      }
    }

    return header;
  }

  // 구분선인지 체크
  function isSeparatorLine(line) {
    var trimmed = line.trim();
    if (trimmed.length < 3) return false;
    if (/^[─═\-\*_~]{3,}$/.test(trimmed)) return true;
    return false;
  }

  // 턴 번호 추출
  function extractTurnNumber(line) {
    for (var i = 0; i < TURN_PATTERNS.length; i++) {
      var m = line.match(TURN_PATTERNS[i]);
      if (m) return parseInt(m[1]);
    }
    return -1;
  }

  // 스피커 감지 (🗣️ [이름] 또는 🤖 [이름])
  function parseSpeaker(line) {
    var trimmed = line.trim();

    var m = trimmed.match(/^(🗣️|🗣|👤|🧑|💬)\s*\[([^\]]+)\]/);
    if (m) return { type: 'user', name: m[2].trim() };

    m = trimmed.match(/^(🤖|🎭|💻|✨)\s*\[([^\]]+)\]/);
    if (m) return { type: 'ai', name: m[2].trim() };

    m = trimmed.match(/^\[([^\]]+)\]$/);
    if (m) return { type: 'unknown', name: m[1].trim() };

    return null;
  }

  // 턴 내부에서 메시지 분리 (유저+AI를 하나의 턴으로)
  function parseTurnContent(contentLines) {
    var messages = [];
    var currentSpeaker = null;
    var currentLines = [];

    for (var i = 0; i < contentLines.length; i++) {
      var line = contentLines[i];
      var speaker = parseSpeaker(line);

      if (speaker) {
        if (currentSpeaker) {
          messages.push({
            speaker: currentSpeaker,
            text: currentLines.join('\n').trim()
          });
        }
        currentSpeaker = speaker;
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    }

    if (currentSpeaker && currentLines.length > 0) {
      messages.push({
        speaker: currentSpeaker,
        text: currentLines.join('\n').trim()
      });
    }

    if (messages.length === 0 && contentLines.length > 0) {
      var fullText = contentLines.join('\n').trim();
      if (fullText) {
        messages.push({
          speaker: { type: 'ai', name: 'AI' },
          text: fullText
        });
      }
    }

    return messages;
  }

  // 메인 파싱 함수
  function parse(text) {
    var header = parseHeader(text);
    var lines = text.split('\n');
    var turns = [];

    // 1단계: 턴 시작 위치 찾기 (중복 방지!)
    var turnStarts = [];
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      var turnNum = extractTurnNumber(line);

      if (turnNum > 0) {
        // 이 줄 자체에 턴 번호가 있음 → 턴 시작
        // 이 줄 바로 위가 구분선이면 구분선부터 턴 시작으로 잡기
        var startIdx = i;
        if (i > 0 && isSeparatorLine(lines[i - 1])) {
          startIdx = i - 1;
        }
        // 중복 방지: 이미 같은 위치가 등록됐으면 스킵
        if (turnStarts.length === 0 || turnStarts[turnStarts.length - 1].index !== startIdx) {
          turnStarts.push({ index: startIdx, turnNum: turnNum });
        }
        i++;
        continue;
      }

      // 구분선이고 다음 줄에 턴 번호가 있으면 → 다음 줄에서 처리되므로 스킵
      if (isSeparatorLine(line) && i + 1 < lines.length && extractTurnNumber(lines[i + 1]) > 0) {
        // 다음 반복에서 턴 번호 줄이 처리할 것 → 여기서는 아무것도 안 함
        i++;
        continue;
      }

      i++;
    }

    // 턴을 못 찾은 경우: 전체를 하나의 턴으로
    if (turnStarts.length === 0) {
      var startIdx2 = 0;
      for (var j = 0; j < Math.min(lines.length, 15); j++) {
        if (/^[═]{3,}$/.test(lines[j].trim())) {
          startIdx2 = j + 1;
          break;
        }
      }
      var contentLines = lines.slice(startIdx2);
      var messages = parseTurnContent(contentLines);
      if (messages.length > 0) {
        turns.push({ turnNum: 1, messages: messages, rawText: contentLines.join('\n') });
      }
      return { header: header, turns: turns };
    }

    // 2단계: 각 턴의 내용 추출
    for (var t = 0; t < turnStarts.length; t++) {
      var start = turnStarts[t].index;
      var end = (t + 1 < turnStarts.length) ? turnStarts[t + 1].index : lines.length;

      // 턴 헤더 라인(구분선, 턴번호 라인) 건너뛰기
      var contentStart = start;
      for (var s = start; s < Math.min(start + 5, end); s++) {
        if (isSeparatorLine(lines[s]) || extractTurnNumber(lines[s]) > 0) {
          contentStart = s + 1;
        } else {
          break;
        }
      }

      var turnContent = lines.slice(contentStart, end);
      var msgs = parseTurnContent(turnContent);

      turns.push({
        turnNum: turnStarts[t].turnNum > 0 ? turnStarts[t].turnNum : t + 1,
        messages: msgs,
        rawText: turnContent.join('\n')
      });
    }

    // 스피커 이름 자동 감지
    var detectedNames = { user: '', ai: '' };
    for (var tn = 0; tn < turns.length; tn++) {
      for (var mn = 0; mn < turns[tn].messages.length; mn++) {
        var msg = turns[tn].messages[mn];
        if (msg.speaker.type === 'user' && !detectedNames.user) detectedNames.user = msg.speaker.name;
        if (msg.speaker.type === 'ai' && !detectedNames.ai) detectedNames.ai = msg.speaker.name;
        if (detectedNames.user && detectedNames.ai) break;
      }
      if (detectedNames.user && detectedNames.ai) break;
    }

    return {
      header: header,
      turns: turns,
      detectedNames: detectedNames
    };
  }

  return { parse: parse };
})();
