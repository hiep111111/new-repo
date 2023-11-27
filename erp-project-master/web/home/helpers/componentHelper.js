/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-unused-vars */
/* eslint-disable no-param-reassign */
import PropTypes from "prop-types";
import { isArray, isFunction, isObject, isUndefined, omit, isString, concat } from "lodash";
import { createDraft, finishDraft } from "immer";
import createCachedSelector from "re-reselect";
import axios from "axios";
import { createBrowserHistory } from "history";

import CustomerField from "../userControls/CustomerField";
import VendorField from "../userControls/VendorField";
import ProductField from "../userControls/ProductField";
import UserField from "../userControls/UserField";
import InstantSearchField from "../userControls/InstantSearchField";

import { DATA_TYPE } from "../constants/dataType";
import { API_GATEWAY_URL } from "../constants/config";

import { apiErrorMessages } from "./errorHelper";
import { apiGetList, apiCreate, apiGetById } from "./apiHelper";
import {
  getToken,
  removeToken,
  getInputValue,
  getDefaultValue,
  convertDataListOptionList,
  convertDataListInstantSearchOptionList,
  equalToId,
  isObjectId,
  convertStringToArray,
  getFunctionId,
} from "./commonHelper";
import { getDefaultModelValue } from "./modelHelper";
import { getNetSearchQuery, LIST_VIEW_MODE } from "./listComponentHelper";
import { parseServiceSwagger, API_ACTION_CODE } from "./swaggerHelper";
import { HASH_TAG_SERVICE_CODE } from "./formComponentHelper";

const COMMENT_SERVICE_CODE = "v1/comments";
const DISCOVERY_SERVICE_CODE = "v1/services";

export const LOADING_STATE = {
  loading: true,
  error: false,
  success: false,
  messages: "",
};

export const DEFAULT_PERMISSION = {
  allowedApiActionList: [],
  allowedWorkflowActionList: [],
};

export const PLUGIN = {
  COMMENT: "comment",
  QUERY_TEMPLATE: "queryTemplate",
};

export const API_RESERVED_KEY = ["limit", "offset", "sortBy", "fields"];

export const ObjectListPropType = PropTypes.shape({
  model: PropTypes.string,
  length: PropTypes.number,
  data: PropTypes.array,
  query: PropTypes.object,
});

export const PropsChildrenPropType = PropTypes.oneOfType([PropTypes.array, PropTypes.object]);

export const listOptionsSelector = createCachedSelector(
  (objectList) => objectList,
  (objectList, keyField) => keyField,
  (objectList, keyField, codeField) => codeField,
  (objectList, keyField, codeField, nameField) => nameField,

  (objectList, keyField, codeField, nameField) => {
    if (objectList && objectList.data) {
      return convertDataListOptionList(objectList.data, keyField, codeField, nameField);
    }
    return [];
  }
)((objectList, keyField, codeField, nameField, fieldName) => fieldName);

export const instantSearchOptionsSelector = createCachedSelector(
  (objectList) => objectList,
  (objectList, valueField) => valueField,
  (objectList, valueField, codeField) => codeField,
  (objectList, valueField, codeField, nameField) => nameField,

  (objectList, valueField, codeField, nameField) => {
    if (objectList && objectList.data) {
      return convertDataListInstantSearchOptionList(objectList.data, valueField, codeField, nameField);
    }
    return [];
  }
)((objectList, valueField, codeField, nameField, fieldName) => fieldName);

export const directListOptionsSelector = createCachedSelector(
  (objectList, keyField, codeField, nameField, cacheName) => objectList,
  (objectList, keyField, codeField, nameField, cacheName) => keyField,
  (objectList, keyField, codeField, nameField, cacheName) => codeField,
  (objectList, keyField, codeField, nameField, cacheName) => nameField,

  (objectList, keyField, codeField, nameField) => {
    if (objectList) {
      return convertDataListOptionList(objectList, keyField, codeField, nameField);
    }
    return [];
  }
)((objectList, keyField, codeField, nameField, cacheName) => cacheName);

export const bindComponentToContext = (componentList, context) => {
  const normalizedComponentList = isArray(componentList) ? componentList : [componentList];

  const INSTANT_SEARCH_CONTROL_LIST = [CustomerField, VendorField, ProductField, UserField];

  if (normalizedComponentList.some((component) => INSTANT_SEARCH_CONTROL_LIST.includes(component))) {
    normalizedComponentList.push(InstantSearchField);
  }

  normalizedComponentList.forEach((component) => {
    component.contextType = context;
  });
};

