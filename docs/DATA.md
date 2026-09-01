# Fluently — 資料層與 AI 串接

> 記錄 SQLite schema、Gemini 串接方式、API key 的流向，以及 token/來回次數是怎麼算出來的。
> 程式碼在 [`lib/db.ts`](../lib/db.ts)、[`lib/gemini.ts`](../lib/gemini.ts)、[`app/api/chat/route.ts`](../app/api/chat/route.ts)。
> 改 schema 或改串接方式時，**同一個 commit 內更新這份文件**。

---

## 1. SQLite

用 Node 22 內建的 `node:sqlite`（`DatabaseSync`），**沒有原生相依套件要編譯**。
資料庫檔案在 `data/fluently.db`（已 gitignore），首次寫入時自動建立。
啟用 `WAL` 與 `foreign_keys`。連線用 `globalThis` 快取，避免 dev HMR 每次改檔就漏一個 handle。

> Node 會印 `ExperimentalWarning: SQLite is an experimental feature`——這是預期的，不是錯誤。

### Schema

```sql
sessions
  id           TEXT PRIMARY KEY      -- crypto.randomUUID()
  scenario_id  TEXT NOT NULL         -- 對應 lib/scenarios.ts 的 id
  mode         TEXT NOT NULL DEFAULT 'script'  -- 'script' 獨白式 / 'live' 真實情境
  created_at   INTEGER NOT NULL      -- epoch ms
  updated_at   INTEGER NOT NULL

messages
  id           INTEGER PK AUTOINCREMENT
  session_id   TEXT → sessions(id) ON DELETE CASCADE
  role         TEXT CHECK (role IN ('user','model'))   -- 'model' = AI 家教
  content      TEXT NOT NULL
  created_at   INTEGER NOT NULL

api_calls
  id             INTEGER PK AUTOINCREMENT
  session_id     TEXT → sessions(id) ON DELETE CASCADE
  scenario_id    TEXT NOT NULL
  kind           TEXT NOT NULL DEFAULT 'chat'  -- 'chat' 對話 / 'tts' 語音合成
  model          TEXT NOT NULL
  voice          TEXT      -- 只有 kind='tts' 會有值
  prompt_tokens  INTEGER   -- usageMetadata.promptTokenCount
  output_tokens  INTEGER   -- usageMetadata.candidatesTokenCount
  thought_tokens INTEGER   -- usageMetadata.thoughtsTokenCount（思考模型才有）
  total_tokens   INTEGER   -- usageMetadata.totalTokenCount
  latency_ms     INTEGER
  ok             INTEGER   -- 1 成功 / 0 失敗
  error          TEXT      -- 失敗時的 Gemini 錯誤訊息
  created_at     INTEGER NOT NULL
```

```sql
api_logs                        -- 每一次對外 API 呼叫的原始紀錄
  id            INTEGER PK AUTOINCREMENT
  platform      TEXT NOT NULL   -- 供應商，目前一律 'gemini'
  endpoint      TEXT NOT NULL   -- 完整 URL（認證走標頭，所以不含 key）
  operation     TEXT NOT NULL   -- 'chat' / 'tts' / 'verify-key'
  model         TEXT            -- verify-key 沒有模型，為 NULL
  detail        TEXT            -- 額外參數，例如 'voice=Kore'
  session_id    TEXT            -- 關聯用，刻意不加外鍵
  input         TEXT            -- 送出的內容（超過 4000 字截斷）
  output        TEXT            -- 收到的內容；語音記成 '[audio] 24000Hz…1.8s'
  input_tokens  INTEGER
  output_tokens INTEGER
  total_tokens  INTEGER
  status        INTEGER NOT NULL   -- HTTP 狀態碼
  ok            INTEGER NOT NULL
  error         TEXT
  requested_at  INTEGER NOT NULL   -- 送出時間 epoch ms
  returned_at   INTEGER NOT NULL   -- 收到時間 epoch ms
  duration_ms   INTEGER NOT NULL
```

索引：`messages(session_id, id)`、`api_calls(session_id)`、`api_calls(created_at)`、
`api_calls(kind)`、`api_logs(requested_at)`、`api_logs(operation)`。

### 遷移

`migrate()` 用 `PRAGMA table_info` 檢查欄位是否存在，缺了就 `ALTER TABLE` 補上，
舊資料列自動視為 `kind='chat'`。**依賴新欄位的索引必須建在 `migrate()` 裡面**，
不能放進 `SCHEMA` 字串——否則舊資料庫會在建索引時因為欄位不存在而爆掉。

### 三張表的分工

