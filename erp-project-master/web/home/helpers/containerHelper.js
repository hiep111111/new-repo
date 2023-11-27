import pluralize from "pluralize";
import createCachedSelector from "re-reselect";
import BosError, { BOS_ERROR } from "./errorHelper";

const MASTER_PAGE_CHANGE_CURRENT_FUNCTION_BY_URL = "SYSTEM_CHANGE_CURRENT_FUNCTION_BY_URL";

export const getStateName = (moduleName, modelName) => {
  if (!moduleName) {
    throw new BosError("moduleName is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!modelName) {
    throw new BosError("modelName is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  return `${moduleName}_${pluralize.plural(modelName.replace("/", "_"))}`;
};

export const stateSelector = createCachedSelector(
  (currentState) => currentState,
  (currentState, systemState) => systemState,

  (currentState, systemState) => {
    const {
      user,
      status,
      departmentList,

      currentFunctionId,
      currentFunctionName,
      currentFunctionUrl,
      currentModuleId,
      currentFunctionActionList,
    } = systemState;

    const {
      modelName,
      apiActionList,
      workflow,
      pluginList,
      models,
      apiEndpoint,
      queryList,
      selectedQueryId,
      query,
      defaultQuery,
      objectList,
      pageLoad,
      focus,
      prevObjectId,
      objectId,
      nextObjectId,
      objectCodeField,
      objectNameField,
    } = currentState;

    return {
      userId: user._id || "",
      userName: user.userName || "",
      isAdmin: user.isAdmin || false,
      userFullName: user.fullName || "",
      employeeNo: user.employeeNo || "",
      status,
      departmentList,

      functionId: currentFunctionId,
      moduleId: currentModuleId,
      functionName: currentFunctionName || "",
      baseUrl: currentFunctionUrl || "",
      functionActionList: currentFunctionActionList ? currentFunctionActionList.split(",") : [],

      modelName,
      models,
      objectCodeField,
      objectNameField,

      apiEndpoint,
      apiActionList,
      workflow,
      focus,
      pluginList,

      queryList,
      selectedQueryId,
      query,
      defaultQuery,
      objectList,
      pageLoad,

      prevObjectId,
      objectId,
      nextObjectId,

      batchActionList: [],

      canDrillDown: true,
      canVisualize: false,
      canShowKanban: !!workflow, // workflow defined => can show Kanban
    };
  }
)((currentState, systemState, stateName) => stateName);

export const changeCurrentFunctionByUrlHandler = (dispatch) => (functionUrl) =>
  dispatch({
    type: MASTER_PAGE_CHANGE_CURRENT_FUNCTION_BY_URL,
    payload: functionUrl,
  });