export const getLinkedObjects = (objectId, objectListData) => {
  const currentIndex = objectListData.findIndex((val) => equalToId(val._id, objectId));
  const prevObjectId = currentIndex > 0 ? objectListData[currentIndex - 1]._id : "";
  const nextObjectId = currentIndex > -1 && currentIndex < objectListData.length - 1 ? objectListData[currentIndex + 1]._id : "";

  return {
    prevObjectId,
    nextObjectId,
  };
};

export function removeJunkValue(self, query) {
  const normalizedQuery = {};
  const { model } = self.state;
  let fieldType = "";

  if (!query) {
    console.warn("query is undefined");
    return normalizedQuery;
  }

  Object.entries(query).forEach(([key, value]) => {
    // copy and reject null / empty / undefined values
    switch (value) {
      case undefined:
      case "":
      case null:
        break;

      case "0": // remove ID = 0 query
        fieldType = model[key] ? model[key].type : DATA_TYPE.STRING;

        if (fieldType !== DATA_TYPE.ID && fieldType !== DATA_TYPE.COMPANY_ID) {
          normalizedQuery[key] = value;
        }
        break;

      default:
        if (["isDefaultQuery", "hiddenFields"].indexOf(key) === -1) {
          // other fields
          normalizedQuery[key] = value;
        }

        break;
    }
  });

  return normalizedQuery;
}

export async function getList(self, apiEndpoint, query) {
  const { error, data } = await apiGetList(apiEndpoint, removeJunkValue(self, getNetSearchQuery(query)), self);

  if (error) {
    self.setState({
      query,
      error: true,
      success: false,
      messages: apiErrorMessages(error),
      loading: false,
      viewMode: LIST_VIEW_MODE.LIST,
    });
  } else {
    self.setState({
      query,
      loading: false,
      objectList: data,
      prevObjectId: "",
      objectId: "",
      nextObjectId: "",
      viewMode: LIST_VIEW_MODE.LIST,
    });
  }
}

function mergeFieldOnChangeList(fieldDef, onChangeHandlerList) {
  if (fieldDef) {
    const onChangeHandler = fieldDef.onChange;

    if (isFunction(onChangeHandler)) {
      if (onChangeHandlerList.indexOf(onChangeHandler) < 0) {
        onChangeHandlerList.push(onChangeHandler);
      }
    }
  }
}

