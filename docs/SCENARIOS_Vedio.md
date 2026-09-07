# SPEC：咖啡店情境角色動畫播放器

給 Claude Code 的實作規格。目標是在既有的英語口說練習 React 前端裡，加入一個會隨對話狀態切換的角色影片區塊。

---

## 0. 實作現況（由 Claude Code 回填）

規格已實作，但**與原規格有幾處刻意的差異**，以下為實際狀態：

**已完成**

- 素材搬到 `public/scenes/cafe/`（原本在 `public/Scenario/CoffeShop/Counter/`，
  順便修掉 `CoffeShop` 少一個 f 的錯字）
- 片段清單：[`lib/scene-clips.ts`](../lib/scene-clips.ts)（不是 `src/features/scene/clips.ts`——
  本專案是 App Router，沒有 `src/`）
- 播放元件：[`components/scene-stage.tsx`](../components/scene-stage.tsx)
- 圓形 Orb 已移除，改成直式舞台（比例鎖 `880 / 1072`）
- **先用靜態圖跑完整對話循環**，影片先不接：進門揮手是 `scenario_d.jpeg`，
  面向客人是 `scenario_a.jpeg`，托腮是 `scenario_c.jpeg`。`scenario_b.png`
  （收銀）等結帳 phase 再接。動畫檔在 `public/scenes/cafe/animation/`。

**與規格的差異，以及原因**

| 規格 | 實際 | 為什麼 |
|---|---|---|
| 自成一套 `useSceneState` 狀態機 | **沿用既有的 `Phase`** | `live-room.tsx` 早就有一組狀態（`warming`/`speaking`/`thinking`/`listening`/`paused`/`stalled`），再加一套會有兩個真相來源 |
| 先接影片，缺片退 `base.png` | **先接靜態圖，影片暫不播** | 要把進門→聽→想→說的循環先跑順；`warming` 用揮手的 `scenario_d.jpeg` |
| 換 `key` 重新載入 video | **所有 ready 素材一次掛好，只切透明度** | 換 `src` 每次都閃一格。數量少，全部保持解碼的代價更划算 |
| `PRELOAD` 四支影片 | **掛三張靜態圖** | 說話與聆聽暫時共用 `scenario_a.jpeg` |
| `welcome`/`register`/`hand_receipt`/`goodbye` | **未實作** | `/api/chat` 只回純文字，沒有「已完成點餐」這種結構化訊號可以觸發。`scenario_b.png` 留給結帳 |

**尚未執行的前置處理（§3）** —— 這台機器沒有 ffmpeg，需要你自己跑：

- 音軌仍在（`mp4a` 5.032s）。目前靠 `muted` 蓋掉，只是白白多佔位元組
- 未做 faststart（`moov` 在 `mdat` 之後），串流要等整檔下載
- **浮水印應該還在** —— 無法驗證，需要你目視確認

跑完 §3 的指令後把產出覆蓋回 `public/scenes/cafe/` 即可，程式不用改。

**新增素材的方式**：把檔案放進 `public/scenes/cafe/`，把
`lib/scene-clips.ts` 對應項的 `ready` 改成 `true`。其他檔案都不用動。

---

## 1. 背景與目標

使用者在情境對話中練習英語口說。畫面上有一位咖啡店店員角色，她的動作要隨對話流程改變（傾聽、思索、回話、結帳、道別），讓使用者感覺是在跟真人互動而不是對著文字框講話。

角色動畫是**一組預先產好的短影片片段**，由前端依對話狀態決定播哪一段。所有條件判斷都在 React 這一層，影片本身沒有任何互動能力。

**重要限制：目前只有 2 段影片完成，其餘 6 段尚未產出。** 程式必須在素材不齊的情況下也能正常運作，不能因為檔案不存在就壞掉。

---

## 2. 現有素材

| 原始檔名 | 應改名為 | 狀態 | 說明 |
|---|---|---|---|
| `listening.mp4` | **`talking.mp4`** | ✅ 可用 | 內容其實是「說話中」，嘴巴全程張開。原本命名錯誤，改名後當 talking 用 |
| `thinking.mp4` | `thinking.mp4` | ✅ 可用 | 抬手托腮、視線上飄、閉嘴微笑，最後回到原姿勢 |

