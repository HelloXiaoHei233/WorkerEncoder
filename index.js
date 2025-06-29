addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

// ================== 编码处理器 ==================
const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const base32 = {
  encode: str => {
    let bits = ''
    const bytes = new TextEncoder().encode(str)
    for (const byte of bytes) bits += byte.toString(2).padStart(8, '0')
    
    let encoded = ''
    for (let i = 0; i < bits.length; i += 5) {
      const chunk = bits.substr(i, 5).padEnd(5, '0')
      encoded += base32Chars[parseInt(chunk, 2)]
    }
    return encoded + '='.repeat((8 - (encoded.length % 8)) % 8)
  },
  
  decode: b32 => {
    b32 = b32.replace(/=+$/, '').toUpperCase()
    let bits = ''
    for (const char of b32) {
      const index = base32Chars.indexOf(char)
      bits += index.toString(2).padStart(5, '0')
    }
    
    const bytes = []
    for (let i = 0; i < bits.length; i += 8) {
      const chunk = bits.substr(i, 8).padEnd(8, '0')
      bytes.push(parseInt(chunk, 2))
    }
    return new TextDecoder().decode(new Uint8Array(bytes))
  }
}

const morseMap = {
  'A':'.-', 'B':'-...', 'C':'-.-.', 'D':'-..', 'E':'.', 'F':'..-.',
  'G':'--.', 'H':'....', 'I':'..', 'J':'.---', 'K':'-.-', 'L':'.-..',
  'M':'--', 'N':'-.', 'O':'---', 'P':'.--.', 'Q':'--.-', 'R':'.-.',
  'S':'...', 'T':'-', 'U':'..-', 'V':'...-', 'W':'.--', 'X':'-..-',
  'Y':'-.--', 'Z':'--..', '0':'-----', '1':'.----', '2':'..---',
  '3':'...--', '4':'....-', '5':'.....', '6':'-....', '7':'--...',
  '8':'---..', '9':'----.', ' ':'/'
}

const reverseMorseMap = Object.entries(morseMap).reduce((a,[k,v]) => (a[v]=k,a), {})