export async function onChange(self, event, data) {
  event.preventDefault();

  const currentState = self.state;
  const { isListComponent, query, object, model, pageLoad, modelName } = currentState;
  const { name, value } = getInputValue(data);
  const changedFields = createDraft(isListComponent ? query : object);
  const splittedNameList = name.split("."); // fieldName.index.subFieldName
  const onChangeHandlerList = []; // all handler called after related field changed

  if (splittedNameList.length < 3) {
    // single field or field with '$gt' / '$lt'
    changedFields[name] = value;

    mergeFieldOnChangeList(model[name], onChangeHandlerList);

    const selectedPageLoad = pageLoad[name];

    if (selectedPageLoad) {
      // Ref model is found => need to process related fields
      const { refKeyField, relatedFields } = selectedPageLoad;

      if (value) {
        // EU selected value
        const selectedItem = selectedPageLoad.data.find((item) => equalToId(item[refKeyField], value));

        if (selectedItem && relatedFields) {
          relatedFields.forEach((field) => {
            if (isObject(field)) {
              const { fromField, toField, toPageLoad } = field;

              if (toField) {
                changedFields[toField] = selectedItem[fromField];
                mergeFieldOnChangeList(model[toField], onChangeHandlerList);
              } else if (toPageLoad) {
                pageLoad[toPageLoad] = {
                  // create new pageLoad for related field
                  ...pageLoad[toPageLoad],
                  data: selectedItem[fromField],
                };
              }
            } else {
              changedFields[field] = selectedItem[field];
              mergeFieldOnChangeList(model[field], onChangeHandlerList);
            }
          });
        }
      } else if (relatedFields) {
        // EU didn't select value
        relatedFields.forEach((field) => {
          if (isObject(field)) {
            const { toField, toPageLoad } = field;

            if (toField) {
              const toFieldDef = model[toField];

              changedFields[toField] = getDefaultValue(toFieldDef.type, toFieldDef.defaultValue);
              mergeFieldOnChangeList(model[toField], onChangeHandlerList);
            } else if (toPageLoad) {
              pageLoad[toPageLoad] = {
                // create new pageLoad for related field
                ...pageLoad[toPageLoad],
                data: [],
              };
            }
          } else {
            const fieldDef = model[field];

            if (fieldDef) {
              changedFields[field] = getDefaultValue(fieldDef.type, fieldDef.defaultValue);
              mergeFieldOnChangeList(model[field], onChangeHandlerList);
            } else {
              console.error(`Field ${field} is NOT defined in model ${modelName}.`);
            }
          }
        });
      }
    }
  } else {
    // nested field
    const fieldName = splittedNameList[0];
    const index = splittedNameList[1];
    const subFieldName = splittedNameList[2];
    const fieldSubModel = model[fieldName] && model[fieldName].subModel ? model[fieldName].subModel : {};

    const changedItem = changedFields[fieldName][index];
    changedItem[subFieldName] = value;

    mergeFieldOnChangeList(fieldSubModel[subFieldName], onChangeHandlerList);

    // pageLoad[name] => nested instant search field with MANY pageLoad
    // pageLoad[`${fieldName}.${subFieldName}`] => nested instant search field with UNIQUE pageLoad
    const selectedPageLoad = !isUndefined(pageLoad[name]) ? pageLoad[name] : pageLoad[`${fieldName}.${subFieldName}`];

    if (selectedPageLoad) {
      // Ref model is found
      const { refKeyField, relatedFields } = selectedPageLoad;

      if (value) {
        // EU selected value
        const selectedItem = selectedPageLoad.data ? selectedPageLoad.data.find((item) => equalToId(item[refKeyField], value)) : undefined;

        if (selectedItem && relatedFields) {
          relatedFields.forEach((field) => {
            if (isObject(field)) {
              const { fromField, toField, toPageLoad } = field;

              if (toField) {
                changedItem[toField] = selectedItem[fromField];
                mergeFieldOnChangeList(fieldSubModel[toField], onChangeHandlerList);
              } else if (toPageLoad) {
                pageLoad[`${fieldName}.${index}.${toPageLoad}`] = {
                  // create new pageLoad for related field
                  ...pageLoad[`${fieldName}.${toPageLoad}`],
                  data: selectedItem[fromField],
                };
              }
            } else {
              changedItem[field] = selectedItem[field];
              mergeFieldOnChangeList(fieldSubModel[field], onChangeHandlerList);
            }
          });
        }
      } else if (relatedFields) {
        // EU didn't select value => clear related field
        relatedFields.forEach((field) => {
          const fieldDef = fieldSubModel[subFieldName];

          if (isObject(field)) {
            // exists { fromField: toField }
            const { toField, toPageLoad } = field;

            if (toField) {
              changedItem[toField] = getDefaultValue(fieldDef.type, fieldDef.defaultValue);
              mergeFieldOnChangeList(fieldSubModel[toField], onChangeHandlerList);
            } else if (toPageLoad) {
              pageLoad[`${fieldName}.${index}.${toPageLoad}`] = {
                ...pageLoad[`${fieldName}.${toPageLoad}`],
                data: [],
              };
            }
          } else {
            changedItem[field] = getDefaultValue(fieldDef.type, fieldDef.defaultValue);
            mergeFieldOnChangeList(fieldSubModel[field], onChangeHandlerList);
          }
        });
      }
    }
  }

  let newState = finishDraft(changedFields);

  for (let i = 0; i < onChangeHandlerList.length; i += 1) {
    const func = onChangeHandlerList[i];
    // eslint-disable-next-line no-await-in-loop
    newState = await func(self, newState);
  }

  if (isListComponent) {
    // in list page
    self.setState({
      ...currentState,
      query: newState,
    });
  } else {
    // in form page
    self.setState({
      ...currentState,
      object: newState,
    });
  }
}

