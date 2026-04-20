# Платформа замовлень НФК НТУ

Веб-платформа для розміщення та виконання навчальних замовлень студентами Надвірнянського фахового коледжу НТУ.

## Що оновлено у версії 2

- виправлено відкриття сторінки `/orders`;
- прибрано залежність від `cross-env` для запуску вбудованого режиму на Windows;
- видалено `package-lock.json`, через який `npm install` міг звертатися до недоступного реєстру;
- покращено типографіку, адаптивність, щільність блоків і вирівнювання;
- додано м’які анімації появи елементів і плавніші hover-ефекти;
- прибрано службові згадки про попередній тестовий режим з інтерфейсу.

## Що реалізовано

- Node.js + Express.js + PostgreSQL
- корпоративна реєстрація лише для домену `@nfcntu.ukr.education`
- ролі: замовник, виконавець, адміністратор
- створення, фільтрація та супровід замовлень
- детальна сторінка замовлення зі статусом, прогресом, журналом активності, чатом і файлами
- відгуки, рейтинг, репутаційні бали та рівні виконавців
- портфоліо виконаних робіт
- dashboard для кожної ролі
- охайна адмін-панель з аналітикою, списком користувачів і замовлень
- вбудовані початкові дані для швидкого запуску
- стриманий брендинг з логотипом коледжу

## Технологічний стек

- Node.js 20+
- Express.js
- PostgreSQL 16+
- EJS
- express-session + connect-pg-simple
- pg / pg-mem
- multer для вкладень

## Найшвидший запуск без окремої бази даних

Уже вкладено `node_modules`, тому після розпакування архіву можна одразу запускати застосунок без `npm install`.

### Windows

Запустіть файл:

```text
start-platform.bat
```

### macOS / Linux

```bash
./start-platform.sh
```

### Через npm

```bash
npm run start:memory
```

Після старту відкрийте:

```text
http://localhost:3000
```

Початковий обліковий запис адміністратора:

```text
admin@nfcntu.ukr.education
пароль: College2025!
```

## Локальний запуск з PostgreSQL

### 1) Створіть базу даних

```sql
CREATE DATABASE nfcntu_platform;
```

### 2) Скопіюйте `.env.example` у `.env`

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS / Linux:

```bash
cp .env.example .env
```

### 3) Вкажіть `DATABASE_URL`

Приклад:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nfcntu_platform
SESSION_SECRET=your-strong-session-secret
AUTO_SEED=true
```

### 4) Якщо потрібно, встановіть залежності

```bash
npm install
```

### 5) Ініціалізуйте базу даних

```bash
npm run db:setup
```

### 6) Запустіть сервер

```bash
npm start
```

## Корисні команди

```bash
npm run db:migrate
npm run db:seed
npm run db:setup
npm run verify
npm run smoke
npm run start:memory
```

## Структура проєкту

```text
nfcntu-platform/
├── db/
├── public/
│   └── assets/
├── scripts/
├── src/
│   ├── config/
│   ├── db/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   └── utils/
├── storage/uploads/
├── views/
├── .env.example
├── docker-compose.yml
├── README.md
├── START_HERE.txt
├── package.json
├── start-platform.bat
└── start-platform.sh
```

## Важливі примітки

- вкладення зберігаються у `storage/uploads/`;
- реєстрація на фронтенді та бекенді перевіряє корпоративний домен;
- групи та категорії можна швидко оновити через довідники і seed-дані;
- для захисту диплома найшвидше запускати проєкт через `start-platform.bat` або `npm run start:memory`.
