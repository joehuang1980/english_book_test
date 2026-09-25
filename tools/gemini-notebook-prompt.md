# 從 Gemini Notebook 取出題庫

Gemini Notebook（原 NotebookLM）的 Studio 應用程式**沒有辦法匯出程式碼**，
官方匯出只到 PDF / Word / PPTX 這類成品格式。

所以流程不是「搬程式」，而是「取內容」：讓筆記本把測驗內容吐成 JSON，
貼進 `books/<book-id>.json`，網站的程式碼共用同一套。

## 步驟

1. 打開那本書的 Gemini Notebook。
2. 把下面整段提示詞貼進筆記本的對話框（**不是** Studio，是一般的聊天框）。
3. 把回覆的 JSON 整段複製。
4. 存成 `books/<book-id>.json`，`book-id` 用小寫英文、數字和連字號，例如 `charlottes-web`。
5. 在 `books/index.json` 的 `books` 陣列加一筆，`id` 要一模一樣。
6. 跑 `node tools/validate.mjs` 確認格式沒問題。
7. commit、push，GitHub Pages 會自動更新。

> 模型有時候會在 JSON 前後多加說明文字或 ```json 圍欄，複製的時候只留大括號內的部分。

---

## 提示詞（整段複製）

```
請根據這個筆記本的來源，產生一份英文閱讀測驗，並且**只輸出 JSON**，
不要有任何前言、說明或 markdown 圍欄。

格式如下：

{
  "id": "<書名的英文小寫連字號形式，例如 charlottes-web>",
  "title": "<書名，英文原名>",
  "author": "<作者>",
  "level": "<CEFR 等級，A1/A2/B1/B2/C1 擇一>",
  "description": "<一句話英文介紹，不超過 25 個字>",
  "sets": [
    {
      "id": "<章節的英文小寫連字號形式，例如 chapters-1-3>",
      "title": "<章節標題，例如 Chapters 1–3>",
      "passage": "<這一段的英文短文。段落之間用兩個換行符號分開。若這組題目不需要短文就整個省略這個欄位。>",
      "questions": [
        {
          "id": "q1",
          "prompt": "<英文題目>",
          "choices": ["<選項 A>", "<選項 B>", "<選項 C>", "<選項 D>"],
          "answer": 0,
          "explanation": "<一到兩句英文解析，說明為什麼這個答案正確>"
        }
      ]
    }
  ]
}

最重要的規則 —— 課文必須自足：
- **每一題的答案都必須只靠該章的 "passage" 就能確定。** 學生只會看到 passage，看不到原書。
- 出完題目後，逐題檢查：我能不能從 passage 裡**逐字引用**一句話來支持這個答案？
  引用不出來，就把那個細節寫進 passage，或者換一題。
- 字彙題問 'X' 是什麼意思的話，**X 這個字必須原封不動出現在 passage 裡**。
  passage 寫 "giant" 卻問 "enormous" 是錯的。
- 問動機、情緒、寓意、對話的話，passage 裡必須真的有那段情節。
- passage 寧可長一點。每章 1000 到 2000 字元比較安全，太短的摘要會塞不下題目要考的東西。

其他規則：
- "answer" 是正確選項在 "choices" 裡的**索引**，從 0 開始。0 代表第一個選項。
- 每題至少 4 個選項，錯誤選項要合理，不能明顯是湊數的。
- 每個 sets 元素放 5 到 8 題。
- 書比較長的話，按章節切成多個 sets。
- 題目要涵蓋：字面理解、推論、字彙（用上下文猜意思）、主旨。
- 所有題目、選項、解析都用英文；只有我這段指示是中文。
- 嚴格輸出合法 JSON：內文的雙引號要用 \" 跳脫，換行用 \n。
```

> 為什麼要強調課文自足：實測 7 本書 71 題，有 17 題（24%）問了課文裡根本沒有的東西 ——
> 因為 passage 是摘要，題目卻是照完整章節出的。這是目前最主要的錯誤來源。

---

## 欄位說明

| 欄位 | 必填 | 說明 |
|---|---|---|
| `id` | 是 | 要和檔名一致（`books/<id>.json`） |
| `title` | 是 | 書名 |
| `author` / `level` / `description` | 否 | 顯示在書目卡片上 |
| `sets[].id` | 是 | 小寫字母、數字、連字號；同一本書內不可重複 |
| `sets[].title` | 是 | 章節名稱 |
| `sets[].passage` | 否 | 短文。省略的話只顯示題目 |
| `questions[].prompt` | 是 | 題目 |
| `questions[].choices` | 是 | 至少 2 個選項 |
| `questions[].answer` | 是 | 正確選項的索引，**從 0 開始** |
| `questions[].explanation` | 否 | 作答後顯示的解析 |

最常見的錯誤是 `answer` 從 1 開始數。`node tools/validate.mjs` 會抓出範圍錯誤，
但如果答案剛好偏移一格又還在範圍內，它抓不到 —— 請自己確認第一個選項是 `0`。
