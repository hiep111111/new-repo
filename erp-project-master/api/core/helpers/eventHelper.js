import humps from "humps";
import { isString } from "lodash";

import BosError, { BOS_ERROR } from "./errorHelper";

export const COMMON_EVENT = {
  CREATED: "created",
  UPDATED: "updated",
  DELETED: "deleted",
  DELETE_REJECTED: "deleteRejected",
  TRIGGERED_WORKFLOW: "triggeredWorkflow",
  NOTIFICATION_REQUESTED: "notificationRequested",
  POSTED: "posted",
  REVERSED: "reversed",
};

const SERVICE_CODE_PATTERN = /v[0-9]+\/[a-zA-Z]/;

export const normalizeModelName = (modelName, version) => {
  if (!modelName) {
    throw new BosError("modelName is not correct.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (SERVICE_CODE_PATTERN.test(modelName)) {
    return modelName.replace(/\//g, ".");
  }

  return `v${version || "1"}.${modelName}`;
};

export const getServiceEventType = (modelName, eventType, version) => {
  if (!modelName) {
    throw new BosError("modelName is not correct.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!eventType) {
    throw new BosError(`eventType "${eventType}" is not correct.`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  return `${normalizeModelName(modelName, version)}.${eventType}`;
};

export const parseServiceEventType = (event) => {
  if (!isString(event)) {
    throw new BosError("event is not correct.", BOS_ERROR.INVALID_ARG_TYPE);
  }

  const splittedEvent = event.split(".");

  if (splittedEvent.length !== 3) {
    throw new BosError("event is not correct.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  return {
    modelName: splittedEvent[1], // [..] no need pluralize user => user[s]
    version: splittedEvent[0].substring(1), // get only "1", not "v1"
    eventType: splittedEvent[2],
  };
};

const toUpperCaseEventName = (eventType) => {
  if (!eventType) {
    throw new BosError("eventType is not correct.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  return humps.decamelize(eventType).toUpperCase();
};

export const createEventTypeByModel = (model) => {
  if (!model) {
    throw new BosError("model is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const { modelName, version, apiList } = model;

  if (!modelName) {
    throw new BosError("modelName is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const normalizedModelName = normalizeModelName(modelName, version);
  const normalizedEventType = {};

  Object.values(apiList).forEach((api) => {
    const { eventType } = api;

    if (eventType) {
      normalizedEventType[toUpperCaseEventName(eventType)] = `${normalizedModelName}.${eventType}`;
    }
  });

  return normalizedEventType;
};
