import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import bodyParser from "body-parser";

import BosError, { BOS_ERROR, errorHandler } from "../helpers/errorHelper";
import { clientRequestParser } from "../helpers/authHelper";
import { HTTP_RESPONSE_CODE } from "../constants/httpConstant";
import apm from "../helpers/apmHelper";

module.exports = (app) => {
  app.use(helmet());
  app.use(cors());
  app.use(morgan("dev"));

  app.use(
    bodyParser.json({
      limit: "50mb",
    })
  );

  app.use(
    bodyParser.urlencoded({
      limit: "50mb",
      extended: false,
      parameterLimit: 50000,
    })
  );

  app.use(require("method-override")());
  app.use(clientRequestParser);
  app.use(require("../services/controllers"));

  app.use(apm.middlewareConnect());

  app.use((req, res, next) => {
    const error = new BosError(`Not found: ${req.originalUrl}`, BOS_ERROR.INVALID_URL, HTTP_RESPONSE_CODE.NOT_FOUND);

    next(error);
  });

  app.use(errorHandler);
};