| 表 | 回答的問題 |
|---|---|
| `sessions` | 使用者練過哪些情境、什麼時候 |
| `messages` | **記憶**——每次呼叫 Gemini 時整段歷史都從這裡撈出來重送 |
| `api_calls` | **用量帳**——一列 = 一次計費呼叫，`kind` 分對話與語音，供統計聚合 |
| `api_logs` | **原始紀錄**——一列 = 一次對外呼叫，含送出/收到的實際內容與狀態碼，供除錯 |

`messages` 與 `api_calls` 刻意分開：一次失敗的呼叫不會產生 AI 訊息，
但它**仍然是一次呼叫**，必須計入用量與錯誤率。

「來回次數」只數 `kind='chat'`——語音合成是附加成本，不是一次對話往返，
混在一起數會讓「練了幾輪」這個數字失真。

### `api_calls` 與 `api_logs` 的差別

兩張表刻意分開，不要合併：

| | `api_calls` | `api_logs` |
|---|---|---|
| 用途 | 用量統計與聚合 | 除錯與稽核 |
| 記錄什麼 | token 數、延遲、成敗 | 連同**實際送出與收到的文字**、HTTP 狀態碼、平台、端點 |
| 涵蓋範圍 | 對話與語音 | **所有**對外呼叫，含不花 token 的 `verify-key` |
| 外鍵 | 有（`session_id`） | **無**——記錄失敗絕不能拖垮請求 |

`logApiCall()` 內部包了 try/catch，寫入失敗只會在 console 留一行錯誤，不會讓 API 呼叫失敗。

---

## 2. Token 與來回次數怎麼算

**不是估算的。** 數字直接取自 Gemini 回應的 `usageMetadata`
（[`lib/gemini.ts`](../lib/gemini.ts) 的 `generateReply`）：

| 顯示名稱 | 來源欄位 |
|---|---|
| 輸入 | `promptTokenCount` |
| 輸出 | `candidatesTokenCount` |
| 思考 | `thoughtsTokenCount` |
| 總計 | `totalTokenCount` |

**來回次數** = `api_calls` 中 `kind='chat'` 的列數。成功與失敗都算，因為兩者都送出了請求。
語音合成另外統計（`kind='tts'`），用量頁分成兩張卡。

注意 `promptTokenCount` 會隨對話變長而**持續增加**——每次呼叫都重送整段歷史。
這是自管記憶的必然代價，用量頁的「輸入 / 輸出」比例就是在觀察這件事。
`getHistory()` 預設只取最近 40 則來設上限。

聚合查詢都在 `lib/db.ts`：`getTotals`、`getUsageByScenario`、`getDailyUsage`、
`getRecentSessions`、`getRecentCalls`、`getSessionStats`。
觀察介面在 [`/usage`](../app/usage/page.tsx)。

---

## 3. Gemini 串接

**端點**：`POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
**認證**：`x-goog-api-key` 標頭
**預設模型**：`gemini-3.7-flash`（可用清單見 `MODELS`）

### 為什麼不用 Interactions API

Google 現在推薦新專案用 Interactions API，但它**把對話歷史存在 Google 那邊**
（`previous_interaction_id`），與本專案「用 SQLite 做記憶」的前提直接衝突。
`generateContent` 仍受完整支援，且我們自己管歷史，所以維持使用它。

### System instruction

由 `buildSystemInstruction(scenario)` 從情境資料組出來，用到
`persona`、`title`、`blurb`、`level`、`focus` 五個欄位（見 [SCENARIOS.md](SCENARIOS.md)）。
內容包含：角色設定、場景、依難度調整的語言複雜度、要引導的句型，
以及幾條硬規則（不出戲、只用英文、1–3 句加一個問題、純口語不要 markdown——
因為回覆會被語音合成唸出來）。

---

## 3.5 呼叫紀錄怎麼收集

`lib/gemini.ts` **會被 client 端 import**（`lib/settings.ts`、`components/settings-menu.tsx`
需要 `VOICES`、`DEFAULT_MODEL` 這些常數），所以**那個檔案裡絕對不能 import `node:sqlite`**，
否則前端 build 會炸。

因此改用回呼：`generateReply` / `synthesizeSpeech` / `verifyKey` 都接受一個
`onCall?: ApiCallLogger`，在 fetch 回來後**不論成敗**都會帶著完整的 `ApiCallRecord` 觸發一次。
Route handler（server-only）再傳 `onCall: (call) => logApiCall({ ...call, sessionId })` 進去。

好處是紀錄發生在 **API 邊界**而不是各個呼叫端，所以不可能漏記——
包含那些不寫進 `api_calls` 的呼叫（例如驗證 key）。

`endpoint` 存的是完整 URL；因為認證走 `x-goog-api-key` 標頭而非 query string，
**key 不會出現在紀錄裡**。

### 檢視介面

[`/logs`](../app/logs/page.tsx) 是這張表的專屬頁面：依操作與狀態篩選、全文搜尋
（比對 `input` / `output` / `error` / `model`）、每頁 25 筆分頁，點任一列展開看完整送出與收到內容。

篩選與分頁**全部走 URL query（`?op=` / `?status=` / `?q=` / `?page=`）**，
展開用原生 `<details>`，所以整頁是純伺服器渲染，沒有任何 client JS。
`/usage` 只保留摘要與連往這裡的入口，不重複列表格。

## 4. API key 的流向

```
設定面板輸入
   → localStorage（只在這台瀏覽器）
   → 每次請求帶 x-gemini-key 標頭到我們自己的 /api/chat
   → 伺服器轉成 x-goog-api-key 送給 Google
