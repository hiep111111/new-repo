import jwt from "jsonwebtoken";
import fs from "fs";
import osPath from "path";
import { v4 as uuidv4 } from "uuid";

import { parseBaseUrl, getServiceCode } from "./commonHelper";
import apm from "./apmHelper";

export const clientRequestParser = (req, res, next) => {
  const { headers, path, baseUrl } = req;
  const { modelName, version } = parseBaseUrl(baseUrl + path);
  const functionId = headers["x-function-id"] || "";
  const policyContext = headers["x-policy-context"] || "";
  const traceId = headers["x-trace-id"] || uuidv4(); // [..] ref https://docs.sentry.io/performance/distributed-tracing/\
  const authHeader = headers.authorization || "";
  const splittedAuthHeader = authHeader ? authHeader.split(" ") : [];
  const token = splittedAuthHeader[0] === "Bearer" ? splittedAuthHeader[1] : "";

  // TODO: if call webhook => check API Key / Secret

  if (token) {
    const cert = fs.readFileSync(osPath.resolve(__dirname, "../certs/token.public.pem"));

    jwt.verify(token, cert, (err, jwtPayload) => {
      if (err) {
        res.redirect(`${headers.origin}/logout`);
      } else {
        const { userId, userName, fullName, isAdmin, useDebugMode } = jwtPayload;

        req.user = {
          userId,
          userName,
          fullName,
          isAdmin: isAdmin ? Boolean(isAdmin) : false,
          useDebugMode: useDebugMode ? Boolean(useDebugMode) : false,
        };

        apm.setUserContext({
          id: userId,
          username: userName,
        });
      }
    });
  } else {
    req.user = {};
  }

  const serviceCode = getServiceCode(modelName, version);

  req.context = {
    ...req.user,

    serviceCode,
    modelName,
    version,
    functionId,
    policyContext,
    traceId,
  };

  apm.setCustomContext({
    serviceCode,
    modelName,
    version,
    functionId,
    policyContext,
    traceId,
  });

  next();
};
