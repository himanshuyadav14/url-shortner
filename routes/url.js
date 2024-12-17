const express = require('express');
const {handleGenerateNewShortenUrl, handleGetAnalytics, handleRedirect, handleGetTopicAnalytics} = require('../controllers/url')
const router = express.Router();

router.post("/shorten", handleGenerateNewShortenUrl);
router.get("/shorten/:shortId", handleRedirect);
router.get("/analytics/:shortId", handleGetAnalytics)
router.get("/analytics/topic/:topic", handleGetTopicAnalytics)


module.exports = router;