export async function onAddSubDocument(self, event, fieldName, push) {
  event.preventDefault();

  const currentState = self.state;

  const { isListComponent, query, object, model, pageLoad } = currentState;

  const changedFields = createDraft(isListComponent ? query : object);
  const { subModel } = model[fieldName];
  const subDocumentLength = changedFields[fieldName] ? changedFields[fieldName].length : 0;

  if (subDocumentLength === 0) {
    changedFields[fieldName] = [getDefaultModelValue(subModel)];
  } else {
    if (push) {
      changedFields[fieldName].push(getDefaultModelValue(subModel));
    } else {
      changedFields[fieldName].unshift(getDefaultModelValue(subModel));
    }
  }

  // auto clone pageLoad to sub document pageLoad by its index
  Object.entries(subModel).forEach(([subFieldName, subFieldDef]) => {
    const { uniquePageLoad } = subFieldDef; // [!] ~Page[L]oad vs ~Page[l]oad is easy to make error

    if (uniquePageLoad && !push) {
      for (let i = subDocumentLength; i > 0; i -= 1) {
        pageLoad[`${fieldName}.${i}.${subFieldName}`] = { ...pageLoad[`${fieldName}.${i - 1}.${subFieldName}`] };
      }

      pageLoad[`${fieldName}.0.${subFieldName}`] = { ...pageLoad[`${fieldName}.${subFieldName}`] };
    } else if (uniquePageLoad && push) {
      pageLoad[`${fieldName}.${subDocumentLength}.${subFieldName}`] = { ...pageLoad[`${fieldName}.${subFieldName}`] };
    }
  });

  const newState = finishDraft(changedFields);

  if (isListComponent) {
    // in list page
    self.setState({
      ...currentState,
      query: {
        ...query,
        ...newState,
      },
    });
  } else {
    // in form page
    self.setState({
      ...currentState,
      object: {
        ...object,
        ...newState,
      },
    });
  }
}

export async function onAppendSubDocument(self, event, fieldName) {
  event.preventDefault();

  const currentState = self.state;

  const { isListComponent, query, object, model, pageLoad } = currentState;

  const changedFields = createDraft(isListComponent ? query : object);
  const { subModel } = model[fieldName];
  const subDocumentLength = changedFields[fieldName] ? changedFields[fieldName].length : 0;

  if (subDocumentLength === 0) {
    changedFields[fieldName] = [getDefaultModelValue(subModel)];
  } else {
    changedFields[fieldName].push(getDefaultModelValue(subModel));
  }

  // auto clone pageLoad to sub document pageLoad by its index
  Object.entries(subModel).forEach(([subFieldName, subFieldDef]) => {
    const { uniquePageLoad } = subFieldDef; // [!] ~Page[L]oad vs ~Page[l]oad is easy to make error

    if (uniquePageLoad) {
      pageLoad[`${fieldName}.${subDocumentLength}.${subFieldName}`] = { ...pageLoad[`${fieldName}.${subFieldName}`] };
    }
  });

  const newState = finishDraft(changedFields);

  if (isListComponent) {
    // in list page
    self.setState({
      ...currentState,
      query: {
        ...query,
        ...newState,
      },
    });
  } else {
    // in form page
    self.setState({
      ...currentState,
      object: {
        ...object,
        ...newState,
      },
    });
  }
}

export async function onDeleteSubDocument(self, event, indexedFieldName) {
  event.preventDefault();

  const currentState = self.state;
  const { model, isListComponent, query, object, pageLoad } = currentState;
  const changedFields = createDraft(isListComponent ? query : object);
  const splittedNameList = indexedFieldName.split("."); // fieldName.index
  const fieldName = splittedNameList[0];
  const index = Number.parseInt(splittedNameList[1], 10);
  const { subModel } = model[fieldName];
  const subDocumentLength = changedFields[fieldName].length - 1;
  changedFields[fieldName].splice(index, 1);
  const newState = finishDraft(changedFields);

  // auto clone pageLoad to sub document pageLoad by its index
  Object.entries(subModel).forEach(([subFieldName, subFieldDef]) => {
    const { uniquePageLoad } = subFieldDef; // [!] ~Page[L]oad vs ~Page[l]oad is easy to make error

    if (uniquePageLoad) {
      for (let i = index; i < subDocumentLength; i += 1) {
        pageLoad[`${fieldName}.${i}.${subFieldName}`] = { ...pageLoad[`${fieldName}.${i + 1}.${subFieldName}`] };
      }

      delete pageLoad[`${fieldName}.${subDocumentLength}.${subFieldName}`];
    }
  });

  if (isListComponent) {
    // in list page
    self.setState({
      ...currentState,
      query: {
        ...query,
        ...newState,
      },
    });
  } else {
    // in form page
    self.setState({
      ...currentState,
      object: {
        ...object,
        ...newState,
      },
    });
  }
}

export function onDownloadFile(self, fileId) {
  window.open(`${API_GATEWAY_URL}/v1/files/${fileId}`, "_blank");
}

