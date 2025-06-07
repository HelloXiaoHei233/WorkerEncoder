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
    decode: s => s.split(/\s+/).map(c => reverseMorseMap[c]||'').join('').toLowerCase()
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
      padding: 20px;
      background: #f8f9fa;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .input-panel {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: var(--shadow);
      margin-bottom: 2rem;
      transition: box-shadow 0.3s;
    }

    .input-group {
      display: flex;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
    }

    input, select, button {
      padding: 0.8rem 1.2rem;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 1rem;
      transition: all 0.2s;
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
    }

    button:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .result-box {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      margin-top: 1rem;
      position: relative;
      box-shadow: var(--shadow);
      animation: fadeIn 0.3s ease-out;
    }

    .result-text {
      font-family: monospace;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      padding-right: 100px;
    }

    .copy-btn {
      position: absolute;
      right: 1rem;
      bottom: 1rem;
      padding: 0.5rem 1rem;
      background: var(--primary-light);
      color: var(--primary);
    }
    
        .copy-btn.api-link {
          right: 8.5rem;
      border: none;
      border-radius: 6px;
    }

    .doc-section {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: var(--shadow);
      margin-top: 2rem;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 style="color: var(--primary); margin-bottom: 1.5rem;">编解码服务</h1>

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
          <pre id="resultOutput" style="margin:0; white-space: pre-wrap;"></pre>
          <button class="copy-btn" onclick="copyResult()">复制结果</button>
                    <button class="copy-btn api-link" onclick="copyApiLink()">复制API链接</button>
          <div id="apiLink" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #eee;">
            <small style="color: #666;">API 地址:</small>
            <pre id="apiLinkOutput" style="margin:0; font-size:0.9em; color: #666;"></pre>
          </div>
        </div>
      </div>
    </div>

    <div class="doc-section">
      <h2 style="color: var(--primary);">API调用说明</h2>
      <p style="color: #666; margin-bottom:1rem;">/?[模式]&[编码]=[内容]</p>
      <table class="param-table">
        <tr><th>参数</th><th>说明</th><th>示例</th></tr>
        <tr><td>jmp</td><td>跳转模式</td><td><code>/?jmp&amp;URL=https%3A%2F%2Fexample.com</code></td></tr>
        <tr><td>dec</td><td>解码模式</td><td><code>/?dec&amp;Base64=SGVsbG8=</code></td></tr>
        <tr><td>enc</td><td>编码模式</td><td><code>/?enc&amp;Hex=Hello</code></td></tr>
      </table>

      <h2 style="color: var(--primary); margin-top:2rem;">支持编码类型</h2>
      <p style="color: #666; margin-bottom:1rem;">（以下示例使用 A123456 作为输入）</p>
      <table class="param-table">
        ${Object.keys(encodings).map(t => `
          <tr>
            <td><code>${t}</code></td>
            <td>${encodings[t].encode('A123456')}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  </div>

  <script>
    async function processRequest() {
      const input = document.getElementById('inputText').value
      const mode = document.getElementById('modeSelect').value
      const encoding = document.getElementById('encodingSelect').value
      
      try {
        const response = await fetch(\`/?\${mode}&\${encoding}=\${encodeURIComponent(input)}\`)
        
        if (!response.ok) {
          throw new Error(await response.text())
        }
        
        const result = await response.text()
        updateApiLink(mode, encoding, input)
        document.getElementById('resultOutput').textContent = result
        document.getElementById('resultContainer').style.display = 'block'
      } catch(err) {
        document.getElementById('resultOutput').textContent = '处理失败: ' + err.message
        document.getElementById('resultContainer').style.display = 'block'
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
        function updateApiLink(mode, encoding, input) {
            const baseUrl = window.location.origin
            const encodedInput = encodeURIComponent(input)
            const apiUrl = \`\${baseUrl}/?\${mode}&\${encoding}=\${encodedInput}\`
            document.getElementById('apiLinkOutput').textContent = apiUrl
            document.getElementById('apiLink').style.display = 'block'
          }
      
          function copyApiLink() {
            navigator.clipboard.writeText(document.getElementById('apiLinkOutput').textContent)
              .then(() => {
                const btn = document.querySelector('.api-link')
                btn.textContent = '已复制!'
                setTimeout(() => btn.textContent = '复制API链接', 2000)
              })
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