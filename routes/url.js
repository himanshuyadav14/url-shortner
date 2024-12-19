const express = require("express");
const {
  handleGenerateNewShortenUrl,
  handleGetAnalytics,
  handleRedirect,
  handleGetTopicAnalytics,
  handleGetAnalyticsOverall,
} = require("../controllers/url");
const { isAuthenticated, limiter } = require("../middlewares/auth");
const router = express.Router();

router.post("/shorten", isAuthenticated, limiter, handleGenerateNewShortenUrl);
router.get("/shorten/:shortId", handleRedirect);
router.get("/analytics/overall", handleGetAnalyticsOverall);
router.get("/analytics/:shortId", handleGetAnalytics);
router.get("/analytics/topic/:topic", handleGetTopicAnalytics);


module.exports = router;
