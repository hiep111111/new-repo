import mongoose from "mongoose";
import { isArray, difference, isString, isObject, isUndefined, extend, intersection, pick, clone } from "lodash";
import debug from "debug";
import axios from "axios";
import config from "config";
import puppeteer from "puppeteer-core";

import { UNLIMITED_RETURNED_RESULT, DELETE_REJECT_TIME_OUT_DURATION } from "../constants/commonConstant";
import { HTTP_METHOD, HTTP_RESPONSE_CODE } from "../constants/httpConstant";
import { DATA_TYPE } from "../constants/dataTypeConstant";
import { OPERATOR } from "../constants/mathOperator";

import { COMMON_EVENT, getServiceEventType } from "./eventHelper";
import { AGGREGATE_TYPE } from "./aggregateHelper";
import { isObjectId, isEmail, getServiceCode } from "./commonHelper";
import { EMAIL_LIST_SEPARATOR, getEmailByField, getNextStateUserList, sendEmail } from "./emailHelper";
import { dataMerge } from "./modelHelper";
import { triggerWorkflow, canTriggerWorkflow } from "./workflowHelper";
import BosError, { BOS_ERROR } from "./errorHelper";
import serviceModelList from "./modelHelper";
import sb from "./serviceBusHelper";
import apm from "./apmHelper";
import { checkFieldPermission, checkRecordPermission, mergeUserPermissionListAndHisQuery } from "./policyHelper";
import {
  API_ACTION_CODE,
  ID_PARAM,
  ACTION_CODE_PARAM,
  REQUEST_QUERY,
  REQUEST_BODY,
  TEMPLATE_PARAM,
  CREATE_RESPONSE,
  UPDATE_RESPONSE,
  COMMON_RESPONSE,
  EXPORT_RESPONSE,
  AGGREGATE_RESPONSE,
  TRIGGER_WORKFLOW_RESPONSE,
  POST_RESPONSE,
  REVERSE_RESPONSE,
  GET_LIST_RESPONSE,
  GET_BY_ID_RESPONSE,
  DELETE_RESPONSE,
  PRINT_RESPONSE,
  parseModelSchema,
  generateSwagger,
} from "./swaggerHelper";
import { getExcelBuffer } from "./excelHelper";
import { templateRender, templateConfig, handlebarString } from "./templateHelper";

const serviceBusDebugger = debug("app:sb");
const appBizDebugger = debug("app:biz");

export const FULL_FIELD_LIST = "*";
export const QUERY_RESERVED_FIELDS = ["limit", "offset", "sortBy", "fields"];
export const WORKFLOW_ACTION_CODE_PARAM = "workflowActionCode";
export const PRINTING_TEMPLATE_PARAM = "template";
export const AGGREGATE_FUNCTION_CODE_PARAM = "aggregateFunctionCode";

