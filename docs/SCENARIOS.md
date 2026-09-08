# Fluently — 對話情境規格

> 目前 8 個情境（一場景一個）的完整記錄。**執行時資料在 DB**（`scenes` / `scenarios` / `characters`），
> 正式是 Cloudflare D1、dev 是 `node:sqlite`；seed 目錄在 [`lib/scenarios.ts`](../lib/scenarios.ts)、
> 正式 seed 在 `migrations/0002_seed.sql`。
> 這份文件是說明書：欄位定義、每個情境的設定、以及新增情境的規則。
>
> 角色**沒有獨立的 `roles` 表**：用 `scenarios.role_type`（`staff`/`friend`/`boss`）表示，
> 決策見 [DATA.md §8 ADR-002](DATA.md)。目前所有情境都由 **Bella** 演出（同一顆聲音）。
>
> 兩邊不一致時以 `lib/scenarios.ts` 的 seed 為準（dev 開庫時 upsert），並修正這份文件。

---

## 1. 資料結構

```ts
type ScenarioCatalog = Scenario & {
  sceneId: string; // scenes.id（咖啡店、街頭、職場…）
  characterId: string; // characters.id（目前只有 bella）
};
// Scenario 內含 roleType: "staff" | "friend" | "boss"
```

| 欄位 | 說明 | 撰寫規則 |
|---|---|---|
| `id` | 唯一代號，同時是路由 `/chat/[id]` | 小寫英文 + 連字號；**一旦公開就不要再改**（會斷連結與 DB 外鍵） |
| `sceneId` | 所屬場景 | 對應 `SCENE_CATALOG` |
| `roleType` | AI 演哪種角色 | `staff` 工作人員 / `friend` 朋友 / `boss` 主管 |
| `characterId` | 由哪個人物扮演（決定聲音） | 對應 `CHARACTER_CATALOG`（目前只有 `bella`） |
| `emoji` | 卡片上的圖示 | 單一 emoji，避免膚色／性別變體 |
| `title` | 英文情境名 | 2–3 個字的名詞片語，Title Case |
| `titleZh` | 中文情境名 | 4–6 字，口語、具體 |
| `blurb` | 中文情境描述 | **一句話 25–40 字**，寫「你會遇到什麼」而不是「你會學到什麼」 |
| `level` | 難度 | 三級之一，判準見第 2 節 |
| `persona` | AI 扮演的角色 | **英文**，小寫開頭的名詞片語（會被接在 `you play ` 之後）。寫「他是誰」，不要寫他該怎麼說話 |
| `focus` | 語言學習重點 | **英文、3 個**，是家教要引導出來的能力，不是單字表 |
| `opening` | 家教的開場白 | **英文一句話（可含兩個短句）**，必須已經在角色裡，並以問句收尾把球丟給使用者 |
| `tint` | `[淺色, 深色]` emoji 方塊底色 | 低飽和暖／冷灰調，用法見 [DESIGN.md §2](DESIGN.md) |

### 同檔案的其他匯出

| 匯出 | 用途 |
|---|---|
| `LEVELS` | 難度清單（`id` / `label` 中文 / `en` 英文），供篩選器與 badge 使用 |
| `ROLE_TYPES` | 角色類型清單（`staff`/`friend`/`boss` 與中文標籤） |
| `SCENE_CATALOG` / `CHARACTER_CATALOG` / `scenarios` | seed 進 DB 的目錄（dev 用；正式對應 `migrations/0002_seed.sql`） |
| `listScenarios()` / `getScenario(id)` | **在 `lib/db.ts`**：從 DB 組出 UI 用的 `Scenario`（含 scene 的 emoji/tint 與 scenario 的 persona/role_type） |
| `levelLabel(level)` | 取難度標籤的 helper，**目前沒有被使用**（兩處頁面各自寫了 `LEVELS.find(...)`） |

---

## 2. 難度判準

| 難度 | `id` | 中文 | 判準 |
|---|---|---|---|
| 初級 | `beginner` | 初級 | 交易式對話，句型固定、可預期，說錯不會有後果 |
| 中級 | `intermediate` | 中級 | 需要描述細節、確認資訊、處理小狀況，對方會追問 |
| 進階 | `advanced` | 進階 | 要組織論點、應對壓力、在有立場的情況下維持禮貌 |

目前難度分佈為初級 3、中級 3、進階 2，**新增時盡量維持平衡**。

---

## 3. 情境總表

