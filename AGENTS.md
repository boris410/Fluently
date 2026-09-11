<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Fluently — 專案規範

英文口說練習應用：使用者以 Google 登入後選一個情境，與 AI 英文家教（Gemini）對話練習，
對話與學習記憶存在 Cloudflare D1（`next dev` 走同一顆 local D1）。

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
以及新增情境的步驟。Seed 目錄在 `lib/scenarios.ts`，執行時讀 D1。

新增或修改情境時，**同一個 commit 內更新 `docs/SCENARIOS.md`**；
`id` 是路由與未來 DB 外鍵，公開後不要更動。

## 動資料層或 AI 串接前必讀

**[`docs/DATA.md`](docs/DATA.md)** 記錄 D1 schema（學習者、場景、情境、better-auth 帳號、用量帳、呼叫紀錄）、
Gemini 串接方式、API key 流向、token 與來回次數的計算來源，以及語音的實作。

重點規則：

- token 數字一律取自 Gemini 回傳的 `usageMetadata`，**不要自己估算**。
- 失敗的呼叫也要寫進 `api_calls`（`ok=0`），否則錯誤率會失真。
- `api_calls.kind` 分 `chat` 與 `tts`：「來回次數」只數 `chat`，語音成本另計。
- `api_calls` 記帳、`api_logs` 記原始呼叫（含送出/收到內容與狀態碼），**兩張表不要合併**。
- 新增對外 API 呼叫時，透過 `onCall` 回呼記進 `api_logs`；
  **`lib/gemini.ts` 不可 import 資料庫**（它會被 client 端 import）。
- 新增 schema 一律走 `migrations/*.sql` + `wrangler d1 migrations apply`，不要在執行時 `ALTER`。
- API key 只走 localStorage → 請求標頭，**永遠不要寫進資料庫或 log**。
- 角色舞台素材路徑（靜態圖與影片）只寫在 `lib/scene-clips.ts`，其他檔案一律透過 `resolveClip()` 取得。
- 改 schema 或改串接方式時，同一個 commit 內更新 `docs/DATA.md`。
- 登入走 better-auth（Google）；練習資料必須用 `user.id` 過濾。OAuth secret 只放 `.env.local`（`next dev`）、`.dev.vars`（preview）、或 `wrangler secret`（正式）。

## 驗收

```bash
npm run build && npm run lint
```

## 多角色（自動迴圈）

使用者只要丟產品需求。主 Agent 當編排器，用 Task 叫專案子代理，不必開四個 Agents 視窗。

流程：`pm` 寫 [`docs/specs/`](docs/specs/) → `qa` 審規格 → `frontend` 與 `backend` 平行實作 → `qa` 對 `git diff`。細節在 [`.cursor/skills/fluently-feature-loop/SKILL.md`](.cursor/skills/fluently-feature-loop/SKILL.md)。角色提示詞在 [`.cursor/agents/`](.cursor/agents/)，檔案觸發規則在 [`.cursor/rules/`](.cursor/rules/)。

**修復審查上限：** 每個角色獨立計算。產出 1 → QA 審 1 → 僅允許修 1 次 → QA 審 2。第 2 次仍有 Must-fix 就停止該角色，不再修。PM 在規格階段被停則不進實作。Should-fix 不啟動修復輪。

規格用 [`docs/specs/_template.md`](docs/specs/_template.md)。每次交接輸出 Goal / Changes / Next Step。

檔案所有權：

- PM：`docs/specs/`（改情境目錄才動 `docs/SCENARIOS.md`）
- 前端：`components/`、pages/layouts、`lib/use-*.ts`、`lib/scene-clips.ts`、`docs/DESIGN.md`
- 後端：`app/api/`、`migrations/`、`docs/DATA.md`、非 UI 的 `lib/`（db / auth / gemini / speech）
- QA：只寫 `docs/specs/*-qa.md`，不改產品碼

同一檔有衝突就停、寫進 Next Step，不要兩邊一起改。`wrangler secret` 與 Google Console 仍是人做。不要把 `.env.local` / `.dev.vars` 寫進規格或 commit。

純提問、OAuth/secret 設定、使用者已指定檔案的單點修正：不要開迴圈。若要手動開 Agent，每個執行緒只掛一個角色規則，前後端用不同 worktree。
