# Julia Language Studio

Публичный сайт расписания и мини-админка для управления свободными окнами и группами.

## Что внутри

- `index.html` — публичная страница расписания;
- `admin.html` — кабинет преподавателя;
- `data/schedule.json` — единый источник данных;
- `app.js` — вывод расписания на публичной странице;
- `admin.js` — редактирование расписания через GitHub API;
- `styles.css` — общий дизайн.

## Публикация через GitHub Pages

1. Откройте **Settings → Pages**.
2. В **Build and deployment** выберите **Deploy from a branch**.
3. Branch: `main`, Folder: `/ (root)`.
4. Нажмите **Save**.

После публикации сайт будет доступен по адресу:

`https://yulchikyulenka89-ai.github.io/julia-language-studio/`

Админка:

`https://yulchikyulenka89-ai.github.io/julia-language-studio/admin.html`

## Доступ к админке

Админка не хранит GitHub-токен в репозитории. Для редактирования нужен fine-grained Personal Access Token с доступом **только к этому репозиторию** и правом **Contents: Read and write**.

Токен вводится вручную при открытии админки и хранится только в памяти текущей вкладки браузера.
