import mongoose from "mongoose";
import config from "config";
import debug from "debug";

import sb, { getQueueName } from "../helpers/serviceBusHelper";
import serviceModelList from "../helpers/modelHelper";
import { getServiceEventType, COMMON_EVENT } from "../helpers/eventHelper";
import { getUpdatedHandlerInstance, getDeletedHandlerInstance, getDeletedRejectedHandlerInstance } from "../helpers/eventHandlerHelper";
import BosError, { BOS_ERROR } from "../helpers/errorHelper";
import { HTTP_RESPONSE_CODE } from "../constants/httpConstant";

const serviceBusDebugger = debug("app:sb");

const existedHandler = (eventHandlerList, refModelName, eventType, refModelVersion = "1", fieldName = "") => {
  const eventIndex = eventHandlerList.findIndex((eventHandler) => {
    const { refModelName: eRefModelName, refModelVersion: eRefModelVersion, eventType: eEventType, fieldName: eFieldName } = eventHandler;

    return eRefModelName === refModelName && (eRefModelVersion || "1") === refModelVersion && eEventType === eventType && eFieldName === fieldName;
  });

  return eventIndex > -1;
};

sb.init(
  config.get("messageBroker.server"),
  config.get("messageBroker.exchangeName"),

  (err) => {
    if (err) {
      throw new BosError(err.message, BOS_ERROR.SB_CAN_NOT_INIT, HTTP_RESPONSE_CODE.INTERNAL_SERVER_ERROR, err.stack);
    } else {
      serviceBusDebugger(`[SB] Connected!`);

      Object.values(serviceModelList).forEach((serviceModel) => {
        const { modelName, version, eventHandlerList, constraintList } = serviceModel;
        const queueName = getQueueName(modelName, version);
        const fullEventHandlerList = eventHandlerList ? [].concat(eventHandlerList) : [];

        serviceBusDebugger(`[SB] Queue [${queueName}] is registering...`);

        if (constraintList) {
          for (const constraint of constraintList) {
            // auto handle  UPDATED / DELETED / ... events
            const { fieldName, refModelName, refModelVersion } = constraint;

            // TODO: fullEventHandlerList.each.fieldName always null (dev not defined) => always !existedHandler => add default event handle

            if (!existedHandler(fullEventHandlerList, refModelName, COMMON_EVENT.UPDATED, refModelVersion, fieldName)) {
              fullEventHandlerList.push({
                fieldName,
                refModelName,
                refModelVersion,
                eventType: COMMON_EVENT.UPDATED,
                handler: getUpdatedHandlerInstance(modelName, version, constraint),
              });
            }

            if (!existedHandler(fullEventHandlerList, refModelName, COMMON_EVENT.DELETED, refModelVersion, fieldName)) {
              fullEventHandlerList.push({
                fieldName,
                refModelName,
                refModelVersion,
                eventType: COMMON_EVENT.DELETED,
                handler: getDeletedHandlerInstance(modelName, version, constraint),
              });
            }
          }
        }

        if (!existedHandler(fullEventHandlerList, modelName, COMMON_EVENT.DELETE_REJECTED, version)) {
          fullEventHandlerList.push({
            refModelName: modelName,
            refModelVersion: version,
            eventType: COMMON_EVENT.DELETE_REJECTED,
            handler: getDeletedRejectedHandlerInstance(modelName, version),
          });
        }

        const servedEventList = fullEventHandlerList.map((servedEvent) => {
          const { refModelName, refModelVersion, eventType, handler } = servedEvent;

          return {
            event: getServiceEventType(refModelName, eventType, refModelVersion),
            handler,
          };
        });

        sb.consume(
          queueName,
          servedEventList,

          (error) => {
            if (error) {
              serviceBusDebugger(`[SB] Queue [${queueName}] consumed but has error: \n ${error}`);
            } else {
              serviceBusDebugger(`[SB] Queue [${queueName}] consumed.`);
            }
          }
        );
      });
    }
  }
);
