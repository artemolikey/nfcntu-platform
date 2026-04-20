const { query } = require('../db');

async function getSpecialties() {
  const result = await query('SELECT id, code, title, short_name FROM specialties ORDER BY code');
  return result.rows;
}

async function getSpecialtyById(id) {
  if (!id) return null;
  const result = await query('SELECT id, code, title, short_name FROM specialties WHERE id = $1', [Number(id)]);
  return result.rows[0] || null;
}

async function getAcademicGroups() {
  const result = await query(`SELECT g.id, g.code, g.is_reference, g.specialty_id, s.title AS specialty_title FROM academic_groups g JOIN specialties s ON s.id = g.specialty_id ORDER BY g.code`);
  return result.rows;
}

async function getAcademicGroupById(id) {
  if (!id) return null;
  const result = await query(`SELECT g.id, g.code, g.is_reference, g.specialty_id, s.title AS specialty_title FROM academic_groups g JOIN specialties s ON s.id = g.specialty_id WHERE g.id = $1`, [Number(id)]);
  return result.rows[0] || null;
}

async function getCategories() {
  const result = await query(`SELECT c.id, c.name, c.description, c.specialty_id, s.title AS specialty_title FROM order_categories c LEFT JOIN specialties s ON s.id = c.specialty_id ORDER BY c.name`);
  return result.rows;
}

async function getCategoryById(id) {
  if (!id) return null;
  const result = await query(`SELECT id, name, description, specialty_id FROM order_categories WHERE id = $1`, [Number(id)]);
  return result.rows[0] || null;
}

async function getReferenceData() {
  const [specialties, groups, categories] = await Promise.all([getSpecialties(), getAcademicGroups(), getCategories()]);
  return { specialties, groups, categories };
}

module.exports = { getSpecialties, getSpecialtyById, getAcademicGroups, getAcademicGroupById, getCategories, getCategoryById, getReferenceData };
