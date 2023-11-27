import { isArray, isUndefined, isObject, isNull, isFunction, concat, pick } from "lodash";
import { DATA_TYPE } from "../constants/dataType";
import { VALIDATE_FAILURE } from "../constants/config";
import i18n from "../i18n";
import { isPhone, isEmail, getDefaultValue, isObjectId } from "./commonHelper";
import BosError, { BOS_ERROR, apiErrorMessages } from "./errorHelper";
import { apiGetList } from "./apiHelper";

export function getDefaultModelValue(model) {
  if (!model) {
    throw new BosError("model is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const object = {};

  Object.entries(model).forEach(([key, def]) => {
    const { defaultValue, type } = def;

    object[key] = getDefaultValue(isArray(def) ? DATA_TYPE.ARRAY : type, defaultValue);
  });

  return object;
}

export function normalizeData(model, data) {
  if (!model) {
    throw new BosError("model is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!data) {
    throw new BosError("data is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const normalizedData = {};
  const defaultValue = getDefaultModelValue(model);

  Object.entries(defaultValue).forEach(([key, value]) => {
    const fieldValue = data[key];

    if (isUndefined(fieldValue)) {
      // if undefined => set by default value
      normalizedData[key] = value;
    } else if (isArray(fieldValue)) {
      // if field is array => add index
      const tmpSrcArray = fieldValue;

      if (tmpSrcArray.length > 0 && isObject(tmpSrcArray[0])) {
        // only add index field if Array of Object
        const tmpDestArray = [];

        for (let i = 0; i < tmpSrcArray.length; i += 1) {
          if (isObject(tmpSrcArray[i])) {
            tmpSrcArray[i].index = i + 1;
          }

          tmpDestArray.push(tmpSrcArray[i]);
        }

        normalizedData[key] = tmpDestArray;
      } else {
        normalizedData[key] = fieldValue;
      }
    } else {
      // if normal field => keep its value
      normalizedData[key] = fieldValue;
    }
  });

  return normalizedData;
}

const validateRequiredField = (name, type, value) => {
  let valid = true;

  switch (type) {
    case DATA_TYPE.ARRAY: {
      if (value.length === 0) {
        valid = false;
      }

      // TODO: validate sub field

      break;
    }

    case DATA_TYPE.COMPANY_ID:
    case DATA_TYPE.ID: {
      if (name !== "_id") {
        // not check ID value
        valid = isObjectId(value);
      }

      break;
    }

    case DATA_TYPE.GL_DATE:
    case DATA_TYPE.DESC_STRING:
    case DATA_TYPE.STRING:
    case DATA_TYPE.DATE:
    case DATA_TYPE.DATE_TIME: {
      if (!value) {
        valid = false;
      }

      break;
    }

    case DATA_TYPE.PROGRESS: {
      if (isNull(value) || isUndefined(value) || isNaN(value)) {
        valid = false;
      }

      break;
    }

    case DATA_TYPE.POSTED_NUMBER:
    case DATA_TYPE.NUMBER: {
      if (value !== 0 && !value) {
        valid = false;
      }

      break;
    }

    default: {
      if (isUndefined(value)) {
        valid = false;
      }

      break;
    }
  }

  return valid;
};

export const validateData = async (model, objectData, isSubField = false) => {
  if (!model) {
    throw new BosError("model is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!objectData) {
    throw new BosError("objectData is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  let errors = [];
  let hasError = false;
  const pickedFieldList = [];

  try {
    for (const [fieldName, def] of Object.entries(model)) {
      const { type, picked, required, unique, validator, validatorMessage } = def;
      const fieldValue = type === DATA_TYPE.ID && (objectData[fieldName] === 0 || objectData[fieldName] === "") ? null : objectData[fieldName];

      let valid = true;
      let isUndefinedValidator = isUndefined(validator);

      if (isUndefinedValidator || type === DATA_TYPE.ARRAY) {
        // standard validation
        const requiredValue = isFunction(required) ? required(objectData) : required;

        if (requiredValue) {
          if (isUndefined(fieldValue)) {
            valid = false;
          } else {
            valid = validateRequiredField(fieldName, type, fieldValue);
          }
        }

        if (valid && fieldValue) {
          // always check if field value exists
          switch (type) {
            case DATA_TYPE.EMAIL:
              valid = isEmail(fieldValue);
              break;

            case DATA_TYPE.PHONE:
              valid = isPhone(fieldValue);
              break;

            case DATA_TYPE.ARRAY: {
              if (!isArray(fieldValue)) {
                valid = false;
              } else {
                if (unique) {
                  // check unique for fieldName
                  const valueSet = new Set();

                  for (let i = 0; i < fieldValue.length; i += 1) {
                    const val = JSON.stringify(fieldValue[i]);

                    if (valueSet.has(val)) {
                      errors.push({
                        name: `${fieldName}`,
                        message: "system:msg.validate.isDuplicated",
                      });

                      hasError = true;

                      break;
                    } else {
                      valueSet.add(val);
                    }
                  }
                }

                const { subModel } = def; // [?] need to convert sharp into subModel by reducer?

                if (subModel) {
                  // validate sub model fields
                  for (let i = 0; i < fieldValue.length; i += 1) {
                    // validate sub model field value
                    const line = fieldValue[i];
                    const { error } = await validateData(subModel, line, true);

                    if (error) {
                      errors = concat(errors, error);
                      hasError = true;
                    }
                  }

                  // eslint-disable-next-line no-loop-func
                  Object.entries(subModel).forEach(([subFieldName, subDef]) => {
                    // validate overall unique value
                    const { type: subType, unique: subUnique, required: subRequired } = subDef;
                    const subRequiredValue = isFunction(subRequired) ? subRequired(objectData) : subRequired;

                    if (subUnique) {
                      const valueSet = new Set();

                      for (let i = 0; i < fieldValue.length; i += 1) {
                        const val = fieldValue[i][subFieldName];

                        if (val && valueSet.has(val)) {
                          errors.push({
                            name: `[${i18n.t(fieldName)}].[${i + 1}].[${i18n.t(subFieldName)}]`,
                            message: "system:msg.validate.isDuplicated",
                          });

                          hasError = true;

                          break;
                        } else {
                          valueSet.add(val);
                        }
                      }
                    }

                    if (subRequiredValue) {
                      for (let i = 0; i < fieldValue.length; i += 1) {
                        const val = fieldValue[i][subFieldName];

                        if (!validateRequiredField(subFieldName, subType, val)) {
                          errors.push({
                            name: `[${i18n.t(fieldName)}].[${i + 1}].[${i18n.t(subFieldName)}]`,
                            message: "system:msg.validate.isRequired",
                          });

                          hasError = true;

                          break;
                        }
                      }
                    }
                  });
                }
              }

              break;
            }

            default:
              break;
          }
        }
      }

      if (!isUndefinedValidator) {
        // user defined validation
        valid = await validator(fieldValue, objectData);
        if (isObject(valid)) {
          errors = errors.concat(valid.errorList);

          valid = true;
          hasError = true;
        }
      }

      if (!valid && !isSubField) {
        errors.push({
          name: fieldName,
          message: validatorMessage || VALIDATE_FAILURE,
        });

        hasError = true;
      } else if (picked || isUndefined(picked)) {
        pickedFieldList.push(fieldName);
      }
    }

    if (hasError) {
      return { error: errors };
    }

    return { data: pick(objectData, pickedFieldList) };
  } catch (error) {
    return { error };
  }
};

export const validatePost = async (model, objectData) => {
  if (!model) {
    throw new BosError("model is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!objectData) {
    throw new BosError("objectData is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  let errors = [];
  let hasError = false;

  try {
    const fieldList = Object.entries(model).filter(([fieldName, def]) => [DATA_TYPE.GL_DATE, DATA_TYPE.COMPANY_ID, DATA_TYPE.DESC_STRING, DATA_TYPE.POSTED_NUMBER].includes(def.type));

    const companyField = fieldList.find(([fieldName, def]) => def.type === DATA_TYPE.COMPANY_ID);

    for (const [fieldName, def] of fieldList) {
      const { type } = def;
      const fieldValue = objectData[fieldName];
      let valid = true;
      let errorMessage = "";

      if (isUndefined(fieldValue)) {
        valid = false;
      } else {
        valid = validateRequiredField(fieldName, type, fieldValue);
      }

      if (valid) {
        if (companyField && type === DATA_TYPE.GL_DATE) {
          const companyId = objectData[companyField[0]];

          const query = {
            fields: "fiscalPeriodId, fiscalPeriodCode, fiscalPeriodName",
            companyId,
            state: "opened",

            "fromDate.$lte": new Date(fieldValue),
            "toDate.$gte": new Date(fieldValue),

            orderBy: "toDate.desc",
            limit: 1,
          };

          const { data, error } = await apiGetList("v1/sysFiscalPeriodStates", query);

          if (error) {
            valid = false;
            errorMessage = apiErrorMessages(error);
          } else {
            const period = data.data[0];

            if (!period) {
              valid = false;
              errorMessage = "Chưa mở kỳ kế toán";
            }
          }
        }
      }

      if (!valid) {
        errors.push({
          name: fieldName,
          message: errorMessage || VALIDATE_FAILURE,
        });

        hasError = true;
      }
    }

    if (hasError) {
      return { error: errors };
    }

    return { error: false };
  } catch (error) {
    return { error };
  }
};

export const cloneObject = (self, object) => {
  const { model } = self.state;

  const omitFields = {
    _id: "0",
  };

  Object.entries(model).forEach(([fieldName, fieldDef]) => {
    const { type, cloned } = fieldDef;

    if (!cloned) {
      switch (type) {
        case DATA_TYPE.DOCUMENT_CODE:
        case DATA_TYPE.DOCUMENT_NAME: {
          omitFields[fieldName] = "";
          break;
        }

        case DATA_TYPE.ARRAY: {
          omitFields[fieldName] = [];
          break;
        }

        default: {
          break;
        }
      }
    } else {
      switch (type) {
        case DATA_TYPE.DOCUMENT_CODE: {
          omitFields[fieldName] = "";
          break;
        }

        default: {
          break;
        }
      }
    }
  });

  return {
    ...object,
    ...omitFields,
  };
};
