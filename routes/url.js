const express = require("express");
const {
  handleGenerateNewShortenUrl,
  handleGetAnalytics,
  handleRedirect,
  handleGetTopicAnalytics,
  handleGetAnalyticsOverall,
} = require("../controllers/url");
const { isAuthenticated } = require("../middlewares/auth");
const router = express.Router();

router.post("/shorten", isAuthenticated, handleGenerateNewShortenUrl);
router.get("/shorten/:shortId", handleRedirect);
router.get("/analytics/:shortId", handleGetAnalytics);
router.get("/analytics/topic/:topic", handleGetTopicAnalytics);
router.get("/analytics/overall", handleGetAnalyticsOverall);

module.exports = router;
