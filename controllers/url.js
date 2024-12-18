const shortid = require("shortid");
const URL = require("../models/url");
const geoip = require("geoip-lite");
const moment = require("moment");
const useragent = require("useragent");

async function handleGenerateNewShortenUrl(req, res) {
  const body = req.body;

  if (!body.url) {
    return res.status(400).json({ error: "url is required" });
  }

  const shortID = shortid.generate();
  console.log(req.user.id);

  try {
    const newEntry = await URL.create({
      shortId: shortID,
      redirectURL: body.url,
      customAlias: body.customAlias,
      topic: body.topic || "promotion",
      visitedHistory: [],
    });

    return res.json({
      shortURL: `${process.env.BASE_URL}/shorten/${
        newEntry.customAlias ? newEntry.customAlias : newEntry.shortId
      }`,
      createdAt: newEntry.createdAt,
      topic: newEntry.topic,
    });
  } catch (error) {
    console.error("Error creating short URL:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function handleRedirect(req, res) {
  const shortIdOrAlias = req.params.shortId;
  try {
    let entry = await URL.findOne({ customAlias: shortIdOrAlias });

    if (!entry) {
      entry = await URL.findOne({ shortId: shortIdOrAlias });
    }

    if (!entry) {
      return res.status(404).json({ message: "URL not found" });
    }

    const timestamp = Date.now();
    const userAgent = req.headers["user-agent"];

    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const validIP = ip === "::1" || ip === "127.0.0.1" ? "8.8.8.8" : ip;

    const geo = geoip.lookup(validIP);

    const geolocation = geo
      ? {
          country: geo.country || "",
          region: geo.region || "",
          city: geo.city || "",
          lat: geo.ll ? geo.ll[0] : null,
          lon: geo.ll ? geo.ll[1] : null,
        }
      : {};

    const visitData = {
      timeStamp: timestamp,
      userAgent,
      validIP,
      geolocation,
    };

    // Log visit data to the database
    await URL.findOneAndUpdate(
      { shortId: entry.shortId },
      { $push: { visitHistory: visitData } }
    );

    console.log("Redirecting to the original URL...");
    // Redirect to the original URL
    res.redirect(entry.redirectURL);
  } catch (error) {
    console.error("Error during URL redirect:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function handleGetAnalytics(req, res) {
  const shortId = req.params.shortId;

  try {
    const result = await URL.findOne({ shortId });

    if (!result) {
      return res.status(404).json({ message: "URL not found" });
    }

    const visitHistory = result.visitHistory;
    const totalClicks = visitHistory.length;

    const userAgentString = req.headers["user-agent"];
    const agent = useragent.parse(userAgentString);

    // Global Device and OS Type
    const deviceName = agent.isMobile
      ? "mobile"
      : agent.isTablet
      ? "tablet"
      : "desktop";
    const osName = agent.os.toString();

    // Calculate unique clicks by IP
    const uniqueUsersSet = new Set(
      visitHistory.map((visit) => visit.ip || "unknown")
    );
    const uniqueClicks = uniqueUsersSet.size;

    // Calculate clicks by date for the past 7 days
    const clicksByDate = [];
    for (let i = 0; i < 7; i++) {
      const date = moment().subtract(i, "days").format("YYYY-MM-DD");
      const count = visitHistory.filter((visit) =>
        moment(visit.timeStamp).isSame(date, "day")
      ).length;

      clicksByDate.push({ date, count });
    }

    // OS Type Analytics
    const osTypeMap = new Map();

    visitHistory.forEach((visit) => {
      if (!osTypeMap.has(osName)) {
        osTypeMap.set(osName, {
          osName,
          uniqueClicks: 0,
          uniqueUsers: new Set(),
        });
      }
      osTypeMap.get(osName).uniqueClicks++;
      osTypeMap.get(osName).uniqueUsers.add(visit.ip || "unknown");
    });

    const osType = Array.from(osTypeMap.values()).map((os) => ({
      osName: os.osName,
      uniqueClicks: os.uniqueClicks,
      uniqueUsers: os.uniqueUsers.size,
    }));

    // Device Type Analytics
    const deviceTypeMap = new Map();

    visitHistory.forEach((visit) => {
      if (!deviceTypeMap.has(deviceName)) {
        deviceTypeMap.set(deviceName, {
          deviceName,
          uniqueClicks: 0,
          uniqueUsers: new Set(),
        });
      }
      deviceTypeMap.get(deviceName).uniqueClicks++;
      deviceTypeMap.get(deviceName).uniqueUsers.add(visit.ip || "unknown");
    });

    const deviceTypeAnalytics = Array.from(deviceTypeMap.values()).map(
      (device) => ({
        deviceName: device.deviceName,
        uniqueClicks: device.uniqueClicks,
        uniqueUsers: device.uniqueUsers.size,
      })
    );

    // Response
    return res.json({
      totalClicks,
      uniqueClicks,
      clicksByDate,
      osType,
      deviceType: deviceTypeAnalytics, // Changed here to use the new name
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function handleGetTopicAnalytics(req, res) {
  const topic = req.params.topic;

  try {
    const result = await URL.find({ topic });

    if (!result || result.length === 0) {
      return res
        .status(404)
        .json({ message: "No URLs found for the specified topic" });
    }

    let totalClicks = 0;
    let uniqueClicks = 0;
    let clicksByDate = [];
    let urlsAnalytics = [];

    result.forEach((url) => {
      const visitHistory = url.visitHistory;
      const shortId = url.shortId;
      const shortUrl = `${process.env.BASE_URL}/shorten/${shortId}`;

      // Calculate total clicks and unique clicks
      totalClicks += visitHistory.length;
      const uniqueUsersSet = new Set(
        visitHistory.map((visit) => visit.ip || "unknown")
      );
      uniqueClicks += uniqueUsersSet.size;

      // Calculate clicks by date for the past 7 days
      for (let i = 0; i < 7; i++) {
        const date = moment().subtract(i, "days").format("YYYY-MM-DD");
        const count = visitHistory.filter((visit) =>
          moment(visit.timeStamp).isSame(date, "day")
        ).length;

        // Record date-wise clicks for the entire topic
        const existingDateEntry = clicksByDate.find(
          (entry) => entry.date === date
        );
        if (existingDateEntry) {
          existingDateEntry.count += count;
        } else {
          clicksByDate.push({ date, count });
        }
      }

      // Step 3: Collect individual URL analytics
      urlsAnalytics.push({
        shortUrl,
        totalClicks: visitHistory.length,
        uniqueClicks: uniqueUsersSet.size,
      });
    });

    // Step 4: Respond with aggregated analytics data
    return res.json({
      totalClicks,
      uniqueClicks,
      clicksByDate,
      urls: urlsAnalytics,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function handleGetAnalyticsOverall(req, res) {

}

module.exports = {
  handleGenerateNewShortenUrl,
  handleGetAnalytics,
  handleRedirect,
  handleGetTopicAnalytics,
  handleGetAnalyticsOverall,
};
