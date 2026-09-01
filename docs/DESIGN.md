# Fluently — 設計系統規範

> 這份文件是 **UI 的唯一事實來源**。任何 AI 或人類協作者在動 UI 之前先讀這份，
> 動完之後如果改了 token 或新增了通用樣式，**回來更新這份**。
>
> Token 實際定義在 [`app/globals.css`](../app/globals.css)（CSS 變數 + Tailwind v4 `@theme inline`）。
> 這份文件與那個檔案不一致時，以 `globals.css` 為準，並修正這份文件。

技術基礎：Next.js 16 App Router · React 19 · Tailwind CSS v4（無 `tailwind.config`，全部走 CSS-first）。

---

## 1. 視覺定位

參考 **claude.ai** 的調性：暖色紙感畫布、低對比邊框、大量留白、單一陶土色 accent、
襯線標題搭配無襯線內文。**不要**引入第二個 accent 色、漸層按鈕、重陰影或亮飽和色。

三個關鍵字：**warm（暖）· quiet（安靜）· roomy（寬鬆）**。

---

## 2. 色彩 Token

所有顏色一律用 token，**元件裡不准出現裸 hex**（唯一例外：`lib/scenarios.ts` 的情境專屬 `tint`）。
淺色定義在 `:root`，深色定義在 `@media (prefers-color-scheme: dark)`，
再由 `@theme inline` 映射成 Tailwind utility。

| Token | Tailwind class | Light | Dark | 用途 |
|---|---|---|---|---|
| `--canvas` | `bg-canvas` | `#faf9f5` | `#1f1e1d` | 頁面底色（`body` 已套） |
| `--canvas-deep` | `bg-canvas-deep` | `#f3f1e9` | `#191817` | 交錯區塊底色，用來分段 |
| `--surface` | `bg-surface` | `#ffffff` | `#262624` | 卡片、composer、浮起面 |
| `--surface-2` | `bg-surface-2` | `#f5f3ec` | `#30302e` | 次級面：hover 底、tag、chip |
| `--ink` | `text-ink` | `#23211e` | `#f4f2ec` | 主要文字、標題 |
| `--ink-soft` | `text-ink-soft` | `#57544e` | `#c3c0b8` | 內文段落 |
| `--ink-muted` | `text-ink-muted` | `#83807a` | `#918d85` | 註解、meta、placeholder |
| `--line` | `border-line` | `#e7e3d8` | `#373633` | 預設邊框（常配 `/70` 透明度） |
| `--line-strong` | `border-line-strong` | `#d8d3c4` | `#494742` | hover 邊框、強調分隔 |
| `--clay` | `bg-clay` `text-clay` | `#d97757` | `#d97757` | **唯一 accent**：主按鈕、連結、重點字 |
| `--clay-deep` | `bg-clay-deep` | `#c15f3c` | `#e08a6d` | clay 的 hover 態（深淺模式反向） |
| `--clay-wash` | `bg-clay-wash` | `#f7e9e2` | `#3a2a23` | accent 的極淡底，放圖示方塊 |
| `--on-clay` | `text-on-clay` | `#ffffff` | `#ffffff` | 疊在 clay 上的文字 |
| `--shadow` | `shadow-[var(--shadow)]` | 雙層極淡 | 雙層深黑 | **唯一允許的陰影** |

規則：

- **深色模式有三層解析順序**，全部靠 CSS 變數，**永遠不要寫 `dark:` class 前綴**：
  1. `:root` — 淺色，預設值
  2. `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` — 跟隨系統
  3. `:root[data-theme="dark"]` / `[data-theme="light"]` — 使用者在設定選單的手動指定

  `<html>` 上的 `data-theme` 由兩處寫入：[`app/layout.tsx`](../app/layout.tsx) 的 inline script
  （在首次繪製前套用，避免閃爍）與 [`components/settings-menu.tsx`](../components/settings-menu.tsx)。
  **沒有 `data-theme` 屬性 = 跟隨系統。**
- 深色色值在 CSS 裡刻意寫了兩份（media query 一份、`[data-theme="dark"]` 一份），
  **改的時候兩份都要改**，內容必須完全一致。
