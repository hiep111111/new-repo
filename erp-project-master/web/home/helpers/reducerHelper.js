import { isUndefined, isArray, isObject, omit, cloneDeep } from "lodash";

import { DATA_TYPE } from "../constants/dataType";
import { ITEM_AMOUNT_PER_PAGE } from "../constants/config";
import { OPERATOR_SIGN } from "../constants/mongoConstant";

import { ACTIONS as MASTER_PAGE_ACTIONS, CHANGE_CURRENT_FUNCTION } from "../masterPage/actions/masterPageAction";

import { getDefaultModelValue } from "./modelHelper";
import { SAVE_QUERY_STATE, SAVE_OBJECT_SURFING_STATE } from "./actionHelper";
import { convertModelNameApiEndpoint } from "./apiHelper";
import { API_ACTION_LIST } from "./swaggerHelper";
import BosError, { BOS_ERROR } from "./errorHelper";

export const createInitialState = (model) => {
  if (!model) {
    throw new BosError("model is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const { modelName, apiActionList, workflow, pluginList, query, data, focus } = model;

  if (!modelName) {
    throw new BosError("model's modelName is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!query) {
    throw new BosError("model query is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!data) {
    throw new BosError("model data is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const apiEndpoint = convertModelNameApiEndpoint(modelName);
  const queryRefModels = [];
  const queryModel = {};
  const groupByFields = {};
  const queryFields = [];

  const { fields, exportedFields, hiddenFields, freezeField } = query;

  const queryFieldsUndefined = isUndefined(fields);

  const objectRefModels = [];
  const objectModel = {};
  const objectFields = [];
  let objectCodeField = "";
  let objectNameField = "";

  Object.entries(data).forEach(([fieldName, fieldDef]) => {
    const { defaultValue, options, onChange } = fieldDef;
    const canGroupBy = fieldDef.canGroupBy || false; // can filter in list form
    const canQuery = fieldDef.canQuery || false; // can filter in list form
    const required = fieldDef.required || false; // check require when validation
    const unique = fieldDef.unique || false; // check require when validation
    const picked = isUndefined(fieldDef.picked) ? true : fieldDef.picked; // pick when create / update (by validation)
    const cloned = isUndefined(fieldDef.cloned) ? true : fieldDef.cloned; // pick when create / update (by validation)
    const translated = fieldDef.translated || false;
    const truncatedLength = fieldDef.truncatedLength || false;
    const isCreateRef = fieldDef.isCreateRef || true;
    const href = isUndefined(fieldDef.href) ? null : fieldDef.href;

    const {
      type, // type of field
      refModelName, // API name of reference data
      refQuery, // user defined query to get reference data
      refKeyField, // primary key (linked) field name
      relatedFields, // field list combined (auto updated) to primary key field
      autoPageLoad, // reference data is loaded automatically
      sharp, // sub model definition
      validator, // field user-defined validator
      validatorMessage, // field user-defined message if validator returns fail
    } = fieldDef;

    if (type === DATA_TYPE.DOCUMENT_CODE) {
      objectCodeField = fieldName;
    } else if (type === DATA_TYPE.DOCUMENT_NAME) {
      objectNameField = fieldName;
    }

    const arrayDefined = isArray(fieldDef);
    const sharpDefined = type === DATA_TYPE.ARRAY && isObject(sharp);

    if (arrayDefined || sharpDefined) {
      // sub-model definition
      const subModelDef = arrayDefined ? fieldDef[0] : sharp;
      const subModel = {};

      if (subModelDef) {
        Object.entries(subModelDef).forEach(([subFieldName, subFieldType]) => {
          const subRefModelName = subFieldType.refModelName;

          // TODO: if !refQuery.fields => gen by refKeyField, relatedFields

          if (subRefModelName) {
            const subFieldNameWithParent = `${fieldName}.${subFieldName}`;

            const refModel = {
              fieldName: subFieldNameWithParent,
              modelName: convertModelNameApiEndpoint(subRefModelName),
              query: subFieldType.refQuery,
              refKeyField: subFieldType.refKeyField,
              relatedFields: subFieldType.relatedFields,

              // [!] ~Page[L]oad vs ~Page[l]oad is easy to make error
              autoPageLoad: isUndefined(subFieldType.autoPageLoad) ? true : subFieldType.autoPageLoad,
              uniquePageLoad: isUndefined(subFieldType.uniquePageLoad) ? false : subFieldType.uniquePageLoad,
              onChange: subFieldType.onChange,
              translated: isUndefined(subFieldType.translated) ? false : subFieldType.translated,
            };

            objectRefModels.push(refModel);

            if (subFieldType.canQuery) {
              queryRefModels.push(refModel);

              queryModel[subFieldNameWithParent] = {
                type: subFieldType.type,
                subModel: refModel,
              };

              if (queryFieldsUndefined) {
                queryFields.push(subFieldNameWithParent);
              }
            }
          } // if (subFieldType.refModelName) {

          subModel[subFieldName] = omit(subFieldType, ["refKeyField", "refModelName", "refQuery", "relatedFields"]);
        });
      } // if (subModelDef) {

      objectModel[fieldName] = {
        type: DATA_TYPE.ARRAY,
        required,
        unique,
        validator,
        validatorMessage,
        picked,
        cloned,
        defaultValue,
        subModel,
        canQuery,
        options,
        translated,
        truncatedLength,
        isCreateRef,
        href,
      };

      if (canQuery) {
        queryModel[fieldName] = {
          type: DATA_TYPE.ARRAY,
          subModel,
        };

        if (queryFieldsUndefined) {
          queryFields.push(fieldName);
        }
      } // if (canQuery) {
    } else if (refModelName) {
      // field with ref model
      const normalizedModelName = convertModelNameApiEndpoint(refModelName);

      objectRefModels.push({
        fieldName,
        modelName: normalizedModelName,
        query: refQuery,
        refKeyField,
        relatedFields,
        autoPageLoad: isUndefined(autoPageLoad) ? true : autoPageLoad,
        onChange,
        translated,
      });

      objectModel[fieldName] = {
        type,
        required,
        unique,
        validator,
        validatorMessage,
        picked,
        cloned,
        defaultValue,
        options,
        translated,
        truncatedLength,
        isCreateRef,
        href,
      };

      if (canQuery) {
        queryRefModels.push({
          fieldName,
          modelName: normalizedModelName,
          query: refQuery,
          refKeyField,
          relatedFields,
          autoPageLoad: isUndefined(autoPageLoad) ? true : autoPageLoad,
          truncatedLength,
          onChange,
        });

        queryModel[fieldName] = {
          type,
          canQuery,
          translated,
        };

        if (queryFieldsUndefined) {
          queryFields.push(fieldName);
        }
      } // if (canQuery) {
    } else {
      // field with single data type
      objectModel[fieldName] = {
        type,
        required,
        unique,
        validator,
        validatorMessage,
        picked,
        cloned,
        defaultValue,
        options,
        onChange,
        translated,
        truncatedLength,
        isCreateRef,
        href,
      };

      if (canQuery) {
        if (type === DATA_TYPE.DATE || type === DATA_TYPE.DATE_TIME) {
          // auto create GREATER AND LESS THAN
          queryModel[fieldName] = {
            // redundancy to get its model
            type,
          };

          queryModel[`${fieldName}${OPERATOR_SIGN}gte`] = {
            type,
          };

          queryModel[`${fieldName}${OPERATOR_SIGN}lte`] = {
            type,
          };
        } else {
          queryModel[fieldName] = {
            type,
            options,
            translated,
            truncatedLength,
          };
        }

        if (queryFieldsUndefined) {
          queryFields.push(fieldName);
        }
      } // if (canQuery) {
    }

    if (canGroupBy) {
      groupByFields[fieldName] = fieldDef;
      queryModel[fieldName] = fieldDef;
      groupByFields[fieldName].canQuery = true;
      queryModel[fieldName].canQuery = true;
    }

    if (picked) {
      objectFields.push(fieldName);
    }
  });

  // add non-system attribute into query model
  Object.entries(query).forEach(([fieldName, fieldDef]) => {
    if (["fields", "exportedFields", "hiddenFields", "page", "itemsPerPage"].indexOf(fieldName) < 0) {
      queryModel[fieldName] = fieldDef;
    }
  });

  queryModel.fields = fields || { type: DATA_TYPE.ARRAY, defaultValue: queryFields };
  queryModel.exportedFields = exportedFields || { type: DATA_TYPE.ARRAY, defaultValue: queryFields };
  queryModel.hiddenFields = hiddenFields || { type: DATA_TYPE.ARRAY, defaultValue: [] };
  queryModel.freezeField = freezeField || { type: DATA_TYPE.STRING, defaultValue: "" };
  queryModel.page = { type: DATA_TYPE.NUMBER, defaultValue: 1 };
  queryModel.itemsPerPage = { type: DATA_TYPE.NUMBER, defaultValue: ITEM_AMOUNT_PER_PAGE };

  if (isUndefined(queryModel.active)) {
    queryModel.active = { type: DATA_TYPE.BOOLEAN, defaultValue: true }; // if NOT INJECTED => create full option value
  }

  groupByFields.fields = fields || { type: DATA_TYPE.ARRAY, defaultValue: queryFields };
  groupByFields.exportedFields = exportedFields || { type: DATA_TYPE.ARRAY, defaultValue: queryFields };
  groupByFields.hiddenFields = hiddenFields || { type: DATA_TYPE.ARRAY, defaultValue: [] };
  groupByFields.freezeField = freezeField || { type: DATA_TYPE.STRING, defaultValue: "" };
  groupByFields.page = { type: DATA_TYPE.NUMBER, defaultValue: 1 };
  groupByFields.itemsPerPage = { type: DATA_TYPE.NUMBER, defaultValue: ITEM_AMOUNT_PER_PAGE };

  const defaultQuery = getDefaultModelValue(queryModel);

  let modelApiEndpoint = model.apiEndpoint;

  if (!modelApiEndpoint) {
    modelApiEndpoint = {
      create: apiEndpoint,
      read: apiEndpoint, // with "/"" or "/:id"
      update: apiEndpoint, // with "/:id"
      delete: apiEndpoint, // with "/:id"

      print: `${apiEndpoint}/print`, // with "/:id"
      export: `${apiEndpoint}/export`, // with "/"
      aggregate: `${apiEndpoint}/aggregate`, // with "/"
      triggerWorkflow: `${apiEndpoint}/triggerWorkflow`, // with "/:actionCode/:id"
      post: `${apiEndpoint}/post`, // with "/:id"
      reverse: `${apiEndpoint}/reverse`, // with "/:id"
    };
  }

  return {
    modelName: apiEndpoint, // model name in API endpoint format
    apiEndpoint: modelApiEndpoint, // default API endpoint list

    apiActionList: apiActionList || API_ACTION_LIST.CRUD, // default set to CRUD (backward compatiblity)
    workflow,
    focus,
    pluginList: pluginList || [],

    models: {
      query: {
        model: queryModel,
        groupBy: groupByFields,
        refModels: queryRefModels,
      },

      object: {
        objectFields: objectFields.join(","),
        model: objectModel,
        refModels: objectRefModels,
      },
    },

    defaultQuery, // default query by query model
    queryList: [],
    selectedQueryId: "",
    query: defaultQuery,
    objectList: {},

    prevObjectId: "",
    objectId: "",
    nextObjectId: "",

    batchActionList: [],

    objectCodeField,
    objectNameField,
  };
};

export const getNewState = (state, ACTIONS, action) => {
  switch (action.type) {
    case MASTER_PAGE_ACTIONS[CHANGE_CURRENT_FUNCTION]: {
      // change function => clear all query state
      const defaultQuery = cloneDeep(state.defaultQuery);

      return {
        ...state,
        query: defaultQuery,
        objectList: {},
      };
    }

    case ACTIONS[SAVE_QUERY_STATE]: {
      const { queryList, selectedQueryId, query, objectList, pageLoad, prevObjectId, objectId, nextObjectId } = action.payload;

      return {
        ...state,
        queryList,
        selectedQueryId,
        query,
        objectList,
        pageLoad,

        prevObjectId,
        objectId,
        nextObjectId,
      };
    }

    case ACTIONS[SAVE_OBJECT_SURFING_STATE]: {
      const { prevObjectId, objectId, nextObjectId } = action.payload;

      return {
        ...state,
        prevObjectId,
        objectId,
        nextObjectId,
      };
    }

    default:
      return state;
  }
};
