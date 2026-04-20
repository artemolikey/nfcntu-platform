const { LEVEL_RULES } = require('../config/constants');

function getLevelLabel(points = 0) {
  let current = LEVEL_RULES[0].label;
  for (const rule of LEVEL_RULES) {
    if (points >= rule.min) current = rule.label;
  }
  return current;
}

module.exports = { getLevelLabel };
