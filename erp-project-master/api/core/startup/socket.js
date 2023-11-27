import mongoose from "mongoose";
import debug from "debug";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

import { app } from "../server";

const socketDebugger = debug("app:socket");
const AUTHENTICATION_TIMEOUT = 10000;

module.exports = function (socketServer) {
  socketServer.of("/messages").on("connection", (socket) => {
    socketDebugger(`[Socket] Socket ${socket.id} is connected!`);

    socket.auth = false;

    socket.on("authenticate", (data) => {
      const { token, type } = data; // ko dung toan tu {} vi bi loi ko lay duoc token

      socketDebugger(`[Socket] Received token: "${token}"; type: ${type}"`);

      if (token) {
        if (String(type).toLowerCase() !== "bearer") {
          socket.disconnect("Missing authentication method!");
        }

        const cert = fs.readFileSync(path.resolve(__dirname, "../certs/token.public.pem"));

        jwt.verify(token, cert, function (err, jwtPayload) {
          if (err) {
            socketDebugger(`[Socket] Socket ${socket.id} has invalid token.`);

            socket.disconnect("Unauthorized");
          } else {
            socketDebugger(`[Socket] Socket ${socket.id} is authorized!`);

            const userId = jwtPayload["userId"] || "";
            const userName = jwtPayload["userName"] || "";

            socket.auth = true;
            socket.userId = userId;
            socket.userName = userName;

            // TODO: check multi connection / user / tab

            app.locals.socket = socket;

            const MessageModel = mongoose.model("messages");

            MessageModel.find({
              recipient: socket.userId,
            })
              .select({
                _id: 1,
                subject: 1,
                refUrl: 1,
                state: 1,
                content: 1,
                createdByUserName: 1,
                createdAt: 1,
              })
              .limit(20)
              .sort({ createdAt: -1 })
              .exec((err, messageList) => {
                if (!err) {
                  socket.emit(`update${socket.userName}MessageList`, messageList);
                }
              });
          }
        });
      }
    });

    setTimeout(() => {
      if (!socket.auth) {
        socketDebugger(`[Socket] Cause of timeout, force socket ${socket.id} to disconnect.`);
        socket.disconnect("Unauthorized");
      }
    }, AUTHENTICATION_TIMEOUT);

    socket.on("disconnect", () => {
      socketDebugger(`[Socket] Socket ${socket.id} disconnected!`);
    });
  });
};