- accent 用得越少越有力。一個畫面裡 clay 出現超過 3 處就該檢討。
- 陰影只用 `shadow-[var(--shadow)]`，且僅限「浮起」的元素（主按鈕、composer、卡片 hover）。

### 情境專屬色（scenario tint）

每個情境在 [`lib/scenarios.ts`](../lib/scenarios.ts) 帶一組 `tint: [light, dark]`，
用來染 emoji 方塊。用法是把值放進 inline CSS 變數，再套 `.tinted`：

```tsx
<span
  className="tinted flex h-11 w-11 items-center justify-center rounded-xl"
  style={{ "--tint-light": s.tint[0], "--tint-dark": s.tint[1] } as React.CSSProperties}
>
  {s.emoji}
</span>
```

`.tinted` 定義在 `globals.css` 末段，自帶深色模式切換與 `--surface-2` fallback。

---

## 3. 字型

由 `next/font/google` 在 [`app/layout.tsx`](../app/layout.tsx) 載入，掛在 `<html>` 的 CSS 變數上。

| 角色 | 字體 | CSS 變數 | Tailwind class |
|---|---|---|---|
| 標題 / 品牌 | **Source Serif 4** | `--font-serif-src` → `--font-display` | `font-display` |
| 內文 / UI | **Geist Sans** | `--font-geist-sans` → `--font-sans` | 預設（`body` 已套） |
| 數字 / 標號 | **Geist Mono** | `--font-geist-mono` → `--font-mono` | `font-mono` |

用法規則：

- **`font-display` 只給標題**：`h1`–`h3`、卡片標題、wordmark。內文、按鈕、標籤一律無襯線。
- 大標配 `tracking-tight` 或 `tracking-[-0.02em]`；襯線大字不加粗，維持 `font-normal`。
- `font-mono` 只用在步驟編號那類小標號（`01` / `02`），不要拿來排內文。
- 中文沒有指定字體，交給系統預設，因此**中文標題不要期待襯線效果**——
  需要氣勢時靠字級與留白，不要靠 `font-bold`。

### 字級（實際在用的一套，沿用即可，別再發明新尺寸）

| 用途 | class | 行高 |
|---|---|---|
| Hero 大標 | `text-[42px]` → `sm:text-[58px]` | `leading-[1.12]` |
| 頁面主標 | `text-[36px]` → `sm:text-[44px]` | `leading-tight` |
| 區塊標題 | `text-[28px]` → `sm:text-[32px]` | 預設 |
| 卡片標題 | `text-[18px]` / `text-[19px]` | `leading-snug` |
| Hero 內文 / 對話訊息 | `text-[16px]` / `text-[17px]` | `leading-7` / `leading-8` |
| 一般內文 | `text-[14px]` / `text-[15px]` | `leading-7` |
| meta / 註解 | `text-[13px]` | 預設 |
| 標籤 badge | `text-[12px]` | 預設 |

長標題與短段落加 `text-balance`。

---

## 4. 形狀與間距

| 元素 | 圓角 |
|---|---|
| 按鈕、chip、badge、頭像 | `rounded-full` |
| Composer 輸入框 | `rounded-[20px]` |
| 卡片 | `rounded-2xl` |
| 大型 CTA 區塊 | `rounded-3xl` |
| 圖示方塊（emoji tile） | `rounded-xl` |
| Nav 項目 | `rounded-lg` |
| 小標籤 | `rounded-md` |

- **容器寬度**：一般頁面 `max-w-6xl`；閱讀/對話 `max-w-3xl`；Hero 文字 `max-w-2xl`。
- **水平內距**：全站一致 `px-5 sm:px-8`。
- **區塊垂直節奏**：`py-20`（區塊）、`py-14 sm:py-20`（頁面）、Hero `pt-16 pb-20 sm:pt-24 sm:pb-28`。
- 區塊之間用 `border-t border-line/70` 分隔，並用 `bg-canvas-deep` 交錯，**不要用陰影分段**。
- 主按鈕高度固定 `h-13`（Tailwind v4 動態 spacing，合法）。

---

## 5. 動態

動畫就這幾個，全部定義在 `globals.css`，且都被 `prefers-reduced-motion` 關掉。
**新增動畫時記得一併加進那個 media query 的關閉清單。**

