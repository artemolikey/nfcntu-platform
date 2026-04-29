const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { query, withTransaction, isPgMem } = require('./index');
const { ROLES, ORDER_STATUSES, REVIEW_POINTS, ORDER_STATUS_LABELS } = require('../config/constants');
const { getLevelLabel } = require('../utils/levels');

const migrationsDir = path.join(__dirname, 'migrations');

function normalizeMigrationSql(sql) {
  if (!isPgMem) return sql;
  return sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;\s*/gi, '');
}

async function runMigrations() {
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = normalizeMigrationSql(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
    await query(sql);
  }
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function addDays(days, hours = 9, minutes = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function isoDate(days) {
  return addDays(days).toISOString().slice(0, 10);
}

function isoDateTime(days, hours = 9, minutes = 0) {
  return addDays(days, hours, minutes).toISOString();
}

async function seedReferences(client) {
const specialties = [
  ['274', 'Автомобільний транспорт', 'Автомобільний транспорт'],
  ['141', 'Електроенергетика, електротехніка та електромеханіка', 'Електроенергетика'],
  ['275', 'Транспортні технології (на автомобільному транспорті)', 'Транспортні технології'],
  ['192', 'Будівництво та цивільна інженерія', 'Будівництво'],
  ['122', "Комп'ютерні науки", "Комп'ютерні науки"],
  ['072', 'Фінанси, банківська справа та страхування', 'Фінанси'],
  ['071', 'Облік та оподаткування', 'Облік'],
  ['051', 'Економіка', 'Економіка'],
  ['029', 'Інформаційна, бібліотечна та архівна справа', 'Інформаційна справа'],
  ['081', 'Право', 'Право']
];

  for (const item of specialties) {
    await client.query(
      'INSERT INTO specialties (code, title, short_name) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING',
      item
    );
  }

  const specialtyMapResult = await client.query('SELECT id, code FROM specialties');
  const specialtyMap = new Map(specialtyMapResult.rows.map((row) => [row.code, row.id]));

const groups = [
  ['АТ-11', '274'], ['АТ-21', '274'], ['АТ-31', '274'], ['АТ-41', '274'],
  ['ЕМ-11', '141'], ['ЕМ-21', '141'], ['ЕМ-31', '141'], ['ЕМ-41', '141'],
  ['ТТ-11', '275'], ['ТТ-21', '275'], ['ТТ-31', '275'], ['ТТ-41', '275'],
  ['ТБ-11', '192'], ['ТБ-21', '192'], ['ТБ-31', '192'], ['ТБ-41', '192'],
  ['ІТ-11', '122'], ['ІТ-21', '122'], ['ІТ-31', '122'], ['ІТ-41', '122'],
  ['Ф-11', '072'], ['Ф-21', '072'], ['Ф-31', '072'],
  ['ОП-11', '071'], ['ОП-21', '071'], ['ОП-31', '071'],
  ['І-11', '051'], ['І-21', '051'], ['І-31', '051'],
  ['ІС-11', '029'], ['ІС-21', '029'], ['ІС-31', '029'],
  ['П-11', '081'], ['П-21', '081'], ['П-31', '081'], ['П-41', '081']
];
  for (const [code, specialtyCode] of groups) {
    await client.query(
      'INSERT INTO academic_groups (code, specialty_id, is_reference) VALUES ($1, $2, TRUE) ON CONFLICT (code) DO NOTHING',
      [code, specialtyMap.get(specialtyCode)]
    );
  }

  const categories = [
    ['Веброзробка', 'Створення та доопрацювання вебінтерфейсів.', '122'],
    ['Програмування', 'Розробка програмних модулів і навчальних застосунків.', '122'],
    ['Бази даних', 'Моделювання та супровід баз даних.', '122'],
    ["Комп'ютерні мережі", 'Налаштування мережевих сервісів та інфраструктури.', '123'],
    ['Ремонт і обслуговування транспорту', 'Практичні завдання з діагностики та сервісу транспорту.', '274'],
    ['Електротехнічні роботи', 'Схеми, вимірювання та лабораторні кейси.', '141'],
    ['Транспортна логістика', 'Планування маршрутів і транспортних процесів.', '275'],
    ['Будівельні розрахунки', 'Кошторисні та технічні будівельні задачі.', '192'],
    ['Правові документи', 'Договори, довідки та юридичні шаблони.', '081'],
    ['Економічний аналіз', 'Аналітичні розрахунки й візуалізація показників.', '051'],
    ['Облік і звітність', 'Облікові документи та звітні форми.', '071'],
    ['Презентації', 'Оформлення виступів і слайдів.', null],
    ['Документація', 'Інструкції, довідки та технічні описи.', null],
    ['Інформаційні системи', 'Проєктування та опис модулів ІС.', '122'],
    ['Архівна та інформаційна обробка', 'Систематизація архівних матеріалів.', '029']
  ];

  for (const [name, description, specialtyCode] of categories) {
    await client.query(
      'INSERT INTO order_categories (name, description, specialty_id) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
      [name, description, specialtyCode ? specialtyMap.get(specialtyCode) : null]
    );
  }
}

async function getRefMaps(client) {
  const [specialties, groups, categories] = await Promise.all([
    client.query('SELECT id, code FROM specialties'),
    client.query('SELECT id, code FROM academic_groups'),
    client.query('SELECT id, name FROM order_categories')
  ]);

  return {
    specialtyByCode: new Map(specialties.rows.map((row) => [row.code, row.id])),
    groupByCode: new Map(groups.rows.map((row) => [row.code, row.id])),
    categoryByName: new Map(categories.rows.map((row) => [row.name, row.id]))
  };
}

async function createSeedUsers(client, refs) {
  const passwordHash = await bcrypt.hash('College2025!', 10);
  const users = [
    ['Адміністратор системи', 'admin@nfcntu.ukr.education', '+380671110001', ROLES.ADMIN, '122', 'КН-31', 'Керує платформою та контролює системні дані.'],
    ['Марія Гнатюк', 'm.hnatiuk@nfcntu.ukr.education', '+380671110011', ROLES.CUSTOMER, '051', 'ЕК-21', 'Формує завдання з економічного аналізу та звітності.'],
    ['Олег Мельник', 'o.melnyk@nfcntu.ukr.education', '+380671110012', ROLES.CUSTOMER, '081', 'Працює з юридичними та документальними кейсами.'],
    ['Ірина Савчук', 'i.savchuk@nfcntu.ukr.education', '+380671110013', ROLES.CUSTOMER, '192', 'БЦІ-21', 'Замовляє будівельні розрахунки та презентації.'],
    ['Андрій Бойчук', 'a.boichuk@nfcntu.ukr.education', '+380671110014', ROLES.CUSTOMER, '274', 'АТ-21', 'Створює технічні транспортні завдання.'],
    ['Світлана Поліщук', 's.polishchuk@nfcntu.ukr.education', '+380671110015', ROLES.CUSTOMER, '029', 'АР-21', 'Потребує допомоги з архівною та інформаційною обробкою.'],
    ['Юлія Кравчук', 'y.kravchuk@nfcntu.ukr.education', '+380671110016', ROLES.CUSTOMER, '072', 'ФН-21', 'Потребує фінансових розрахунків і аналітики.'],
    ['Василь Коваль', 'v.koval@nfcntu.ukr.education', '+380671120011', ROLES.PERFORMER, '122', 'КН-31', 'Розробляє вебрішення, API та інформаційні системи.'],
    ['Наталія Федорук', 'n.fedoruk@nfcntu.ukr.education', '+380671120012', ROLES.PERFORMER, '123', 'КІ-31', 'Працює з мережами, апаратними модулями та системною конфігурацією.'],
    ['Петро Іванюк', 'p.ivaniuk@nfcntu.ukr.education', '+380671120013', ROLES.PERFORMER, '081', 'ПР-21', 'Готує правові документи та структуровані довідки.'],
    ['Оксана Дячук', 'o.diachuk@nfcntu.ukr.education', '+380671120014', ROLES.PERFORMER, '051', 'ЕК-21', 'Виконує аналітичні розрахунки та презентації.'],
    ['Роман Петрів', 'r.petriv@nfcntu.ukr.education', '+380671120015', ROLES.PERFORMER, '274', 'АТ-21', 'Працює з технічними картами та діагностикою транспорту.'],
    ['Галина Левицька', 'h.levytska@nfcntu.ukr.education', '+380671120016', ROLES.PERFORMER, '141', 'ЕМ-21', 'Опрацьовує електротехнічні схеми та лабораторні кейси.'],
    ['Микола Боднар', 'm.bodnar@nfcntu.ukr.education', '+380671120017', ROLES.PERFORMER, '275', 'ТТ-21', 'Оптимізує логістику та транспортні процеси.'],
    ['Тетяна Семенюк', 't.semeniuk@nfcntu.ukr.education', '+380671120018', ROLES.PERFORMER, '071', 'ОБ-21', 'Працює з обліковими формами, звітністю та записками.'],
    ['Ігор Грицай', 'i.hrytsai@nfcntu.ukr.education', '+380671120019', ROLES.PERFORMER, '192', 'БЦІ-21', 'Виконує будівельні розрахунки та готує документацію.'],
    ['Леся Томин', 'l.tomyn@nfcntu.ukr.education', '+380671120020', ROLES.PERFORMER, '029', 'АР-21', 'Систематизує архівні матеріали та цифрові описи документів.']
  ];

  const map = new Map();
  for (const [fullName, email, phone, role, specialtyCode, groupCode, bio] of users) {
    const result = await client.query(
      `INSERT INTO users (full_name, email, password_hash, phone, role, specialty_id, academic_group_id, bio)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id, email`,
      [fullName, email, passwordHash, phone, role, refs.specialtyByCode.get(specialtyCode), refs.groupByCode.get(groupCode), bio]
    );
    map.set(result.rows[0].email, result.rows[0].id);
  }
  return map;
}

async function insertActivity(client, orderId, actorId, actionType, title, description, createdAt) {
  await client.query(
    'INSERT INTO activity_logs (order_id, actor_id, action_type, title, description, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [orderId, actorId, actionType, title, description, createdAt]
  );
}

async function createSeedOrders(client, users, refs) {
  const orders = [
    ['Розробити внутрішній вебкабінет для обліку навчальних консультацій', 'Потрібно підготувати прототип вебкабінету для запису на консультації, журналу звернень і короткої аналітики. Важливо продумати структуру ролей та журнал змін.', 'm.hnatiuk@nfcntu.ukr.education', 'v.koval@nfcntu.ukr.education', '122', 'Веброзробка', ORDER_STATUSES.IN_PROGRESS, isoDate(18), 72, isoDateTime(-12, 9, 10)],
    ['Побудувати ER-діаграму та SQL-схему для архіву навчальних документів', 'Потрібно спроєктувати базу даних архівних матеріалів з каталогами, тегами, видачею документів і журналом змін.', 's.polishchuk@nfcntu.ukr.education', 'l.tomyn@nfcntu.ukr.education', '029', 'Архівна та інформаційна обробка', ORDER_STATUSES.COMPLETED, isoDate(-3), 100, isoDateTime(-28, 11, 20)],
    ['Підготувати логістичну схему маршруту з аналізом витрат', 'Необхідно сформувати таблицю маршруту, часові вікна, витрати пального та рекомендації щодо оптимізації перевезення.', 'a.boichuk@nfcntu.ukr.education', 'm.bodnar@nfcntu.ukr.education', '275', 'Транспортна логістика', ORDER_STATUSES.IN_PROGRESS, isoDate(14), 48, isoDateTime(-9, 10, 15)],
    ['Оформити пакет правових документів для кейсу з договірними відносинами', 'Потрібно підготувати проєкт договору, супровідний лист, коротку правову довідку та перелік ризиків.', 'o.melnyk@nfcntu.ukr.education', 'p.ivaniuk@nfcntu.ukr.education', '081', 'Правові документи', ORDER_STATUSES.COMPLETED, isoDate(-7), 100, isoDateTime(-23, 8, 45)],
    ['Підготувати економічний аналіз собівартості навчального проєкту', 'Необхідно виконати аналіз витрат, побудувати висновки та коротку презентацію для захисту.', 'y.kravchuk@nfcntu.ukr.education', 'o.diachuk@nfcntu.ukr.education', '051', 'Економічний аналіз', ORDER_STATUSES.COMPLETED, isoDate(-9), 100, isoDateTime(-26, 12, 30)],
    ['Налаштувати схему локальної мережі для навчальної лабораторії', 'Потрібно підготувати мережеву схему аудиторії, перелік обладнання, базові правила безпеки та план підключення.', 'i.savchuk@nfcntu.ukr.education', 'n.fedoruk@nfcntu.ukr.education', '123', "Комп'ютерні мережі", ORDER_STATUSES.NEEDS_CLARIFICATION, isoDate(11), 35, isoDateTime(-7, 9, 40)],
    ['Скласти облікову відомість та пояснювальну записку', 'Необхідно сформувати комплект навчальної звітності та коротко описати методику розрахунків у пояснювальній записці.', 'm.hnatiuk@nfcntu.ukr.education', 't.semeniuk@nfcntu.ukr.education', '071', 'Облік і звітність', ORDER_STATUSES.IN_PROGRESS, isoDate(16), 61, isoDateTime(-10, 14, 5)],
    ['Розробити презентацію до захисту технічного проєкту з будівництва', 'Потрібно структурувати матеріал дипломного кейсу, оформити слайди та підготувати інфографіку для виступу.', 'i.savchuk@nfcntu.ukr.education', null, '192', 'Презентації', ORDER_STATUSES.NEW, isoDate(21), 0, isoDateTime(-5, 13, 20)],
    ['Підготувати електротехнічну схему підключення лабораторного стенда', 'Потрібно створити схему підключення, таблицю параметрів та коротку інструкцію з безпечного запуску стенда.', 'a.boichuk@nfcntu.ukr.education', 'h.levytska@nfcntu.ukr.education', '141', 'Електротехнічні роботи', ORDER_STATUSES.IN_PROGRESS, isoDate(12), 55, isoDateTime(-11, 10, 55)],
    ['Підготувати технічну карту діагностики системи гальмування', 'Необхідно описати процедуру діагностики, інструменти, послідовність перевірок та контрольні параметри.', 'a.boichuk@nfcntu.ukr.education', 'r.petriv@nfcntu.ukr.education', '274', 'Ремонт і обслуговування транспорту', ORDER_STATUSES.COMPLETED, isoDate(-4), 100, isoDateTime(-24, 7, 50)]
  ];

  const map = new Map();
  for (const [title, description, customerEmail, performerEmail, specialtyCode, categoryName, status, deadline, progress, createdAt] of orders) {
    const result = await client.query(
      `INSERT INTO orders (title, description, customer_id, performer_id, specialty_id, category_id, status, deadline, progress, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING id`,
      [title, description, users.get(customerEmail), performerEmail ? users.get(performerEmail) : null, refs.specialtyByCode.get(specialtyCode), refs.categoryByName.get(categoryName), status, deadline, progress, createdAt]
    );
    const orderId = result.rows[0].id;
    map.set(title, orderId);

    await insertActivity(client, orderId, users.get(customerEmail), 'order_created', 'Створено замовлення', 'Замовлення успішно створено та додано до списку.', createdAt);

    if (performerEmail) {
      await insertActivity(client, orderId, users.get(performerEmail), 'performer_assigned', 'Замовлення взято в роботу', 'Виконавець долучився до виконання завдання.', isoDateTime(-8, 12, 5));
    }
    if (progress > 0) {
      await insertActivity(client, orderId, performerEmail ? users.get(performerEmail) : users.get(customerEmail), 'progress_updated', 'Оновлено прогрес', `Прогрес виконання встановлено на ${progress}%.`, isoDateTime(-6, 15, 10));
    }
    if (status !== ORDER_STATUSES.NEW) {
      await insertActivity(client, orderId, users.get(customerEmail), 'status_changed', 'Оновлено статус', `Статус замовлення змінено на «${ORDER_STATUS_LABELS[status]}».`, isoDateTime(-4, 16, 25));
    }
  }
  return map;
}

async function createSeedMessages(client, users, orders) {
  const messages = [
    ['Розробити внутрішній вебкабінет для обліку навчальних консультацій', 'v.koval@nfcntu.ukr.education', 'Почав структурувати модулі. Сьогодні підготую перший варіант карти сторінок.', isoDateTime(-11, 11, 15)],
    ['Розробити внутрішній вебкабінет для обліку навчальних консультацій', 'm.hnatiuk@nfcntu.ukr.education', 'Добре, окремо прошу показати блок аналітики по зверненнях.', isoDateTime(-11, 11, 40)],
    ['Підготувати логістичну схему маршруту з аналізом витрат', 'a.boichuk@nfcntu.ukr.education', 'Візьми за основу 8 годин чистого часу перевезення та покажи резервний сценарій.', isoDateTime(-8, 12, 26)],
    ['Налаштувати схему локальної мережі для навчальної лабораторії', 'n.fedoruk@nfcntu.ukr.education', 'Потрібно уточнити, чи додаємо до схеми принтер і точку доступу для гостей.', isoDateTime(-6, 10, 50)],
    ['Налаштувати схему локальної мережі для навчальної лабораторії', 'i.savchuk@nfcntu.ukr.education', 'Так, додаємо обидва пристрої. Також передбач резервний комутатор.', isoDateTime(-6, 11, 5)],
    ['Скласти облікову відомість та пояснювальну записку', 't.semeniuk@nfcntu.ukr.education', 'Почала готувати таблицю проведень. До вечора додам пояснювальну записку.', isoDateTime(-5, 17, 15)]
  ];

  for (const [title, email, body, createdAt] of messages) {
    await client.query(
      'INSERT INTO order_messages (order_id, sender_id, body, created_at) VALUES ($1, $2, $3, $4)',
      [orders.get(title), users.get(email), body, createdAt]
    );
  }
}

async function createSeedFiles(client, users, orders) {
  ensureDir(env.uploadsDir);
  const seedDir = path.join(env.uploadsDir, 'seed');
  ensureDir(seedDir);

  const files = [
    ['consultations-brief.txt', 'brief-kabinet-konsultatsii.txt', 'Короткий бриф: ролі користувачів, журнал консультацій, статуси звернень.'],
    ['logistics-calc.txt', 'rozrakhunok-marshrutu.txt', 'Таблиця маршруту, паливні витрати, часові вікна, коефіцієнти завантаження.'],
    ['network-schema.txt', 'skhema-lokalnoi-merezhi.txt', 'Опис сегментів мережі, комутатори, точка доступу, резервне обладнання.'],
    ['legal-package.txt', 'paket-pravovykh-dokumentiv.txt', 'Чернетка правової довідки, структура договору та перелік ризиків.']
  ];

  for (const [storedName, originalName, content] of files) {
    const fullPath = path.join(seedDir, storedName);
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }

  const attachments = [
    ['Розробити внутрішній вебкабінет для обліку навчальних консультацій', 'm.hnatiuk@nfcntu.ukr.education', files[0]],
    ['Підготувати логістичну схему маршруту з аналізом витрат', 'm.bodnar@nfcntu.ukr.education', files[1]],
    ['Налаштувати схему локальної мережі для навчальної лабораторії', 'n.fedoruk@nfcntu.ukr.education', files[2]],
    ['Оформити пакет правових документів для кейсу з договірними відносинами', 'p.ivaniuk@nfcntu.ukr.education', files[3]]
  ];

  for (const [title, email, file] of attachments) {
    const fullPath = path.join(seedDir, file[0]);
    const size = fs.statSync(fullPath).size;
    await client.query(
      `INSERT INTO order_files (order_id, uploaded_by, original_name, stored_name, mime_type, size_bytes, file_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [orders.get(title), users.get(email), file[1], file[0], 'text/plain', size, fullPath]
    );
  }
}

async function createSeedReviews(client, users, orders) {
  const reviews = [
    ['Побудувати ER-діаграму та SQL-схему для архіву навчальних документів', 's.polishchuk@nfcntu.ukr.education', 'l.tomyn@nfcntu.ukr.education', 5, 'Робота виконана дуже акуратно: база продумана, запити зрозумілі, а опис структури придатний для подальшого розширення.', isoDateTime(-3, 10, 40)],
    ['Оформити пакет правових документів для кейсу з договірними відносинами', 'o.melnyk@nfcntu.ukr.education', 'p.ivaniuk@nfcntu.ukr.education', 4, 'Документи підготовлені якісно, структура чітка, потрібно було лише мінімально скоригувати вступну частину.', isoDateTime(-6, 15, 10)],
    ['Підготувати економічний аналіз собівартості навчального проєкту', 'y.kravchuk@nfcntu.ukr.education', 'o.diachuk@nfcntu.ukr.education', 5, 'Аналітика виконана професійно, висновки добре структуровані, презентація виглядає переконливо для захисту.', isoDateTime(-8, 16, 25)],
    ['Підготувати технічну карту діагностики системи гальмування', 'a.boichuk@nfcntu.ukr.education', 'r.petriv@nfcntu.ukr.education', 4, 'Матеріал змістовний і практичний, карта діагностики готова до використання на занятті.', isoDateTime(-4, 14, 20)]
  ];

  for (const [title, customerEmail, performerEmail, rating, reviewText, createdAt] of reviews) {
    const reputation = REVIEW_POINTS[rating];
    const orderId = orders.get(title);
    await client.query(
      `INSERT INTO order_reviews (order_id, customer_id, performer_id, rating, review_text, reputation_awarded, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [orderId, users.get(customerEmail), users.get(performerEmail), rating, reviewText, reputation, createdAt]
    );
    await client.query(
      `INSERT INTO portfolio_entries (performer_id, order_id, title, summary, completed_at, rating, review_excerpt)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [users.get(performerEmail), orderId, title, reviewText, createdAt, rating, reviewText]
    );
    await insertActivity(client, orderId, users.get(customerEmail), 'review_added', 'Додано відгук', `Замовник залишив відгук з оцінкою ${rating}/5.`, createdAt);
  }
}

async function refreshPerformerMetrics(client) {
  const performers = await client.query('SELECT id FROM users WHERE role = $1', [ROLES.PERFORMER]);
  for (const performer of performers.rows) {
    const stats = await client.query(
      'SELECT COALESCE(AVG(rating), 0) AS rating_avg, COALESCE(SUM(reputation_awarded), 0) AS reputation_points FROM order_reviews WHERE performer_id = $1',
      [performer.id]
    );
    const ratingAvg = Number(stats.rows[0].rating_avg || 0);
    const reputationPoints = Number(stats.rows[0].reputation_points || 0);
    await client.query(
      'UPDATE users SET rating_avg = $2, reputation_points = $3, level_label = $4 WHERE id = $1',
      [performer.id, ratingAvg, reputationPoints, getLevelLabel(reputationPoints)]
    );
  }
}

async function seedDatabase(force = false) {
  await withTransaction(async (client) => {
    const existing = await client.query('SELECT COUNT(*)::int AS count FROM users');
    if (existing.rows[0].count > 0 && !force) return;

    if (force) {
      await client.query('TRUNCATE TABLE activity_logs, portfolio_entries, order_reviews, order_files, order_messages, orders, users, order_categories, academic_groups, specialties RESTART IDENTITY CASCADE');
    }

    await seedReferences(client);
    const refs = await getRefMaps(client);
    const users = await createSeedUsers(client, refs);
    const orders = await createSeedOrders(client, users, refs);
    await createSeedMessages(client, users, orders);
    await createSeedFiles(client, users, orders);
    await createSeedReviews(client, users, orders);
    await refreshPerformerMetrics(client);
  });
}

async function ensureBootstrapped() {
  await runMigrations();
  if (env.autoSeed) {
    await seedDatabase(false);
  }
}

module.exports = { runMigrations, seedDatabase, ensureBootstrapped };
