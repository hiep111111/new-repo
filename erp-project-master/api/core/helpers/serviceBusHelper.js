import debug from "debug";
import async from "async";
import mongoose from "mongoose";
import { isString, isArray } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { normalizeConsumeEvent } from "./eventHandlerHelper";
import BosError, { BOS_ERROR } from "./errorHelper";
import { MESSAGE_STATE } from "../constants/messageConstant";
import { ADMIN } from "../constants/userConstant";

const amqp = require("amqplib/callback_api");
const serviceBusDebugger = debug("app:sb");

let serviceBusInstant;

export const getQueueName = (modelName, version) => {
  if (!modelName) {
    throw new BosError("modelName is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  return `v${version || "1"}.${modelName}`;
};

const _connectToMessageBroker = (esb, cb) => {
  amqp.connect(esb.messageBrokerUri, (err, conn) => {
    if (err) {
      serviceBusDebugger(`[SB] Connect to RabbitMQ error: ${err}`);
      cb(err);
    } else {
      esb.connection = conn;
      cb(null, esb);
    }
  });
};

const _initExchange = (esb, cb) => {
  esb.connection.createChannel((err, channel) => {
    if (err) {
      serviceBusDebugger(`[SB] Create RabbitMQ channel error: ${err}`);
      cb(err);
    } else {
      channel.prefetch(1);
      channel.assertExchange(esb.exchangeName, "direct", { durable: true });

      esb.channel = channel;

      cb(null, esb);
    }
  });
};

const isConnected = () => {
  if (!serviceBusInstant) {
    return false;
  } else if (!serviceBusInstant.connection) {
    return false;
  }

  return true;
};

const init = (messageBrokerUri, exchangeName, initCallback) => {
  const esb = {
    messageBrokerUri,
    exchangeName,
    connection: null,
    channel: null,
  };

  async.waterfall(
    [async.apply(_connectToMessageBroker, esb), _initExchange],

    (err, esb) => {
      if (err) {
        initCallback(err);
      } else {
        serviceBusInstant = esb;
        initCallback(null);
      }
    } // (err, serviceBus)
  );
};

const consume = (queueName, servedEventList, consumerCallback) => {
  if (!isString(queueName)) {
    throw new BosError("queueName is not correct.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isArray(servedEventList)) {
    throw new BosError(`consume servedEventList is not an array.`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isConnected()) {
    consumerCallback(new Error("ServiceBusNotExisted"));
    return;
  }

  serviceBusInstant.channel.assertQueue(
    queueName,
    { durable: true },

    (err, mq) => {
      if (err) {
        serviceBusDebugger(`[SB] Cannot assert queue [${queueName}] with error: \n ${err}.`);
        consumerCallback(err);
      } else {
        const { exchangeName } = serviceBusInstant;
        const { queue } = mq;
        const ServiceBusEventModel = mongoose.model("sysServiceBusEvents");

        servedEventList.forEach((servedEvent) => {
          const { event } = servedEvent;

          serviceBusDebugger(`[SB] Binding "${event}" => queue [${queueName}].`);
          serviceBusInstant.channel.bindQueue(queue, exchangeName, event);
        });

        serviceBusInstant.channel.consume(queue, (msg) => {
          serviceBusDebugger(`[SB] ${queueName} consuming...`);

          if (msg !== null) {
            const { properties, content } = msg;
            const { replyTo, type, correlationId } = properties;
            const msgContent = content.toString();

            serviceBusDebugger(`[SB] ${queueName} 's handling event "${type}" with correlationId "${correlationId}".`); // with payload:\n ${msgContent}

            const servedEventHandleList = servedEventList.filter((e) => e.event === type);

            if (!servedEventHandleList) {
              serviceBusDebugger(`[SB] skipped handle event "${type}" because of undefined handler.`);

              serviceBusInstant.channel.ack(msg); // TODO: log unhandled msg
              consumerCallback(null);
              return;
            }

            servedEventHandleList.forEach(async (servedEvent) => {
              const { handler: eventHandler } = servedEvent;
              const consumeEvent = normalizeConsumeEvent(replyTo, type, JSON.parse(msgContent), correlationId);

              await eventHandler(
                consumeEvent,

                async (err) => {
                  if (!err) {
                    serviceBusDebugger(`[SB] ${queueName} handled event "${type}".`); // with payload:\n ${msgContent}
                  } else {
                    serviceBusDebugger(`[SB] ${queueName} cannot handle event "${type}" because of error:\n ${err}.`); // with payload:\n ${msgContent}
                  }

                  let errorMsg = "";

                  if (err) {
                    errorMsg = err.message ? `Error: ${err.message}.` : JSON.stringify(err);

                    const MessageModel = mongoose.model("messages");

                    const { payload } = consumeEvent;
                    const { oldData, newData } = payload;
                    const relatedDocumentId = newData ? newData._id : oldData ? oldData._id : null;

                    const notification = MessageModel({
                      subject: `SB event ${type} throws error`,
                      content: errorMsg,
                      relatedModel: replyTo,
                      relatedDocumentId,
                      refUrl: "/system/serviceBusEvents/",
                      state: MESSAGE_STATE.SENT,

                      recipient: ADMIN.USER_ID,
                      recipientUserName: ADMIN.USER_NAME,
                      recipientFullName: ADMIN.FULL_NAME,

                      createdBy: ADMIN.USER_ID,
                      createdByUserName: ADMIN.USER_NAME,
                      createdByFullName: ADMIN.FULL_NAME,
                    });

                    await notification.save();
                  }

                  // TODO: use APM to trace

                  await ServiceBusEventModel.updateOne(
                    { correlationId },
                    {
                      $push: {
                        consumerList: {
                          name: queueName,
                          handled: !err,
                          description: errorMsg,
                          updatedAt: new Date(),
                        },
                      },
                    }
                  );
                } // eventHandler callback
              );
            });

            consumerCallback(null);
            serviceBusInstant.channel.ack(msg);
          } else {
            serviceBusDebugger(`[SB] skipped handle event because of empty payload.`); // with payload: \n ${msgContent}
            serviceBusInstant.channel.ack(msg); // reject vs ack???

            // TODO: use APM to trace

            ServiceBusEventModel.updateOne(
              { correlationId },
              {
                $push: {
                  consumerList: {
                    name: replyTo,
                    handled: true,
                    description: `[SB] skipped handle event because of empty payload.`,
                    updatedAt: new Date(),
                  },
                },
              },
              (error) => {
                consumerCallback(error);
              }
            );
          }
        });
      }
    }
  );
};

const UUID_LENGTH = 36;
const isTraceId = (id) => id && String(id).length === UUID_LENGTH;

const publish = (origin, type, payload, traceId, publisherCallback) => {
  if (!isConnected()) {
    publisherCallback(new Error("ServiceBusNotExisted"));
    return;
  }

  const ServiceBusEventModel = mongoose.model("sysServiceBusEvents");
  const correlationId = isTraceId(traceId) ? traceId : uuidv4();

  try {
    const msgContent = JSON.stringify(payload);

    const msgOptions = {
      contentType: "application/json",
      correlationId,
      replyTo: origin,
      type,
    };

    serviceBusInstant.channel.publish(serviceBusInstant.exchangeName, type, Buffer.from(msgContent), msgOptions);

    const serviceBusEvent = new ServiceBusEventModel({
      correlationId,
      origin,
      type,
      payload,
      active: true,
      deleted: false,
    });

    serviceBusEvent.save((error) => {
      publisherCallback(error);
    });

    serviceBusDebugger(`[SB] ${origin} triggered event "${type}" with correlationId "${correlationId}" & content:\n ${msgContent}.`);
  } catch (error) {
    serviceBusDebugger(`[SB] ${origin}] cannot trigger event [${type}] with error:\n ${error}.`);

    const serviceBusEvent = new ServiceBusEventModel({
      correlationId,
      origin,
      type,
      payload: { error },
    });

    serviceBusEvent.save((error) => {
      publisherCallback(error);
    });

    if (publisherCallback) {
      publisherCallback(error);
    }
  }
};

const sb = {
  init,
  isConnected,
  consume,
  publish,
};

export default sb;
