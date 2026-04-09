/* ════════��══════════════════════════════
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
    // ─, ═, -, *, _ 등 반복 문자
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

  // 턴 시작 라인인지 판단 (구분선 + 턴 번호 포함 라인 조합)
  function isTurnStart(lines, idx) {
    var line = lines[idx];

    // 직접 턴 번호가 있는 경우
    if (extractTurnNumber(line) > 0) return true;

    // 구분선 다음 줄에 턴 번호가 있는 경우
    if (isSeparatorLine(line) && idx + 1 < lines.length) {
      if (extractTurnNumber(lines[idx + 1]) > 0) return true;
    }

    return false;
  }

  // 스피커 감지 (🗣️ [이름] 또는 🤖 [이름])
  function parseSpeaker(line) {
    var trimmed = line.trim();

    // 이모지 + [이름] 패턴
    var m = trimmed.match(/^(🗣️|🗣|👤|🧑|💬)\s*\[([^\]]+)\]/);
    if (m) return { type: 'user', name: m[2].trim() };

    m = trimmed.match(/^(🤖|🎭|💻|✨)\s*\[([^\]]+)\]/);
    if (m) return { type: 'ai', name: m[2].trim() };

    // [이름] 패턴만 (아이콘 없이)
    m = trimmed.match(/^\[([^\]]+)\]$/);
    if (m) return { type: 'unknown', name: m[1].trim() };

    return null;
  }

  // 턴 내부에서 메시지 분리
  function parseTurnContent(contentLines) {
    var messages = [];
    var currentSpeaker = null;
    var currentLines = [];

    for (var i = 0; i < contentLines.length; i++) {
      var line = contentLines[i];
      var speaker = parseSpeaker(line);

      if (speaker) {
        // 이전 스피커 메시지 저장
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

    // 마지막 메시지
    if (currentSpeaker && currentLines.length > 0) {
      messages.push({
        speaker: currentSpeaker,
        text: currentLines.join('\n').trim()
      });
    }

    // 스피커 없이 전체가 하나의 텍스트인 경우
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

    // 1단계: 턴 시작 위치 찾기
    var turnStarts = [];
    for (var i = 0; i < lines.length; i++) {
      if (isTurnStart(lines, i)) {
        var turnNum = extractTurnNumber(lines[i]);
        if (turnNum < 0 && i + 1 < lines.length) {
          turnNum = extractTurnNumber(lines[i + 1]);
        }
        turnStarts.push({ index: i, turnNum: turnNum });
      }
    }

    // 턴을 못 찾은 경우: 전체를 하나의 턴으로
    if (turnStarts.length === 0) {
      // 헤더 영역 이후부터
      var startIdx = 0;
      for (var j = 0; j < Math.min(lines.length, 15); j++) {
        if (/^[═]{3,}$/.test(lines[j].trim())) {
          startIdx = j + 1;
          break;
        }
      }
      var contentLines = lines.slice(startIdx);
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
      for (var s = start; s < Math.min(start + 4, end); s++) {
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

    // 스피커 이름 자동 감지 (첫 번째 user/ai)
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
