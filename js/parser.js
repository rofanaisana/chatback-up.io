/* ═══════════════════════════════════════
   parser.js — txt 파일 파싱
   범용 구분자 + 마커 지원
   ═══════════════════════════════════════ */

var ChatParser = (function () {

  // 기본 턴 감지 정규식
  var DEFAULT_TURN_PATTERNS = [
    /\[\s*Turn\s+(\d+)\s*\]/i,
    /Turn\s+(\d+)/i,
    /(\d+)\s*턴/,
    /※\s*(\d+)\s*턴/,
    /─+\s*\[\s*Turn\s+(\d+)\s*\]/i,
    /#{1,3}\s*Turn\s+(\d+)/i,
    /#{1,3}\s*(\d+)\s*턴/,
  ];

  // 기본 스피커 감지 패턴들 (어떤 이모지든 + [이름])
  var DEFAULT_USER_PATTERNS = [
    /^(🗣️|🗣|👤|🧑|💬|😊|😀|😎|🙂|👦|👧|🧒|👨|👩)\s*\[([^\]]+)\]/,
  ];
  var DEFAULT_AI_PATTERNS = [
    /^(🤖|🎭|💻|✨|😈|🐱|🦊|👑|🌸|💀|🔥|❤️|🌙|⭐|🎀|🧸|🐰|🦋|🌺|💎|🎃|👻|🐉|🦁|🐺|🌹|🪄|⚡|🗡️|🛡️)\s*\[([^\]]+)\]/,
  ];

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

  function isSeparatorLine(line) {
    var trimmed = line.trim();
    if (trimmed.length < 3) return false;
    if (/^[─═\-\*_~]{3,}$/.test(trimmed)) return true;
    return false;
  }

  function extractTurnNumber(line, customPatterns) {
    var patterns = customPatterns || DEFAULT_TURN_PATTERNS;
    for (var i = 0; i < patterns.length; i++) {
      var m = line.match(patterns[i]);
      if (m) return parseInt(m[1]);
    }
    return -1;
  }

  /**
   * 범용 스피커 감지
   * customMarkers: { user: "🗣️ [유저]", ai: "🤖 [AI]" }
   */
  function parseSpeaker(line, customMarkers) {
    var trimmed = line.trim();

    // 커스텀 마커가 설정되어 있으면 우선 사용
    if (customMarkers) {
      if (customMarkers.user) {
        var userM = buildMarkerPattern(customMarkers.user);
        if (userM) {
          var um = trimmed.match(userM);
          if (um) return { type: 'user', name: um[1] || um[0] };
        }
      }
      if (customMarkers.ai) {
        var aiM = buildMarkerPattern(customMarkers.ai);
        if (aiM) {
          var am = trimmed.match(aiM);
          if (am) return { type: 'ai', name: am[1] || am[0] };
        }
      }
    }

    // 범용 패턴: 어떤 이모지(들) + [이름]
    var genericMatch = trimmed.match(/^(.+?)\s*\[([^\]]+)\]\s*$/);
    if (genericMatch) {
      var prefix = genericMatch[1].trim();
      var name = genericMatch[2].trim();
      // prefix가 이모지나 짧은 텍스트면 스피커로 인식
      if (prefix.length <= 10) {
        // 첫번째로 발견되면 일단 unknown, 나중에 분류
        return { type: 'unknown', name: name, prefix: prefix };
      }
    }

    // 순수 [이름] 만 있는 경우
    var bracketOnly = trimmed.match(/^\[([^\]]+)\]\s*$/);
    if (bracketOnly) {
      return { type: 'unknown', name: bracketOnly[1].trim() };
    }

    return null;
  }

  function buildMarkerPattern(marker) {
    if (!marker) return null;
    // "🗣️ [유저]" → /^🗣️\s*\[([^\]]+)\]/
    var m = marker.match(/^(.+?)\s*\[([^\]]*)\]\s*$/);
    if (m) {
      var prefix = escapeRegex(m[1].trim());
      return new RegExp('^' + prefix + '\\s*\\[([^\\]]+)\\]');
    }
    // "[유저]" 만 있으면
    var m2 = marker.match(/^\[([^\]]*)\]$/);
    if (m2) {
      return new RegExp('^\\[(' + escapeRegex(m2[1]) + ')\\]');
    }
    // 그냥 텍스트면 그 텍스트로 시작하면 매치
    return new RegExp('^' + escapeRegex(marker.trim()));
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function buildCustomTurnPatterns(sepText) {
    if (!sepText) return null;
    // "{n}"을 (\d+)로 치환
    var escaped = escapeRegex(sepText).replace(/\\\{n\\\}/gi, '(\\d+)');
    try {
      return [new RegExp(escaped, 'i')];
    } catch (e) {
      return null;
    }
  }

  function parseTurnContent(contentLines, markers) {
    var messages = [];
    var currentSpeaker = null;
    var currentLines = [];

    for (var i = 0; i < contentLines.length; i++) {
      var line = contentLines[i];
      var speaker = parseSpeaker(line, markers);

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

  function parse(text, options) {
    var opts = options || {};
    var header = parseHeader(text);
    var lines = text.split('\n');
    var turns = [];

    var customTurnPatterns = opts.turnSeparator ? buildCustomTurnPatterns(opts.turnSeparator) : null;
    var markers = null;
    if (opts.userMarker || opts.aiMarker) {
      markers = { user: opts.userMarker || '', ai: opts.aiMarker || '' };
    }

    // 턴 시작 위치 찾기
    var turnStarts = [];
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      var turnNum = extractTurnNumber(line, customTurnPatterns);

      if (turnNum > 0) {
        var startIdx = i;
        if (i > 0 && isSeparatorLine(lines[i - 1])) {
          startIdx = i - 1;
        }
        if (turnStarts.length === 0 || turnStarts[turnStarts.length - 1].index !== startIdx) {
          turnStarts.push({ index: startIdx, turnNum: turnNum });
        }
        i++;
        continue;
      }

      if (isSeparatorLine(line) && i + 1 < lines.length && extractTurnNumber(lines[i + 1], customTurnPatterns) > 0) {
        i++;
        continue;
      }

      i++;
    }

    // 턴을 못 찾은 경우
    if (turnStarts.length === 0) {
      var startIdx2 = 0;
      for (var j = 0; j < Math.min(lines.length, 15); j++) {
        if (/^[═]{3,}$/.test(lines[j].trim())) {
          startIdx2 = j + 1;
          break;
        }
      }
      var contentLines = lines.slice(startIdx2);
      var messages = parseTurnContent(contentLines, markers);
      if (messages.length > 0) {
        turns.push({ turnNum: 1, messages: messages, rawText: contentLines.join('\n') });
      }
      return { header: header, turns: turns };
    }

    // 각 턴 내용 추출
    for (var t = 0; t < turnStarts.length; t++) {
      var start = turnStarts[t].index;
      var end = (t + 1 < turnStarts.length) ? turnStarts[t + 1].index : lines.length;

      var contentStart = start;
      for (var s = start; s < Math.min(start + 5, end); s++) {
        if (isSeparatorLine(lines[s]) || extractTurnNumber(lines[s], customTurnPatterns) > 0) {
          contentStart = s + 1;
        } else {
          break;
        }
      }

      var turnContent = lines.slice(contentStart, end);
      var msgs = parseTurnContent(turnContent, markers);

      turns.push({
        turnNum: turnStarts[t].turnNum > 0 ? turnStarts[t].turnNum : t + 1,
        messages: msgs,
        rawText: turnContent.join('\n')
      });
    }

    // 스피커 이름/타입 자동 분류
    var detectedNames = { user: '', ai: '' };
    var speakerCounts = {}; // name → count
    for (var tn = 0; tn < turns.length; tn++) {
      for (var mn = 0; mn < turns[tn].messages.length; mn++) {
        var msg = turns[tn].messages[mn];
        if (msg.speaker.type === 'user' && !detectedNames.user) detectedNames.user = msg.speaker.name;
        if (msg.speaker.type === 'ai' && !detectedNames.ai) detectedNames.ai = msg.speaker.name;
        // unknown 타입이면 카운트해서 나중에 분류
        if (msg.speaker.type === 'unknown') {
          speakerCounts[msg.speaker.name] = (speakerCounts[msg.speaker.name] || 0) + 1;
        }
      }
    }

    // unknown 스피커 분류: 턴 내 첫번째 = user, 두번째 = ai
    if (!detectedNames.user || !detectedNames.ai) {
      for (var tn2 = 0; tn2 < turns.length; tn2++) {
        var foundUser = false;
        for (var mn2 = 0; mn2 < turns[tn2].messages.length; mn2++) {
          var msg2 = turns[tn2].messages[mn2];
          if (msg2.speaker.type === 'unknown') {
            if (!foundUser) {
              msg2.speaker.type = 'user';
              if (!detectedNames.user) detectedNames.user = msg2.speaker.name;
              foundUser = true;
            } else {
              msg2.speaker.type = 'ai';
              if (!detectedNames.ai) detectedNames.ai = msg2.speaker.name;
            }
          } else if (msg2.speaker.type === 'user') {
            foundUser = true;
          }
        }
      }
    }

    // 감지된 구분자 텍스트 (UI 표시용)
    var detectedSep = '';
    if (turnStarts.length > 0) {
      detectedSep = lines[turnStarts[0].index].trim();
      if (isSeparatorLine(detectedSep) && turnStarts[0].index + 1 < lines.length) {
        detectedSep = lines[turnStarts[0].index + 1].trim();
      }
    }

    return {
      header: header,
      turns: turns,
      detectedNames: detectedNames,
      detectedSep: detectedSep
    };
  }

  return { parse: parse };
})();
