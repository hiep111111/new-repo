import mongoose from "mongoose";
import config from "config";
import debug from "debug";

require("../services/models");

const dbDebugger = debug("app:db");

module.exports = function (app) {
  mongoose.Promises = global.Promise;

  if (app.get("env") === "development") {
    mongoose.set("debug", true);
  }

  const db = config.get("database");

  const dbOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  };

  mongoose.connect(db, dbOptions);

  mongoose.connection.on("connected", function () {
    dbDebugger(`Mongoose connected to ${db}`);
  });

  mongoose.connection.on("error", function (err) {
    console.log("mongoose.connection.error: ", err);
  });

  mongoose.connection.on("disconnected", function () {
    console.log("Mongoose disconnected");
  });

  process.on("SIGINT", function () {
    mongoose.connection.close(function () {
      process.exit(0);
    });
  });
};
