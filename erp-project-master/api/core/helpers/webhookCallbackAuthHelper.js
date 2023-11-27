import mongoose from "mongoose";

const UNAUTHORIZED_ERROR = "Unauthorized";

export const clientRequestParser = async (req, res, next) => {
  try {
    const WebhookModel = mongoose.model("webhooks");
    const { headers, path } = req;

    if (String(path).endsWith("/healthcheck")) {
      next();
      return;
    }

    const authHeader = headers.authorization || "";
    const splittedAuthHeader = authHeader ? authHeader.split(" ") : [];
    const webhookCode = path.split("/")[2]; // "/supporting/ocr/" => "ocr"

    if (String(splittedAuthHeader[0]).toLowerCase() !== "basic" || !splittedAuthHeader[1] || !webhookCode) {
      next(UNAUTHORIZED_ERROR);
      return;
    }

    const decodedAuthHeader = Buffer.from(splittedAuthHeader[1], "base64").toString("ascii").split(":"); // decode base64
    const apiKey = decodedAuthHeader[0];
    const apiSecret = decodedAuthHeader[1];

    if (!apiKey || !apiSecret) {
      next(new Error(UNAUTHORIZED_ERROR));
      return;
    }

    const webhook = await WebhookModel.findOne(
      {
        webhookCode,
        apiKey,
        apiSecret,
      },
      {
        _id: 1,
        webhookName: 1,
      }
    ).lean();

    if (!webhook) {
      console.log("!webhook");

      next(new Error(UNAUTHORIZED_ERROR));
      return;
    }

    // TODO: get caller Public IP

    const { _id: webhookId, webhookName } = webhook;

    req.context = {
      webhookId,
      webhookCode,
      webhookName,
    };

    next();
  } catch (error) {
    next(error);
  }
};
