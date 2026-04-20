const express = require('express');
const asyncHandler = require('../utils/async-handler');
const { getLandingPageData } = require('../services/order.service');
const { getReferenceData } = require('../services/reference.service');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/', asyncHandler(async (req, res) => {
  const [landing, referenceData] = await Promise.all([
    getLandingPageData(),
    getReferenceData()
  ]);

  res.render('pages/home', {
    pageTitle: 'Головна',
    bodyClass: 'landing-page',
    stats: landing.stats,
    performers: landing.performers,
    testimonials: landing.testimonials,
    specialties: referenceData.specialties,
    categories: referenceData.categories
  });
}));

module.exports = router;