**兩支的共同規格**（後續所有片段都必須比照，不得更改）：

- 解析度 `880 × 1072`
- 幀率 `24 fps`
- 時長 `5.04s`
- 編碼 H.264
- 含一條空的 AAC 音軌 → 前置處理時移除
- 右上角有燒進畫面的 `DeeVid AI` 浮水印，位置 `x 679–844, y 34–59` → 前置處理時移除
- 兩支的循環接縫已驗證通過（首尾格差異與一般相鄰格差異相當），可直接 `loop`
- 背景（收銀機、窗戶、櫃檯）已驗證無漂移

**尚未產出**：`idle`、`listening`、`welcome`、`register`、`hand_receipt`、`goodbye`

**靜態底圖**：`base.png`（角色微笑、左手放櫃檯、右手垂在收銀機旁）。用作 video 的 poster，以及素材缺席時的替代畫面。

---

## 3. 前置處理（人工執行一次，不需寫進程式）

```bash
# 1. 改名
mv listening.mp4 talking.mp4

# 2. 去浮水印 + 去音軌 + 統一編碼
for f in talking thinking; do
  ffmpeg -i raw/$f.mp4 \
    -vf "delogo=x=670:y=26:w=185:h=42,fps=24" \
    -c:v libx264 -crf 23 -pix_fmt yuv420p \
    -an -movflags +faststart \
    public/scenes/cafe/$f.mp4
done
```

產出位置：`public/scenes/cafe/`

---

## 4. 檔案結構

```
public/scenes/cafe/
  base.png            # 靜態底圖 / poster / fallback
  thinking.mp4        # ✅
  talking.mp4         # ✅
  idle.mp4            # ⬜ 未產出
  listening.mp4       # ⬜ 未產出
  welcome.mp4         # ⬜ 未產出
  register.mp4        # ⬜ 未產出
  hand_receipt.mp4    # ⬜ 未產出
  goodbye.mp4         # ⬜ 未產出

src/features/scene/
  clips.ts            # 片段清單（唯一的素材真相來源）
  useSceneState.ts    # 狀態機
  SceneStage.tsx      # 播放元件
```

> 以下程式碼用 TypeScript 撰寫。若專案是純 JavaScript，把型別標註拿掉即可，邏輯不變。

---

## 5. `clips.ts` — 片段清單

這是唯一需要維護的素材清單。之後每產出一段新影片，只要把該項的 `ready` 改成 `true` 就會自動生效，不需要動其他檔案。