```

**key 不會寫進資料庫，也不會出現在任何 log。**
伺服器端備援：若請求沒帶標頭，會改讀環境變數 `GEMINI_API_KEY`（見 `.env.example`）。

驗證用 [`/api/key-check`](../app/api/key-check/route.ts)，它呼叫 `GET /v1beta/models?pageSize=1`
——**不花任何 token** 就能確認 key 有效。

---

## 5. 語音

### 學習者開口說（STT）

瀏覽器內建的 `SpeechRecognition` / `webkitSpeechRecognition`，`lang: en-US`，
**音訊不離開瀏覽器**。只有 Chromium 與 Safari 支援；不支援時介面會說明並退回打字。

### 家教的聲音（TTS）— 兩種來源可切換

設定面板的「家教的聲音」有兩個選項，**預設是瀏覽器語音**——先求隨開即用、
不消耗額度，需要好音質時再自己切到 Gemini：

| 來源 | 實作 | 成本 | 音質 |
|---|---|---|---|
| `browser`（預設） | `speechSynthesis` | 免費 | 機械感 |
| `gemini` | Gemini TTS 模型，走 `/api/speak` | 消耗音訊 token | 自然、可選音色 |

沒存過偏好時 `getVoiceSource()` 回 `browser`；只有明確存成 `gemini` 才會走 Gemini。

**Gemini TTS 的呼叫方式**（[`synthesizeSpeech`](../lib/gemini.ts)）：

- 端點：`POST /v1beta/models/{ttsModel}:generateContent`
- 模型：`gemini-3.1-flash-tts-preview`（可用 `GEMINI_TTS_MODEL` 覆寫）
- 請求：`generationConfig.responseModalities: ["AUDIO"]` 加上
  `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`
- 回應：`candidates[0].content.parts[0].inlineData.data` 是 base64 的**裸 PCM**
  （24 kHz、單聲道、16-bit）

**這裡同樣沒用 Interactions API**：它的 TTS token 回報方式官方文件沒寫清楚，
而 `generateContent` 這條路明確會回 `usageMetadata`——用量統計需要那個數字。

### PCM 要包成 WAV

瀏覽器不吃裸 PCM，所以伺服器用 `pcmToWav()` 在前面加 44 bytes 的 RIFF 標頭再回傳
`audio/wav`。取樣率從回應的 `mimeType`（形如 `audio/L16;codec=pcm;rate=24000`）解析，
解析不到就用 24000。

### 音色

30 個內建音色，清單與風格見 `VOICES`。預設 `Sulafat`（溫暖）。
送進來的音色名稱會用 `isKnownVoice()` 驗證，無效就退回預設。

### 自動出聲與瀏覽器的自動播放限制

進入對話頁時會**直接唸出開場白**（`自動朗讀家教回覆` 開啟時），之後每則回覆也自動播放。
續接舊對話（`?session=`）刻意不自動播放——一進門就重播很久以前的句子只會讓人困惑。

瀏覽器在使用者尚未與該頁面互動前會擋掉播放，兩條路徑的表現不同，所以分開處理：

| 路徑 | 被擋時的徵狀 | 偵測方式 |
|---|---|---|
| Gemini（`Audio.play()`） | promise reject | `DOMException` 且 `name === "NotAllowedError"` |
| 瀏覽器（`speechSynthesis`） | **無聲失敗，不會拋錯** | 900ms 後檢查 `onstart` 沒觸發且 `speaking === false` |

被擋時畫面出現「🔊 點一下開啟聲音」，點一次之後同一個頁面就不會再被擋。
**自動播放被擋不算 Gemini 失敗**，所以不會觸發退回瀏覽器語音（那同樣會被擋）。

從情境卡片點進來屬於同一個 document 的互動，通常不會被擋；
直接貼網址或重新整理才比較容易遇到。

### 免持自動輪流（真實情境模式）

`components/live-room.tsx` 把既有零件串成一個輪流迴圈，**沒有自己做語音活動偵測**——
`listen()` 的 `continuous: false` 本來就會在講者停頓時自動結束並回傳 final transcript。

```
開場白播放 → (speakState 轉 idle) → 開麥聆聽
          → (拿到 final transcript) → 送出 → 等回覆
          → 回覆播放 → (idle) → 再開麥 → …
