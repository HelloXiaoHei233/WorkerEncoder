# 基于Workers的编解码及跳转小工具

一个轻量、免部署、自托管的编解码 + 跳转工具，基于 [Cloudflare Workers](https://workers.cloudflare.com/) 实现，支持多种编码方式，包括 Base64、Unicode、Morse、转义编码、CodePoint 等等。  
支持生成 API 链接、页面交互，也支持 `jmp` 跳转模式，便于绕过部分平台对链接或关键字的屏蔽审查。



---

##  快速使用

打开页面即可进行编码或解码：  
https://get.xiaoheicat.com/

1. 输入原始内容
2. 选择模式（编码 / 解码 / 跳转）
3. 选择编码方式
4. 点击确认，即可看到结果与对应 API 接口调用链接

---

##  支持的编码类型

- Base64 / Base32 / Base16
- UnicodeEscapeShort / UnicodeEscapeLong
- \x HexEscape / \000 OctalEscape
- URL Encode / Unicode Entity / HTML Dec/Hex Entity
- MorseCode 编码
- CodePoint（U+ 编码）
- Binary / Decimal 数值编码
- 支持将任意内容编码成安全形式用于跳转

---

##  API 调用方式

### 编码模式
GET /?enc&Base64=HelloWorld
→ 返回 Base64 编码结果
### 解码模式
GET /?dec&Hex=48656c6c6f
→ 返回解码结果
### 跳转模式
GET /?jmp&Base64=aHR0cHM6Ly9leGFtcGxlLmNvbQ==
→ 跳转到 https://example.com

---

##  安全说明

- 本工具为纯前端展示 + Worker 沙箱运行，**无服务器**，**无账号登录**，**无用户数据存储**。
- 支持跨端编码转换 / 自建跳转服务 / 脚本调用。
- 所有请求均通过 Cloudflare HTTPS 托管，传输安全。
- API 返回为纯文本，无动态执行。

---

##  项目部署

- 将 `index.js` 上传到你的 Cloudflare Worker 控制台。
- 无需额外依赖、无需数据库。
- 如果需要修改编码表或添加新类型，请在 `encodings` 模块中新增定义。

---

##  免责声明

该项目为个人自用工具，无任何盈利目的。  
功能以实用优先，未作处理优化，不保证持续维护。  
如需长期使用，建议 Fork 自部署。

---

##  License

MIT License. Use freely, fork freely, host freely.