```ts
export type SceneState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'talking'
  | 'welcome'
  | 'register'
  | 'hand_receipt'
  | 'goodbye';

export interface Clip {
  /** 影片檔路徑 */
  src: string;
  /** true = 循環播放（待機類）；false = 播一次就結束（動作類） */
  loop: boolean;
  /** 單次片段播完後自動切往的狀態。loop 片段為 null */
  next: SceneState | null;
  /** 素材是否已產出。false 時會退回 fallback */
  ready: boolean;
  /**
   * 素材未就緒時的替代方案。
   * 指向另一個 SceneState，或 'still'（顯示靜態底圖 base.png）。
   * 解析時會遞迴跟隨，並偵測循環引用。
   */
  fallback: SceneState | 'still';
}

const DIR = '/scenes/cafe';

export const CLIPS: Record<SceneState, Clip> = {
  // ---- 循環片段：沒有外部事件就一直播 ----
  idle: {
    src: `${DIR}/idle.mp4`,
    loop: true,
    next: null,
    ready: false,          // ⬜ 待產出
    fallback: 'still',
  },
  listening: {
    src: `${DIR}/listening.mp4`,
    loop: true,
    next: null,
    ready: false,          // ⬜ 待產出（第一次產出的版本嘴巴會張開，已廢棄改作 talking）
    fallback: 'idle',      // idle 也未就緒時會再退到 still
  },
  thinking: {
    src: `${DIR}/thinking.mp4`,
    loop: true,
    next: null,
    ready: true,           // ✅ 已完成
    fallback: 'still',
  },
  talking: {
    src: `${DIR}/talking.mp4`,
    loop: true,
    next: null,
    ready: true,           // ✅ 已完成（原 listening.mp4 改名而來）
    fallback: 'still',
  },

  // ---- 單次片段：播完自動轉往 next ----
  welcome: {
    src: `${DIR}/welcome.mp4`,
    loop: false,
    next: 'idle',
    ready: false,          // ⬜ 待產出
    fallback: 'idle',
  },
  register: {
    src: `${DIR}/register.mp4`,
    loop: false,
    next: 'hand_receipt',
    ready: false,          // ⬜ 待產出
    fallback: 'idle',
  },
  hand_receipt: {
    src: `${DIR}/hand_receipt.mp4`,
    loop: false,
    next: 'idle',
    ready: false,          // ⬜ 待產出
    fallback: 'idle',
  },
  goodbye: {
    src: `${DIR}/goodbye.mp4`,
    loop: false,
    next: 'idle',
    ready: false,          // ⬜ 待產出
    fallback: 'idle',
  },
};

export const STILL_SRC = `${DIR}/base.png`;

/** 情境開始時要預先載入的片段（常用循環，避免切換時等待） */
export const PRELOAD: SceneState[] = ['idle', 'listening', 'thinking', 'talking'];

/**
 * 解析出實際要播的片段。
 * 若目標未就緒，沿著 fallback 往下找；找到 'still' 或偵測到循環引用就回傳 null。
 */
export function resolveClip(state: SceneState): { key: SceneState; clip: Clip } | null {
  const seen = new Set<SceneState>();
  let cur: SceneState | 'still' = state;

  while (cur !== 'still') {
    if (seen.has(cur)) return null;   // 循環引用保護
    seen.add(cur);
    const clip = CLIPS[cur];
    if (clip.ready) return { key: cur, clip };
    cur = clip.fallback;
  }
  return null;   // 顯示靜態底圖
}
```

---

## 6. `useSceneState.ts` — 狀態機

單次片段播完後要自動前進；`register` 會串成 `register → hand_receipt → idle`。素材未就緒時，`advance` 仍須被呼叫，否則流程會卡住。

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { CLIPS, resolveClip, type SceneState } from './clips';

export function useSceneState(initial: SceneState = 'idle') {
  const [state, setState] = useState<SceneState>(initial);
  const timer = useRef<number | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  /** 外部事件驅動的狀態切換 */
  const go = useCallback((next: SceneState) => {
    clearTimer();
    setState(next);
  }, []);

  /** 單次片段播放結束時呼叫 */
  const advance = useCallback(() => {
    setState((cur) => CLIPS[cur].next ?? cur);
  }, []);

  // 素材未就緒的單次片段：沒有 video 會觸發 onEnded，
  // 改用計時器在固定延遲後自動前進，避免流程卡死。
  useEffect(() => {
    const clip = CLIPS[state];
    if (clip.loop) return;
    if (resolveClip(state)) return;   // 有實際影片可播，交給 onEnded

    clearTimer();
    timer.current = window.setTimeout(advance, 1200);
    return clearTimer;
  }, [state, advance]);

  useEffect(() => clearTimer, []);

  return { state, go, advance };
}
```

---

## 7. `SceneStage.tsx` — 播放元件

要點：

- 用兩層堆疊 + 淡入淡出切換，避免換片時閃黑
- `key` 綁 clip 路徑，確保換片時 video 重新載入
- `muted` + `playsInline` 是行動裝置自動播放的必要條件（缺一不可）
- `poster` 用靜態底圖，載入期間不會空白
- 素材未就緒時直接渲染靜態底圖

```tsx
import { useEffect, useRef } from 'react';
import { PRELOAD, resolveClip, STILL_SRC, type SceneState } from './clips';

interface Props {
  state: SceneState;
  /** 單次片段播完時呼叫（傳入 useSceneState 的 advance） */
  onEnded: () => void;
  className?: string;
}

