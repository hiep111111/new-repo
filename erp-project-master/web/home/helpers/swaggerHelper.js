/* eslint-disable import/prefer-default-export */
import { isObject, isArray } from "lodash";
import { apiGet } from "./apiHelper";

const MODEL_DEFINITION_PATH = "#/definitions/";
const DEFAULT_SCHEMA_NAME = "UserDefinedSchema";

const STRING = "string";
const ARRAY = "array";
const NUMBER = "number";
const OBJECT = "object";
const OBJECTID = "string"; // UUID
const BOOLEAN = "boolean";
const DATE = "string";
const DATE_TIME = "string";

export const SWAGGER_TYPE = {
  STRING,
  ARRAY,
  NUMBER,
  OBJECT,
  OBJECTID,
  BOOLEAN,
  DATE,
  DATE_TIME,
};

export const API_ACTION_CODE = {
  GET_LIST: "getList",
  GET_BY_ID: "getById",
  CREATE: "create",
  UPDATE: "updateById",
  DELETE: "deleteById",

  PRINT: "print",
  EXPORT: "exportList",
  AGGREGATE: "aggregate",
  TRIGGER_WORKFLOW: "triggerWorkflowById",
  CHECK_PERMISSION: "checkPermissionById",

  POST: "postById",
  REVERSE: "reverseById",
};