| class | 效果 | 用在哪 |
|---|---|---|
| `.rise` | 淡入上浮 0.75s | 進場元素；用 `[animation-delay:80ms]` 之類錯開 |
| `.glow` | 緩慢呼吸縮放 7s | Hero 背後的色暈 |
| `.caret` | 游標閃爍 | 打字動畫的游標 |
| `.pop` | 下拉淡入 0.18s | 彈出面板（設定選單） |
| `.ripple` | 環狀脈動 2.4s | 真實情境模式的說話／聆聽指示環 |

`.glow` 另外被借用在對話的「思考中」三點指示器上（三個點各給不同 `animation-delay`）。

互動一律 `transition-colors` / `transition-all duration-300`。
hover 位移最多 `-translate-y-0.5`，箭頭用 `group-hover:translate-x-1`。**不要彈跳、不要縮放整張卡。**

---

## 6. 元件配方（直接複製，不要另創一套）

**主按鈕（clay pill）**

```tsx
className="group inline-flex h-13 items-center gap-2 rounded-full bg-clay px-7 text-[16px] font-medium text-on-clay shadow-[var(--shadow)] transition-colors hover:bg-clay-deep"
```

**次要按鈕（描邊 pill）**

```tsx
className="rounded-full border border-line-strong px-4 py-2 font-medium text-ink transition-colors hover:border-clay hover:text-clay"
```

**卡片**

```tsx
className="rounded-2xl border border-line bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow)]"
```

**Chip / 標籤**

```tsx
className="rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
className="rounded-md bg-surface-2 px-2 py-1 text-[12px] text-ink-muted"   // 靜態標籤
```

**Header**：`sticky top-0 z-30 border-b border-line/70 bg-canvas/80 backdrop-blur-md`，高度 `h-16`。

**可展開列（log 之類的長清單）**

用原生 `<details>` / `<summary>`，不要為了展開收合寫 client component：

```tsx
<details className="group bg-surface border-t border-line">
  <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 hover:bg-surface-2">
    <span className="transition-transform group-open:rotate-90">▶</span>
    …摘要列，長文字用 truncate…
  </summary>
  <div className="border-t border-line bg-surface-2 px-5 py-4">…全文…</div>
</details>
```

摘要列的 meta（時間、狀態碼、耗時）一律 `font-mono text-[12px] text-ink-muted`，
錯誤狀態才加 `bg-clay-wash text-clay`。

**真實情境模式的中央 Orb**

沒有字幕的沉浸模式只有一個視覺錨點：情境 emoji 放在圓形內，外面兩圈環表達狀態。

```tsx
// 外環：聆聽時 border-clay，家教說話時 border-clay/60，其餘 border-line
// 說話或聆聽中才加 .ripple
className="absolute inset-0 rounded-full border-2 border-clay ripple"
// 內圈裝飾
className="absolute inset-4 rounded-full border border-clay/30"
// 中心：沿用情境卡片同一套 .tinted + --tint-light/--tint-dark
className="tinted flex h-28 w-28 items-center justify-center rounded-full text-[44px]"
```

狀態文字放在 Orb 下方 `text-[17px] text-ink`，次要資訊 `text-[13px] text-ink-muted`。
**這個模式不顯示任何對話文字，也不顯示 token 數字**——只留來回計數。

**對話氣泡**

```tsx
// 家教（左，帶 Mark 頭像）
className="rounded-2xl rounded-tl-sm border border-line bg-surface px-4 py-3 text-[16px] leading-7"
// 使用者（右，實心 clay）
className="max-w-[80%] rounded-2xl rounded-tr-sm bg-clay px-4 py-3 text-[16px] leading-7 text-on-clay"
```

氣泡下方的 meta（token、延遲、重聽）用 `text-[12px] text-ink-muted`，數字加 `font-mono`。

**Stat tile（數據卡）**

```tsx
// 外框
className="rounded-2xl border border-line bg-surface p-5"
// 標籤 text-[12px] text-ink-muted / 數值 font-display text-[28px]（hero 用 text-[34px] text-clay）/ 註解 text-[12px] text-ink-muted
```

一個畫面只給**一個** hero tile 上 clay 色，其餘維持 `text-ink`。

