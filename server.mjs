import http from "node:http";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT || 17891);
const host = "127.0.0.1";
const appDir = path.dirname(fileURLToPath(import.meta.url));
const profileDir = path.join(appDir, "chrome-profile");

const html = String.raw`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Русская диктовка</title>
  <style>
    :root {
      --bg: #111815;
      --panel: #f6f0df;
      --ink: #1b211d;
      --muted: #6b6f69;
      --accent: #d34f2f;
      --accent-dark: #9e341e;
      --line: #d8cfb8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Georgia, "Times New Roman", serif;
      background:
        radial-gradient(circle at 20% 10%, rgba(211,79,47,.28), transparent 30%),
        linear-gradient(135deg, #111815, #263126 55%, #121915);
      color: var(--ink);
      display: grid;
      place-items: center;
      padding: 24px;
    }
    main {
      width: min(980px, 100%);
      min-height: min(720px, calc(100vh - 48px));
      background: var(--panel);
      border: 1px solid rgba(255,255,255,.26);
      box-shadow: 0 24px 80px rgba(0,0,0,.38);
      display: grid;
      grid-template-rows: auto auto 1fr auto;
      gap: 18px;
      padding: 28px;
    }
    header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px solid var(--line);
      padding-bottom: 16px;
    }
    h1 {
      margin: 0;
      font-size: clamp(32px, 6vw, 68px);
      line-height: .9;
      letter-spacing: 0;
      max-width: 720px;
    }
    .status {
      font: 700 14px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace;
      color: var(--accent-dark);
      text-transform: uppercase;
      white-space: nowrap;
    }
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      border-bottom: 1px solid var(--line);
      padding-bottom: 16px;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      flex: 0 0 auto;
    }
    button {
      min-height: 48px;
      border: 1px solid var(--ink);
      background: var(--ink);
      color: var(--panel);
      padding: 0 18px;
      font: 700 15px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
      cursor: pointer;
    }
    button.secondary {
      background: transparent;
      color: var(--ink);
    }
    button.active {
      background: var(--accent);
      border-color: var(--accent-dark);
      color: #fff8ee;
    }
    button:disabled {
      opacity: .45;
      cursor: not-allowed;
    }
    textarea {
      width: 100%;
      height: 100%;
      min-height: 360px;
      resize: none;
      border: 1px solid var(--line);
      background: rgba(255,255,255,.42);
      color: var(--ink);
      padding: 20px;
      font: 28px/1.35 Georgia, "Times New Roman", serif;
      outline: none;
    }
    .interim {
      min-height: 36px;
      color: var(--muted);
      font-size: 20px;
      line-height: 1.35;
    }
    footer {
      color: var(--muted);
      font: 14px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    @media (max-width: 680px) {
      body { padding: 12px; }
      main {
        min-height: calc(100vh - 24px);
        padding: 18px;
      }
      header,
      .toolbar {
        align-items: stretch;
        flex-direction: column;
      }
      .status { white-space: normal; }
      button { flex: 1 1 140px; }
      textarea {
        min-height: 320px;
        font-size: 22px;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Говори по-русски</h1>
      <div id="status" class="status">готово</div>
    </header>

    <div class="toolbar">
      <div class="controls">
        <button id="start">Начать</button>
        <button id="stop" class="secondary" disabled>Стоп</button>
        <button id="clear" class="secondary">Очистить</button>
        <button id="topmost" class="secondary">Поверх окон: нет</button>
      </div>
    </div>

    <section>
      <textarea id="text" spellcheck="true" placeholder="После нажатия «Начать» говори по-русски. Текст появится здесь."></textarea>
      <div id="interim" class="interim"></div>
    </section>

    <footer>
      Нажатие на текстовое поле копирует весь готовый текст в буфер обмена.
    </footer>
  </main>

  <script>
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const statusEl = document.querySelector("#status");
    const textEl = document.querySelector("#text");
    const interimEl = document.querySelector("#interim");
    const startBtn = document.querySelector("#start");
    const stopBtn = document.querySelector("#stop");
    const clearBtn = document.querySelector("#clear");
    const topmostBtn = document.querySelector("#topmost");
    const autoStart = new URLSearchParams(location.search).get("auto") === "1";

    let recognition;
    let listening = false;
    let shouldRestart = autoStart;
    let topmost = false;

    function setStatus(value) {
      statusEl.textContent = value;
      document.title = "Русская диктовка: " + value;
    }

    function handleFinal(phrase) {
      const lower = phrase.toLowerCase().trim();
      if (/\b(очистить|сотри|стереть)\b/i.test(lower)) {
        textEl.value = "";
        interimEl.textContent = "";
        setStatus("очищено");
        return;
      }

      const cleaned = phrase.trim();
      if (cleaned) {
        textEl.value = textEl.value + (textEl.value ? " " : "") + cleaned;
      }
    }

    function start() {
      if (!SpeechRecognition) {
        setStatus("нет web speech");
        alert("В этом браузере нет Web Speech API. Открой в Google Chrome.");
        return;
      }

      recognition = new SpeechRecognition();
      recognition.lang = "ru-RU";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        listening = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        setStatus("слушаю");
      };
      recognition.onerror = (event) => {
        setStatus(event.error || "ошибка");
      };
      recognition.onend = () => {
        listening = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        interimEl.textContent = "";
        setStatus("пауза");
        if (shouldRestart) {
          setTimeout(() => {
            if (!listening) start();
          }, 900);
        }
      };
      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const phrase = event.results[i][0].transcript;
          if (event.results[i].isFinal) handleFinal(phrase);
          else interim += phrase;
        }
        interimEl.textContent = interim;
      };

      recognition.start();
    }

    startBtn.addEventListener("click", () => {
      shouldRestart = true;
      start();
    });
    stopBtn.addEventListener("click", () => {
      shouldRestart = false;
      recognition && recognition.stop();
    });
    clearBtn.addEventListener("click", () => {
      textEl.value = "";
      interimEl.textContent = "";
      setStatus("очищено");
    });
    topmostBtn.addEventListener("click", async () => {
      topmost = !topmost;
      topmostBtn.textContent = topmost ? "Поверх окон: да" : "Поверх окон: нет";
      topmostBtn.classList.toggle("active", topmost);
      try {
        await fetch("/topmost", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled: topmost }),
        });
        setStatus(topmost ? "поверх окон" : "обычное окно");
      } catch {
        setStatus("ошибка окна");
      }
    });
    textEl.addEventListener("click", async () => {
      const text = textEl.value.trim();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        setStatus("скопировано");
      } catch {
        textEl.select();
        document.execCommand("copy");
        setStatus("скопировано");
      }
    });

    if (autoStart) {
      setTimeout(start, 700);
    }
  </script>
</body>
</html>`;

