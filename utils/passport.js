const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/user");

module.exports = function () {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BASE_URL}/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ googleId: profile.id });
          if (!user) {
            user = new User({
              googleId: profile.id,
              displayName: profile.displayName,
              email: profile.emails[0].value,
              profilePicture: profile.photos ? profile.photos[0].value : null,
            });
            await user.save();
          }
          return done(null, user);
        } catch (err) {
          console.error("Error in GoogleStrategy:", err);
          return done(err, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    console.log("Serializing user:", user);
    done(null, user._id); // Use MongoDB _id as the unique identifier
  });

  passport.deserializeUser((id, done) => {
    User.findById(id)
      .then((user) => {
        console.log("Deserializing user:", user);
        done(null, user);
      })
      .catch((err) => {
        console.error("Error in deserializing user:", err);
        done(err, null);
      });
  });
};
