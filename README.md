# English Book Test

每本書一份英文閱讀測驗，共用同一套測驗程式，用瀏覽器直接作答。
純靜態網站，沒有建置步驟，沒有相依套件，推上 GitHub 就會自動部署到 GitHub Pages。

## 為什麼是這個架構

Gemini Notebook（原 NotebookLM）的 Studio 應用程式**沒辦法把程式碼匯出** ——
官方匯出只到 PDF / Word / PPTX 這種成品格式，拿不到背後的 HTML 和 JavaScript。
所以沒辦法把筆記本裡的 N 個應用程式原封不動搬進 GitHub。

改成這樣做：

- **程式只寫一次。** 測驗介面、計分、解析都在 `assets/` 裡，所有書共用。
- **每本書只是一份 JSON。** 加一本書 = 加一個檔案，不是再做一個應用程式。
- **內容從筆記本取出，不是搬程式。** 見 [`tools/gemini-notebook-prompt.md`](tools/gemini-notebook-prompt.md)。

好處是介面一致、可以用 git 管版本、可以分享連結，而且以後想改介面只要改一個地方。

## 加一本新書

1. 照著 [`tools/gemini-notebook-prompt.md`](tools/gemini-notebook-prompt.md) 的提示詞，
   讓那本書的筆記本輸出 JSON。
2. 存成 `books/<book-id>.json`，例如 `books/charlottes-web.json`。
3. 在 `books/index.json` 的 `books` 陣列加一筆，`id` 要和檔名一致。
4. 驗證格式：

   ```bash
   node tools/validate.mjs
   ```

5. commit、push。GitHub Pages 會自動更新。

## 本機預覽

網頁用 `fetch()` 讀題庫，所以不能用 `file://` 直接開，要起一個本機伺服器：

```bash
python3 -m http.server 8000
# 然後開 http://localhost:8000
```

## 開啟 GitHub Pages

第一次要手動開一次：

1. GitHub repo → **Settings** → **Pages**
2. **Source** 選 **GitHub Actions**

之後每次 push 到 `main`，`.github/workflows/pages.yml` 就會重新部署。
網址會是 `https://joehuang1980.github.io/english_book_test/`。

部署前會先跑一次 `tools/validate.mjs`，題庫格式壞掉就不會上線。

## 檔案結構

```
index.html                  書目首頁
book.html                   測驗頁（讀 ?book=<id>&set=<id>）
assets/
  style.css                 樣式，含深色模式
  quiz.js                   測驗邏輯：出題、計分、顯示解析
  storage.js                最佳成績，存在瀏覽器 localStorage
  util.js                   DOM 與 fetch 小工具
books/
  index.json                書目清單（首頁讀這個）
  aesops-fables.json        範例題庫，可以直接拿來改
tools/
  validate.mjs              題庫格式驗證
  gemini-notebook-prompt.md 從筆記本取出題庫的提示詞與欄位說明
```

## 題庫格式

```json
{
  "id": "charlottes-web",
  "title": "Charlotte's Web",
  "author": "E. B. White",
  "level": "B1",
  "description": "A pig, a spider, and a barn.",
  "sets": [
    {
      "id": "chapters-1-3",
      "title": "Chapters 1–3",
      "passage": "英文短文，段落之間用兩個換行分開。不需要短文可以省略。",
      "questions": [
        {
          "id": "q1",
          "prompt": "Why did Fern object to her father's plan?",
          "choices": ["...", "...", "...", "..."],
          "answer": 2,
          "explanation": "作答後顯示的解析。"
        }
      ]
    }
  ]
}
```

`answer` 是正確選項在 `choices` 裡的索引，**從 0 開始**（`0` = 第一個選項）。
這是最容易寫錯的地方。

一本書可以有多個 `sets`（通常按章節切）。只有一組時會直接進入測驗，
多組時會先顯示章節清單。

完整欄位說明在 [`tools/gemini-notebook-prompt.md`](tools/gemini-notebook-prompt.md)。