// can SEARCH by requestFieldList filter
export const getQueryPermission = async (schema, context, requestFieldList) => {
  if (!schema) {
    throw new BosError("schema is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const span = apm.startSpan("getQueryPermission");

  const AccessListModel = mongoose.model("sysAccessLists");
  const UserFeatureModel = mongoose.model("sysUserFeatures");

  const { serviceCode, apiActionCode: actionCode, userId, isAdmin, functionId, policyContext } = context;

  if (!userId) {
    throw new BosError("userId is not correct.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!functionId) {
    throw new BosError("functionId is not correct.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const userFeature = await UserFeatureModel.findOne({ userId }, { userFeatureList: 1 }).lean();
  const userFeatureList = userFeature ? userFeature.userFeatureList : [];

  span && span.addLabels({ isAdmin });

  if (isAdmin) {
    // full permission
    appBizDebugger("user is admin => full permission.");

    span && span.end();

    return [
      {
        allowedRequestFieldList: [],
        allowedResponseFieldList: [],
        userFeatureList,
        recordFeatureList: [],
      },
    ];
  }

  const accessList = await AccessListModel.find({
    userId,
    functionId,
    serviceCode,
    actionCode,

    context: {
      $in: ["", policyContext],
    },
  }).lean();

  const accessListCount = accessList ? accessList.length : 0;
  const finalAccessList = [];

  span && span.addLabels({ accessListCount });

  appBizDebugger("accessListCount count: ", accessListCount);

  if (!accessListCount) {
    throw new BosError(
      `Not found accessList for (userId: ${userId}, functionId: ${functionId}, serviceCode: ${serviceCode}, actionCode: ${actionCode}, context: ${policyContext || `''`}).`,
      BOS_ERROR.FORBIDDEN,
      HTTP_RESPONSE_CODE.FORBIDDEN
    );
  }

  for (let perm of accessList) {
    const allowedFieldList = normalizeFieldListQuery(schema, perm.allowedResponseFieldList);
    const fieldListIsOk = checkFieldPermission(requestFieldList, allowedFieldList);

    span && span.addLabels({ fieldListIsOk });
    appBizDebugger("fieldListIsOk", fieldListIsOk);

    if (fieldListIsOk) {
      finalAccessList.push({
        ...perm,
        userFeatureList,
      });
    }
  }

  span && span.end();
  return finalAccessList;
};

// can CREATE / READ / UPDATE / DELETE / ... record by Id
export const getCRUDPermission = async (context, requestFieldList, dataObject, apiParam) => {
  const AccessListModel = mongoose.model("sysAccessLists");
  const UserFeatureModel = mongoose.model("sysUserFeatures");

  const span = apm.startSpan("getCRUDPermission");

  const { serviceCode, apiActionCode: actionCode, userId, isAdmin, functionId } = context;

  if (!userId) {
    throw new BosError("userId is not correct.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!functionId) {
    throw new BosError("functionId is not correct.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const userFeature = await UserFeatureModel.findOne({ userId }, { userFeatureList: 1 }).lean();
  const userFeatureList = userFeature ? userFeature.userFeatureList : [];

  if (isAdmin) {
    // full permission
    appBizDebugger("user is admin => full permission.");

    return {
      allowedRequestFieldList: [FULL_FIELD_LIST],
      allowedResponseFieldList: [FULL_FIELD_LIST],
      userFeatureList,
      recordFeatureList: [],
    };
  }

  span &&
    span.addLabels({
      userId,
      functionId,
      serviceCode,
      actionCode,
    });

  appBizDebugger("getCRUDPermission");
  appBizDebugger("apiActionCode", actionCode);

  const accessList = await AccessListModel.find({
    userId,
    functionId,
    serviceCode,
    actionCode,
  }).lean();

  const accessListCount = accessList ? accessList.length : 0;

  span &&
    span.addLabels({
      accessListCount,
    });

  appBizDebugger("accessList count: ", accessListCount);

  if (!accessListCount) {
    // throw new BosError(`Not found accessList for (userId: ${userId}, functionId: ${functionId}, actionCode: ${actionCode}).`, BOS_ERROR.FORBIDDEN);
    span && span.end();
    return null;
  }

  for (let i = 0; i < accessListCount; i += 1) {
    const { allowedRequestFieldList, recordFeatureList, apiFeatureList } = accessList[i];
    const fieldListIsOk = checkFieldPermission(requestFieldList, allowedRequestFieldList);
    const recordIsOk = checkRecordPermission(dataObject, userFeatureList, recordFeatureList);
    const apiParamIsOk = apiParam && apiFeatureList && apiFeatureList.length ? checkRecordPermission(apiParam, userFeatureList, apiFeatureList) : true;

    // TODO: API data validator

    appBizDebugger("fieldListIsOk", fieldListIsOk);
    appBizDebugger("recordIsOk", recordIsOk);
    appBizDebugger("apiParamIsOk", apiParamIsOk);

    if (fieldListIsOk && recordIsOk && apiParamIsOk) {
      span && span.end();
      return accessList[i];
    }
  }

  span && span.end();
  return null;
};

export const healthCheckController = (req, res, next) => {
  if (mongoose.connection.readyState && sb.isConnected()) {
    res.json({
      status: "Hi! I'm good!",
    });
  } else {
    res.sendStatus(HTTP_RESPONSE_CODE.INTERNAL_SERVER_ERROR);
  }
};

export const swaggerController = (req, res, next) => {
  try {
    const span = apm.startSpan("swaggerController");

    const { context } = req;
    const { serviceCode, modelName, version } = context;
    const model = serviceModelList[serviceCode];

    if (!model) {
      throw new BosError("model is undefined.", BOS_ERROR.INVALID_ARG_VALUE, HTTP_RESPONSE_CODE.BAD_REQUEST);
    }

    const { data, apiList, scheduleList } = model;

    if (!data) {
      throw new BosError("model's data schema is undefined", BOS_ERROR.INVALID_ARG_VALUE);
    }

    const { requiredFieldList, definition } = parseModelSchema(data); // TODO: sub-document split
    const swagger = generateSwagger(modelName, version, apiList || API_LIST.CRUD, requiredFieldList, definition, scheduleList);

    if (!swagger) {
      throw new BosError("swagger can't be generated", BOS_ERROR.UNHANDLED_ERROR, HTTP_RESPONSE_CODE.SERVICE_UNAVAILABLE);
    }

    span && span.end();
    res.json(swagger);
  } catch (error) {
    apm.captureError(error);
    next(error);
  }
};

export const idParamController = async (req, res, next, id) => {
  try {
    const span = apm.startSpan("idParamController");

    if (!isObjectId(id)) {
      throw new BosError(`idParam "${id}" is not a correct id.`, BOS_ERROR.INVALID_ARG_VALUE, HTTP_RESPONSE_CODE.UNPROCESSABLE_ENTITY);
    }

    const { modelName } = req.context;
    const RequestedDataModel = mongoose.model(modelName);

    const dataObject = await RequestedDataModel.findOne({
      _id: id,
      deleted: {
        $ne: true,
      },
    });

    if (!dataObject) {
      throw new BosError(`Can\'t find ${modelName} by id ${id}.`, BOS_ERROR.NOT_FOUND, HTTP_RESPONSE_CODE.NOT_FOUND);
    }

    req.dataObject = dataObject;

    span && span.end();
    next(null);
  } catch (error) {
    apm.captureError(error);
    next(error);
  }
};

export const workflowActionCodeParamController = async (req, res, next, workflowActionCode) => {
  if (!workflowActionCode) {
    throw new BosError("workflowActionCode is undefined.", BOS_ERROR.INVALID_WORK_FLOW, HTTP_RESPONSE_CODE.UNPROCESSABLE_ENTITY);
  }

  req.context.workflowActionCode = workflowActionCode;
  next();
};

export const aggregateFunctionCodeParamController = async (req, res, next, aggregateFunctionCode) => {
  if (!aggregateFunctionCode) {
    throw new BosError("aggregateFunctionCode is undefined.", BOS_ERROR.INVALID_WORK_FLOW, HTTP_RESPONSE_CODE.UNPROCESSABLE_ENTITY);
  }

  req.context.aggregateFunctionCode = aggregateFunctionCode;
  next();
};

export const printingTemplateParamController = async (req, res, next, printingTemplate) => {
  if (!printingTemplate) {
    throw new BosError("printingTemplate is undefined.", BOS_ERROR.INVALID_WORK_FLOW, HTTP_RESPONSE_CODE.UNPROCESSABLE_ENTITY);
  }

  req.context.printingTemplate = printingTemplate;
  next();
};

export const normalizeFieldListQuery = (schema, fieldList, excludedList = null) => {
  const span = apm.startSpan("normalizeFieldListQuery");
  appBizDebugger("normalizeFieldListQuery");

  if (!schema) {
    throw new BosError("schema is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (isArray(fieldList)) {
    appBizDebugger("fieldList is array");
    span && span.end();
    return fieldList;
  }

  const notPickedFieldList = isArray(excludedList) ? [...excludedList] : [];

  Object.entries(schema).forEach(([key, def]) => {
    const { picked, virtual } = def;

    if (picked === false || virtual) {
      notPickedFieldList.push(key);
    }
  });

  if (!fieldList) {
    span && span.end();
    return difference(Object.keys(schema), notPickedFieldList); // get all pickable fields
  }

  const normalizeFieldList = isString(fieldList) ? fieldList.replace(/ /g, "").split(",") : [];

  span && span.end();
  return difference(normalizeFieldList, notPickedFieldList);
};

export const convertIntoMongoSelect = (fieldList) => {
  if (!isArray(fieldList)) {
    throw new BosError("fieldList is not a array", BOS_ERROR.INVALID_ARG_TYPE);
  }

  const fieldSet = {};

  fieldList.forEach((field) => {
    fieldSet[field] = 1;
  });

  return fieldSet;
};

export const convertIntoMongoGroupId = (fieldList) => {
  if (!isArray(fieldList)) {
    throw new BosError("fieldList is not a array", BOS_ERROR.INVALID_ARG_TYPE);
  }

  const fieldCount = fieldList.length;

  switch (fieldCount) {
    case 0: {
      throw new BosError("fieldList is not a array", BOS_ERROR.INVALID_ARG_TYPE);
    }

    case 1: {
      return `$${fieldList[0]}`;
    }

    default: {
      const fieldSet = {};

      fieldList.forEach((field) => {
        fieldSet[field] = `$${field}`;
      });

      return fieldSet;
    }
  }
};

export const normalizeUserQuery = (schema, query, stringExactMatch = false) => {
  const span = apm.startSpan("normalizeUserQuery");

  const condition = {
    deleted: {
      // reject deleted record
      $ne: true,
    },
  };

  Object.entries(query).forEach(([key, value]) => {
    if (QUERY_RESERVED_FIELDS.indexOf(key) < 0) {
      const splittedFieldKey = key.split(".");
      const rootFieldKey = splittedFieldKey[0];
      const extFieldKey = splittedFieldKey.length > 1 ? splittedFieldKey[1] : "";
      const field = schema[rootFieldKey]; // check type of try to search sub-document

      if (!isUndefined(field)) {
        const { type, picked } = field;

        if (picked === false) {
          return;
        }

        if (isArray(value)) {
          condition[key] = { $in: value };
        } else if (value) {
          if (value.$exists) {
            condition[key] = {};
            condition[key].$exists = value.$exists === "true";
          } else {
            switch (type) {
              case DATA_TYPE.SEQUENCE: {
                if (isString(value) && !stringExactMatch) {
                  condition[key] = { $regex: `${value}$`, $options: "mi" }; // ends with..
                } else {
                  condition[key] = value;
                }

                break;
              }

              case DATA_TYPE.STRING: {
                if (isString(value) && !stringExactMatch) {
                  condition[key] = { $regex: value, $options: "i" }; // contains..
                } else {
                  condition[key] = value;
                }

                break;
              }

              case DATA_TYPE.ID: {
                if (isObject(value)) {
                  condition[key] = value;
                } else if (isObjectId(value)) {
                  condition[key] = mongoose.Types.ObjectId(value);
                }

                break;
              }

              case DATA_TYPE.BOOL:
              case DATA_TYPE.BOOLEAN: {
                if (isObject(value)) {
                  condition[key] = value;
                } else if (value !== null && value !== "" && typeof value !== "undefined") {
                  condition[key] = String(value).toLowerCase() === "true"; // fix aggregate match not working if direct assign
                }

                break;
              }

              case DATA_TYPE.DATE:
              case DATA_TYPE.DATE_TIME: {
                let dateLookup;
                const isObjectValue = isObject(value);

                if (isObjectValue) {
                  dateLookup = {};
                  for (const [op, val] of Object.entries(value)) {
                    dateLookup[op] = new Date(val);
                  }
                } else {
                  const dtValue = new Date(value);

                  switch (extFieldKey) {
                    case OPERATOR.LT: {
                      dateLookup = { $lt: dtValue };
                      break;
                    }

                    case OPERATOR.LTE: {
                      dateLookup = { $lte: dtValue };
                      break;
                    }

                    case OPERATOR.GT: {
                      dateLookup = { $gt: dtValue };
                      break;
                    }

                    case OPERATOR.GTE: {
                      dateLookup = { $gte: dtValue };
                      break;
                    }

                    default: {
                      dateLookup = { $eq: dtValue };
                      break;
                    }
                  }
                }

                if (isUndefined(condition[rootFieldKey])) {
                  condition[rootFieldKey] = dateLookup;
                } else {
                  condition[rootFieldKey] = extend(condition[rootFieldKey], dateLookup);
                }

                break;
              }

              case DATA_TYPE.NUMBER: {
                let numberLookup;
                const isObjectValue = isObject(value);

                if (isObjectValue) {
                  numberLookup = {};
                  for (const [op, val] of Object.entries(value)) {
                    numberLookup[op] = val;
                  }
                } else {
                  const dtValue = new Number(value);

                  switch (extFieldKey) {
                    case OPERATOR.LT: {
                      numberLookup = { $lt: dtValue };
                      break;
                    }

                    case OPERATOR.LTE: {
                      numberLookup = { $lte: dtValue };
                      break;
                    }

                    case OPERATOR.GT: {
                      numberLookup = { $gt: dtValue };
                      break;
                    }

                    case OPERATOR.GTE: {
                      numberLookup = { $gte: dtValue };
                      break;
                    }

                    default: {
                      numberLookup = { $eq: dtValue };
                      break;
                    }
                  }
                }

                if (isUndefined(condition[rootFieldKey])) {
                  condition[rootFieldKey] = numberLookup;
                } else {
                  condition[rootFieldKey] = extend(condition[rootFieldKey], numberLookup);
                }

                break;
              }

              default: {
                condition[key] = value;
                break;
              }
            }
          }
        }
      } else if (key === "_id") {
        condition._id = value;
      } else if (key === OPERATOR.OR || key === "$and") {
        // mongo query
        condition[key] = value;
      }
    }
  });

  span && span.end();
  return condition;
};

export const normalizeUserOrderBy = (schema, sortBy) => {
  const span = apm.startSpan("normalizeUserOrderBy");
  const sortBySet = {};

  if (sortBy) {
    sortBy.split(",").forEach((condition) => {
      const field = condition.trim();

      if (field) {
        const splitCondition = field.split("."); // template: fieldName.desc / fieldName.asc
        const orderBy = splitCondition[0];

        if (orderBy) {
          // TODO: fix modelHelper issue & change to "schema[orderBy]"
          let orderDirection;

          if (splitCondition.length === 2) {
            if (splitCondition[1] === "desc") {
              orderDirection = -1;
            } else {
              orderDirection = 1;
            }
          } else {
            orderDirection = 1;
          }
          sortBySet[orderBy] = orderDirection;
        }
      }
    });
  } else {
    // auto sort by Id
    sortBySet._id = -1;
  }

  span && span.end();
  return sortBySet;
};

export const queryHandler = async (req, callback) => {
  const span = apm.startSpan("queryHandler");
  const { context, query } = req;
  const { serviceCode, modelName } = context;
  const model = serviceModelList[serviceCode];

  if (!model) {
    throw new BosError("model is undefined.", BOS_ERROR.INVALID_ARG_VALUE, HTTP_RESPONSE_CODE.BAD_REQUEST);
  }

  const dataSchema = model.data;
  const { fields, sortBy, limit, offset } = query;
  const dataQuery = normalizeUserQuery(dataSchema, query);
  const requestFieldList = normalizeFieldListQuery(dataSchema, fields);
  const sortBySet = normalizeUserOrderBy(dataSchema, sortBy);
  const findingLimit = isNaN(limit) ? UNLIMITED_RETURNED_RESULT : Number(limit);
  const findingOffset = isNaN(offset) ? 0 : Number(offset);
  const permissionList = await getQueryPermission(dataSchema, context, requestFieldList);
  const permissionListLength = isArray(permissionList) ? permissionList.length : 0;

  appBizDebugger(`context: ${JSON.stringify(context)}`);
  appBizDebugger(`requestFieldList: ${JSON.stringify(requestFieldList)}`);
  appBizDebugger(`=> found permissionList count: ${permissionListLength}`);

  span &&
    span.addLabels({
      requestFieldList: JSON.stringify(requestFieldList),
      permissionListLength,
    });

  if (permissionList.length === 0) {
    throw new BosError("Can not get permission list", BOS_ERROR.FORBIDDEN, HTTP_RESPONSE_CODE.FORBIDDEN);
  }

  const RequestedDataModel = mongoose.model(modelName);
  const mongoFieldSet = convertIntoMongoSelect(requestFieldList); // TODO: prevent query "picked = false" fields
  const mergedQueryList = mergeUserPermissionListAndHisQuery(permissionList, dataQuery);
  const mergedQueryListLength = mergedQueryList.length;
  let mongoQuery;

  switch (mergedQueryListLength) {
    case 0: {
      mongoQuery = {};
      break;
    }

    case 1: {
      mongoQuery = mergedQueryList[0];
      break;
    }

    default: {
      mongoQuery = {
        $or: mergedQueryList,
      };

      break;
    }
  }

  span &&
    span.addLabels({
      mergedQueryListLength,
      mongoQuery: JSON.stringify(mongoQuery),
      mongoFieldSet: JSON.stringify(mongoFieldSet),
      findingLimit,
      findingOffset,
      sortBySet: JSON.stringify(sortBySet),
    });

  const length = await RequestedDataModel.count(mongoQuery).exec();

  const data = await RequestedDataModel.find(mongoQuery).select(mongoFieldSet).limit(findingLimit).skip(findingOffset).sort(sortBySet).lean();

  callback(modelName, mongoQuery, requestFieldList, findingOffset, findingLimit, data, length);

  span && span.end();
};

export const queryWithoutPermissionHandler = async (req, callback) => {
  const span = apm.startSpan("queryHandler");
  const { context, query } = req;
  const { supportingServiceCode } = context;
  const modelName = supportingServiceCode;
  const model = serviceModelList[getServiceCode(supportingServiceCode, 1)];

  if (!model) {
    throw new BosError("model is undefined.", BOS_ERROR.INVALID_ARG_VALUE, HTTP_RESPONSE_CODE.BAD_REQUEST);
  }

  const dataSchema = model.data;

  const { fields, sortBy, limit, offset } = query;

  const dataQuery = normalizeUserQuery(dataSchema, query);
  const requestFieldList = normalizeFieldListQuery(dataSchema, fields);
  const sortBySet = normalizeUserOrderBy(dataSchema, sortBy);
  const findingLimit = isNaN(limit) ? UNLIMITED_RETURNED_RESULT : Number(limit);
  const findingOffset = isNaN(offset) ? 0 : Number(offset);

  appBizDebugger(`context: ${JSON.stringify(context)}`);
  appBizDebugger(`requestFieldList: ${JSON.stringify(requestFieldList)}`);

  const RequestedDataModel = mongoose.model(modelName);
  const mongoFieldSet = convertIntoMongoSelect(requestFieldList); // TODO: prevent query "picked = false" fields
  const mergedQueryList = [dataQuery];
  const mergedQueryListLength = mergedQueryList.length;
  let mongoQuery;

  switch (mergedQueryListLength) {
    case 0: {
      mongoQuery = {};
      break;
    }

    case 1: {
      mongoQuery = mergedQueryList[0];
      break;
    }

    default: {
      mongoQuery = {
        $or: mergedQueryList,
      };

      break;
    }
  }

  span &&
    span.addLabels({
      mergedQueryListLength,
      mongoQuery: JSON.stringify(mongoQuery),
      mongoFieldSet: JSON.stringify(mongoFieldSet),
      findingLimit,
      findingOffset,
      sortBySet: JSON.stringify(sortBySet),
    });

  const length = await RequestedDataModel.count(mongoQuery).exec();
  const data = await RequestedDataModel.find(mongoQuery).select(mongoFieldSet).limit(findingLimit).skip(findingOffset).sort(sortBySet).lean();

  callback(modelName, mongoQuery, requestFieldList, findingOffset, findingLimit, data, length);

  span && span.end();
};

export const getListController = async (req, res, next) => {
  try {
    const { context, query } = req;
    const { checkPermission, batchActionList } = query;
    const { serviceCode } = context;
    const model = serviceModelList[serviceCode];
    let getListCallback;

    const getListRelatedAction = batchActionList ? batchActionList : [];

    if (!model) {
      throw new BosError("model is undefined.", BOS_ERROR.INVALID_ARG_VALUE, HTTP_RESPONSE_CODE.BAD_REQUEST);
    }

    if (!checkPermission) {
      getListCallback = (modelName, mongoQuery, fields, offset, limit, data, length) =>
        res.json({
          modelName,

          query: {
            ...mongoQuery,

            fields,
            offset,
            limit,
          },

          data,
          length,
        });
    } else {
      const span = apm.startSpan("getListController");

      const { apiList } = model;
      const normalizedApiList = apiList || API_LIST.CRUD; // default is CRUD

      span && span.addLabels({ normalizedApiList: JSON.stringify(normalizedApiList) });
      appBizDebugger(`normalizedApiList: ${JSON.stringify(normalizedApiList)}`);

      const testedApiActionCodeList = intersection(
        normalizedApiList.map((a) => a.operationId),

        [API_ACTION_CODE.CREATE, API_ACTION_CODE.DELETE, API_ACTION_CODE.EXPORT, API_ACTION_CODE.PRINT, ...getListRelatedAction]
      ); // check "list screen" related actions only

      const allowedApiActionSet = new Set();

      span && span.addLabels({ testedApiActionCodeList: JSON.stringify(testedApiActionCodeList) });
      appBizDebugger(`testedApiActionCodeList: ${JSON.stringify(testedApiActionCodeList)}`);

      for (const apiActionCode of testedApiActionCodeList) {
        try {
          const testedContext = {
            ...context,
            apiActionCode,
          };

          span && span.addLabels({ testedContext: JSON.stringify(testedContext) });

          const perm = await getCRUDPermission(testedContext, [], {});

          if (perm) {
            allowedApiActionSet.add(apiActionCode);
          }
        } catch (error) {
          span && span.addLabels({ error });
          appBizDebugger(`getListController.error: ${error}`);
          // just test => do nothing
        }
      }

      span && span.addLabels({ allowedApiActionSet: JSON.stringify(allowedApiActionSet) });
      appBizDebugger(`allowedApiActionSet: ${JSON.stringify(allowedApiActionSet)}`);

      span && span.end();

      getListCallback = (modelName, mongoQuery, fields, offset, limit, data, length) =>
        res.json({
          modelName,

          query: {
            ...mongoQuery,

            fields,
            offset,
            limit,
          },

          data,
          length,
          allowedApiActionList: [...allowedApiActionSet],
        });
    }

    context.apiActionCode = API_ACTION_CODE.GET_LIST;

    await queryHandler(req, getListCallback);
  } catch (error) {
    console.log("error", error);
    next(error);
  }
};

export const exportController = (req, res, next) => {
  try {
    const { context } = req;
    const { serviceCode } = context;
    const model = serviceModelList[serviceCode];
    const span = apm.startSpan("exportController");

    const callback = (modelName, mongoQuery, fields, offset, limit, data, length) => {
      // TODO: check max export file length
      const excelData = getExcelBuffer(model.data, fields, data);

      res.send(excelData);
      res.end();

      span && span.end();
    };

    req.context.apiActionCode = API_ACTION_CODE.EXPORT;

    queryHandler(req, callback);
  } catch (error) {
    apm.captureError(error);
    next(error);
  }
};

export const aggregateHandler = async (req, res, next) => {
  try {
    const span = apm.startSpan("aggregateHandler");
    const { context, query } = req;
    const { serviceCode, modelName } = context;
    const model = serviceModelList[serviceCode];

    if (!model) {
      throw new BosError("model is undefined.", BOS_ERROR.INVALID_ARG_VALUE, HTTP_RESPONSE_CODE.BAD_REQUEST);
    }

    context.apiActionCode = API_ACTION_CODE.AGGREGATE; // share getList with aggregate perm

    const dataSchema = model.data;
    const { aggregateFunctionCode } = context;
    const { groupBy } = query;
    const dataQuery = normalizeUserQuery(dataSchema, query, true);
    const requestFieldList = normalizeFieldListQuery(dataSchema, groupBy);
    const permissionList = await getQueryPermission(dataSchema, context, requestFieldList);
    const permissionListLength = isArray(permissionList) ? permissionList.length : 0;

    appBizDebugger(`context: ${JSON.stringify(context)}`);
    appBizDebugger(`requestFieldList: ${JSON.stringify(requestFieldList)}`);
    appBizDebugger(`=> found permissionList count: ${permissionListLength}`);

    span &&
      span.addLabels({
        requestFieldList: JSON.stringify(requestFieldList),
        permissionListLength,
      });

    if (permissionList.length === 0) {
      throw new BosError("Can not get permission list", BOS_ERROR.FORBIDDEN, HTTP_RESPONSE_CODE.FORBIDDEN);
    }

    const RequestedDataModel = mongoose.model(modelName);
    const mongoGroupId = convertIntoMongoGroupId(requestFieldList); // TODO: prevent query "picked = false" fields
    const mergedQueryList = mergeUserPermissionListAndHisQuery(permissionList, dataQuery);
    const mergedQueryListLength = mergedQueryList.length;
    let mongoMatch;

    switch (mergedQueryListLength) {
      case 0: {
        mongoMatch = {};
        break;
      }

      case 1: {
        mongoMatch = mergedQueryList[0];
        break;
      }

      default: {
        mongoMatch = {
          $or: mergedQueryList,
        };

        break;
      }
    }

    let mongoStageList = [];

    switch (aggregateFunctionCode) {
      case AGGREGATE_TYPE.COUNT: {
        mongoStageList = [
          {
            $match: mongoMatch,
          },

          {
            $group: {
              _id: mongoGroupId,
              count: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              _id: -1,
            },
          },
        ];

        break;
      }

      case AGGREGATE_TYPE.COUNT_PER_DAY: {
        mongoStageList = [
          {
            $match: {
              createdAt: {
                $gte: new Date(new Date().getTime() - 1000 * 3600 * 24 * 14),
              },
            },
          },

          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              count: {
                $sum: 1,
              },
            },
          },

          {
            $match: {
              count: {
                $gt: 0,
              },
            },
          },

          {
            $sort: {
              _id: 1,
            },
          },

          {
            $limit: 10,
          },
        ];

        break;
      }

      default: {
        throw new BosError(`aggregateFunctionCode "${aggregateFunctionCode}" is invalidate`, BOS_ERROR.INVALID_ARG_VALUE, HTTP_RESPONSE_CODE.UNPROCESSABLE_ENTITY);
      }
    }

    span &&
      span.addLabels({
        aggregateFunctionCode,
      });

    const data = await RequestedDataModel.aggregate(mongoStageList);

    res.json({
      modelName,
      aggregateStages: mongoStageList,
      data,
    });

    span && span.end();
  } catch (error) {
    apm.captureError(error);

    next(error);
  }
};

export const checkDataObjectPermission = async (context, model, dataObject) => {
  const span = apm.startSpan("checkDataObjectPermission");
  const { serviceCode, functionId, userId, isAdmin } = context;
  const { apiList, workflow } = model;
  const normalizedApiList = apiList || API_LIST.CRUD; // default is CRUD

  span &&
    span.addLabels({
      normalizedApiList: JSON.stringify(normalizedApiList),
      isAdmin,
    });

  appBizDebugger(`normalizedApiList: ${normalizedApiList}`);
  appBizDebugger(`isAdmin: ${isAdmin}`);

  let hasWorkflow = false;

  if (normalizedApiList.findIndex((a) => a.operationId === API_ACTION_CODE.TRIGGER_WORKFLOW) > -1) {
    hasWorkflow = true;

    if (!workflow) {
      throw new BosError("workflow is undefined.", BOS_ERROR.INVALID_WORK_FLOW, HTTP_RESPONSE_CODE.SERVICE_UNAVAILABLE);
    }
  }

  const allowedApiActionSet = new Set();
  const allowedWorkflowActionSet = new Set();

  if (!isAdmin) {
    const workflowActionCodeSet = new Set(); // user config workflowActionCode

    span &&
      span.addLabels({
        hasWorkflow,
      });

    appBizDebugger(`hasWorkflow: ${hasWorkflow}`);

    if (hasWorkflow) {
      const AccessListModel = mongoose.model("sysAccessLists");

      const triggerWorkflowAccessList = await AccessListModel.find(
        {
          serviceCode,
          functionId,
          userId,
          actionCode: API_ACTION_CODE.TRIGGER_WORKFLOW,
        },
        {}
      ).lean();

      if (!triggerWorkflowAccessList) {
        throw new BosError("triggerWorkflowAccessList is empty", BOS_ERROR.FORBIDDEN, HTTP_RESPONSE_CODE.FORBIDDEN);
      }

      let hasFullWorkflowActionCode = false;
      const fullWorkflowActionCodeSet = new Set();

      const { transitionList, stateField } = workflow;
      const currentState = dataObject[stateField];

      if (isArray(transitionList)) {
        transitionList.forEach((transition) => {
          const { fromState, actionCode } = transition;

          if (fromState === currentState) {
            fullWorkflowActionCodeSet.add(actionCode);
          }
        });
      }

      span &&
        span.addLabels({
          fullWorkflowActionCodeSet: JSON.stringify(fullWorkflowActionCodeSet),
        });

      appBizDebugger(`fullWorkflowActionCodeSet: ${fullWorkflowActionCodeSet}`);

      for (const perm of triggerWorkflowAccessList) {
        // check api permission
        const { apiFeatureList } = perm;
        const workflowActionCodeFeature = apiFeatureList ? apiFeatureList.filter((f) => f.featureName === WORKFLOW_ACTION_CODE_PARAM) : [];
        const workflowActionCodeFeatureLength = workflowActionCodeFeature.length;

        span &&
          span.addLabels({
            "triggerWorkflowAccessList.perm": JSON.stringify(perm),
            "triggerWorkflowAccessList.apiFeatureList": JSON.stringify(apiFeatureList),
            workflowActionCodeFeature: JSON.stringify(workflowActionCodeFeature),
            workflowActionCodeFeatureLength,
          });

        appBizDebugger(`triggerWorkflowAccessList perm: ${JSON.stringify(perm)}`);
        appBizDebugger(`triggerWorkflowAccessList apiFeatureList: ${JSON.stringify(apiFeatureList)}`);
        appBizDebugger(`workflowActionCodeFeature: ${JSON.stringify(workflowActionCodeFeature)}`);
        appBizDebugger(`workflowActionCodeFeature.length === ${workflowActionCodeFeatureLength}`);

        if (workflowActionCodeFeatureLength === 0) {
          // not found
          hasFullWorkflowActionCode = true;
        } else {
          workflowActionCodeFeature.forEach((apiFeature) => {
            // find workflow action code
            const { selectedValueList, selectedOperator } = apiFeature; // TODO: other api feature operator

            span &&
              span.addLabels({
                selectedValueList: JSON.stringify(selectedValueList),
                selectedOperator: JSON.stringify(selectedOperator),
              });

            appBizDebugger(`selectedValueList: ${selectedValueList}`);
            appBizDebugger(`selectedOperator: ${selectedOperator}`);

            switch (selectedOperator) {
              case OPERATOR.IN: {
                selectedValueList.split(",").forEach((action) => {
                  workflowActionCodeSet.add(action);
                });

                break;
              }

              case OPERATOR.NOT_IN: {
                difference([...fullWorkflowActionCodeSet], selectedValueList.split(",")).forEach((action) => {
                  workflowActionCodeSet.add(action);
                });

                break;
              }

              default: {
                workflowActionCodeSet.add(selectedValueList);
                break;
              }
            }
          });
        }
      }

      if (hasFullWorkflowActionCode) {
        [...fullWorkflowActionCodeSet].forEach((actionCode) => {
          workflowActionCodeSet.add(actionCode);
        });
      }

      span &&
        span.addLabels({
          workflowActionCodeSet: JSON.stringify(workflowActionCodeSet),
        });

      appBizDebugger(`workflowActionCodeSet: ${JSON.stringify(workflowActionCodeSet)}`);

      for (const workflowActionCode of [...workflowActionCodeSet]) {
        try {
          const testedContext = {
            ...context,
            workflow,
            apiActionCode: API_ACTION_CODE.TRIGGER_WORKFLOW,
            workflowActionCode,
          };

          const perm = await getCRUDPermission(testedContext, [], dataObject, { [WORKFLOW_ACTION_CODE_PARAM]: workflowActionCode });

          if (perm && canTriggerWorkflow(testedContext, dataObject)) {
            allowedApiActionSet.add(API_ACTION_CODE.TRIGGER_WORKFLOW);
            allowedWorkflowActionSet.add(workflowActionCode);
          }
        } catch (error) {
          apm.captureError(error);

          console.log("getCRUDPermission.error", error);
          // just test => do nothing
        }
      }
    }

    const testedApiActionCodeList = difference(
      normalizedApiList.map((a) => a.operationId),

      [API_ACTION_CODE.CREATE, API_ACTION_CODE.GET_LIST, API_ACTION_CODE.TRIGGER_WORKFLOW]
    ); // skip CREATE / TRIGGER_WORKFLOW APIs

    for (const apiActionCode of testedApiActionCodeList) {
      try {
        const testedContext = {
          ...context,
          apiActionCode,
        };

        const perm = await getCRUDPermission(testedContext, [], dataObject, {});

        if (perm) {
          allowedApiActionSet.add(apiActionCode);
        }
      } catch (error) {
        apm.captureError(error);

        console.log("getCRUDPermission.error", error);
        // just test => do nothing
      }
    }
  }

  span &&
    span.addLabels({
      allowedApiActionSet: JSON.stringify(allowedApiActionSet),
      allowedWorkflowActionSet: JSON.stringify(allowedWorkflowActionSet),
    });

  appBizDebugger(`allowedApiActionSet: ${JSON.stringify(allowedApiActionSet)}`);
  appBizDebugger(`allowedWorkflowActionSet: ${JSON.stringify(allowedWorkflowActionSet)}`);

  span && span.end();

  return {
    allowedApiActionList: [...allowedApiActionSet],
    allowedWorkflowActionList: [...allowedWorkflowActionSet],
  };
};

export const getByIdController = async (req, res, next) => {
  try {
    const span = apm.startSpan("getByIdController");

    const { dataObject, context, query, params } = req;

    const { serviceCode } = context;
    const { checkPermission, fields } = query;
    const model = serviceModelList[serviceCode];

    if (!model) {
      throw new BosError("model is undefined.", BOS_ERROR.INVALID_ARG_VALUE, HTTP_RESPONSE_CODE.SERVICE_UNAVAILABLE);
    }

    const { data } = model;

    if (!data) {
      throw new BosError("data is undefined.", BOS_ERROR.INVALID_ARG_VALUE, HTTP_RESPONSE_CODE.SERVICE_UNAVAILABLE);
    }

    context.apiActionCode = API_ACTION_CODE.GET_BY_ID;

    const requestFieldList = normalizeFieldListQuery(data, fields);
    let perm = await getCRUDPermission(context, requestFieldList, dataObject, params);

    if (!perm) {
      throw new BosError("Can not get permission list", BOS_ERROR.FORBIDDEN, HTTP_RESPONSE_CODE.FORBIDDEN);
    }

    if (!checkPermission) {
      span && span.end();

      return res.json({
        data: pick(dataObject, requestFieldList),
      });
    }

    span && span.end();

    return res.json({
      data: pick(dataObject, requestFieldList),
      ...(await checkDataObjectPermission(context, model, dataObject)),
    });
  } catch (error) {
    apm.captureError(error);

    next(error);
  }
};

export const createController = async (req, res, next) => {
  try {
    const span = apm.startSpan("createController");
    const { context, body } = req;

    const { serviceCode, modelName, version, userId, userName, fullName, traceId } = context;

    const model = serviceModelList[serviceCode];

    if (!model) {
      throw new BosError("model is undefined.", BOS_ERROR.INVALID_ARG_VALUE, HTTP_RESPONSE_CODE.BAD_REQUEST);
    }

    const RequestedDataModel = mongoose.model(modelName);
    const dataObject = new RequestedDataModel();
    const requestFieldList = dataMerge(model.data, dataObject, body, false);

    context.apiActionCode = API_ACTION_CODE.CREATE;

    const perm = await getCRUDPermission(context, requestFieldList, dataObject);

    if (!perm) {
      throw new BosError("Can not get permission list", BOS_ERROR.FORBIDDEN, HTTP_RESPONSE_CODE.FORBIDDEN);
    }

    dataObject.active = true;
    dataObject.deleted = false;

    dataObject.createdBy = userId;
    dataObject.createdByUserName = userName;
    dataObject.createdByFullName = fullName;

    const newData = (await dataObject.save()).toObject();
    const eventType = getServiceEventType(modelName, COMMON_EVENT.CREATED, version);

    sb.publish(serviceCode, eventType, { model: serviceCode, oldData: {}, newData }, traceId, async (err) => {
      if (err) {
        // TODO: change the way to save data => skip validate saved data

        serviceBusDebugger(`[SB] Publish error: ${err}`);
        // TODO: send warning & logging message
      }

      res.json({
        data: newData,
        ...(await checkDataObjectPermission(context, model, newData)),
      });

      span && span.end();
    });
  } catch (error) {
    apm.captureError(error);

    next(error);
  }
};

export const updateController = async (req, res, next) => {
  try {
    const span = apm.startSpan("updateController");

    const { dataObject, context, body, params } = req;

    const { serviceCode, modelName, version, userId, userName, fullName, traceId } = context;

    const model = serviceModelList[serviceCode];

    if (!model) {
      throw new BosError("model is undefined.", BOS_ERROR.INVALID_ARG_VALUE, HTTP_RESPONSE_CODE.BAD_REQUEST);
    }

    // TODO: change the way to save data
    const oldData = clone(dataObject._doc);
    const changedFields = dataMerge(model.data, dataObject, body, true);

    context.apiActionCode = API_ACTION_CODE.UPDATE;

    const perm = await getCRUDPermission(context, changedFields, oldData, params);

    if (!perm) {
      throw new BosError("Can not get permission list", BOS_ERROR.FORBIDDEN, HTTP_RESPONSE_CODE.FORBIDDEN);
    }

    dataObject.updatedBy = userId;
    dataObject.updatedByUserName = userName;
    dataObject.updatedByFullName = fullName;

    const newData = (await dataObject.save()).toObject();
    const eventType = getServiceEventType(modelName, COMMON_EVENT.UPDATED, version);

    sb.publish(serviceCode, eventType, { model: serviceCode, oldData, newData, changedFields }, traceId, async (err) => {
      if (err) {
        // TODO: rollback saved data

        serviceBusDebugger(`[SB] Publish error: ${err}`);
        throw new BosError(err.message, BOS_ERROR.SB_CAN_NOT_PUBLISH);
      }

      res.json({
        data: newData,
        ...(await checkDataObjectPermission(context, model, newData)),
      });

      span && span.end();
    });
  } catch (error) {
    apm.captureError(error);

    next(error);
  }
};

export const deleteController = async (req, res, next) => {
  try {
    const span = apm.startSpan("deleteController");

    const { context, dataObject } = req;

    const { serviceCode, modelName, version, userId, userName, fullName, traceId } = context;

    const model = serviceModelList[serviceCode];

    if (!model) {
      throw new BosError("model is undefined.", BOS_ERROR.INVALID_ARG_VALUE, HTTP_RESPONSE_CODE.BAD_REQUEST);
    }

    context.apiActionCode = API_ACTION_CODE.DELETE;

    const perm = await getCRUDPermission(context, [], dataObject);

    if (!perm) {
      res.status(HTTP_RESPONSE_CODE.FORBIDDEN).json({ error: "Forbidden" });
      return;
    }

    // TODO: change the way to save data => skip validate saved data
    const now = new Date();
    const timeout = now;

    timeout.setMinutes(timeout.getMinutes() + DELETE_REJECT_TIME_OUT_DURATION);

    const { data: dataModel } = model;

    Object.entries(dataModel).forEach(([fieldName, def]) => {
      // fix duplicated sequence code
      if ([DATA_TYPE.STRING, DATA_TYPE.SEQUENCE].includes(def.type) && def.unique) {
        dataObject[fieldName] = String(dataObject._id).substr(18) + "-" + dataObject[fieldName];
      }
    });

    dataObject.deleteRejectTimeOut = timeout;
    dataObject.deleted = true;
    dataObject.deletedAt = now;
    dataObject.deletedBy = userId;
    dataObject.deletedByUserName = userName;
    dataObject.deletedByFullName = fullName;

    const newData = (await dataObject.save()).toObject();
    const eventType = getServiceEventType(modelName, COMMON_EVENT.DELETED, version);

    sb.publish(serviceCode, eventType, { model: serviceCode, oldData: newData }, traceId, (err) => {
      // TODO: add rejected service info
      if (err) {
        serviceBusDebugger(`[SB] Publish error: ${err}`);
        throw new BosError(err.message, BOS_ERROR.SB_CAN_NOT_PUBLISH);
      }

      res.sendStatus(HTTP_RESPONSE_CODE.OK);

      span && span.end();
    });
  } catch (error) {
    apm.captureError(error);

    next(error);
  }
};

export const printController = async (req, res, next) => {
  try {
    const span = apm.startSpan("printController");
    const { context, body } = req;
    const { serviceCode, modelName, printingTemplate } = context;
    const { objectIdList, printingOffset } = body;

    if (!objectIdList) {
      throw new BosError(`objectIdList is undefined.`, BOS_ERROR.NOT_FOUND, HTTP_RESPONSE_CODE.NOT_FOUND);
    }

    if (!printingTemplate) {
      throw new BosError(`printingTemplate is undefined.`, BOS_ERROR.BAD_REQUEST, HTTP_RESPONSE_CODE.BAD_REQUEST);
    }

    const model = serviceModelList[serviceCode];

    if (!model) {
      throw new BosError("model is undefined.", BOS_ERROR.INVALID_ARG_VALUE, HTTP_RESPONSE_CODE.BAD_REQUEST);
    }

    const { helperList } = model;
    const DataModel = mongoose.model(modelName);

    let objectList = await DataModel.find(
      {
        _id: {
          $in: objectIdList,
        },
      },
      {}
    ).lean();

    if (!objectList || !objectList.length) {
      throw new BosError(`Object is not found.`, BOS_ERROR.NOT_FOUND, HTTP_RESPONSE_CODE.NOT_FOUND);
    }

    const normalizedPrintingOffset = printingOffset || 0;

    if (objectList.length + normalizedPrintingOffset > 18) {
      throw new BosError(`Printing area is out of letter size page.`, BOS_ERROR.OUT_OF_RANGE, HTTP_RESPONSE_CODE.UNPROCESSABLE_ENTITY);
    }

    let normalizedObjectList = [];
    for (let i = 0; i < normalizedPrintingOffset; i += 1) {
      normalizedObjectList.push({});
    }

    normalizedObjectList = normalizedObjectList.concat(objectList);

    const content = await templateRender(printingTemplate, { objectList: normalizedObjectList, normalizedPrintingOffset }, helperList);

    let config = await templateConfig(printingTemplate);
    const pdf = await genPdf(content, config);

    res.set({ "Content-Type": "application/pdf", "Content-Length": pdf.length });
    res.send(pdf);

    span && span.end();
  } catch (error) {
    apm.captureError(error);

    next(error);
  }
};

export const genPdf = async (content, configTemplate) => {
  try {
    const genPdfServer = process.env.GEN_PDF_SERVER;
    const dataPDF = await axios({
      method: "POST",
      data: {
        data: content,
        configTemplate: configTemplate,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 5 * 60 * 1000,
      url: `${genPdfServer}/ext/v1/extensions/makePDF`,
      headers: {
        "Content-Type": "application/json",
      },
      responseType: "arraybuffer",
    });
    return await dataPDF.data;
  } catch (error) {
    const genPdfServer = process.env.GEN_PDF_SERVER;
    const dataPDF = await axios({
      method: "POST",
      data: {
        data: content,
        configTemplate: configTemplate,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 5 * 60 * 1000,
      url: `${genPdfServer}/ext/v1/extensions/makePDF`,
      headers: {
        "Content-Type": "application/json",
      },
      responseType: "arraybuffer",
    });
    return await dataPDF.data;
  }
};

const genPdfOld = async (content, contentTemplateFile) => {
  const browser = await puppeteer.launch({
    // [..] https://github.com/puppeteer/puppeteer/blob/master/docs/api.md#puppeteerlaunchoptions
    executablePath: "/usr/bin/chromium-browser", // [..] defined in Dockerfile
    headless: true,
    args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.setContent(content);
  await page.emulateMediaType("screen");

  let config = contentTemplateFile;

  if (!contentTemplateFile) {
    config = {
      // [..] don't set "path" option if don't want to save file
      format: "A4",
      printBackground: false,
    };
  }

  const pdf = await page.pdf(config);

  await browser.close();

  return pdf;
};

export const printPreviewController = async (req, res, next) => {
  try {
    const span = apm.startSpan("printController");
    const { context, body } = req;
    const { serviceCode, printingTemplate } = context;

    if (!printingTemplate) {
      throw new BosError(`printingTemplate is undefined.`, BOS_ERROR.BAD_REQUEST, HTTP_RESPONSE_CODE.BAD_REQUEST);
    }

    const model = serviceModelList[serviceCode];

    if (!model) {
      throw new BosError("model is undefined.", BOS_ERROR.INVALID_ARG_VALUE, HTTP_RESPONSE_CODE.BAD_REQUEST);
    }

    const { helperList } = model;

    const content = await templateRender(printingTemplate, { objectList: [body] }, helperList);

    let config = await templateConfig(printingTemplate);

    const pdf = await genPdf(content, config);

    res.set({ "Content-Type": "application/pdf", "Content-Length": pdf.length });
    res.send(pdf);

    span && span.end();
  } catch (error) {
    apm.captureError(error);
    next(error);
  }
};

export const triggerWorkflowController = async (req, res, next) => {
  try {
    const span = apm.startSpan("triggerWorkflowController");

    const { context, dataObject, body, params } = req;

    const { serviceCode, traceId, modelName, version } = context;

    const model = serviceModelList[serviceCode];

    if (!model) {
      throw new BosError("model is undefined.", BOS_ERROR.INVALID_ARG_VALUE, HTTP_RESPONSE_CODE.BAD_REQUEST);
    }

    const { workflow, data, helperList } = model;

    if (!workflow) {
      throw new BosError("triggerWorkflowController 's workflow is undefined.", BOS_ERROR.INVALID_ARG_VALUE, HTTP_RESPONSE_CODE.BAD_REQUEST);
    }

    const oldData = clone(dataObject._doc);
    const changedFields = dataMerge(data, dataObject, body, true);

    context.apiActionCode = API_ACTION_CODE.TRIGGER_WORKFLOW;
    context.workflow = workflow;

    const perm = await getCRUDPermission(context, changedFields, oldData, params);

    if (!perm) {
      throw new BosError("Can not get permission list", BOS_ERROR.FORBIDDEN, HTTP_RESPONSE_CODE.FORBIDDEN);
    }

    const { triggered, informTo, informToByField, copyTo, copyToByField, subject, subjectTemplateFile, content, contentTemplateFile, informToNextStepUser, nextWorkflowActionCodeList } =
      await triggerWorkflow(context, dataObject, oldData);

    if (!triggered) {
      throw new BosError("Workflow is not triggered.", BOS_ERROR.UNHANDLED_ERROR);
    }

    const newData = (await dataObject.save()).toObject();

    const nextStepUserEmailList = informToNextStepUser ? (await getNextStateUserList(context, newData, nextWorkflowActionCodeList)).join(EMAIL_LIST_SEPARATOR) : "";
    let wfInformToEmailSet = new Set();
    let wfCopyToEmailSet = new Set();

    if (isEmail(informTo)) {
      wfInformToEmailSet = new Set(informTo);
    } else if (informToByField) {
      wfInformToEmailSet = new Set(await getEmailByField(informToByField, newData));
    }

    if (isEmail(copyTo)) {
      wfCopyToEmailSet = new Set(copyTo);
    } else if (copyToByField) {
      wfCopyToEmailSet = new Set(await getEmailByField(copyToByField, newData));
    }

    let msgToAddressList = "";
    let msgCcAddressList = "";
    let msgSubject = "";
    let msgContent = "";

    if (nextStepUserEmailList) {
      msgToAddressList = nextStepUserEmailList;
      msgCcAddressList = [...new Set([...wfInformToEmailSet, ...wfCopyToEmailSet])].join(EMAIL_LIST_SEPARATOR); // get unique msg from 2 set
    } else {
      msgToAddressList = [...wfInformToEmailSet].join(EMAIL_LIST_SEPARATOR);
      msgCcAddressList = [...wfCopyToEmailSet].join(EMAIL_LIST_SEPARATOR);
    }

    if (msgToAddressList) {
      if (subject) {
        msgSubject = await handlebarString(subject, newData);
      } else if (subjectTemplateFile) {
        msgSubject = await templateRender(subjectTemplateFile, newData, helperList);
      }

      if (!msgSubject) {
        throw new BosError("Email subject is not configured correctly.", BOS_ERROR.INVALID_WORK_FLOW);
      }

      if (content) {
        msgContent = content;
      } else if (contentTemplateFile) {
        msgContent = await templateRender(contentTemplateFile, newData, helperList);
      }

      if (!msgContent) {
        throw new BosError("Email content is not configured correctly.", BOS_ERROR.INVALID_WORK_FLOW);
      }

      // TODO: check informBy to trigger other notification media (Telegram / Slack / SMS / ...)

      sendEmail(msgToAddressList, msgCcAddressList, msgSubject, msgContent, (error) => {
        if (error) {
          console.log("hungnv2 -> error:", error);
          throw new BosError(`Error when try to send email: ${error.message}`, BOS_ERROR.INVALID_WORK_FLOW);
        }
      });
    }

    const eventType = getServiceEventType(modelName, COMMON_EVENT.TRIGGERED_WORKFLOW, version);

    sb.publish(
      serviceCode,
      eventType,
      { model: serviceCode, oldData, newData, changedFields },
      traceId,

      async (err) => {
        if (err) {
          // TODO: rollback saved data

          serviceBusDebugger(`[SB] Publish error: ${err}`);
          throw new BosError(err.message, BOS_ERROR.SB_CAN_NOT_PUBLISH);
        }

        res.json({
          data: newData,
          ...(await checkDataObjectPermission(context, model, newData)),
        });

        span && span.end();
      }
    );
  } catch (error) {
    apm.captureError(error);

    next(error);
  }
};

export const postController = async (req, res, next) => {
  try {
    const span = apm.startSpan("postController");

    const { dataObject, context, body, params } = req;

    const { serviceCode, modelName, version, userId, userName, fullName, traceId } = context;

    const model = serviceModelList[serviceCode];

    if (!model) {
      throw new BosError("model is undefined.", BOS_ERROR.INVALID_ARG_VALUE, HTTP_RESPONSE_CODE.BAD_REQUEST);
    }

    // TODO: change the way to save data
    const oldData = clone(dataObject._doc);
    const changedFields = dataMerge(model.data, dataObject, body, true);

    context.apiActionCode = API_ACTION_CODE.POST;

    const perm = await getCRUDPermission(context, changedFields, oldData, params);

    if (!perm) {
      throw new BosError("Can not get permission list", BOS_ERROR.FORBIDDEN, HTTP_RESPONSE_CODE.FORBIDDEN);
    }

    dataObject.posted = true;
    dataObject.postedNote = "";
    dataObject.postedAt = new Date();
    dataObject.postedBy = userId;
    dataObject.postedByUserName = userName;
    dataObject.postedByFullName = fullName;

    const newData = (await dataObject.save()).toObject();
    const eventType = getServiceEventType(modelName, COMMON_EVENT.POSTED, version);

    sb.publish(serviceCode, eventType, { model: serviceCode, oldData, newData, changedFields }, traceId, async (err) => {
      if (err) {
        // TODO: rollback saved data

        serviceBusDebugger(`[SB] Publish error: ${err}`);
        throw new BosError(err.message, BOS_ERROR.SB_CAN_NOT_PUBLISH);
      }

      res.json({
        data: newData,
        ...(await checkDataObjectPermission(context, model, newData)),
      });

      span && span.end();
    });
  } catch (error) {
    apm.captureError(error);

    next(error);
  }
};

export const reverseController = async (req, res, next) => {
  try {
    const span = apm.startSpan("reverseController");

    const { dataObject, context, body, params } = req;

    const { serviceCode, modelName, version, userId, userName, fullName, traceId } = context;

    const model = serviceModelList[serviceCode];

    if (!model) {
      throw new BosError("model is undefined.", BOS_ERROR.INVALID_ARG_VALUE, HTTP_RESPONSE_CODE.BAD_REQUEST);
    }

    // TODO: change the way to save data
    const oldData = clone(dataObject._doc);
    const changedFields = dataMerge(model.data, dataObject, body, true);

    context.apiActionCode = API_ACTION_CODE.REVERSE;

    const perm = await getCRUDPermission(context, changedFields, oldData, params);

    if (!perm) {
      throw new BosError("Can not get permission list", BOS_ERROR.FORBIDDEN, HTTP_RESPONSE_CODE.FORBIDDEN);
    }

    dataObject.posted = false;
    dataObject.postedNote = "";
    dataObject.reversedAt = new Date();
    dataObject.reversedBy = userId;
    dataObject.reversedByUserName = userName;
    dataObject.reversedByFullName = fullName;

    const newData = (await dataObject.save()).toObject();
    const eventType = getServiceEventType(modelName, COMMON_EVENT.REVERSED, version);

    sb.publish(serviceCode, eventType, { model: serviceCode, oldData, newData, changedFields }, traceId, async (err) => {
      if (err) {
        // TODO: rollback saved data

        serviceBusDebugger(`[SB] Publish error: ${err}`);
        throw new BosError(err.message, BOS_ERROR.SB_CAN_NOT_PUBLISH);
      }

      res.json({
        data: newData,
        ...(await checkDataObjectPermission(context, model, newData)),
      });

      span && span.end();
    });
  } catch (error) {
    apm.captureError(error);

    next(error);
  }
};

export const API = {
  HEALTH_CHECK: {
    operationId: API_ACTION_CODE.HEALTH_CHECK,
    method: HTTP_METHOD.GET,
    path: "/healthcheck",
    parameters: [],
    responses: COMMON_RESPONSE,
    controller: healthCheckController,
  },

  GET_SWAGGER: {
    operationId: API_ACTION_CODE.GET_SWAGGER,
    method: HTTP_METHOD.GET,
    path: "/swagger",
    parameters: [],
    responses: COMMON_RESPONSE,
    controller: swaggerController,
  },

  PRINT: {
    operationId: API_ACTION_CODE.PRINT,
    method: HTTP_METHOD.POST,
    path: `/print/:${PRINTING_TEMPLATE_PARAM}`,
    parameters: [TEMPLATE_PARAM, REQUEST_QUERY],
    responses: PRINT_RESPONSE,
    controller: printController,
  },

  CREATE: {
    operationId: API_ACTION_CODE.CREATE,
    method: HTTP_METHOD.POST,
    path: "/",
    parameters: [REQUEST_BODY],
    responses: CREATE_RESPONSE,
    controller: createController,
    eventType: COMMON_EVENT.CREATED,
  },

  GET_LIST: {
    operationId: API_ACTION_CODE.GET_LIST,
    method: HTTP_METHOD.GET,
    path: "/",
    parameters: [REQUEST_QUERY],
    responses: GET_LIST_RESPONSE,
    controller: getListController,
  },

  EXPORT: {
    operationId: API_ACTION_CODE.EXPORT,
    method: HTTP_METHOD.GET,
    path: "/export",
    parameters: [REQUEST_QUERY],
    responses: EXPORT_RESPONSE,
    controller: exportController,
  },

  AGGREGATE: {
    operationId: API_ACTION_CODE.AGGREGATE,
    method: HTTP_METHOD.GET,
    path: `/aggregate/:${AGGREGATE_FUNCTION_CODE_PARAM}/`,
    parameters: [REQUEST_QUERY],
    responses: AGGREGATE_RESPONSE,
    controller: aggregateHandler,
  },

  GET_BY_ID: {
    operationId: API_ACTION_CODE.GET_BY_ID,
    method: HTTP_METHOD.GET,
    path: "/:id",
    parameters: [ID_PARAM, REQUEST_QUERY],
    responses: GET_BY_ID_RESPONSE,
    controller: getByIdController,
  },

  UPDATE: {
    operationId: API_ACTION_CODE.UPDATE,
    method: HTTP_METHOD.PUT,
    path: "/:id",
    parameters: [ID_PARAM, REQUEST_BODY],
    responses: UPDATE_RESPONSE,
    controller: updateController,
    eventType: COMMON_EVENT.UPDATED,
  },

  DELETE: {
    operationId: API_ACTION_CODE.DELETE,
    method: HTTP_METHOD.DELETE,
    path: "/:id",
    parameters: [ID_PARAM],
    responses: DELETE_RESPONSE,
    controller: deleteController,
    eventType: COMMON_EVENT.DELETED,
  },

  TRIGGER_WORKFLOW: {
    operationId: API_ACTION_CODE.TRIGGER_WORKFLOW,
    method: HTTP_METHOD.PATCH,
    path: `/triggerWorkflow/:${WORKFLOW_ACTION_CODE_PARAM}/:id`,
    parameters: [ACTION_CODE_PARAM, ID_PARAM, REQUEST_BODY],
    responses: TRIGGER_WORKFLOW_RESPONSE,
    controller: triggerWorkflowController,
    eventType: COMMON_EVENT.TRIGGERED_WORKFLOW,
  },

  POST: {
    operationId: API_ACTION_CODE.POST,
    method: HTTP_METHOD.PATCH,
    path: "/post/:id",
    parameters: [ID_PARAM, REQUEST_BODY],
    responses: POST_RESPONSE,
    controller: postController,
    eventType: COMMON_EVENT.POSTED,
  },

  REVERSE: {
    operationId: API_ACTION_CODE.REVERSE,
    method: HTTP_METHOD.PATCH,
    path: "/reverse/:id",
    parameters: [ID_PARAM, REQUEST_BODY],
    responses: REVERSE_RESPONSE,
    controller: reverseController,
    eventType: COMMON_EVENT.REVERSED,
  },
};

export const DEFAULT_API_LIST = [API.HEALTH_CHECK, API.GET_SWAGGER];

export const API_LIST = {
  CRUD: [
    API.CREATE,
    API.AGGREGATE, // [!] cause of router pipeline, "Aggregate" API" must before "GetById API"
    API.GET_LIST,
    API.GET_BY_ID,
    API.UPDATE,
    API.DELETE,
  ],

  R: [
    API.AGGREGATE, // [!] cause of router pipeline, "Aggregate" API" must before "GetById API"
    API.GET_LIST,
    API.GET_BY_ID,
  ],

  RE: [
    API.EXPORT, // [!] cause of router pipeline, "Export API" must before "GetById API"
    API.AGGREGATE, // [!] cause of router pipeline, "Aggregate" API" must before "GetById API"
    API.GET_LIST,
    API.GET_BY_ID,
  ],

  RPE: [
    API.EXPORT, // [!] cause of router pipeline, "Export API" must before "GetById API"
    API.AGGREGATE, // [!] cause of router pipeline, "Aggregate" API" must before "GetById API"
    API.GET_LIST,
    API.GET_BY_ID,
    API.PRINT,
  ],

  CRUDT: [
    API.CREATE,
    API.AGGREGATE, // [!] cause of router pipeline, "Aggregate" API" must before "GetById API"
    API.GET_LIST,
    API.GET_BY_ID,
    API.UPDATE,
    API.DELETE,
    API.TRIGGER_WORKFLOW,
  ],

  CRUDP: [
    API.CREATE,
    API.AGGREGATE, // [!] cause of router pipeline, "Aggregate" API" must before "GetById API"
    API.GET_LIST,
    API.GET_BY_ID,
    API.UPDATE,
    API.DELETE,
    API.PRINT,
  ],

  CRUDOV: [
    API.CREATE,
    API.AGGREGATE, // [!] cause of router pipeline, "Aggregate" API" must before "GetById API"
    API.GET_LIST,
    API.GET_BY_ID,
    API.UPDATE,
    API.DELETE,
    API.POST,
    API.REVERSE,
  ],

  CRUDPE: [
    API.CREATE,
    API.EXPORT, // [!] cause of router pipeline, "Export API" must before "GetById API"
    API.AGGREGATE, // [!] cause of router pipeline, "Aggregate" API" must before "GetById API"
    API.GET_LIST,
    API.GET_BY_ID,
    API.UPDATE,
    API.DELETE,
    API.PRINT,
  ],

  CRUDET: [
    API.CREATE,
    API.EXPORT, // [!] cause of router pipeline, "Export API" must before "GetById API"
    API.AGGREGATE, // [!] cause of router pipeline, "Aggregate" API" must before "GetById API"
    API.GET_LIST,
    API.GET_BY_ID,
    API.UPDATE,
    API.DELETE,
    API.TRIGGER_WORKFLOW,
  ],

  CRUDPT: [
    API.CREATE,
    API.AGGREGATE, // [!] cause of router pipeline, "Aggregate" API" must before "GetById API"
    API.GET_LIST,
    API.GET_BY_ID,
    API.UPDATE,
    API.DELETE,
    API.PRINT,
    API.TRIGGER_WORKFLOW,
  ],

  CRUDPET: [
    API.CREATE,
    API.EXPORT, // [!] cause of router pipeline, "Export API" must before "GetById API"
    API.AGGREGATE, // [!] cause of router pipeline, "Aggregate" API" must before "GetById API"
    API.GET_LIST,
    API.GET_BY_ID,
    API.UPDATE,
    API.DELETE,
    API.PRINT,
    API.TRIGGER_WORKFLOW,
  ],

  CRUDTOV: [
    API.CREATE,
    API.AGGREGATE, // [!] cause of router pipeline, "Aggregate" API" must before "GetById API"
    API.GET_LIST,
    API.GET_BY_ID,
    API.UPDATE,
    API.DELETE,
    API.TRIGGER_WORKFLOW,
    API.POST,
    API.REVERSE,
  ],

  CRUDPOV: [
    API.CREATE,
    API.AGGREGATE, // [!] cause of router pipeline, "Aggregate" API" must before "GetById API"
    API.GET_LIST,
    API.GET_BY_ID,
    API.UPDATE,
    API.DELETE,
    API.PRINT,
    API.POST,
    API.REVERSE,
  ],

  CRUDEOV: [
    API.CREATE,
    API.EXPORT,
    API.AGGREGATE, // [!] cause of router pipeline, "Aggregate" API" must before "GetById API"
    API.GET_LIST,
    API.GET_BY_ID,
    API.UPDATE,
    API.DELETE,
    API.POST,
    API.REVERSE,
  ],

  CRUDPEOV: [
    API.CREATE,
    API.EXPORT, // [!] cause of router pipeline, "Export API" must before "GetById API"
    API.AGGREGATE, // [!] cause of router pipeline, "Aggregate" API" must before "GetById API"
    API.GET_LIST,
    API.GET_BY_ID,
    API.UPDATE,
    API.DELETE,
    API.POST,
    API.REVERSE,
  ],

  CRUDPTOV: [
    API.CREATE,
    API.AGGREGATE, // [!] cause of router pipeline, "Aggregate" API" must before "GetById API"
    API.GET_LIST,
    API.GET_BY_ID,
    API.UPDATE,
    API.DELETE,
    API.PRINT,
    API.TRIGGER_WORKFLOW,
    API.POST,
    API.REVERSE,
  ],

  CRUDPETOV: [
    API.CREATE,
    API.EXPORT, // [!] cause of router pipeline, "Export API" must before "GetById API"
    API.AGGREGATE, // [!] cause of router pipeline, "Aggregate" API" must before "GetById API"
    API.GET_LIST,
    API.GET_BY_ID,
    API.UPDATE,
    API.DELETE,
    API.PRINT,
    API.TRIGGER_WORKFLOW,
    API.POST,
    API.REVERSE,
  ],
};

export const registerControllerList = (router) => {
  if (!serviceModelList) {
    throw new BosError("serviceModelList is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  Object.values(serviceModelList).forEach((model) => {
    const { modelName, version } = model;

    DEFAULT_API_LIST.forEach((api) => {
      const { path, method, controller } = api;

      router[method](`/v${version || 1}/${modelName}${path}`, controller);
    });
  });

  router.param("id", idParamController);
  router.param(WORKFLOW_ACTION_CODE_PARAM, workflowActionCodeParamController);
  router.param(PRINTING_TEMPLATE_PARAM, printingTemplateParamController);
  router.param(AGGREGATE_FUNCTION_CODE_PARAM, aggregateFunctionCodeParamController);

  Object.values(serviceModelList).forEach((model) => {
    const { modelName, version, apiList } = model;
    const normalizedApiList = apiList || API_LIST.CRUD;

    normalizedApiList.forEach((api) => {
      const { path, method, controller } = api;

      if (!path) {
        throw new BosError("path is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
      }

      if (!method) {
        throw new BosError("method is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
      }

      if (!controller) {
        throw new BosError("controller is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
      }

      router[method](`/v${version || 1}/${modelName}${path}`, controller);
    });
  });
};
