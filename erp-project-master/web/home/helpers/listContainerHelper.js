import { getStateName, stateSelector, changeCurrentFunctionByUrlHandler } from './containerHelper';
import { action as masterPageAction } from '../masterPage/actions/masterPageAction';

export const getStateProps = (state, moduleName, modelName) => {
  const stateName = getStateName(moduleName, modelName);

  return stateSelector(state[stateName], state.system, stateName);
};

export const getDispatchProps = (dispatch, action) => ({
  handleReloginUserSuccess: (
    user,

    moduleList,
    currentModuleId,

    functionList,
    currentFunctionId,
    currentFunctionName,
    currentFunctionUrl,
    currentFunctionActionList,

    departmentList,
  ) => dispatch(masterPageAction.reloginUserSuccess( // to call masterPage reducer
    user,

    moduleList,
    currentModuleId,

    functionList,
    currentFunctionId,
    currentFunctionName,
    currentFunctionUrl,
    currentFunctionActionList,

    departmentList,
  )),

  handleSaveQueryState: (
    queryList,
    selectedQueryId,
    query,

    objectList,
    pageLoad,

    prevObjectId,
    objectId,
    nextObjectId,
  ) => dispatch(action.saveQueryState(
    queryList,
    selectedQueryId,
    query,

    objectList,
    pageLoad,

    prevObjectId,
    objectId,
    nextObjectId,
  )),

  handleChangeCurrentFunctionByUrl: changeCurrentFunctionByUrlHandler(dispatch),
});
