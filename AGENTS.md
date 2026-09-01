<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Fluently — 專案規範

英文口說練習應用：使用者選一個情境，與 AI 英文家教（Gemini）對話練習，
對話與學習記憶存在本地 SQLite。

## 動 UI 前必讀

**[`docs/DESIGN.md`](docs/DESIGN.md) 是 UI 的唯一事實來源。**
在新增或修改任何頁面、元件、樣式之前先讀它——裡面有色彩 token、字型、字級、
圓角、間距、動畫與元件配方，以及一份提交前的檢查清單。

不要憑印象刻樣式：顏色一律用 token（`bg-canvas` / `text-ink` / `bg-clay`…），
不要寫裸 hex，也不要用 `dark:` 前綴（深色模式由 CSS 變數 + `prefers-color-scheme` 自動處理）。

改了 token 或新增通用樣式時，**同一個 commit 內更新 `docs/DESIGN.md`**。

## 動情境資料前必讀

**[`docs/SCENARIOS.md`](docs/SCENARIOS.md) 記錄了全部 9 個對話情境**：
`Scenario` 欄位定義、難度判準、每個情境的角色設定與開場白、欄位在各頁面的使用位置，
以及新增情境的步驟。情境資料本體在 `lib/scenarios.ts`。

新增或修改情境時，**同一個 commit 內更新 `docs/SCENARIOS.md`**；
`id` 是路由與未來 DB 外鍵，公開後不要更動。

## 動資料層或 AI 串接前必讀

**[`docs/DATA.md`](docs/DATA.md)** 記錄 SQLite schema（`sessions` / `messages` / `api_calls`）、
Gemini 串接方式、API key 流向、token 與來回次數的計算來源，以及語音的實作。

重點規則：

- token 數字一律取自 Gemini 回傳的 `usageMetadata`，**不要自己估算**。
- 失敗的呼叫也要寫進 `api_calls`（`ok=0`），否則錯誤率會失真。
- `api_calls.kind` 分 `chat` 與 `tts`：「來回次數」只數 `chat`，語音成本另計。
- `api_calls` 記帳、`api_logs` 記原始呼叫（含送出/收到內容與狀態碼），**兩張表不要合併**。
- 新增對外 API 呼叫時，透過 `onCall` 回呼記進 `api_logs`；
  **`lib/gemini.ts` 不可 import `node:sqlite`**（它會被 client 端 import）。
- 新增依賴新欄位的索引時，要放進 `migrate()`，不能放 `SCHEMA` 字串（舊資料庫會爆）。
- API key 只走 localStorage → 請求標頭，**永遠不要寫進資料庫或 log**。
- 改 schema 或改串接方式時，同一個 commit 內更新 `docs/DATA.md`。

資料庫需要 Node 22+（用內建 `node:sqlite`）。`ExperimentalWarning` 是預期輸出。

## 驗收

```bash
npm run build && npm run lint
```
