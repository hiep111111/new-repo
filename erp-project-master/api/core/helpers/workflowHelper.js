import { isArray, isFunction } from "lodash";
import debug from "debug";

import BosError, { BOS_ERROR } from "./errorHelper";
import { isAsyncFunction } from "./commonHelper";

const appBizDebugger = debug("app:biz");

// ref: https://stackoverflow.com/questions/38508420/how-to-know-if-a-function-is-async

export const triggerWorkflow = async (context, dataObject, oldDataObject) => {
  if (!context) {
    throw new BosError("context is undefined.", BOS_ERROR.INVALID_WORK_FLOW);
  }

  const { userId, userName, fullName, workflow, workflowActionCode: actionCode } = context;

  if (!userId) {
    throw new BosError("userId is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!userName) {
    throw new BosError("userName is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!fullName) {
    throw new BosError("fullName is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!actionCode) {
    throw new BosError("workflowActionCode is undefined.", BOS_ERROR.INVALID_WORK_FLOW_ACTION_CODE);
  }

  if (!workflow) {
    throw new BosError("workflow is undefined.", BOS_ERROR.INVALID_WORK_FLOW);
  }

  const { stateField, endingStateList, canRollback, transitionList } = workflow;

  if (!stateField) {
    throw new BosError("stateField is undefined.", BOS_ERROR.INVALID_WORK_FLOW);
  }

  if (!isArray(endingStateList)) {
    throw new BosError("endingStateList is not an array.", BOS_ERROR.INVALID_WORK_FLOW);
  }

  if (!isArray(transitionList)) {
    throw new BosError("transitionList is not an array.", BOS_ERROR.INVALID_WORK_FLOW);
  }

  const currentState = dataObject[stateField];

  if (!currentState) {
    throw new BosError(`value of state field "${stateField}" is undefined.`, BOS_ERROR.INVALID_STATE);
  }

  if (endingStateList.indexOf(currentState) > -1 && !canRollback) {
    throw new BosError("state has already ended.", BOS_ERROR.INVALID_STATE);
  }

  const transition = transitionList.find((t) => t.fromState === currentState && t.actionCode === actionCode);

  if (!transition) {
    throw new BosError(`transition is undefined with { fromState: ${currentState}, actionCode: ${actionCode} }.`, BOS_ERROR.INVALID_WORK_FLOW);
  }

  const { toState, handler, informTo, informToByField, copyTo, copyToByField, subject, subjectTemplateFile, content, contentTemplateFile, informToNextStepUser } = transition;

  if (!toState) {
    throw new BosError("toState is undefined.", BOS_ERROR.INVALID_WORK_FLOW);
  }

  dataObject[stateField] = toState;

  dataObject.updatedBy = userId;
  dataObject.updatedByUserName = userName;
  dataObject.updatedByFullName = fullName;

  if (isFunction(handler)) {
    // handler = validator + processor
    let triggered;

    if (isAsyncFunction(handler)) {
      triggered = await handler(context, dataObject, oldDataObject);
    } else {
      triggered = handler(context, dataObject, oldDataObject);
    }

    if (triggered === false) {
      // [..] not compare to true to use UNDEFINED returned result
      return { triggered: false };
    }
  }

  const nextWorkflowActionCodeList = transitionList.filter((t) => t.fromState === toState).map((t) => t.actionCode);

  return {
    triggered: true,
    informTo,
    informToByField,
    copyTo,
    copyToByField,
    subject,
    subjectTemplateFile,
    content,
    contentTemplateFile,

    informToNextStepUser,
    nextWorkflowActionCodeList,
  };
};

export const canTriggerWorkflow = (context, dataObject) => {
  appBizDebugger("canTriggerWorkflow");

  if (!context) {
    throw new BosError("context is undefined.", BOS_ERROR.INVALID_WORK_FLOW);
  }

  const { userId, workflow, workflowActionCode: actionCode } = context;

  if (!workflow) {
    appBizDebugger("!workflow => return false");
    return false;
  }

  if (!actionCode) {
    appBizDebugger("!actionCode => return false");
    return false;
  }

  if (!userId) {
    appBizDebugger("!userId => return false");
    return false;
  }

  const { stateField, endingStateList, transitionList } = workflow;

  if (!stateField || !isArray(endingStateList) || !isArray(transitionList)) {
    appBizDebugger("!stateField || !isArray(endingStateList) || !isArray(transitionList) => return false");
    return false;
  }

  const currentState = dataObject[stateField];

  if (!currentState || endingStateList.indexOf(currentState) > -1) {
    appBizDebugger("!currentState || endingStateList.indexOf(currentState) > -1 => return false");
    return false;
  }

  const transition = transitionList.find((t) => t.fromState === currentState && t.actionCode === actionCode);

  if (!transition) {
    appBizDebugger("!transition => return false");
    return false;
  }

  const { toState } = transition;

  if (!toState) {
    appBizDebugger("!toState => return false");
    return false;
  }

  return true;
};
