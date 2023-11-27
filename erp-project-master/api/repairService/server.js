import express from "express";
import config from "config";
import qs from "qs";

process.env.TZ = config.get("timezone"); // [..] fix wrong timezone issue

// require('./startup/apm');

export const app = express();

// [!] fix wrong array param parsing https://github.com/expressjs/express/issues/3039
app.set("query parser", (str) => {
  return qs.parse(str, { arrayLimit: Infinity });
});

require("./startup/db")(app);
require("./startup/esb");

require("./services/i18n");
require("./services/schedules");

require("./startup/routes")(app);

const server = app.listen(config.get("port"), () => {
  console.log(`[${config.get("name")}] service running on port ${server.address().port}.`);
});