export const API_ACTION_LIST = {
  CRUD: [
    API_ACTION_CODE.CREATE, 
    API_ACTION_CODE.AGGREGATE,
    API_ACTION_CODE.GET_LIST, 
    API_ACTION_CODE.GET_BY_ID, 
    API_ACTION_CODE.UPDATE, 
    API_ACTION_CODE.DELETE
  ],

  R: [
    API_ACTION_CODE.AGGREGATE, 
    API_ACTION_CODE.GET_LIST, 
    API_ACTION_CODE.GET_BY_ID
  ],

  RE: [
    API_ACTION_CODE.AGGREGATE, 
    API_ACTION_CODE.GET_LIST, 
    API_ACTION_CODE.GET_BY_ID, 
    API_ACTION_CODE.EXPORT
  ],

  RPE: [
    API_ACTION_CODE.AGGREGATE, 
    API_ACTION_CODE.GET_LIST, 
    API_ACTION_CODE.GET_BY_ID, 
    API_ACTION_CODE.PRINT, 
    API_ACTION_CODE.EXPORT
  ],

  CRUDT: [
    API_ACTION_CODE.CREATE, 
    API_ACTION_CODE.AGGREGATE, 
    API_ACTION_CODE.GET_LIST, 
    API_ACTION_CODE.GET_BY_ID, 
    API_ACTION_CODE.UPDATE, 
    API_ACTION_CODE.DELETE, 
    API_ACTION_CODE.TRIGGER_WORKFLOW
  ],

  CRUDET: [
    API_ACTION_CODE.CREATE,
    API_ACTION_CODE.AGGREGATE,
    API_ACTION_CODE.GET_LIST,
    API_ACTION_CODE.GET_BY_ID,
    API_ACTION_CODE.UPDATE,
    API_ACTION_CODE.DELETE,
    API_ACTION_CODE.EXPORT,
    API_ACTION_CODE.TRIGGER_WORKFLOW,
  ],

  CRUDP: [
    API_ACTION_CODE.CREATE, 
    API_ACTION_CODE.AGGREGATE, 
    API_ACTION_CODE.GET_LIST, 
    API_ACTION_CODE.GET_BY_ID, 
    API_ACTION_CODE.UPDATE, 
    API_ACTION_CODE.DELETE, 
    API_ACTION_CODE.PRINT
  ],

  CRUDOV: [
    API_ACTION_CODE.CREATE,
    API_ACTION_CODE.AGGREGATE,
    API_ACTION_CODE.GET_LIST,
    API_ACTION_CODE.GET_BY_ID,
    API_ACTION_CODE.UPDATE,
    API_ACTION_CODE.DELETE,
    API_ACTION_CODE.POST,
    API_ACTION_CODE.REVERSE,
  ],

  CRUDPT: [
    API_ACTION_CODE.CREATE,
    API_ACTION_CODE.AGGREGATE,
    API_ACTION_CODE.GET_LIST,
    API_ACTION_CODE.GET_BY_ID,
    API_ACTION_CODE.UPDATE,
    API_ACTION_CODE.DELETE,
    API_ACTION_CODE.PRINT,
    API_ACTION_CODE.TRIGGER_WORKFLOW,
  ],

  CRUDPET: [
    API_ACTION_CODE.CREATE,
    API_ACTION_CODE.AGGREGATE,
    API_ACTION_CODE.GET_LIST,
    API_ACTION_CODE.GET_BY_ID,
    API_ACTION_CODE.UPDATE,
    API_ACTION_CODE.DELETE,
    API_ACTION_CODE.PRINT,
    API_ACTION_CODE.EXPORT,
    API_ACTION_CODE.TRIGGER_WORKFLOW,
  ],

  CRUDTOV: [
    API_ACTION_CODE.CREATE,
    API_ACTION_CODE.AGGREGATE,
    API_ACTION_CODE.GET_LIST,
    API_ACTION_CODE.GET_BY_ID,
    API_ACTION_CODE.UPDATE,
    API_ACTION_CODE.DELETE,
    API_ACTION_CODE.TRIGGER_WORKFLOW,
    API_ACTION_CODE.POST,
    API_ACTION_CODE.REVERSE,
  ],

  CRUDPOV: [
    API_ACTION_CODE.CREATE,
    API_ACTION_CODE.AGGREGATE,
    API_ACTION_CODE.GET_LIST,
    API_ACTION_CODE.GET_BY_ID,
    API_ACTION_CODE.UPDATE,
    API_ACTION_CODE.DELETE,
    API_ACTION_CODE.PRINT,
    API_ACTION_CODE.POST,
    API_ACTION_CODE.REVERSE,
  ],

  CRUDEOV: [
    API_ACTION_CODE.CREATE,
    API_ACTION_CODE.EXPORT,
    API_ACTION_CODE.AGGREGATE,
    API_ACTION_CODE.GET_LIST,
    API_ACTION_CODE.GET_BY_ID,
    API_ACTION_CODE.UPDATE,
    API_ACTION_CODE.DELETE,
    API_ACTION_CODE.POST,
    API_ACTION_CODE.REVERSE,
  ],

  CRUDPEOV: [
    API_ACTION_CODE.CREATE,
    API_ACTION_CODE.EXPORT,
    API_ACTION_CODE.AGGREGATE,
    API_ACTION_CODE.GET_LIST,
    API_ACTION_CODE.GET_BY_ID,
    API_ACTION_CODE.UPDATE,
    API_ACTION_CODE.DELETE,
    API_ACTION_CODE.POST,
    API_ACTION_CODE.REVERSE,
  ],

  CRUDPTOV: [
    API_ACTION_CODE.CREATE,
    API_ACTION_CODE.AGGREGATE,
    API_ACTION_CODE.GET_LIST,
    API_ACTION_CODE.GET_BY_ID,
    API_ACTION_CODE.UPDATE,
    API_ACTION_CODE.DELETE,
    API_ACTION_CODE.PRINT,
    API_ACTION_CODE.TRIGGER_WORKFLOW,
    API_ACTION_CODE.POST,
    API_ACTION_CODE.REVERSE,
  ],

  CRUDPETOV: [
    API_ACTION_CODE.CREATE,
    API_ACTION_CODE.EXPORT,
    API_ACTION_CODE.AGGREGATE,
    API_ACTION_CODE.GET_LIST,
    API_ACTION_CODE.GET_BY_ID,
    API_ACTION_CODE.UPDATE,
    API_ACTION_CODE.DELETE,
    API_ACTION_CODE.PRINT,
    API_ACTION_CODE.TRIGGER_WORKFLOW,
    API_ACTION_CODE.POST,
    API_ACTION_CODE.REVERSE,
  ],
};

