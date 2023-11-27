import { isArray, isFunction } from "lodash";
import BosError, { BOS_ERROR } from "./errorHelper";

export const AUTOMATED_ACTION_CODE = "automatedActionCode";

export const triggerWorkflow = (workflow, actionCode, dataObject) => {
  if (!workflow) {
    throw new BosError("workflow is undefined.", BOS_ERROR.INVALID_WORK_FLOW);
  }

  if (!actionCode) {
    throw new BosError("actionCode is undefined.", BOS_ERROR.INVALID_WORK_FLOW_ACTION_CODE);
  }

  const { stateField, endingStateList, transitionList } = workflow;

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
    throw new BosError(`state by ${stateField} is undefined.`, BOS_ERROR.INVALID_STATE);
  }

  if (endingStateList.indexOf(currentState) > -1) {
    throw new BosError("dataObject's state has already ended.", BOS_ERROR.INVALID_STATE);
  }

  const transition = transitionList.find((t) => t.fromState === currentState && t.actionCode === actionCode);

  if (!transition) {
    throw new BosError(`transition is undefined with { fromState: ${currentState}, actionCode: ${actionCode} }.`, BOS_ERROR.INVALID_WORK_FLOW);
  }

  const { toState, validator } = transition;

  if (!toState) {
    throw new BosError("toState is undefined.", BOS_ERROR.INVALID_STATE);
  }

  if (isFunction(validator)) {
    const { error } = validator(dataObject);

    if (error) {
      // [..] not compare to true to use UNDEFINED returned result
      return false;
    }
  }

  dataObject[stateField] = toState;

  return true;
};