| # | `id` | Emoji | English | 中文 | 難度 | role_type | Focus |
|---|---|---|---|---|---|---|---|
| 1 | `cafe` | ☕ | Ordering Coffee | 咖啡廳點餐 | 初級 | staff | Polite requests · Sizes & options · Small talk |
| 2 | `directions` | 🧭 | Giving Directions | 街頭被問路 | 初級 | friend | Giving directions · Prepositions of place · Landmarks |
| 3 | `small-talk` | 💬 | Small Talk | 派對被搭訕 | 初級 | friend | Openers · Follow-up questions · Ending politely |
| 4 | `hotel` | 🏨 | Hotel Check-in | 飯店入住 | 中級 | staff | Confirming details · Making requests · Complaints |
| 5 | `clinic` | 🩺 | At the Clinic | 看診問診 | 中級 | staff | Describing symptoms · Duration & frequency · Instructions |
| 6 | `phone-interview` | 📞 | Phone Interview | 電話面試 | 中級 | boss | Phone etiquette · Self-introduction · Asking to repeat |
| 7 | `interview` | 💼 | Job Interview | 面試現場 | 進階 | boss | Self-introduction · STAR answers · Asking back |
| 8 | `debate` | ⚖️ | Opinion & Debate | 環保辯論 | 進階 | friend | Stating a position · Counter-arguments · Hedging |

> emoji 與底色來自 **scene**（見 `scenes` 表），情境卡顯示的是所屬場景的圖示。

---

## 4. 各情境細節

> 「AI 扮演」對應資料裡的 `persona` 欄位，是 Gemini system instruction 的角色設定來源
> （組法見 [DATA.md §3](DATA.md)）。表中的品牌（Bluebird Coffee、The Harbour Hotel、
> Nordwell Support）皆為虛構。

### 初級

#### ☕ `cafe` — Ordering Coffee／咖啡廳點餐

- **描述**：走進街角咖啡廳，點一杯剛剛好的拿鐵，順便和店員閒聊兩句。
- **role_type**：`staff`（工作人員）
- **AI 扮演**：Bluebird Coffee 的咖啡師
- **Focus**：`Polite requests` · `Sizes & options` · `Small talk`
- **Opening**：`Hi there! Welcome to Bluebird Coffee. What can I get started for you today?`
- **Tint**：`#f3e7d8` / `#3a2f24`（scene: cafe）

#### 🧭 `directions` — Giving Directions／街頭被問路

- **描述**：在街頭被觀光客攔下問路，練習清楚地指路與描述方位。
- **role_type**：`friend`（朋友）
- **AI 扮演**：有點迷路、向學習者問路的觀光客
- **Focus**：`Giving directions` · `Prepositions of place` · `Landmarks`
- **Opening**：`Excuse me, sorry to bother you! I'm a bit lost — do you know how to get to the train station from here?`
- **Tint**：`#dfeae0` / `#243329`（scene: street）

#### 💬 `small-talk` — Small Talk／派對被搭訕

- **描述**：派對上有人主動來搭話，用三分鐘找出你們的共同話題。
- **role_type**：`friend`（朋友）
- **AI 扮演**：派對上主動來攀談的賓客 Sam
- **Focus**：`Openers` · `Follow-up questions` · `Ending politely`
- **Opening**：`Hey! I don't think we've met — I'm Sam. Mind if I join you? This party is pretty packed, huh?`
- **Tint**：`#e6e3f2` / `#2b2937`（scene: party）

### 中級

#### 🏨 `hotel` — Hotel Check-in／飯店入住

- **描述**：深夜抵達飯店，處理訂房、房型與一點點突發狀況。
- **role_type**：`staff`（工作人員）
- **AI 扮演**：The Harbour Hotel 的夜班櫃檯
- **Focus**：`Confirming details` · `Making requests` · `Complaints`
- **Opening**：`Good evening, and welcome to The Harbour Hotel. Do you have a reservation with us tonight?`
- **Tint**：`#dee7f0` / `#232c36`（scene: hotel）

#### 🩺 `clinic` — At the Clinic／看診問診

- **描述**：向醫生描述症狀、聽懂醫囑，並問清楚該注意什麼。
- **role_type**：`staff`（工作人員）
- **AI 扮演**：門診醫師
- **Focus**：`Describing symptoms` · `Duration & frequency` · `Instructions`
- **Opening**：`Hello, come on in and have a seat. So, what brings you in today?`
- **Tint**：`#f0dfe2` / `#372529`（scene: clinic）

#### 📞 `phone-interview` — Phone Interview／電話面試

- **描述**：接到招募人員來電，在看不到表情的情況下完成第一輪電話面試。
- **role_type**：`boss`（主管）
- **AI 扮演**：進行第一輪電話面試的招募人員
- **Focus**：`Phone etiquette` · `Self-introduction` · `Asking to repeat`
- **Opening**：`Hi, thanks for taking my call! Is now still a good time for a quick phone interview?`
- **Tint**：`#e9e4d6` / `#332f24`（scene: phone）

### 進階

#### 💼 `interview` — Job Interview／面試現場

- **描述**：面對面試官，講出你的經歷、強項，還有那個經典的難題。
- **role_type**：`boss`（主管）
- **AI 扮演**：當面面試的用人主管
- **Focus**：`Self-introduction` · `STAR answers` · `Asking back`
- **Opening**：`Thanks for coming in today. To get us started — could you walk me through your background?`
- **Tint**：`#e2e6ea` / `#262b2f`（scene: workplace）

#### ⚖️ `debate` — Opinion & Debate／環保辯論

