import { difference, isArray, isUndefined, keys, isString, take, isEqual, intersection, isObject } from "lodash";
import mongoose from "mongoose";

import { DATA_TYPE } from "../constants/dataTypeConstant";
import { DEFAULT_SEQUENCE_PATTERN, getSequenceCode } from "./commonHelper";
import BosError, { BOS_ERROR } from "./errorHelper";
import { API_LIST } from "./controllerHelper";
import { getServiceCode } from "./commonHelper";
import { isObjectId } from "./commonHelper";
import { API_ACTION_CODE } from "./swaggerHelper";
import commonHelperList from "./commonHelper";

const serviceModelList = {};

export const FIELD_SEPARATOR = ".";
export const POSITIONAL_OPERATOR = ".$[].";

export const DATA_MODEL_TEMPLATE = {
  _id: { type: DATA_TYPE.ID, required: true, index: true },
  active: { type: DATA_TYPE.BOOL, required: true, default: true },
  usedBySystem: { type: DATA_TYPE.BOOL, default: false }, // prevent non admin user to edit or deleted

  createdAt: { type: DATA_TYPE.DATE_TIME },
  createdBy: { type: DATA_TYPE.ID },
  createdByUserName: { type: DATA_TYPE.STRING },
  createdByFullName: { type: DATA_TYPE.STRING },

  updatedAt: { type: DATA_TYPE.DATE_TIME },
  updatedBy: { type: DATA_TYPE.ID },
  updatedByUserName: { type: DATA_TYPE.STRING },
  updatedByFullName: { type: DATA_TYPE.STRING },

  deleteRejectTimeOut: { type: DATA_TYPE.DATE_TIME },
  deleted: { type: DATA_TYPE.BOOL, default: false },
  deletedAt: { type: DATA_TYPE.DATE_TIME },
  deletedBy: { type: DATA_TYPE.ID },
  deletedByUserName: { type: DATA_TYPE.STRING },
  deletedByFullName: { type: DATA_TYPE.STRING },
};

export const MODEL_RESERVED_FIELDS = difference(Object.keys(DATA_MODEL_TEMPLATE), ["active", "createdAt"]); // only active can set by user

const parseModel = (modelSchema, level = 1, parent = null, parseModelConstraint = true) => {
  const schema = {};
  const constraintList = [];

  Object.entries(modelSchema).forEach(([fieldName, fieldType]) => {
    const arrayDefined = isArray(fieldType);

    const {
      type,
      sharp, // object way to defined an array
      unique,
      required,
      index,
      defaultValue,
      oneOf, // field can only get one of these values
      refModelName,
      refKeyField,
      relatedFields,
      autoUpdate, // keep data consistence
      virtual, // virtual client request field
    } = fieldType;

    if (virtual) {
      return;
    }

    const sharpDefined = type === DATA_TYPE.ARRAY && !isUndefined(sharp);
    const combinedFieldName = parent ? `${parent}.${fieldName}` : fieldName;

    if (arrayDefined || sharpDefined) {
      // sub-model definition
      const subModelDef = arrayDefined ? fieldType[0] : sharp;
      const keyList = keys(subModelDef);

      if (keyList.length === 1 && keyList[0] === "type") {
        // array of single value
        schema[fieldName] = {
          // using fieldName (instead of combinedFieldName) to keep mongoose schema correct
          type: "array",
          required: false,
        };
      } else {
        const nestedModel = parseModel(subModelDef, level + 1, combinedFieldName, parseModelConstraint);

        schema[fieldName] = [nestedModel.schema]; // using fieldName (instead of combinedFieldName) to keep mongoose schema correct

        if (parseModelConstraint) {
          nestedModel.constraintList.forEach((c) => {
            constraintList.push(c);
          });
        }
      }
    } else {
      const field = {};

      switch (type) {
        case DATA_TYPE.ID: {
          field.type = mongoose.Schema.Types.ObjectId;
          break;
        }

        case DATA_TYPE.STRING:
        case DATA_TYPE.EMAIL:
        case DATA_TYPE.PHONE:
        case DATA_TYPE.STATE: {
          field.type = String;
          break;
        }

        case DATA_TYPE.PROGRESS:
        case DATA_TYPE.NUMBER: {
          field.type = Number;
          break;
        }

        case DATA_TYPE.BOOL:
        case DATA_TYPE.BOOLEAN: {
          field.type = Boolean;
          break;
        }

        case DATA_TYPE.DATE:
        case DATA_TYPE.DATE_TIME: {
          field.type = Date;
          break;
        }

        case DATA_TYPE.OBJECT: {
          field.type = Object;
          break;
        }

        case DATA_TYPE.ARRAY: {
          field.type = Array;
          break;
        }

        default: {
          field.type = String;
          break;
        }
      } // switch (fieldType.type)

      if (unique) {
        field.unique = true;
      }

      if (required) {
        field.required = true;
      }

      if (index || refModelName) {
        // auto index for ID field
        field.index = true;
      }

      if (!isUndefined(defaultValue)) {
        field.default = defaultValue;
      }

      if (!isUndefined(oneOf)) {
        field.enum = oneOf; // mongoose keyword "enum"
      }

      if (refModelName) {
        field.ref = refModelName;

        if (isUndefined(autoUpdate) || autoUpdate) {
          const nestedRelatedFields = [];

          if (isArray(relatedFields)) {
            relatedFields.forEach((f) => {
              if (isString(f)) {
                nestedRelatedFields.push({
                  fromField: f,
                  toField: parent ? `${parent}.${f}` : f,
                });
              } else {
                const { fromField, toField } = f;

                if (fromField && toField) {
                  nestedRelatedFields.push({
                    fromField,
                    toField: parent ? `${parent}.${toField}` : toField,
                  });
                }
              }
            });
          } // if (isArray(subRelatedFields)) {

          if (parseModelConstraint) {
            constraintList.push({
              fieldName: combinedFieldName,

              refModelName,
              refKeyField,
              relatedFields: nestedRelatedFields,
            });
          }
        } //if (isUndefined(autoUpdate) ||  autoUpdate)
      } // if (refModelName && (autoUpdate !== false))

      schema[fieldName] = field;
    } // else if (arrayDefined || sharpDefined) {
  });

  return { schema, constraintList };
};