export function SceneStage({ state, onEnded, className }: Props) {
  const resolved = resolveClip(state);

  // 情境掛載時預載常用循環片段
  useEffect(() => {
    PRELOAD.forEach((key) => {
      const r = resolveClip(key);
      if (!r) return;
      const v = document.createElement('video');
      v.preload = 'auto';
      v.src = r.clip.src;
    });
  }, []);

  if (!resolved) {
    return (
      <img
        src={STILL_SRC}
        alt="Cafe staff"
        className={className}
        draggable={false}
      />
    );
  }

  const { clip } = resolved;

  return (
    <video
      key={clip.src}
      src={clip.src}
      poster={STILL_SRC}
      loop={clip.loop}
      autoPlay
      muted
      playsInline
      preload="auto"
      onEnded={() => {
        if (!clip.loop) onEnded();
      }}
      className={className}
      style={{ transition: 'opacity 300ms ease' }}
    />
  );
}
```

**已知待改進**：目前是單層 video 直接換 `key`，切換瞬間可能有一格空隙。若實測會閃，改成雙層 video 交錯（A 播放時 B 預載下一段，切換時 A 淡出 B 淡入，300ms）。素材補齊前先不做，避免過早最佳化。

---

## 8. 與語音流程的接線

以下事件對應到 `go()` 呼叫。事件來源是既有的 Web Speech API 與後端請求流程。

| 觸發時機 | 呼叫 | 備註 |
|---|---|---|
| 情境開始 | `go('welcome')` | 播完會自動 → `idle` |
| `SpeechRecognition.onstart` | `go('listening')` | 使用者開始講話 |
| `SpeechRecognition.onresult`（送出給後端） | `go('thinking')` | 等待期間畫面必須有動作，否則像當機 |
| `SpeechRecognition.onerror` / `onend` 但無結果 | `go('idle')` | 回到待機 |
| 後端回應開始播 TTS | `go('talking')` | |
| TTS `onend` | `go('idle')` | |
| 對話流程判定「已完成點餐」 | `go('register')` | 自動串 `register → hand_receipt → idle` |
| 情境結束 | `go('goodbye')` | |

**注意**：`thinking` 與 `talking` 目前是僅有的兩支可用素材，上述流程中最關鍵的兩個狀態剛好都已就緒，所以就算其他片段還沒產出，主要對話迴圈（傾聽 → 思索 → 回話 → 待機）在視覺上已經成立。

---

## 9. 使用範例

```tsx
function CafeScenario() {
  const { state, go, advance } = useSceneState('idle');

  // 範例：接上語音辨識
  useEffect(() => {
    recognition.onstart = () => go('listening');
    recognition.onresult = (e) => {
      go('thinking');
      sendToBackend(e.results[0][0].transcript);
    };
  }, [go]);

  return (
    <div className="relative w-full max-w-md mx-auto">
      <SceneStage state={state} onEnded={advance} className="w-full rounded-lg" />
      {/* 對話 UI 疊在下方或旁邊 */}
    </div>
  );
}
```

---

## 10. 驗收條件

- [ ] `thinking` 與 `talking` 能無限循環播放，接縫看不出跳動
- [ ] 未就緒的狀態（`idle`、`welcome` 等）會顯示靜態底圖，不會出現破圖或錯誤
- [ ] `go('register')` 在素材未就緒時，仍會在約 1.2 秒後自動前進到 `hand_receipt` 再到 `idle`，流程不卡死
- [ ] 影片中看不到 DeeVid 浮水印
- [ ] 在 iOS Safari 上會自動播放（確認 `muted` 與 `playsInline` 都有設）
- [ ] 切換狀態時不會閃黑或閃白
- [ ] 之後把某個 clip 的 `ready` 改成 `true` 並放入檔案，該狀態立即生效，不需修改其他檔案

---

## 11. 不要做的事

- 不要在 clips.ts 以外的地方寫死影片路徑
- 不要用 `localStorage` / `sessionStorage`
- 不要幫影片加上任何音軌或音量控制——語音一律由既有的 TTS 流程負責，影片永遠靜音
- 不要為了填滿八個狀態而用重複素材硬湊；未就緒就走 fallback，這是刻意的設計