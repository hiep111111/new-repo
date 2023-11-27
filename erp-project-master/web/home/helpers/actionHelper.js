import { isString } from "lodash";
import BosError, { BOS_ERROR } from "./errorHelper";

export const SAVE_QUERY_STATE = "SAVE_QUERY_STATE";
export const SAVE_OBJECT_SURFING_STATE = "SAVE_OBJECT_SURFING_STATE";
export const ACTION_STATES = [SAVE_QUERY_STATE, SAVE_OBJECT_SURFING_STATE];

export function createActionTypeKey(normalizedModelName, actionName) {
  if (!normalizedModelName) {
    throw new BosError("normalizedModelName is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!actionName) {
    throw new BosError("actionName is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  return `${normalizedModelName}_${actionName}`;
}

export function createActionType(modelName, otherActionStates = []) {
  if (!isString(modelName)) {
    throw new BosError("modelName is not a string", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const fullActionList = otherActionStates ? ACTION_STATES.concat(otherActionStates) : ACTION_STATES;
  const normalizedModelName = modelName.toUpperCase();

  return fullActionList.reduce((acc, action) => {
    acc[action] = createActionTypeKey(normalizedModelName, action);
    return acc;
  }, {});
}

export function createAction(ACTIONS) {
  if (!ACTIONS) {
    throw new BosError("ACTIONS is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  return {
    saveQueryState: (queryList, selectedQueryId, query, objectList, pageLoad, prevObjectId, objectId, nextObjectId) => ({
      type: ACTIONS[SAVE_QUERY_STATE],
      payload: {
        queryList,
        selectedQueryId,
        query,
        objectList,
        pageLoad,

        prevObjectId,
        objectId,
        nextObjectId,
      },
    }),

    saveObjectSurfingState: (prevObjectId, objectId, nextObjectId) => ({
      type: ACTIONS[SAVE_OBJECT_SURFING_STATE],
      payload: {
        prevObjectId,
        objectId,
        nextObjectId,
      },
    }),
  };
}
