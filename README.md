# Русская диктовка

Небольшая Windows-программа для голосового ввода на русском языке. Она запускает локальный Node.js-сервер и открывает отдельное окно Google Chrome с Web Speech API.

## Что нужно

- Windows
- Node.js
- Google Chrome
- Микрофон

## Запуск

```powershell
npm run launch
```

Или напрямую:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Launch-RussianDictation.ps1
```

Для запуска только веб-сервера:

```powershell
npm start
```

После этого открой:

```text
http://127.0.0.1:17891/?auto=1
```

## Сборка EXE-запускателя

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build-launcher.ps1
```

Скрипт создаст `RussianDictation.exe`. Этот файл не добавляется в Git, потому что его можно собрать из `RussianDictationLauncher.cs`.

## Загрузка на GitHub

```powershell
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

Замени `<user>/<repo>` на свой GitHub-репозиторий.