function readBody(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 100_000) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => resolve(data));
    request.on("error", reject);
  });
}

function psQuote(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function setTopmost(enabled) {
  const script = `
$enabled = ${enabled ? "$true" : "$false"}
$profile = ${psQuote(profileDir)}
$signature = @'
using System;
using System.Runtime.InteropServices;
public static class TopMostTools {
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@
Add-Type $signature -ErrorAction SilentlyContinue
$pids = @(Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" | Where-Object { $_.CommandLine -like "*$profile*" } | Select-Object -ExpandProperty ProcessId)
$window = Get-Process -Name chrome -ErrorAction SilentlyContinue | Where-Object { $pids -contains $_.Id -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($null -eq $window) { exit 2 }
$HWND_TOPMOST = [intptr](-1)
$HWND_NOTOPMOST = [intptr](-2)
$SWP_NOMOVE = 0x0002
$SWP_NOSIZE = 0x0001
$SWP_SHOWWINDOW = 0x0040
[void][TopMostTools]::ShowWindowAsync([intptr]$window.MainWindowHandle, 5)
Start-Sleep -Milliseconds 80
[void][TopMostTools]::SetWindowPos([intptr]$window.MainWindowHandle, $(if ($enabled) { $HWND_TOPMOST } else { $HWND_NOTOPMOST }), 0, 0, 0, 0, $SWP_NOMOVE -bor $SWP_NOSIZE -bor $SWP_SHOWWINDOW)
[void][TopMostTools]::SetForegroundWindow([intptr]$window.MainWindowHandle)
`;

  const result = spawnSync("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    script,
  ], {
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `PowerShell exited ${result.status}`);
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${host}`);

    if (request.method === "GET" && requestUrl.pathname === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(html);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/topmost") {
      const body = JSON.parse(await readBody(request));
      setTopmost(Boolean(body.enabled));
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    response.writeHead(404);
    response.end("Not found");
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : String(error));
  }
});

server.listen(port, host, () => {
  console.log(`Russian dictation is listening at http://${host}:${port}`);
});
