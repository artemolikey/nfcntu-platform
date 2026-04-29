UPDATE specialties
SET title = 'Фінанси, банківська справа та страхування',
    short_name = 'Фінанси'
WHERE code = '072';

UPDATE specialties
SET title = 'Облік та оподаткування',
    short_name = 'Облік'
WHERE code = '071';

DELETE FROM academic_groups WHERE is_reference = TRUE;

DELETE FROM specialties WHERE code = '123';

INSERT INTO academic_groups (code, specialty_id, is_reference)
SELECT v.code, s.id, TRUE
FROM (
  VALUES
    ('АТ-11', '274'), ('АТ-21', '274'), ('АТ-31', '274'), ('АТ-41', '274'),
    ('ЕМ-11', '141'), ('ЕМ-21', '141'), ('ЕМ-31', '141'), ('ЕМ-41', '141'),
    ('ТТ-11', '275'), ('ТТ-21', '275'), ('ТТ-31', '275'), ('ТТ-41', '275'),
    ('ТБ-11', '192'), ('ТБ-21', '192'), ('ТБ-31', '192'), ('ТБ-41', '192'),
    ('ІТ-11', '122'), ('ІТ-21', '122'), ('ІТ-31', '122'), ('ІТ-41', '122'),
    ('Ф-11', '072'), ('Ф-21', '072'), ('Ф-31', '072'),
    ('ОП-11', '071'), ('ОП-21', '071'), ('ОП-31', '071'),
    ('І-11', '051'), ('І-21', '051'), ('І-31', '051'),
    ('ІС-11', '029'), ('ІС-21', '029'), ('ІС-31', '029'),
    ('П-11', '081'), ('П-21', '081'), ('П-31', '081'), ('П-41', '081')
) AS v(code, specialty_code)
JOIN specialties s ON s.code = v.specialty_code
ON CONFLICT (code) DO UPDATE
SET specialty_id = EXCLUDED.specialty_id,
    is_reference = TRUE;
    