export const parseServiceSwagger = async (self, serviceCode) => {
  const { error, data } = await apiGet(`${serviceCode}/swagger`, "", self);

  if (error) {
    return { error };
  }

  const actionList = [];
  const { paths, definitions, scheduleList } = data;

  if (isObject(paths)) {
    Object.entries(paths).forEach(([path, methodList]) => {
      // surf paths list
      if (isObject(methodList)) {
        Object.entries(methodList).forEach(([method, methodAttributes]) => {
          // surf method list
          const requestFieldList = [];
          const responseFieldList = [];
          const { operationId, parameters, responses } = methodAttributes;
          let modelName = "";
          let model = {};

          if (isArray(parameters)) {
            parameters.forEach((param) => {
              // surf parameters list
              if (param.in !== "path") {
                const { schema } = param;

                if (!schema) {
                  // pure value
                  requestFieldList.push({
                    name: param.name,
                    type: param.type,
                  });
                } else {
                  // ref to data model
                  modelName = schema.$ref.replace(MODEL_DEFINITION_PATH, "");
                  model = definitions[modelName];

                  if (model) {
                    const { properties } = model;

                    if (properties) {
                      Object.entries(properties).forEach(([name, fieldDef]) => {
                        requestFieldList.push({
                          name,
                          type: fieldDef.type,
                        });
                      });
                    }
                  }
                } // else if (!schema) {
              } // if (param['in'] !== 'path') {
            });
          } // if (isArray(methodAttributes.parameters)) {

          if (isObject(responses)) {
            switch (path) {
              case "/": // get List API
              case "/export": {
                // export list API
                const { schema } = responses["200"];

                if (schema) {
                  modelName = schema.properties.data.items.$ref.replace(MODEL_DEFINITION_PATH, "");
                  model = data.definitions ? data.definitions[modelName] : undefined;

                  if (model) {
                    const { properties } = model;
                    if (isObject(properties)) {
                      Object.entries(properties).forEach(([name, fieldDef]) => {
                        responseFieldList.push({
                          name,
                          type: fieldDef.type,
                        });
                      });
                    }
                  }
                }

                break;
              }

              default: {
                // other API
                const { schema } = responses["200"];

                if (schema) {
                  const responseSchema = schema.properties.data;

                  if (responseSchema.type === SWAGGER_TYPE.ARRAY) {
                    modelName = responseSchema.items.$ref.replace(MODEL_DEFINITION_PATH, "");
                  } else {
                    modelName = responseSchema.$ref.replace(MODEL_DEFINITION_PATH, "");
                  }

                  model = data.definitions ? data.definitions[modelName] : undefined;

                  if (model) {
                    const { properties } = model;
                    if (isObject(properties)) {
                      Object.entries(properties).forEach(([name, fieldDef]) => {
                        responseFieldList.push({
                          name,
                          type: fieldDef.type,
                        });
                      });
                    }
                  }
                }

                break;
              }
            } // switch (path)
          } // if (isObject(responses))

          actionList.push({
            actionCode: operationId,
            path,
            method,
            requestFieldList,
            responseFieldList,
            note: methodAttributes.summary || methodAttributes.description || "",
          });
        });
      }
    });
  }

  const modelDef = definitions ? definitions[DEFAULT_SCHEMA_NAME] : null;
  const fieldList = [];

  if (isObject(modelDef)) {
    const { required, properties } = modelDef;

    Object.entries(properties).forEach(([fieldName, fieldDef]) => {
      const { type } = fieldDef;
      const oneOf = fieldDef.enum; // [!] cause of being a keyword, "enum" make error when move inside spread operator

      fieldList.push({
        name: fieldName,
        type: type,
        oneOf,
        required: required.findIndex((f) => f === fieldName) >= 0,
      });
    });
  }

  return { actionList, fieldList, scheduleList };
};