**長條圖**

單一數列就用單一色相（`bg-clay`），**不需要圖例**——標題已經說明它是什麼。
資料端 `rounded-t-[4px]` 貼齊基線、bar 之間 `gap-[2px]`、空值畫成 `bg-line` 的細條
（不要留空白，否則時間軸會說謊）。只直接標註首尾與尖峰，不要每根都標數字。
每根 bar 給 `title` 屬性當 hover 說明，並在頁面下方附對應的表格。

**圖示按鈕（header 內）**

```tsx
className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
```

**彈出面板（popover）**

```tsx
className="pop absolute right-0 top-full z-40 mt-2 w-[288px] rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]"
```

必備行為：點面板外關閉、`Esc` 關閉、trigger 帶 `aria-expanded` 與 `aria-haspopup`。

**分段控制項（segmented control）**

```tsx
// 外框
className="flex gap-1 rounded-lg bg-surface-2 p-1"
// 選項；選中時 bg-clay text-on-clay
className="flex-1 rounded-md px-2 py-1.5 text-[13px] text-ink-soft transition-colors hover:text-ink"
```

---

## 7. 檔案位置

| 路徑 | 內容 |
|---|---|
| [`app/globals.css`](../app/globals.css) | 色彩 token、`@theme inline` 映射、動畫、`.tinted` |
| [`app/layout.tsx`](../app/layout.tsx) | 字型載入、`<html>` 變數、全站 metadata |
| [`components/logo.tsx`](../components/logo.tsx) | `Mark`（對話框 + sparkle）與 `Wordmark` |
| [`components/site-header.tsx`](../components/site-header.tsx) · [`site-footer.tsx`](../components/site-footer.tsx) | 共用框架 |
| [`lib/scenarios.ts`](../lib/scenarios.ts) | 情境資料，含每個情境的 `tint` |
| [`lib/theme.ts`](../lib/theme.ts) | 主題型別、`localStorage` key、`applyTheme()` |
| [`lib/devtools.ts`](../lib/devtools.ts) | Next.js DevTools dev-server 端點的用戶端（**僅開發模式**） |
| [`components/settings-menu.tsx`](../components/settings-menu.tsx) | 設定選單：外觀切換 + DevTools 指示器控制 |
| [`app/api/devtools-config/route.ts`](../app/api/devtools-config/route.ts) | 讀取 DevTools 設定檔的 dev-only route handler |
| [`components/chat-room.tsx`](../components/chat-room.tsx) | 對話介面：訊息氣泡、語音、每回合 token |
| [`app/usage/page.tsx`](../app/usage/page.tsx) | 用量統計頁：stat tile、長條圖、表格 |
| [`app/logs/page.tsx`](../app/logs/page.tsx) | API 紀錄頁：篩選 pill、`<details>` 展開列、分頁 |
| [`components/live-room.tsx`](../components/live-room.tsx) | 真實情境模式：Orb、狀態文字、免持迴圈 |
| [`components/mode-picker.tsx`](../components/mode-picker.tsx) | 進入對話前的模式選擇畫面 |
| [`lib/use-conversation.ts`](../lib/use-conversation.ts) | 兩個模式共用的對話狀態與語音控制 |

---

## 8. 給後續協作者的檢查清單

動 UI 前後請確認：

- [ ] 沒有裸 hex／裸 `rgb()`，顏色都走 token。
- [ ] 沒有寫 `dark:` 前綴；深色靠 CSS 變數 + `data-theme` 三層解析生效。
- [ ] 若改了深色色值，media query 與 `[data-theme="dark"]` **兩個區塊都改了**。
- [ ] 字級取自第 3 節表格，沒有新增尺寸。
- [ ] 圓角取自第 4 節表格。
- [ ] 只用了 `shadow-[var(--shadow)]`，沒有其他陰影。
- [ ] 新的進場動畫用 `.rise`，沒有繞過 `prefers-reduced-motion`。
- [ ] 水平內距是 `px-5 sm:px-8`，容器寬度取自第 4 節。
- [ ] `npm run build` 與 `npm run lint` 都過。
- [ ] 如果改了 token 或新增通用樣式 → **已回頭更新這份文件**。
