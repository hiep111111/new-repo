import { isUpperCase } from "./commonHelper";
import BosError, { BOS_ERROR } from "../helpers/errorHelper";

export const SERVICE_NAME_TOKEN = "{SERVICE_NAME}";

export const ACTION_CODE_PATTERN_GET_LIST = "get{SERVICE_NAME}List";
export const ACTION_CODE_PATTERN_GET_BY_ID = "get{SERVICE_NAME}ById";
export const ACTION_CODE_PATTERN_CREATE = "create{SERVICE_NAME}";
export const ACTION_CODE_PATTERN_UPDATE = "update{SERVICE_NAME}ById";
export const ACTION_CODE_PATTERN_DELETE = "delete{SERVICE_NAME}ById";

export const ACTION_CODE_PATTERN_PRINT = "print{SERVICE_NAME}ById";
export const ACTION_CODE_PATTERN_EXPORT = "export{SERVICE_NAME}List";
export const ACTION_CODE_PATTERN_TRIGGER_WORKFLOW = "trigger{SERVICE_NAME}WorkflowById";

export const generateActionCode = (actionCodePattern, pascalizedServiceName, apiVersion = null) => {
  if (!pascalizedServiceName) {
    throw new BosError("pascalizedServiceName is not correct.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isUpperCase(pascalizedServiceName[0])) {
    throw new BosError("pascalizedServiceName is not pascalized string.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!apiVersion || apiVersion === "1") {
    return actionCodePattern.replace(SERVICE_NAME_TOKEN, pascalizedServiceName);
  }

  if (isNaN(apiVersion)) {
    throw new BosError("userId is not correct.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  return actionCodePattern.replace(SERVICE_NAME_TOKEN, `V${apiVersion}${pascalizedServiceName}`);
};

export const generateGetListActionCode = (pascalizedServiceName, apiVersion) => generateActionCode(ACTION_CODE_PATTERN_GET_LIST, pascalizedServiceName, apiVersion);
export const generateGetByIdActionCode = (pascalizedServiceName, apiVersion) => generateActionCode(ACTION_CODE_PATTERN_GET_BY_ID, pascalizedServiceName, apiVersion);
export const generateCreateActionCode = (pascalizedServiceName, apiVersion) => generateActionCode(ACTION_CODE_PATTERN_CREATE, pascalizedServiceName, apiVersion);
export const generateUpdateActionCode = (pascalizedServiceName, apiVersion) => generateActionCode(ACTION_CODE_PATTERN_UPDATE, pascalizedServiceName, apiVersion);
export const generateDeleteActionCode = (pascalizedServiceName, apiVersion) => generateActionCode(ACTION_CODE_PATTERN_DELETE, pascalizedServiceName, apiVersion);

export const generatePrintActionCode = (pascalizedServiceName, apiVersion) => generateActionCode(ACTION_CODE_PATTERN_PRINT, pascalizedServiceName, apiVersion);
export const generateExportActionCode = (pascalizedServiceName, apiVersion) => generateActionCode(ACTION_CODE_PATTERN_EXPORT, pascalizedServiceName, apiVersion);
export const generateTriggerWorkflowActionCode = (pascalizedServiceName, apiVersion) => generateActionCode(ACTION_CODE_PATTERN_TRIGGER_WORKFLOW, pascalizedServiceName, apiVersion);

export const getCrudAction = (pascalizedServiceName) => ({
  GET_LIST: generateGetListActionCode(pascalizedServiceName),
  GET_BY_ID: generateGetByIdActionCode(pascalizedServiceName),
  CREATE: generateCreateActionCode(pascalizedServiceName),
  UPDATE: generateUpdateActionCode(pascalizedServiceName),
  DELETE: generateDeleteActionCode(pascalizedServiceName),
});

export const getCrudeAction = (pascalizedServiceName) => ({
  CREATE: generateCreateActionCode(pascalizedServiceName),
  GET_LIST: generateGetListActionCode(pascalizedServiceName),
  GET_BY_ID: generateGetByIdActionCode(pascalizedServiceName),
  UPDATE: generateUpdateActionCode(pascalizedServiceName),
  DELETE: generateDeleteActionCode(pascalizedServiceName),
  EXPORT: generateExportActionCode(pascalizedServiceName),
});

export const getReAction = (pascalizedServiceName) => ({
  GET_LIST: generateGetListActionCode(pascalizedServiceName),
  GET_BY_ID: generateGetByIdActionCode(pascalizedServiceName),
  EXPORT: generateExportActionCode(pascalizedServiceName),
});

export const getCrudpeAction = (pascalizedServiceName) => ({
  CREATE: generateCreateActionCode(pascalizedServiceName),
  GET_LIST: generateGetListActionCode(pascalizedServiceName),
  GET_BY_ID: generateGetByIdActionCode(pascalizedServiceName),
  UPDATE: generateUpdateActionCode(pascalizedServiceName),
  DELETE: generateDeleteActionCode(pascalizedServiceName),
  PRINT: generatePrintActionCode(pascalizedServiceName),
  EXPORT: generateExportActionCode(pascalizedServiceName),
});

export const getRueAction = (pascalizedServiceName) => ({
  GET_LIST: generateGetListActionCode(pascalizedServiceName),
  GET_BY_ID: generateGetByIdActionCode(pascalizedServiceName),
  UPDATE: generateUpdateActionCode(pascalizedServiceName),
  EXPORT: generateExportActionCode(pascalizedServiceName),
});

export const getCrudtAction = (pascalizedServiceName) => ({
  CREATE: generateCreateActionCode(pascalizedServiceName),
  GET_LIST: generateGetListActionCode(pascalizedServiceName),
  GET_BY_ID: generateGetByIdActionCode(pascalizedServiceName),
  UPDATE: generateUpdateActionCode(pascalizedServiceName),
  DELETE: generateDeleteActionCode(pascalizedServiceName),
  TRIGGER_WORKFLOW: generateTriggerWorkflowActionCode(pascalizedServiceName),
});

export const getCrudpetAction = (pascalizedServiceName) => ({
  CREATE: generateCreateActionCode(pascalizedServiceName),
  GET_LIST: generateGetListActionCode(pascalizedServiceName),
  GET_BY_ID: generateGetByIdActionCode(pascalizedServiceName),
  UPDATE: generateUpdateActionCode(pascalizedServiceName),
  DELETE: generateDeleteActionCode(pascalizedServiceName),

  PRINT: generatePrintActionCode(pascalizedServiceName),
  EXPORT: generateExportActionCode(pascalizedServiceName),
  TRIGGER_WORKFLOW: generateTriggerWorkflowActionCode(pascalizedServiceName),
});

export const getRpeAction = (pascalizedServiceName) => ({
  GET_LIST: generateGetListActionCode(pascalizedServiceName),
  GET_BY_ID: generateGetByIdActionCode(pascalizedServiceName),

  PRINT: generatePrintActionCode(pascalizedServiceName),
  EXPORT: generateExportActionCode(pascalizedServiceName),
});