```

四個必須守住的邊界：

| 情況 | 處理 |
|---|---|
| **回音** | `stopListenRef` 有值就不重複開麥；接棒只發生在 `speakState` 轉 `idle` 之後，播放期間麥克風永遠是關的，否則會錄到家教自己的聲音而自問自答 |
| **靜音** | `onEnd` 但沒收到文字 → 400ms 後重開；連續 `SILENT_LIMIT`（3）次沒聽到就停下並顯示「點一下再試」，不無限重啟 |
| **權限被拒** | `onError === "not-allowed"` → 暫停迴圈並說明 |
| **離開頁面** | cleanup 同時 `abort()` 辨識與 `stopSpeaking()` |

`onSpeechFinished` 由 `useConversation` 在播放自然結束時觸發（手動停止不會觸發）。
真實情境模式帶 `forceSpeak: true`，**無視「自動朗讀」設定**——沒有聲音的沉浸模式沒有意義。

`recognition.start()` 包在 try/catch 裡：重複啟動會丟 `InvalidStateError`，
在會反覆自動呼叫的迴圈裡不接住就會整個炸掉。

### 快取與退回

- **快取**：用戶端以 `(音色, 文字)` 為鍵快取產生好的音檔 URL，
  所以「唸給我聽」重播同一句**不會再花 token**。
- **退回**：Gemini 合成失敗（沒額度、key 失效、網路斷）時，
  `speakReply()` 會自動改用瀏覽器語音並在畫面上說明原因，對話不會突然安靜。

## 6. 一次對話的完整流程

[`app/api/chat/route.ts`](../app/api/chat/route.ts)：

1. 取 key（標頭 → 環境變數），沒有就回 `401`
2. 驗證 `scenarioId` 與訊息內容
3. 沒有 `sessionId` → 建立 session，並**先寫入情境開場白**作為第一則 `model` 訊息
4. 寫入使用者訊息
5. `getHistory()` 撈整段歷史 → 呼叫 Gemini
6. 成功：寫入 AI 訊息 + 寫入 `api_calls`（`ok=1`）
7. 失敗：**仍然寫入 `api_calls`**（`ok=0` 加錯誤訊息），回傳錯誤

`/chat/[id]?session=<id>` 可以續接舊對話，用量頁的「最近的對話」就是連到這個。
`?mode=` 決定進哪一種介面（`script` / `live`）；兩者都走同一組 API 與資料表，
差別只在前端呈現。`sessions.mode` 記下這段對話是用哪個模式開始的。

[`app/api/speak/route.ts`](../app/api/speak/route.ts) 是同樣的形狀：驗 key → 驗音色 →
（必要時建 session）→ 合成 → 寫 `api_calls`（`kind='tts'`）→ 回傳 WAV。
session id 透過 `x-session-id` 標頭回給用戶端，因為 body 是二進位音訊。

---

## 7. 已知限制

- **非串流**。用 `generateContent` 而非 `streamGenerateContent`，所以回覆是一次到位，
  等待期間顯示打字指示器。要改串流需同時改 route handler 與 `ChatRoom`。
- **沒有跨 session 記憶**。記憶目前只在單一 session 內。跨 session 的
  「他上次哪個句型講不順」還沒做——那需要另一張表存學習重點。
- **沒有成本估算**。只記 token 數，沒有換算成金額（不同模型費率不同）。
- **語音快取只在記憶體**。重新整理頁面後，同一句話會重新合成一次。
- **`api_logs` 會無限成長**，也**存了對話原文**。目前沒有自動清理或保留期限，
  需要的話得自己 `DELETE FROM api_logs WHERE requested_at < …`。
- **TTS 模型是 preview 版**。`gemini-3.1-flash-tts-preview` 隨時可能變動或改名。