const userPoly = (mappedToUserIdField, mappedToUserNameField, mappedToFullNameField, required = false) => ({
  [mappedToUserIdField]: {
    type: DATA_TYPE.ID,
    required,

    refModelName: "users",

    refKeyField: "_id",

    relatedFields: [
      { fromField: "userName", toField: mappedToUserNameField },
      { fromField: "fullName", toField: mappedToFullNameField },
    ],
  },

  [mappedToUserNameField]: { type: DATA_TYPE.STRING },
  [mappedToFullNameField]: { type: DATA_TYPE.STRING },
});

const getSequenceHookFunction = (sequenceFieldList) => {
  return async function (next) {
    // [!] Don't change into narrow function
    try {
      for (const sequenceField of sequenceFieldList) {
        const { fieldName, pattern, sequenceLength } = sequenceField;

        if (!this[fieldName]) {
          this[fieldName] = await getSequenceCode(pattern, sequenceLength);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Auto convert insight model into mongoose model
// and parse data constant
export const registerModelList = (modelList, parseModelConstraint = true) => {
  if (!isArray(modelList)) {
    throw new BosError("modelList is not an array.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const crossModelDataConstraint = {};

  modelList.forEach((model) => {
    const { modelName, version, workflow, data, hookList, apiList, eventHandlerList: eventHandlerListDefault, scheduleList: scheduleListDefault, helperList } = model.default; // cause of using require (not import method)

    if (!modelName) {
      throw new BosError("modelName is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
    }

    if (!data) {
      throw new BosError("data is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
    }

    const sequenceFieldList = [];

    Object.entries(data).forEach(([fieldName, fieldType]) => {
      const { type, pattern, sequenceLength } = fieldType;

      if (type === DATA_TYPE.SEQUENCE) {
        sequenceFieldList.push({
          fieldName,
          pattern: pattern || DEFAULT_SEQUENCE_PATTERN,
          sequenceLength: sequenceLength || 3,
        });
      }
    });

    let finalDataSchema = {
      ...data,

      active: { type: DATA_TYPE.BOOLEAN, defaultValue: true },
      usedBySystem: { type: DATA_TYPE.BOOLEAN, defaultValue: false }, // prevent non admin user to edit or deleted

      createdAt: { type: DATA_TYPE.DATE_TIME },
      updatedAt: { type: DATA_TYPE.DATE_TIME },
      deleteRejectTimeOut: { type: DATA_TYPE.DATE_TIME },
      deleted: { type: DATA_TYPE.BOOLEAN, defaultValue: false },
      deletedAt: { type: DATA_TYPE.DATE_TIME },

      ...userPoly("createdBy", "createdByUserName", "createdByFullName"),
      ...userPoly("updatedBy", "updatedByUserName", "updatedByFullName"),
      ...userPoly("deletedBy", "deletedByUserName", "deletedByFullName"),
    };

    if (apiList) {
      let postApi = apiList.find((item) => item.operationId === API_ACTION_CODE.POST);

      if (postApi) {
        finalDataSchema = {
          ...finalDataSchema,

          posted: { type: DATA_TYPE.BOOLEAN, defaultValue: false },
          postedNote: { type: DATA_TYPE.STRING },
          postedAt: { type: DATA_TYPE.DATE_TIME },
          reversedAt: { type: DATA_TYPE.DATE_TIME },

          ...userPoly("postedBy", "postedByUserName", "postedByFullName"),
          ...userPoly("reversedBy", "reversedByUserName", "reversedByFullName"),
        };
      }
    }

    const { schema, constraintList } = parseModel(finalDataSchema, 1, null, parseModelConstraint);
    const serviceCode = getServiceCode(modelName, version);

    const helperKeys = new Set(commonHelperList.map((h) => h.name));
    const mergedHelperList = helperList ? [...commonHelperList, ...helperList.filter((d) => !helperKeys.has(d.name))] : commonHelperList;
    const scheduleList = [];
    const eventHandlerList = eventHandlerListDefault || [];

    if (scheduleListDefault) {
      scheduleListDefault.forEach((schedule) => {
        const { eventType, handler, description } = schedule;
        if (eventType) {
          scheduleList.push({
            eventType: `${modelName}${eventType.charAt(0).toUpperCase() + eventType.slice(1)}`,
            description,
          });
        }
        if (handler) {
          eventHandlerList.push({
            refModelName: "timers",
            eventType: `${modelName}${eventType.charAt(0).toUpperCase() + eventType.slice(1)}`,
            handler,
          });
        }
      });
    }

    if (parseModelConstraint) {
      crossModelDataConstraint[modelName] = constraintList;
      serviceModelList[serviceCode] = {
        modelName,
        version: version || "1",
        constraintList,

        workflow,
        data: finalDataSchema,
        apiList: apiList || API_LIST.CRUD,
        eventHandlerList,
        scheduleList,
        helperList: mergedHelperList,
      };
    }

    const mongooseSchema = new mongoose.Schema(schema, {
      timestamps: {
        createdAt: "createdAt",
        updatedAt: "updatedAt",
      },
    });

    const normalizedHookList = isArray(hookList) ? hookList : [];

    if (normalizedHookList.findIndex((h) => h.method === "save") < 0 && sequenceFieldList.length) {
      // sequence related hook not defined => add default hook
      normalizedHookList.push({
        method: "save",
        callback: getSequenceHookFunction(sequenceFieldList),
      });
    }

    normalizedHookList.forEach((hook) => {
      const { method, callback } = hook;

      mongooseSchema.pre(method, callback);
    });

    mongoose.model(modelName, mongooseSchema, modelName);
  }); // modelList.forEach((model)

  return crossModelDataConstraint;
};

// Get field list from mongoose schema
export const getFieldList = (modelSchema, level = 1, parent = null) => {
  if (!isObject(modelSchema)) {
    throw new BosError("modelSchema is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  let fieldList = {};

  Object.entries(modelSchema).forEach(([fieldName, fieldType]) => {
    const arrayDefined = isArray(fieldType);

    const { type, sharp, required, defaultValue, oneOf } = fieldType;

    const sharpDefined = type === DATA_TYPE.ARRAY && !isUndefined(sharp);
    const combinedFieldName = parent ? `${parent}.${fieldName}` : fieldName;

    if (arrayDefined || sharpDefined) {
      // sub-model definition
      const subModelDef = arrayDefined ? fieldType[0] : sharp;
      const keyList = keys(subModelDef);

      if (keyList.length === 1 && keyList[0] === "type") {
        // array of single value
        fieldList[combinedFieldName] = {
          type: DATA_TYPE.ARRAY,
          required: false,
        };
      } else {
        const nestedFieldList = getFieldList(subModelDef, level + 1, combinedFieldName);

        fieldList = {
          ...fieldList,
          ...nestedFieldList,

          [combinedFieldName]: {
            type: DATA_TYPE.ARRAY,
            // unique: unique || false,
            required: required || false,
          },
        };
      }
    } else {
      const field = {
        type,
        // unique: unique || false,
        required: required || false,
      };

      if (!isUndefined(defaultValue)) {
        field.defaultValue = defaultValue;
      }

      if (!isUndefined(oneOf)) {
        field.oneOf = oneOf; // [..] using "enum" make issue when try to parse by spread operator
      }

      fieldList[combinedFieldName] = field;
    } // else if (arrayDefined || sharpDefined) {
  });

  return fieldList;
};

// Auto assign empty array for null sub document
// to reject "The path '...' must exist in the document in order to apply array updates."
export const patchMissingSubDocument = (crossModelDataConstraint) => {
  if (!crossModelDataConstraint) {
    return;
  }

  const final = {};

  // TODO: fix async problem when call this function
  Object.entries(crossModelDataConstraint).forEach(([modelName, dataConstraints]) => {
    const FixedDataModel = mongoose.model(modelName);
    const fixedFieldSet = new Set();

    dataConstraints.forEach((constraint) => {
      const { fieldName } = constraint;

      const splittedFieldName = fieldName.split(FIELD_SEPARATOR);
      const fieldLevel = splittedFieldName.length;

      if (fieldLevel > 1) {
        for (let l = 1; l < fieldLevel; l += 1) {
          const fixedField = take(splittedFieldName, l).join(FIELD_SEPARATOR);

          fixedFieldSet.add(fixedField);
        }
      }
    });

    const fixedFields = Array.from(fixedFieldSet);
    final[modelName] = fixedFields;

    fixedFields.forEach((fieldName) => {
      const splittedFieldName = fieldName.split(FIELD_SEPARATOR);
      const fieldLevel = splittedFieldName.length;

      const errorCallBack = (error) => {
        if (error) {
          throw new BosError(`Error when try to patch field ${fieldName} in model ${modelName}:\n ${error.message}`, BOS_ERROR.MONGO_CAN_NOT_UPDATE, undefined, error.stack);
        }
      };

      if (fieldLevel === 1) {
        FixedDataModel.updateMany(
          {
            $or: [
              {
                [fieldName]: {
                  $type: 10, // is null
                },
              },
              {
                [fieldName]: {
                  $exists: false,
                },
              },
            ],
          },
          {
            [fieldName]: [],
          },
          errorCallBack
        );
      } else {
        const fieldPath = take(splittedFieldName, fieldLevel - 1).join(POSITIONAL_OPERATOR);
        const childField = splittedFieldName[fieldLevel - 1];

        FixedDataModel.updateMany(
          {},
          {
            $set: {
              [`${fieldPath}.$[element].${childField}`]: [],
            },
          },
          {
            arrayFilters: [
              {
                [`element.${childField}`]: {
                  $exists: false,
                },
              },
            ],
          },
          errorCallBack
        );

        FixedDataModel.updateMany(
          {},
          {
            $set: {
              [`${fieldPath}.$[element].${childField}`]: [],
            },
          },
          {
            arrayFilters: [
              {
                [`element.${childField}`]: {
                  $type: 10,
                },
              },
            ],
          },
          errorCallBack
        );
      } // else if (fieldLevel === 1)
    });
  });

  return final;
};

export const dataMerge = (modelDataSchema, dataObject, data, checkChange = true) => {
  if (!modelDataSchema) {
    throw new BosError("modelDataSchema is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!dataObject) {
    throw new BosError("dataObject is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!data) {
    throw new BosError("data is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  let changedFields = [];
  const fieldList = intersection(difference(keys(modelDataSchema), MODEL_RESERVED_FIELDS), keys(data)); // all fields in "data" & "schema" & not in MODEL_RESERVED_FIELDS

  if (!checkChange) {
    fieldList.forEach((fieldName) => {
      const { type } = modelDataSchema[fieldName];
      const dataValue = data[fieldName];

      if ((type === DATA_TYPE.ID) & !isObjectId(dataValue)) {
        // [..] prevent empty string case
        dataObject[fieldName] = null;
      } else {
        dataObject[fieldName] = dataValue;
      }
    });

    changedFields = fieldList;
  } else {
    fieldList.forEach((fieldName) => {
      const { type } = modelDataSchema[fieldName];
      let dataValue = data[fieldName];

      // TODO: validate dataValue by schema type using Joi

      if (!isEqual(dataObject[fieldName], dataValue)) {
        // if changed
        if ((type === DATA_TYPE.ID) & !isObjectId(dataValue)) {
          // [..] prevent empty string case
          dataValue = null;
        }

        dataObject[fieldName] = dataValue;
        changedFields.push(fieldName);
      }
    });
  }

  return changedFields;
};

export default serviceModelList;
