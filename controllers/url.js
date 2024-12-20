const shortid = require("shortid");
const URL = require("../models/url");
const geoip = require("geoip-lite");
const moment = require("moment");
const useragent = require("useragent");
const redisClient = require("../redisClient");

async function handleGenerateNewShortenUrl(req, res) {
  const body = req.body;
  const user = req.user;
  console.log(req.user);

  if (!user) {
    return res.status(401).json({ error: "Please login first" });
  }

  if (!body.url) {
    return res.status(400).json({ error: "url is required" });
  }

  const shortID = shortid.generate();

  try {
    const newEntry = await URL.create({
      shortId: shortID,
      redirectURL: body.url,
      customAlias: body.customAlias,
      topic: body.topic || "promotion",
      visitedHistory: [],
      userId: user.id,
    });

    return res.json({
      shortURL: `${process.env.BASE_URL}/api/shorten/${
        newEntry.customAlias ? newEntry.customAlias : newEntry.shortId
      }`,
      createdAt: newEntry.createdAt,
    });
  } catch (error) {
    console.error("Error creating short URL:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function handleRedirect(req, res) {
  console.log(req.user);
  const shortIdOrAlias = req.params.shortId;

  try {
    const cachedURL = await redisClient.get(shortIdOrAlias);
    if (cachedURL) {
      console.log("Cache hit");
      return res.redirect(cachedURL);
    } else {
      console.log("Cache miss");
    }

    const entry = await URL.findOne({
      $or: [{ customAlias: shortIdOrAlias }, { shortId: shortIdOrAlias }],
    });

    if (!entry) {
      return res
        .status(404)
        .json({ message: `No URL found for identifier: ${shortIdOrAlias}` });
    }

    const timestamp = Date.now();
    const userAgent = req.headers["user-agent"];
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress || "8.8.8.8";

    const geo = geoip.lookup(ip) || {};
    const geolocation = {
      country: geo.country || "",
      region: geo.region || "",
      city: geo.city || "",
      lat: geo.ll ? geo.ll[0] : null,
      lon: geo.ll ? geo.ll[1] : null,
    };

    const visitData = {
      timeStamp: timestamp,
      userAgent,
      ip,
      geolocation,
    };

    // Log visit data to the database
    await URL.findOneAndUpdate(
      { shortId: entry.shortId },
      { $push: { visitHistory: visitData } }
    );

    console.log("Redirecting to the original URL...");
    await redisClient.set(shortIdOrAlias, entry.redirectURL, { EX: 3600 });

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
    // Check cache
    const cachedAnalytics = await redisClient.get(`analytics:${shortId}`);
    if (cachedAnalytics) {
      console.log("Cache hit");
      return res.json(JSON.parse(cachedAnalytics));
    }

    // Fetch URL entry from DB
    const result = await URL.findOne({ shortId });
    if (!result) {
      return res.status(404).json({ message: "URL not found" });
    }

    const visitHistory = result.visitHistory;
    const totalClicks = visitHistory.length;

    // Unique Clicks Calculation
    const uniqueUsersSet = new Set(visitHistory.map((visit) => visit.ip));
    const uniqueClicks = uniqueUsersSet.size;

    // Clicks by Date Calculation
    const clicksByDate = Array.from({ length: 7 }, (_, i) => {
      const date = moment().subtract(i, "days").format("YYYY-MM-DD");
      const count = visitHistory.filter((visit) =>
        moment(visit.timeStamp).isSame(date, "day")
      ).length;
      return { date, count };
    });

    // OS Type Analytics
    const osTypeMap = new Map();
    visitHistory.forEach((visit) => {
      const userAgentString = visit.userAgent || req.headers["user-agent"];
      const agent = useragent.parse(userAgentString);
      const osName = agent.os.toString();

      if (!osTypeMap.has(osName)) {
        osTypeMap.set(osName, {
          osName,
          uniqueClicks: 0,
          uniqueUsers: new Set(),
        });
      }

      const osData = osTypeMap.get(osName);
      if (!osData.uniqueUsers.has(visit.ip)) {
        osData.uniqueUsers.add(visit.ip);
        osData.uniqueClicks++;
      }
    });

    const osType = Array.from(osTypeMap.values()).map((os) => ({
      osName: os.osName,
      uniqueClicks: os.uniqueClicks,
      uniqueUsers: os.uniqueUsers.size,
    }));

    // Device Type Analytics
    const deviceTypeMap = new Map();
    visitHistory.forEach((visit) => {
      const userAgentString = visit.userAgent || req.headers["user-agent"];
      let deviceName = "desktop"; // Default to desktop
      if (/mobile/i.test(userAgentString)) {
        deviceName = "mobile";
      } else if (/tablet/i.test(userAgentString) || /iPad/i.test(userAgentString)) {
        deviceName = "tablet";
      }

      if (!deviceTypeMap.has(deviceName)) {
        deviceTypeMap.set(deviceName, {
          deviceName,
          uniqueClicks: 0,
          uniqueUsers: new Set(),
        });
      }

      const deviceData = deviceTypeMap.get(deviceName);
      if (!deviceData.uniqueUsers.has(visit.ip)) {
        deviceData.uniqueUsers.add(visit.ip);
        deviceData.uniqueClicks++;
      }
    });

    const deviceTypeAnalytics = Array.from(deviceTypeMap.values()).map(
      (device) => ({
        deviceName: device.deviceName,
        uniqueClicks: device.uniqueClicks,
        uniqueUsers: device.uniqueUsers.size,
      })
    );

    // Prepare Response Data
    const analyticsData = {
      totalClicks,
      uniqueClicks,
      clicksByDate,
      osType,
      deviceType: deviceTypeAnalytics,
    };

    // Cache Analytics Data
    await redisClient.set(`analytics:${shortId}`, JSON.stringify(analyticsData), {
      EX: 600, // Cache expires in 10 minutes
    });

    // Respond with Analytics
    console.log("Cache miss - Analytics computed");
    return res.json(analyticsData);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function handleGetTopicAnalytics(req, res) {
  const topic = req.params.topic;

  try {
    // Check the cache first
    const cachedAnalytics = await redisClient.get(`topicAnalytics:${topic}`);
    if (cachedAnalytics) {
      console.log("Cache hit");
      return res.json(JSON.parse(cachedAnalytics));
    }

    // Fetch URLs for the given topic from the database
    const result = await URL.find({ topic });

    if (!result || result.length === 0) {
      return res
        .status(404)
        .json({ message: "No URLs found for the specified topic" });
    }

    let totalClicks = 0;
    let uniqueClicks = 0;
    const clicksByDateMap = new Map();
    const urlsAnalytics = [];

    result.forEach((url) => {
      const { visitHistory, shortId } = url;
      const shortUrl = `${process.env.BASE_URL}/shorten/${shortId}`;

      // Calculate total and unique clicks for this URL
      totalClicks += visitHistory.length;
      const uniqueUsersSet = new Set(
        visitHistory.map((visit) => visit.ip || "unknown")
      );
      uniqueClicks += uniqueUsersSet.size;

      // Aggregate clicks by date for the past 7 days
      for (let i = 0; i < 7; i++) {
        const date = moment().subtract(i, "days").format("YYYY-MM-DD");
        const count = visitHistory.filter((visit) =>
          moment(visit.timeStamp).isSame(date, "day")
        ).length;

        // Update clicks-by-date map
        clicksByDateMap.set(
          date,
          (clicksByDateMap.get(date) || 0) + count
        );
      }

      // Collect individual URL analytics
      urlsAnalytics.push({
        shortUrl,
        totalClicks: visitHistory.length,
        uniqueClicks: uniqueUsersSet.size,
      });
    });

    // Convert clicksByDateMap to an array
    const clicksByDate = Array.from(clicksByDateMap, ([date, count]) => ({
      date,
      count,
    })).sort((a, b) => moment(a.date) - moment(b.date)); // Sort by date

    // Prepare the aggregated analytics data
    const analyticsData = {
      totalClicks,
      uniqueClicks,
      clicksByDate,
      urls: urlsAnalytics,
    };

    // Cache the analytics data for future requests
    await redisClient.set(
      `topicAnalytics:${topic}`,
      JSON.stringify(analyticsData),
      {
        EX: 600, // Cache expires in 10 minutes
      }
    );

    console.log("Cache miss - Analytics computed");
    return res.json(analyticsData);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function handleGetAnalyticsOverall(req, res) {
  try {
    // Assuming user is authenticated, and user ID is available in req.user
    const userId = req?.user?.id;
    console.log("UserID:", userId);

    // Check cache for existing analytics data
    const cachedData = await redisClient.get(`overallAnalytics:${userId}`);
    if (cachedData) {
      console.log("Cache hit");
      return res.json(JSON.parse(cachedData));
    }

    // Fetch URLs created by the user
    const urls = await URL.find({ userId });
    if (!urls || urls.length === 0) {
      return res.status(404).json({ message: "No URLs found for this user" });
    }

    let totalUrls = 0;
    let totalClicks = 0;
    const uniqueIps = new Set();
    const clicksByDateMap = new Map();
    const osTypeMap = new Map();
    const deviceTypeMap = new Map();

    // Process each URL and its visit history
    urls.forEach((url) => {
      totalUrls++;
      totalClicks += url.visitHistory.length;

      // Process each visit
      url.visitHistory.forEach((visit) => {
        const ip = visit.ip || "unknown";
        uniqueIps.add(ip);

        const userAgentString = visit.userAgent || req.headers["user-agent"];
        const agent = useragent.parse(userAgentString);
        const osName = agent.os.toString() || "unknown";
        const deviceName = /mobile/i.test(userAgentString)
          ? "mobile"
          : /tablet/i.test(userAgentString) || /iPad/i.test(userAgentString)
          ? "tablet"
          : "desktop";

        // Aggregate OS Type
        if (!osTypeMap.has(osName)) {
          osTypeMap.set(osName, { osName, uniqueClicks: 0, uniqueUsers: new Set() });
        }
        const osData = osTypeMap.get(osName);
        osData.uniqueClicks++;
        osData.uniqueUsers.add(ip);

        // Aggregate Device Type
        if (!deviceTypeMap.has(deviceName)) {
          deviceTypeMap.set(deviceName, { deviceName, uniqueClicks: 0, uniqueUsers: new Set() });
        }
        const deviceData = deviceTypeMap.get(deviceName);
        deviceData.uniqueClicks++;
        deviceData.uniqueUsers.add(ip);

        // Aggregate clicks by date for the past 7 days
        for (let i = 0; i < 7; i++) {
          const date = moment().subtract(i, "days").format("YYYY-MM-DD");
          const isSameDate = moment(visit.timeStamp).isSame(date, "day");
          if (isSameDate) {
            clicksByDateMap.set(date, (clicksByDateMap.get(date) || 0) + 1);
          }
        }
      });
    });

    // Convert maps to arrays and prepare final analytics
    const clicksByDate = Array.from(clicksByDateMap, ([date, count]) => ({
      date,
      count,
    })).sort((a, b) => moment(a.date) - moment(b.date));

    const osType = Array.from(osTypeMap.values()).map((os) => ({
      osName: os.osName,
      uniqueClicks: os.uniqueClicks,
      uniqueUsers: os.uniqueUsers.size,
    }));

    const deviceType = Array.from(deviceTypeMap.values()).map((device) => ({
      deviceName: device.deviceName,
      uniqueClicks: device.uniqueClicks,
      uniqueUsers: device.uniqueUsers.size,
    }));

    // Final analytics data
    const analyticsData = {
      totalUrls,
      totalClicks,
      uniqueClicks: uniqueIps.size,
      clicksByDate,
      osType,
      deviceType,
    };

    // Cache the analytics data with a TTL of 10 minutes
    await redisClient.set(`overallAnalytics:${userId}`, JSON.stringify(analyticsData), {
      EX: 600, // Cache expires in 10 minutes
    });

    console.log("Cache miss - Analytics computed");
    return res.json(analyticsData);
  } catch (error) {
    console.error("Error fetching overall analytics:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = {
  handleGenerateNewShortenUrl,
  handleGetAnalytics,
  handleRedirect,
  handleGetTopicAnalytics,
  handleGetAnalyticsOverall,
};