const encodings = {
  Base64: {
    encode: s => btoa(unescape(encodeURIComponent(s))),
    decode: s => decodeURIComponent(escape(atob(s)))
  },
  UnicodeEscapeShort: {
    encode: s => [...s].map(c => `\\u${c.charCodeAt(0).toString(16).padStart(4,'0')}`).join(''),
    decode: s => s.replace(/\\u([\da-fA-F]{4})/g, (_,h) => String.fromCharCode(parseInt(h,16)))
  },
  UnicodeEscapeLong: {
    encode: s => [...s].map(c => `\\U${c.charCodeAt(0).toString(16).padStart(8,'0')}`).join(''),
    decode: s => s.replace(/\\U([\da-fA-F]{8})/g, (_,h) => String.fromCodePoint(parseInt(h,16)))
  },
  DecEntity: {
    encode: s => [...s].map(c => `&#${c.charCodeAt(0)};`).join(''),
    decode: s => s.replace(/&#(\d+);/g, (_,d) => String.fromCharCode(d))
  },
  HexEntity: {
    encode: s => [...s].map(c => `&#x${c.charCodeAt(0).toString(16)};`).join(''),
    decode: s => s.replace(/&#x([\da-fA-F]+);/g, (_,h) => String.fromCharCode(parseInt(h,16)))
  },
  HexEscape: {
    encode: s => [...s].map(c => `\\x${c.charCodeAt(0).toString(16).padStart(2,'0')}`).join(''),
    decode: s => s.replace(/\\x([\da-fA-F]{2})/g, (_,h) => String.fromCharCode(parseInt(h,16)))
  },
  OctalEscape: {
    encode: s => [...s].map(c => `\\${c.charCodeAt(0).toString(8).padStart(3,'0')}`).join(''),
    decode: s => s.replace(/\\([0-7]{3})/g, (_,o) => String.fromCharCode(parseInt(o,8)))
  },
  URL: { encode: encodeURIComponent, decode: decodeURIComponent },
  Unicode: {
    encode: s => [...s].map(c => `\\u${c.charCodeAt(0).toString(16).padStart(4,'0')}`).join(''),
    decode: s => s.replace(/\\u([\da-fA-F]{4})/g, (_,h) => String.fromCharCode(parseInt(h,16)))
  },
  Hex: {
    encode: s => Array.from(new TextEncoder().encode(s), b => b.toString(16).padStart(2,'0')).join(''),
    decode: s => new TextDecoder().decode(new Uint8Array((s.match(/[\da-fA-F]{2}/g)||[]).map(h => parseInt(h,16))))
  },
  Dec: {
    encode: s => BigInt('0x'+encodings.Hex.encode(s)).toString(),
    decode: s => encodings.Hex.decode(BigInt(s).toString(16).replace(/^00+/,'').padStart(2,'0'))
  },
  Bin: {
    encode: s => encodings.Hex.encode(s).match(/../g).map(h => parseInt(h,16).toString(2).padStart(8,'0')).join(''),
    decode: s => encodings.Hex.decode(s.match(/.{8}/g).map(b => parseInt(b,2).toString(16).padStart(2,'0')).join(''))
  },
  MorseCode: {
    encode: s => s.toUpperCase().split('').map(c => morseMap[c]||'').filter(Boolean).join(' '),
    decode: s => s.split(/[^.-]/).map(c => reverseMorseMap[c]||'').join('').toLowerCase()
  },
  CodePoint: {
    encode: s => [...s].map(c => c.codePointAt(0)).join(','),
    decode: s => s.split(',').map(cp => String.fromCodePoint(cp)).join('')
  },
  Base32: { encode: base32.encode, decode: base32.decode },
  Base16: {
    encode: s => [...s].map(c => c.charCodeAt(0).toString(16).padStart(2,'0')).join(''),
    decode: s => (s.match(/.{2}/g)||[]).map(p => String.fromCharCode(parseInt(p,16))).join('')
  }
}

// 预计算的示例结果
const exampleResults = {
  Base64: 'QTEyMzQ1Ng==',
  UnicodeEscapeShort: '\\u0041\\u0031\\u0032\\u0033\\u0034\\u0035\\u0036',
  UnicodeEscapeLong: '\\U00000041\\U00000031\\U00000032\\U00000033\\U00000034\\U00000035\\U00000036',
  DecEntity: '&#65;&#49;&#50;&#51;&#52;&#53;&#54;',
  HexEntity: '&#x41;&#x31;&#x32;&#x33;&#x34;&#x35;&#x36;',
  HexEscape: '\\x41\\x31\\x32\\x33\\x34\\x35\\x36',
  OctalEscape: '\\101\\061\\062\\063\\064\\065\\066',
  URL: 'A123456',
  Unicode: '\\u0041\\u0031\\u0032\\u0033\\u0034\\u0035\\u0036',
  Hex: '41313233343536',
  Dec: '1836762202',
  Bin: '01000001001100010011001000110011001101000011010100110110',
  MorseCode: '.- .---- ..--- ...-- ....- ..... -....',
  CodePoint: '65,49,50,51,52,53,54',
  Base32: 'IFBEGRCFIY=',
  Base16: '41313233343536'
}

// ================ 说明文档 ================
const documentation = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>编码转换服务</title>
  <style>
    :root {
      --primary: #2196F3;
      --primary-light: #E3F2FD;
      --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    * {
      box-sizing: border-box;
      font-family: system-ui, -apple-system, sans-serif;
    }

    body {
      margin: 0;
      padding: 10px;
      background: #f8f9fa;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .input-panel {
      background: white;
      padding: 1.5rem;
      border-radius: 12px;
      box-shadow: var(--shadow);
      margin-bottom: 2rem;
      transition: box-shadow 0.3s;
    }

    .input-group {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }

    input, select, button {
      padding: 0.8rem 1rem;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 1rem;
      transition: all 0.2s;
      min-width: 0;
    }

    input:focus, select:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
    }

    button {
      background: linear-gradient(135deg, var(--primary), #1976D2);
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      white-space: nowrap;
    }

    button:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .result-container {
      width: 100%;
      overflow-wrap: break-word;
      word-break: break-all;
    }

    .result-box {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      margin-top: 1rem;
      box-shadow: var(--shadow);
      animation: fadeIn 0.3s ease-out;
      width: 100%;
      overflow-wrap: break-word;
      word-break: break-all;
    }

    .result-text {
      font-family: monospace;
      white-space: pre-wrap;
      word-break: break-all;
      overflow-wrap: break-word;
      font-size: 0.9rem;
      line-height: 1.4;
      margin-bottom: 1rem;
      max-width: 100%;
      overflow-x: auto;
      width: 100%;
    }

    .button-group {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-top: 1rem;
      justify-content: flex-end;
    }

    .copy-btn {
      padding: 0.5rem 1rem;
      background: var(--primary-light);
      color: var(--primary);
      border: none;
      border-radius: 6px;
      font-size: 0.8rem;
      cursor: pointer;
    }

    .jump-info {
      background: #e8f5e8;
      border: 1px solid #4caf50;
      border-radius: 6px;
      padding: 1rem;
      margin-top: 1rem;
      font-size: 0.9rem;
      width: 100%;
      overflow-wrap: break-word;
      word-break: break-all;
    }

    .jump-info h4 {
      margin: 0 0 0.5rem 0;
      color: #2e7d32;
    }

    .jump-info p {
      margin: 0.25rem 0;
      font-family: monospace;
      word-break: break-all;
      overflow-wrap: break-word;
      white-space: pre-wrap;
      width: 100%;
    }

    .doc-section {
      background: white;
      padding: 1.5rem;
      border-radius: 12px;
      box-shadow: var(--shadow);
      margin-top: 2rem;
    }

    .param-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      font-size: 0.9rem;
    }

    .param-table th,
    .param-table td {
      border: 1px solid #e0e0e0;
      padding: 0.5rem;
      text-align: left;
      word-break: break-all;
    }

    .param-table th {
      background: #f5f5f5;
      font-weight: 600;
    }

    .param-table code {
      background: #f0f0f0;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: background-color 0.2s;
      position: relative;
    }

    .param-table code:hover {
      background: #e0e0e0;
    }

    .clickable {
      cursor: pointer;
      transition: background-color 0.2s;
      position: relative;
    }

    .clickable:hover {
      background: #f0f0f0;
    }

    .tooltip {
      position: absolute;
      background: #333;
      color: white;
      padding: 0.3rem 0.6rem;
      border-radius: 4px;
      font-size: 0.8rem;
      white-space: nowrap;
      z-index: 1000;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-bottom: 5px;
    }

    .tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 5px solid transparent;
      border-top-color: #333;
    }

    .clickable:hover .tooltip {
      opacity: 1;
    }

    .copy-notification {
      position: fixed;
      background: #4caf50;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      font-size: 0.9rem;
      z-index: 1001;
      pointer-events: none;
      animation: copyFloat 1.5s ease-out forwards;
    }

    @keyframes copyFloat {
      0% {
        opacity: 0;
        transform: translateY(0);
      }
      20% {
        opacity: 1;
        transform: translateY(-10px);
      }
      80% {
        opacity: 1;
        transform: translateY(-30px);
      }
      100% {
        opacity: 0;
        transform: translateY(-50px);
      }
    }

    .footer {
      text-align: center;
      margin-top: 3rem;
      padding: 2rem;
      color: #666;
      font-size: 0.9rem;
    }

    .footer a {
      color: var(--primary);
      text-decoration: none;
    }

    .footer a:hover {
      text-decoration: underline;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 768px) {
      body { padding: 5px; }
      .input-panel, .doc-section { padding: 1rem; }
      .input-group { flex-direction: column; }
      input, select, button { width: 100%; }
      .button-group { 
        flex-direction: column; 
        justify-content: stretch;
      }
      .copy-btn { width: 100%; }
    }

    #apiLink {
      width: 100%;
      overflow-wrap: break-word;
      word-break: break-all;
    }

    #apiLinkOutput {
      width: 100%;
      overflow-wrap: break-word;
      word-break: break-all;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 style="color: var(--primary); margin-bottom: 1.5rem; font-size: 1.5rem;">编解码服务</h1>

    <div class="input-panel">
      <div class="input-group">
        <input type="text" id="inputText" placeholder="输入需要处理的内容" style="flex:3;">
        <select id="modeSelect" style="flex:1;">
          <option value="enc">编码模式</option>
          <option value="dec">解码模式</option>
          <option value="jmp">跳转模式</option>
        </select>
        <select id="encodingSelect" style="flex:2;">
          ${Object.keys(encodings).map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
        <button onclick="processRequest()" style="flex:0.28;">
          确认
        </button>
      </div>

      <div class="result-container" id="resultContainer" style="display:none;">
        <div class="result-box">
          <pre id="resultOutput" class="result-text" style="margin:0;"></pre>
          
          <div id="jumpInfo" class="jump-info" style="display: none;">
            <h4>跳转信息</h4>
            <p><strong>编码结果:</strong> <span id="encodedResult"></span></p>
            <p><strong>跳转地址:</strong> <span id="jumpUrl"></span></p>
          </div>
          
          <div id="apiLink" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #eee;">
            <small style="color: #666;">API 地址:</small>
            <pre id="apiLinkOutput" style="margin:0; font-size:0.9em; color: #666; word-break: break-all;"></pre>
          </div>
          
          <div class="button-group">
            <button class="copy-btn" onclick="copyResult()">复制结果</button>
            <button class="copy-btn" onclick="copyApiLink()">复制API链接</button>
            <button class="copy-btn" id="copyEncodedBtn" onclick="copyEncodedResult()" style="display: none;">复制编码结果</button>
            <button class="copy-btn" id="copyJumpBtn" onclick="copyJumpUrl()" style="display: none;">复制跳转地址</button>
          </div>
        </div>
      </div>
    </div>

    <div class="doc-section">
      <h2 style="color: var(--primary); font-size: 1.3rem;">API调用说明</h2>
      <p style="color: #666; margin-bottom:1rem;">/?[模式]&[编码]=[内容]</p>
      <table class="param-table">
        <tr><th>参数</th><th>说明</th><th>示例</th></tr>
        <tr><td class="clickable" onclick="copyToClipboard('jmp')">jmp<div class="tooltip">点击复制</div></td><td>跳转模式</td><td><code class="clickable" onclick="copyToClipboard('/?jmp&URL=https%3A%2F%2Fexample.com')">/?jmp&amp;URL=https%3A%2F%2Fexample.com<div class="tooltip">点击复制</div></code></td></tr>
        <tr><td class="clickable" onclick="copyToClipboard('dec')">dec<div class="tooltip">点击复制</div></td><td>解码模式</td><td><code class="clickable" onclick="copyToClipboard('/?dec&Base64=SGVsbG8=')">/?dec&amp;Base64=SGVsbG8=<div class="tooltip">点击复制</div></code></td></tr>
        <tr><td class="clickable" onclick="copyToClipboard('enc')">enc<div class="tooltip">点击复制</div></td><td>编码模式</td><td><code class="clickable" onclick="copyToClipboard('/?enc&Hex=Hello')">/?enc&amp;Hex=Hello<div class="tooltip">点击复制</div></code></td></tr>
      </table>

      <h2 style="color: var(--primary); margin-top:2rem; font-size: 1.3rem;">支持编码类型</h2>
      <p style="color: #666; margin-bottom:1rem;">（以下示例使用 A123456 作为输入）</p>
      <table class="param-table">
        ${Object.keys(encodings).map(t => `
          <tr>
            <td><code class="clickable" onclick="copyToClipboard('${t}')">${t}<div class="tooltip">点击复制</div></code></td>
            <td><code class="clickable" onclick="copyToClipboard('${exampleResults[t] || 'N/A'}')">${exampleResults[t] || 'N/A'}<div class="tooltip">点击复制</div></code></td>
          </tr>
        `).join('')}
      </table>
    </div>

    <div class="footer">
      <p>开源项目 | <a href="https://github.com/HelloXiaoHei233/WorkerEncoder" target="_blank">GitHub</a></p>
    </div>
  </div>

  <script>
    // 编码器定义（与服务器端保持一致）
    const encodings = {
      Base64: {
        encode: s => btoa(unescape(encodeURIComponent(s))),
        decode: s => decodeURIComponent(escape(atob(s)))
      },
      UnicodeEscapeShort: {
        encode: s => [...s].map(c => \`\\\\u\${c.charCodeAt(0).toString(16).padStart(4,'0')}\`).join(''),
        decode: s => s.replace(/\\\\u([\\\\da-fA-F]{4})/g, (_,h) => String.fromCharCode(parseInt(h,16)))
      },
      UnicodeEscapeLong: {
        encode: s => [...s].map(c => \`\\\\U\${c.charCodeAt(0).toString(16).padStart(8,'0')}\`).join(''),
        decode: s => s.replace(/\\\\U([\\\\da-fA-F]{8})/g, (_,h) => String.fromCodePoint(parseInt(h,16)))
      },
      DecEntity: {
        encode: s => [...s].map(c => \`&#\${c.charCodeAt(0)};\`).join(''),
        decode: s => s.replace(/&#(\\\\d+);/g, (_,d) => String.fromCharCode(d))
      },
      HexEntity: {
        encode: s => [...s].map(c => \`&#x\${c.charCodeAt(0).toString(16)};\`).join(''),
        decode: s => s.replace(/&#x([\\\\da-fA-F]+);/g, (_,h) => String.fromCharCode(parseInt(h,16)))
      },
      HexEscape: {
        encode: s => [...s].map(c => \`\\\\x\${c.charCodeAt(0).toString(16).padStart(2,'0')}\`).join(''),
        decode: s => s.replace(/\\\\x([\\\\da-fA-F]{2})/g, (_,h) => String.fromCharCode(parseInt(h,16)))
      },
      OctalEscape: {
        encode: s => [...s].map(c => \`\\\\\${c.charCodeAt(0).toString(8).padStart(3,'0')}\`).join(''),
        decode: s => s.replace(/\\\\([0-7]{3})/g, (_,o) => String.fromCharCode(parseInt(o,8)))
      },
      URL: { 
        encode: encodeURIComponent, 
        decode: decodeURIComponent 
      },
      Unicode: {
        encode: s => [...s].map(c => \`\\\\u\${c.charCodeAt(0).toString(16).padStart(4,'0')}\`).join(''),
        decode: s => s.replace(/\\\\u([\\\\da-fA-F]{4})/g, (_,h) => String.fromCharCode(parseInt(h,16)))
      },
      Hex: {
        encode: s => Array.from(new TextEncoder().encode(s), b => b.toString(16).padStart(2,'0')).join(''),
        decode: s => new TextDecoder().decode(new Uint8Array((s.match(/[\\\\da-fA-F]{2}/g)||[]).map(h => parseInt(h,16))))
      },
      Dec: {
        encode: s => BigInt('0x'+encodings.Hex.encode(s)).toString(),
        decode: s => encodings.Hex.decode(BigInt(s).toString(16).replace(/^00+/,'').padStart(2,'0'))
      },
      Bin: {
        encode: s => encodings.Hex.encode(s).match(/../g).map(h => parseInt(h,16).toString(2).padStart(8,'0')).join(''),
        decode: s => encodings.Hex.decode(s.match(/.{8}/g).map(b => parseInt(b,2).toString(16).padStart(2,'0')).join(''))
      },
      MorseCode: {
        encode: s => s.toUpperCase().split('').map(c => morseMap[c]||'').filter(Boolean).join(' '),
        decode: s => s.split(/[^.-]/).map(c => reverseMorseMap[c]||'').join('').toLowerCase()
      },
      CodePoint: {
        encode: s => [...s].map(c => c.codePointAt(0)).join(','),
        decode: s => s.split(',').map(cp => String.fromCodePoint(cp)).join('')
      },
      Base32: { 
        encode: s => base32.encode(s), 
        decode: s => base32.decode(s) 
      },
      Base16: {
        encode: s => [...s].map(c => c.charCodeAt(0).toString(16).padStart(2,'0')).join(''),
        decode: s => (s.match(/.{2}/g)||[]).map(p => String.fromCharCode(parseInt(p,16))).join('')
      }
    }

    // 摩斯电码映射
    const morseMap = {
      'A':'.-', 'B':'-...', 'C':'-.-.', 'D':'-..', 'E':'.', 'F':'..-.',
      'G':'--.', 'H':'....', 'I':'..', 'J':'.---', 'K':'-.-', 'L':'.-..',
      'M':'--', 'N':'-.', 'O':'---', 'P':'.--.', 'Q':'--.-', 'R':'.-.',
      'S':'...', 'T':'-', 'U':'..-', 'V':'...-', 'W':'.--', 'X':'-..-',
      'Y':'-.--', 'Z':'--..', '0':'-----', '1':'.----', '2':'..---',
      '3':'...--', '4':'....-', '5':'.....', '6':'-....', '7':'--...',
      '8':'---..', '9':'----.', ' ':'/'
    }

    const reverseMorseMap = Object.entries(morseMap).reduce((a,[k,v]) => (a[v]=k,a), {})

    // Base32 编码器
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    const base32 = {
      encode: str => {
        let bits = ''
        const bytes = new TextEncoder().encode(str)
        for (const byte of bytes) bits += byte.toString(2).padStart(8, '0')
        
        let encoded = ''
        for (let i = 0; i < bits.length; i += 5) {
          const chunk = bits.substr(i, 5).padEnd(5, '0')
          encoded += base32Chars[parseInt(chunk, 2)]
        }
        return encoded + '='.repeat((8 - (encoded.length % 8)) % 8)
      },
      
      decode: b32 => {
        b32 = b32.replace(/=+$/, '').toUpperCase()
        let bits = ''
        for (const char of b32) {
          const index = base32Chars.indexOf(char)
          bits += index.toString(2).padStart(5, '0')
        }
        
        const bytes = []
        for (let i = 0; i < bits.length; i += 8) {
          const chunk = bits.substr(i, 8).padEnd(8, '0')
          bytes.push(parseInt(chunk, 2))
        }
        return new TextDecoder().decode(new Uint8Array(bytes))
      }
    }

    async function processRequest() {
      const input = document.getElementById('inputText').value
      const mode = document.getElementById('modeSelect').value
      const encoding = document.getElementById('encodingSelect').value
      
      try {
        // 检查跳转模式下的链接处理
        if (mode === 'jmp' && isUrl(input)) {
          const encodedResult = encodings[encoding].encode(input)
          const jumpUrl = \`\${window.location.origin}/?jmp&\${encoding}=\${encodeURIComponent(encodedResult)}\`
          
          document.getElementById('resultOutput').textContent = \`检测到链接，已自动转换为"\${encoding}"并生成跳转链接\`
          document.getElementById('encodedResult').textContent = encodedResult
          document.getElementById('jumpUrl').textContent = jumpUrl
          document.getElementById('jumpInfo').style.display = 'block'
          
          // 隐藏普通复制按钮，显示跳转相关按钮
          document.getElementById('copyEncodedBtn').style.display = 'inline-block'
          document.getElementById('copyJumpBtn').style.display = 'inline-block'
          document.querySelector('.copy-btn').style.display = 'none'
          document.querySelector('.copy-btn:nth-child(2)').style.display = 'none'
          
          document.getElementById('resultContainer').style.display = 'block'
          return
        }
        
        const response = await fetch(\`/?\${mode}&\${encoding}=\${encodeURIComponent(input)}\`)
        
        if (!response.ok) {
          throw new Error(await response.text())
        }
        
        const result = await response.text()
        updateApiLink(mode, encoding, input)
        
        // 处理跳转模式
        if (mode === 'jmp') {
          const encodedResult = result
          const jumpUrl = \`\${window.location.origin}/?jmp&\${encoding}=\${encodeURIComponent(encodedResult)}\`
          
          document.getElementById('encodedResult').textContent = encodedResult
          document.getElementById('jumpUrl').textContent = jumpUrl
          document.getElementById('jumpInfo').style.display = 'block'
          document.getElementById('resultOutput').textContent = '已编码链接地址并生成跳转链接'
          
          // 隐藏普通复制按钮，显示跳转相关按钮
          document.getElementById('copyEncodedBtn').style.display = 'inline-block'
          document.getElementById('copyJumpBtn').style.display = 'inline-block'
          document.querySelector('.copy-btn').style.display = 'none'
          document.querySelector('.copy-btn:nth-child(2)').style.display = 'none'
        } else {
          document.getElementById('jumpInfo').style.display = 'none'
          document.getElementById('resultOutput').textContent = result
          
          // 显示普通复制按钮，隐藏跳转相关按钮
          document.getElementById('copyEncodedBtn').style.display = 'none'
          document.getElementById('copyJumpBtn').style.display = 'none'
          document.querySelector('.copy-btn').style.display = 'inline-block'
          document.querySelector('.copy-btn:nth-child(2)').style.display = 'inline-block'
        }
        
        document.getElementById('resultContainer').style.display = 'block'
      } catch(err) {
        document.getElementById('resultOutput').textContent = '处理失败: ' + err.message
        document.getElementById('resultContainer').style.display = 'block'
        document.getElementById('jumpInfo').style.display = 'none'
        
        // 错误时显示普通复制按钮，隐藏跳转相关按钮
        document.getElementById('copyEncodedBtn').style.display = 'none'
        document.getElementById('copyJumpBtn').style.display = 'none'
        document.querySelector('.copy-btn').style.display = 'inline-block'
        document.querySelector('.copy-btn:nth-child(2)').style.display = 'inline-block'
      }
    }

    function isUrl(str) {
      try {
        new URL(str)
        return true
      } catch {
        return false
      }
    }

    function copyResult() {
      navigator.clipboard.writeText(document.getElementById('resultOutput').textContent)
        .then(() => {
          const btn = document.querySelector('.copy-btn')
          btn.textContent = '已复制!'
          setTimeout(() => btn.textContent = '复制结果', 2000)
        })
    }
    
    function copyApiLink() {
      navigator.clipboard.writeText(document.getElementById('apiLinkOutput').textContent)
        .then(() => {
          const btn = document.querySelector('.copy-btn:nth-child(2)')
          btn.textContent = '已复制!'
          setTimeout(() => btn.textContent = '复制API链接', 2000)
        })
    }

    function copyEncodedResult() {
      navigator.clipboard.writeText(document.getElementById('encodedResult').textContent)
        .then(() => {
          const btn = document.getElementById('copyEncodedBtn')
          btn.textContent = '已复制!'
          setTimeout(() => btn.textContent = '复制编码结果', 2000)
        })
    }

    function copyJumpUrl() {
      navigator.clipboard.writeText(document.getElementById('jumpUrl').textContent)
        .then(() => {
          const btn = document.getElementById('copyJumpBtn')
          btn.textContent = '已复制!'
          setTimeout(() => btn.textContent = '复制跳转地址', 2000)
        })
    }

    function copyToClipboard(text) {
      navigator.clipboard.writeText(text)
        .then(() => {
          // 创建飘出提示
          const notification = document.createElement('div')
          notification.className = 'copy-notification'
          notification.textContent = '已复制'
          notification.style.left = event.clientX + 'px'
          notification.style.top = event.clientY + 'px'
          document.body.appendChild(notification)
          
          // 动画结束后移除元素
          setTimeout(() => {
            document.body.removeChild(notification)
          }, 1500)
        })
    }
    
    function updateApiLink(mode, encoding, input) {
      const baseUrl = window.location.origin
      const encodedInput = encodeURIComponent(input)
      const apiUrl = \`\${baseUrl}/?\${mode}&\${encoding}=\${encodedInput}\`
      document.getElementById('apiLinkOutput').textContent = apiUrl
      document.getElementById('apiLink').style.display = 'block'
    }
  </script>
</body>
</html>`

// ================== 请求处理器 ==================
async function handleRequest(request) {
  const url = new URL(request.url)
  
  // 显示说明文档
  if (url.pathname === '/' && !url.search) {
    return new Response(documentation, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }

  try {
    const params = url.searchParams
    const mode = params.has('jmp') ? 'jmp' : 
                params.has('dec') ? 'dec' : 
                params.has('enc') ? 'enc' : null
    
    let encodingType = null
    let input = null
    for (const [key, value] of params) {
      if (encodings[key]) {
        encodingType = key
        try { input = decodeURIComponent(value) } catch { input = value }
        break
      }
    }

    // 参数验证
    if (!mode) return new Response('缺少模式参数 (jmp/dec/enc)', { status: 400 })
    if (!encodingType) return new Response('未识别的编码类型', { status: 400 })
    if (input === null) return new Response('缺少输入内容', { status: 400 })

    // 执行编解码
    const processor = encodings[encodingType]
    const result = mode === 'enc' ? processor.encode(input) : processor.decode(input)

    // 处理跳转
    if (mode === 'jmp') {
      try {
        return Response.redirect(new URL(result).toString(), 302)
      } catch(e) {
        return new Response(`无效跳转目标: ${result}`, { status: 400 })
      }
    }

    return new Response(result, {
      headers: { 
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Encoding-Type': encodingType,
        'X-Processing-Mode': mode 
      }
    })

  } catch(err) {
    return new Response(`错误: ${err.message}`, { 
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  }
}