export async function checkLogin(self) {
  const token = getToken(self);
  const loginUrl = `/login/${encodeURIComponent(window.location.href)}`;
  const history = createBrowserHistory();
  const location = history.location.pathname;
  const moduleCode = location.substring(1, location.indexOf("/", 1)); // skip first '/'

  if (!token) {
    window.location.href = loginUrl;
    return;
  }

  const { status, handleReLoginUserSuccess } = self.props;

  if (status !== "authenticated") {
    //  || !user
    try {
      const data = {
        moduleCode,
      };

      const result = await axios({
        method: "POST",
        data,
        url: `${API_GATEWAY_URL}/v1/users/ping`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const userData = result.data.data;

      const { moduleList, currentModuleId, functionList, departmentList, defaultFunctionId, defaultFunctionUrl, defaultFunctionName } = userData;

      let currentFunctionId = defaultFunctionId;
      let currentFunctionName = defaultFunctionName;
      let currentFunctionUrl = defaultFunctionUrl;
      let currentFunctionActionList = "";

      // defaultFunctionId isn't set or having ref url
      // [..] "http://"" having "/" also => length + 2
      if (!isObjectId(currentFunctionId) || window.location.href.split("/").length > 5) {
        const secondSlashPos = location.indexOf("/", 1);
        const thirdSlashPos = secondSlashPos > -1 ? location.indexOf("/", secondSlashPos + 1) : -1;
        let requestFunctionUrl = thirdSlashPos > -1 ? location.substring(0, thirdSlashPos + 1) : location;

        if (requestFunctionUrl !== "") {
          for (let i = 0; i < functionList.length; i += 1) {
            const { functionId, functionName, functionUrl, functionActionList } = { ...functionList[i] };

            let normalizedFunctionUrl = `/${functionUrl}/`;

            while (normalizedFunctionUrl.indexOf("//") > -1) {
              // remove repeated slash character
              normalizedFunctionUrl = normalizedFunctionUrl.replace("//", "/");
            }

            requestFunctionUrl = `${requestFunctionUrl}/`;

            while (requestFunctionUrl.indexOf("//") > -1) {
              // remove repeated slash character
              requestFunctionUrl = requestFunctionUrl.replace("//", "/");
            }

            if (normalizedFunctionUrl.length > 2) {
              if (requestFunctionUrl === normalizedFunctionUrl) {
                currentFunctionId = functionId;
                currentFunctionName = functionName;
                currentFunctionUrl = functionUrl;
                currentFunctionActionList = functionActionList;
                break;
              }
            }
          }
        }
      }

      handleReLoginUserSuccess(
        omit(userData, ["moduleList", "functionList", "departmentList"]),

        moduleList,
        currentModuleId,

        functionList,
        currentFunctionId,
        currentFunctionName,
        currentFunctionUrl,
        currentFunctionActionList,

        departmentList
      );

      if (currentFunctionId && location.indexOf(currentFunctionUrl) < 0) {
        window.location.href = currentFunctionUrl;
      }
    } catch (error) {
      removeToken();
      window.location.href = loginUrl;
    }
  }
}

export const getApiContextFromSelf = (self = {}) => {
  const { props } = self;

  if (!props) {
    return {};
  }

  const { functionId } = props;

  return {
    functionId,
  };
};

export const onClickOpenGuideline = async (self) => {
  const { data } = await apiGetById("v1/functions", getFunctionId(), "_id,functionName,functionUrl,refArticleId,isRefCategory", true, { functionId: "5a08a4ee8d6d232e33df52a7" });
  const functionInfo = data.data;

  if (functionInfo.refArticleId) {
    if (functionInfo.isRefCategory) {
      window.open(`${window.location.origin}/userGuide/articleInquiries/?articleCategoryId=${functionInfo.refArticleId}`, "_blank");
    } else {
      window.open(`${window.location.origin}/userGuide/articleInquiries/${functionInfo.refArticleId}`, "_blank");
    }
  } else {
    alert("Chức năng chưa có hướng dẫn sử dụng");
  }
};

const handleFocus = (childNodes) => {
  for (const child of childNodes) {
    if (child.tagName.toLowerCase() === "label") {
      continue;
    }

    if (child.tagName.toLowerCase() === "input") {
      child.focus();

      break;
    }

    handleFocus(child.childNodes);
  }
};

export const onKeyDown = async (self, event, conditionCode = null) => {
  const { focus } = self.state;
  if (focus) {
    const { switchingList } = focus;
    let switching;

    if (conditionCode) {
      switching = switchingList.find(
        (s) =>
          s.eventKey === event.key &&
          (s.fromField === event.target.name || s.fromField === event.currentTarget.getAttribute("name")) && // currentTarget for SelectionField
          s.conditionCode === conditionCode &&
          Boolean(s.ctrlKey) === event.ctrlKey &&
          Boolean(s.altKey) === event.altKey &&
          Boolean(s.shiftKey) === event.shiftKey
      );
    } else {
      switching = switchingList.find(
        (s) =>
          s.eventKey === event.key &&
          (s.fromField === event.target.name || s.fromField === event.currentTarget.getAttribute("name")) && // currentTarget for SelectionField
          Boolean(s.ctrlKey) === event.ctrlKey &&
          Boolean(s.altKey) === event.altKey &&
          Boolean(s.shiftKey) === event.shiftKey
      );
    }

    if (switching) {
      const { toField } = switching;
      const { current } = self[`${toField}Ref`];
      const { childNodes } = current;

      handleFocus(childNodes);
    }
  }
};

export const onClickFunctionRegister = async (self) => {
  self.setState(LOADING_STATE);

  const { modelName, models, apiActionList, baseUrl, pluginList, functionId, functionName } = self.props;

  const clientContext = getApiContextFromSelf(self);
  const functionUrl = baseUrl;
  const { object, query } = models;
  const { objectFields } = object;
  const serviceCodeList = [];
  const serviceActionList = [];
  const serviceList = [];
  const objectFieldsArray = isString(objectFields) ? objectFields.split(",") : [];
  let hasError = false;
  const errorMessageList = [];

  const convertQueryToRequestFieldList = (modelQuery) => {
    return Object.keys(omit(modelQuery, API_RESERVED_KEY));
  };

  serviceCodeList.push(modelName);

  apiActionList.forEach((apiActionCode) => {
    // parse action related api
    switch (apiActionCode) {
      case API_ACTION_CODE.GET_LIST: {
        serviceActionList.push({
          modelName,
          actionCode: API_ACTION_CODE.AGGREGATE,
          requestFieldList: objectFieldsArray,
          responseFieldList: objectFieldsArray,
        });

        serviceActionList.push({
          modelName,
          actionCode: API_ACTION_CODE.GET_LIST,
          requestFieldList: objectFieldsArray,
          responseFieldList: objectFieldsArray,
        });

        serviceActionList.push({
          modelName,
          actionCode: API_ACTION_CODE.GET_BY_ID,
          requestFieldList: objectFieldsArray,
          responseFieldList: objectFieldsArray,
        });

        break;
      }

      case API_ACTION_CODE.CREATE: {
        serviceActionList.push({
          modelName,
          actionCode: API_ACTION_CODE.CREATE,
          requestFieldList: objectFieldsArray,
          responseFieldList: objectFieldsArray,
        });

        break;
      }

      case API_ACTION_CODE.UPDATE: {
        serviceActionList.push({
          modelName,
          actionCode: API_ACTION_CODE.UPDATE,
          requestFieldList: objectFieldsArray,
          responseFieldList: objectFieldsArray,
        });

        break;
      }

      case API_ACTION_CODE.DELETE: {
        serviceActionList.push({
          modelName,
          actionCode: API_ACTION_CODE.DELETE,
          requestFieldList: [],
          responseFieldList: objectFieldsArray,
        });

        break;
      }

      case API_ACTION_CODE.PRINT: {
        serviceActionList.push({
          modelName,
          actionCode: API_ACTION_CODE.PRINT,
          requestFieldList: [],
          responseFieldList: objectFieldsArray,
        });

        break;
      }

      case API_ACTION_CODE.EXPORT: {
        serviceActionList.push({
          modelName,
          actionCode: API_ACTION_CODE.EXPORT,
          requestFieldList: objectFieldsArray,
          responseFieldList: objectFieldsArray,
        });

        break;
      }

      case API_ACTION_CODE.TRIGGER_WORKFLOW: {
        serviceActionList.push({
          modelName,
          actionCode: API_ACTION_CODE.TRIGGER_WORKFLOW,
          requestFieldList: objectFieldsArray,
          responseFieldList: objectFieldsArray,
        });

        break;
      }

      case API_ACTION_CODE.POST: {
        serviceActionList.push({
          modelName,
          actionCode: API_ACTION_CODE.POST,
          requestFieldList: objectFieldsArray,
          responseFieldList: objectFieldsArray,
        });

        break;
      }

      case API_ACTION_CODE.REVERSE: {
        serviceActionList.push({
          modelName,
          actionCode: API_ACTION_CODE.REVERSE,
          requestFieldList: objectFieldsArray,
          responseFieldList: objectFieldsArray,
        });

        break;
      }

      default: {
        break;
      }
    }
  });

  // parse get list model api
  if (query && isArray(query.refModels)) {
    query.refModels.forEach((m) => {
      const { fieldName, modelName, query } = m;
      const { fields } = query;

      // just auto-register first api with modelName
      if (serviceCodeList.indexOf(modelName) < 0) {
        const responseFieldList = isString(fields) ? convertStringToArray(fields) : fields;

        serviceCodeList.push(modelName);

        serviceActionList.push({
          fieldName,
          modelName,
          actionCode: `getList`,
          requestFieldList: concat(convertQueryToRequestFieldList(query), responseFieldList),
          responseFieldList, // [!] TODO: check query fields much more than object fields??
        });
      }
    });
  }

  // parse reference model api
  if (object && isArray(object.refModels)) {
    object.refModels.forEach((m) => {
      const { fieldName, modelName, query } = m;
      const { fields } = query;

      if (serviceCodeList.indexOf(modelName) < 0 && modelName.indexOf("*.") < 0) {
        // skip virtual model with sign '*.' prefix
        const responseFieldList = isString(fields) ? convertStringToArray(fields) : fields;

        serviceCodeList.push(modelName);

        serviceActionList.push({
          fieldName,
          modelName,
          actionCode: `getList`,
          requestFieldList: concat(convertQueryToRequestFieldList(query), responseFieldList),
          responseFieldList,
        });
      }
    });
  }

  if (pluginList.includes(PLUGIN.COMMENT)) {
    const commentServiceResult = await apiGetList(
      DISCOVERY_SERVICE_CODE,
      {
        serviceCode: COMMENT_SERVICE_CODE,
        limit: 1,
        active: true,
        fields: ["_id", "serviceCode", "serviceName", "actionList", "fieldList"],
      },
      clientContext
    );

    if (commentServiceResult.error) {
      hasError = true;

      errorMessageList.push({
        name: `apiGetList(${COMMENT_SERVICE_CODE})`,
        message: apiErrorMessages(commentServiceResult.error),
      });
    }

    const commentService = commentServiceResult.data.data[0];
    const { actionList: commentActionList } = commentService;

    serviceList.push(commentService);

    if (isArray(commentActionList)) {
      commentActionList.forEach((action) => {
        const { actionCode, requestFieldList, responseFieldList } = action;

        serviceActionList.push({
          modelName: COMMENT_SERVICE_CODE,
          actionCode,
          requestFieldList,
          responseFieldList,
        });
      });
    }

    const tagServiceResult = await apiGetList(
      DISCOVERY_SERVICE_CODE,
      {
        serviceCode: HASH_TAG_SERVICE_CODE,
        limit: 1,
        active: true,
        fields: ["_id", "serviceCode", "serviceName", "actionList", "fieldList"],
      },
      clientContext
    );

    if (tagServiceResult.error) {
      hasError = true;

      errorMessageList.push({
        name: `apiGetList(${HASH_TAG_SERVICE_CODE})`,
        message: apiErrorMessages(tagServiceResult.error),
      });
    }

    const tagService = tagServiceResult.data.data[0];
    const { actionList: tagActionList } = tagService;

    serviceList.push(tagService);

    if (isArray(tagActionList)) {
      tagActionList.forEach((action) => {
        const { actionCode, requestFieldList, responseFieldList } = action;

        serviceActionList.push({
          modelName: HASH_TAG_SERVICE_CODE,
          actionCode,
          requestFieldList,
          responseFieldList,
        });
      });
    }
  }

  // [..] no need to register PLUGIN.QUERY_TEMPLATE

  for (const serviceCode of serviceCodeList) {
    // register service list
    const query = {
      serviceCode: {
        $eq: serviceCode, // search exactly!!
      },

      limit: 1,
      active: true,
      fields: ["_id", "serviceCode", "serviceName", "actionList", "fieldList"],
    };

    const getServiceResult = await apiGetList(DISCOVERY_SERVICE_CODE, query, clientContext);

    if (getServiceResult.error) {
      hasError = true;

      errorMessageList.push({
        name: `apiGetList('${DISCOVERY_SERVICE_CODE}', ${serviceCode})`,
        message: apiErrorMessages(getServiceResult.error),
      });

      continue;
    }

    const service = getServiceResult.data.data[0];

    if (service) {
      serviceList.push(service);
    } else {
      // if (service)
      const swaggerResult = await parseServiceSwagger(self, serviceCode);

      if (swaggerResult.error) {
        hasError = true;

        errorMessageList.push({
          name: `parseServiceSwagger(self, ${serviceCode})`,
          message: apiErrorMessages(swaggerResult.error),
        });

        continue;
      }

      const createdService = {
        serviceCode,
        serviceName: serviceCode,
        actionList: swaggerResult.actionList,
        fieldList: swaggerResult.fieldList,
        active: true,
      };

      const creationResult = await apiCreate(DISCOVERY_SERVICE_CODE, createdService, clientContext);

      if (creationResult.error) {
        hasError = true;

        errorMessageList.push({
          name: `apiCreate('${DISCOVERY_SERVICE_CODE}', ${serviceCode})`,
          message: apiErrorMessages(creationResult.error),
        });

        continue;
      }

      serviceList.push(creationResult.data.data);
    } // if (service)
  }

  for (const serviceAction of serviceActionList) {
    // register policy
    const { fieldName, modelName, actionCode, requestFieldList, responseFieldList } = serviceAction;

    const service = serviceList.find((s) => s.serviceCode === modelName);

    if (!service) {
      hasError = true;

      errorMessageList.push({
        name: `Tài nguyên ${modelName}`,
        message: `không tồn tại!`,
      });

      continue;
    }

    const serviceId = service._id;

    const { serviceCode, serviceName, actionList, fieldList } = service;

    const action = service.actionList.find((a) => a.actionCode === actionCode);

    if (!action) {
      hasError = true;

      errorMessageList.push({
        name: `Hành động ${actionCode} của ${serviceCode}`,
        message: `không tồn tại!`,
      });

      continue;
    }

    const { path, method } = action;

    if (!action) {
      hasError = true;

      errorMessageList.push({
        name: `Hành động ${actionCode} của ${serviceCode}`,
        message: `không tồn tại!`,
      });

      continue;
    }

    const query = {
      functionId,
      context: fieldName || "",

      serviceId,
      actionCode, // [!] find by actionId make duplicate issue after update service (recreate action list)

      limit: 1,
      active: true,
      fields: ["_id", "policyName"],
    };

    const getPolicyResult = await apiGetList("v1/sysPolicies", query, clientContext);

    if (getPolicyResult.error) {
      hasError = true;

      errorMessageList.push({
        name: `apiGetList('v1/sysPolicies', { functionId: ${functionId}, serviceId: ${serviceId}, actionCode: ${actionCode}})`,
        message: apiErrorMessages(getPolicyResult.error),
      });

      continue;
    }

    const policy = getPolicyResult.data.data[0];

    if (policy) {
      serviceList.push(service);
    } else {
      // if (service)
      const policyName = `${functionName} - ${serviceCode} - ${actionCode}`;
      const fullApiParamList = path
        ? path
            .split("/")
            .filter((p) => p.startsWith(":"))
            .map((p) => p.replace(":", ""))
        : []; // parse path to param list

      const createdPolicy = {
        policyName,

        functionId,
        functionUrl,
        functionName,

        context: fieldName || "",

        serviceId,
        serviceCode,
        serviceName,
        actionList,
        fieldList,

        actionCode,
        path,
        method,

        fullRequestFieldList: fieldList,
        requestFieldList,
        requestExceptFieldList: [],
        allowedRequestFieldList: requestFieldList,

        fullResponseFieldList: fieldList,
        responseFieldList,
        responseExceptFieldList: [],
        allowedResponseFieldList: responseFieldList,

        userFeatureList: [],
        recordFeatureList: [],
        apiFeatureList: [],

        fullApiParamList,

        active: true,
      };

      const creationResult = await apiCreate("v1/sysPolicies", createdPolicy, clientContext);

      if (creationResult.error) {
        hasError = true;

        errorMessageList.push({
          name: `apiCreate('v1/sysPolicies', { policyName: ${policyName} })`,
          message: apiErrorMessages(creationResult.error),
        });
        continue;
      }
    } // if (policy)
  } // for (let i = 0; i < serviceActionList.length; i += 1)

  if (hasError) {
    self.setState({
      loading: false,
      error: true,
      messages: errorMessageList,
    });
  } else {
    self.setState({
      loading: false,
      success: true,
      messages: "system:msg.register.success",
    });
  }
};