- **描述**：挑一個環保爭議題目，練習把立場說得有邏輯又有風度。
- **role_type**：`friend`（朋友）
- **AI 扮演**：站在相反立場、討論環保議題的對談者
- **Focus**：`Stating a position` · `Counter-arguments` · `Hedging`
- **Opening**：`Let's dig into something timely: should single-use plastics be banned outright? Where do you stand?`
- **Tint**：`#efe2d3` / `#372c22`（scene: forum）

---

## 5. 欄位在 UI 的使用位置

| 欄位 | 首頁 `/` | 選擇頁 `/scenarios` | 獨白式對話 | 真實情境 |
|---|---|---|---|---|
| `id` | 快捷 chip 的連結 | 卡片連結 | 路由參數 | 路由參數 |
| `emoji` | 快捷 chip | 卡片圖示方塊 | header 圖示方塊 | 沒有舞台素材時的畫面 |
| `title` | — | 卡片標題（`font-display`） | header 標題、metadata | header 標題 |
| `titleZh` | 快捷 chip | 卡片副標 | header 副標 | 舞台下方的說明 |
| `blurb` | — | 卡片內文 | 對話開始前的置中提示 | 模式選擇畫面的提示 |
| `level` | — | 難度篩選 + badge | header 副標 | — |
| `focus` | — | 卡片底部標籤 | 頁面底部標籤 | —（不顯示文字） |
| `opening` | — | — | **家教的第一則訊息** | **自動唸出的開場白** |
| `tint` | — | 圖示方塊底色 | 圖示方塊底色 | 無舞台素材時的底色 |

首頁只取前 4 個情境（`scenarios.slice(0, 4)`）當快捷 chip，**順序即優先序**。

對話頁有兩種模式，由 `?mode=` 決定（`script` 獨白式 / `live` 真實情境）；
沒帶 `mode` 且不是續接舊對話時，先顯示模式選擇畫面。

真實情境模式的角色素材在 [`lib/scene-clips.ts`](../lib/scene-clips.ts) 登記。
目前只有 `cafe` 有靜態圖，用來先把對話循環跑過一次：

| phase | 靜態圖 | 畫面 |
|---|---|---|
| `warming`（客人進門、開場白） | `scenario_d.jpeg` | 揮手歡迎 |
| `listening` / `speaking` | `scenario_a.jpeg` | 面向客人微笑 |
| `thinking` | `scenario_c.jpeg` | 托腮思索 |
| 結帳（尚未接上 phase） | `scenario_b.png` | 手按收銀機 |

其餘情境會退回情境 emoji，版面不會因此跳動。影片規格與待辦見 [`SCENARIOS_Vedio.md`](SCENARIOS_Vedio.md)。

---

## 6. 新增一個情境

1. 在 [`lib/scenarios.ts`](../lib/scenarios.ts) 的 `scenarios` 陣列**依難度分組的位置**插入新物件（目前排序是 初級 → 中級 → 進階）。必要時先在 `SCENE_CATALOG` / `CHARACTER_CATALOG` 加場景與人物。
2. 依第 1 節的撰寫規則填滿欄位（含 `sceneId` / `roleType` / `characterId`）。
3. `tint` 挑一組還沒被用過的低飽和色，淺色亮度約 90%、深色約 20%（寫在對應的 scene 上）。
4. **同步 `migrations/0002_seed.sql`**（正式 D1 的 seed 來源）——加一筆對應的 `INSERT ... ON CONFLICT`；若改了 schema 另開一支新的 migration。
5. 回來更新這份文件的第 3 節總表與第 4 節細節。
6. dev：`npm run dev`（`nodeSeed()` 會 upsert；schema 大改可先刪 `data/fluently.db`）。正式：`wrangler d1 migrations apply fluently_db --remote`。跑 `npm run build`。

檢查清單：

- [ ] `id` 唯一、小寫連字號、沒有和既有情境撞名
- [ ] `blurb` 是「你會遇到什麼」，25–40 字
- [ ] `focus` 是 3 個英文能力項，不是單字
- [ ] `opening` 已經在角色裡，且以問句收尾
- [ ] 難度分佈仍大致平衡
- [ ] 本文件第 3、4 節已同步更新

---

## 7. 情境如何餵給 AI

`buildSystemInstruction()`（[`lib/gemini.ts`](../lib/gemini.ts)）用到五個欄位：

| 欄位 | 在 system instruction 裡的作用 |
|---|---|
| `persona` | `In this session you play {persona}.` |
| `title` + `blurb` | 場景描述 |
| `level` | 挑對應的語言複雜度指示（A2／B1-B2／B2-C1） |
| `focus` | `Steer the conversation so the learner naturally practises: …` |
| `opening` | session 建立時寫入資料庫的第一則 `model` 訊息 |

`id` 現在是 `sessions.scenario_id` 與 `scenarios.id` 的值，
**更加不可以更動**——改了會讓既有的用量紀錄對不上情境。

執行時情境已在 DB；dev 改 seed 後重啟 dev server（`nodeSeed()` upsert），正式則套用 migration。
