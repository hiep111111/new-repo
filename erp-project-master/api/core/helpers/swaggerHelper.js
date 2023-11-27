import { isArray } from "lodash";

import { getFieldList, DATA_MODEL_TEMPLATE } from "./modelHelper";
import { DATA_TYPE } from "../constants/dataTypeConstant";
import BosError, { BOS_ERROR } from "./errorHelper";

export const DEFAULT_SCHEMA_NAME = "UserDefinedSchema";

export const SWAGGER_TYPE = {
  STRING: "string",
  ARRAY: "array",
  NUMBER: "number",
  OBJECT: "object",
  OBJECT_ID: "objectId", // UUID
  BOOLEAN: "boolean",
  DATE: "date",
  DATE_TIME: "dateTime",
};

export const AUTH_PARAM = {
  name: "Authorization",
  in: "header",
  required: false,
  type: SWAGGER_TYPE.STRING,
};

export const ID_PARAM = {
  in: "path",
  name: "id",
  required: true,
  type: SWAGGER_TYPE.STRING,
};

export const LIMIT_PARAM = {
  in: "query",
  name: "limit",
  required: false,
  type: SWAGGER_TYPE.NUMBER,
};

export const OFFSET_PARAM = {
  in: "query",
  name: "offset",
  required: false,
  type: SWAGGER_TYPE.NUMBER,
};

export const TEMPLATE_PARAM = {
  in: "path",
  name: "template",
  required: true,
  type: SWAGGER_TYPE.STRING,
};

export const ACTION_CODE_PARAM = {
  in: "path",
  name: "actionCode",
  required: true,
  type: SWAGGER_TYPE.STRING,
};

export const REQUEST_BODY = {
  in: "body",
  name: DEFAULT_SCHEMA_NAME,
  schema: {
    $ref: `#/definitions/${DEFAULT_SCHEMA_NAME}`,
  },
};

export const REQUEST_QUERY = {
  in: "query",
  name: DEFAULT_SCHEMA_NAME,
  schema: {
    $ref: `#/definitions/${DEFAULT_SCHEMA_NAME}`,
  },
};

export const PAYLOAD_MIME_LIST = ["application/json"];

export const COMMON_RESPONSE = {
  200: {
    description: "OK",
  },

  404: {
    description: "Not Found",
  },

  422: {
    description: "Unprocessable Entity",
  },

  500: {
    description: "Internal Server Error",
  },

  502: {
    description: "Bad Gateway",
  },

  502: {
    description: "Service Unavailable",
  },
};

export const API_ACTION_CODE = {
  HEALTH_CHECK: "healthCheck",
  GET_SWAGGER: "getSwagger",

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

export const GET_LIST_RESPONSE = {
  ...COMMON_RESPONSE,

  200: {
    description: "OK",

    schema: {
      type: SWAGGER_TYPE.OBJECT,
      properties: {
        model: {
          type: SWAGGER_TYPE.STRING,
          description: "Data model",
        },

        data: {
          type: SWAGGER_TYPE.ARRAY,
          items: {
            $ref: `#/definitions/${DEFAULT_SCHEMA_NAME}`,
          },
          description: "Array of found paged records",
        },

        length: {
          type: SWAGGER_TYPE.NUMBER,
          description: "Found record amount",
        },

        query: {
          type: SWAGGER_TYPE.OBJECT,
          description: "Executed query to find data",
        },
      },
    },
  },
};

export const GET_BY_ID_RESPONSE = {
  ...COMMON_RESPONSE,

  200: {
    description: "OK",
    schema: {
      type: SWAGGER_TYPE.OBJECT,
      properties: {
        data: {
          type: SWAGGER_TYPE.OBJECT,
          $ref: `#/definitions/${DEFAULT_SCHEMA_NAME}`,
        },
      },
    },
  },
};

export const CREATE_RESPONSE = {
  ...COMMON_RESPONSE,

  200: {
    description: "OK",
  },
};

export const UPDATE_RESPONSE = {
  ...COMMON_RESPONSE,

  200: {
    description: "OK",
    // TODO: return object after updating
  },
};

export const DELETE_RESPONSE = {
  ...COMMON_RESPONSE,

  200: {
    description: "OK",
  },
};

export const EXPORT_RESPONSE = {
  ...COMMON_RESPONSE,

  200: {
    description: "OK",
    schema: {
      type: SWAGGER_TYPE.OBJECT,
      properties: {
        data: {
          type: SWAGGER_TYPE.ARRAY,
          items: {
            $ref: `#/definitions/${DEFAULT_SCHEMA_NAME}`,
          },
          description: "Data in excel file",
        },
      },
    },
  },
};

export const AGGREGATE_RESPONSE = {
  ...COMMON_RESPONSE,

  200: {
    description: "OK",
    schema: {
      type: SWAGGER_TYPE.OBJECT,
      properties: {
        data: {
          type: SWAGGER_TYPE.ARRAY,
          items: {
            $ref: `#/definitions/${DEFAULT_SCHEMA_NAME}`,
          },
          description: "Data in excel file",
        },
      },
    },
  },
};

export const PRINT_RESPONSE = {
  ...COMMON_RESPONSE,

  200: {
    description: "OK",
  },
};

export const TRIGGER_WORKFLOW_RESPONSE = {
  ...COMMON_RESPONSE,

  200: {
    description: "OK",
    // TODO: return object after updating
  },
};

export const POST_RESPONSE = {
  ...COMMON_RESPONSE,

  200: {
    description: "OK",
    // TODO: return object after updating
  },
};

export const REVERSE_RESPONSE = {
  ...COMMON_RESPONSE,

  200: {
    description: "OK",
    // TODO: return object after updating
  },
};

export const HTTP_PROTOCOL_LIST = ["https", "http"];

export const parseModelSchema = (modelSchema) => {
  const fieldList = getFieldList(modelSchema); // TODO: think more about nested document as ref document

  const definition = {
    _id: {
      type: SWAGGER_TYPE.STRING,
    },
  };

  const requiredFieldList = [];

  const fullFieldDataModel = {
    ...DATA_MODEL_TEMPLATE,
    ...fieldList,
  };

  Object.keys(fullFieldDataModel)
    .sort()
    .forEach((name) => {
      let { type, required, oneOf } = fullFieldDataModel[name];
      let format = null;

      switch (
        type // [..] follow https://swagger.io/docs/specification/data-models/data-types/
      ) {
        case DATA_TYPE.DATE_TIME: {
          type = SWAGGER_TYPE.STRING;
          format = "date-time";
          break;
        }

        case DATA_TYPE.DATE: {
          type = SWAGGER_TYPE.STRING;
          format = "date";
        }

        case DATA_TYPE.ID: {
          type = SWAGGER_TYPE.STRING;
          format = "uuid";
        }

        default:
          break;
      }

      if (oneOf && format) {
        definition[name] = { type, format, enum: oneOf };
      } else if (format) {
        definition[name] = { type, format };
      } else if (oneOf) {
        definition[name] = { type, enum: oneOf };
      } else {
        definition[name] = { type };
      }

      if (required) {
        requiredFieldList.push(name);
      }
    });

  return {
    requiredFieldList,
    definition,
  };
};

export const generateSwagger = (
  modelName,
  version,
  apiList,
  requiredFieldList,
  dataSchema,
  scheduleList = []
) => {
  if (!modelName) {
    throw new BosError("modelName is not given", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isArray(apiList)) {
    throw new BosError(`apiList is not an array: ${apiList}`, BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isArray(requiredFieldList)) {
    throw new BosError("requiredFieldList is an array", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!dataSchema) {
    throw new BosError("dataSchema is not given", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const swagger = {};

  swagger.swagger = "2.0";
  swagger.host = "api.erp.com";
  swagger.basePath = `/v${version ? version : "1"}/${modelName}`;

  swagger.info = {
    title: modelName,
    version: version ? version : "1",
    description: "",
    contact: {
      email: "vunduckhoi@gmail.com",
    },
    license: {
      name: "Apache 2.0",
      url: "http://www.apache.org/licenses/LICENSE-2.0.html",
    },
  };

  swagger.schemes = HTTP_PROTOCOL_LIST;
  swagger.scheduleList = scheduleList;
  swagger.paths = {};

  apiList.forEach((api) => {
    const { operationId, path, method, parameters, responses, produces } = api;

    if (!operationId) {
      throw new BosError("operationId is not given", BOS_ERROR.INVALID_ARG_VALUE);
    }

    if (!path) {
      throw new BosError("path is not given", BOS_ERROR.INVALID_ARG_VALUE);
    }

    if (!method) {
      throw new BosError("method is not given", BOS_ERROR.INVALID_ARG_VALUE);
    }

    if (!parameters) {
      throw new BosError("parameters is not given", BOS_ERROR.INVALID_ARG_VALUE);
    }

    if (!responses) {
      throw new BosError("responses is not given", BOS_ERROR.INVALID_ARG_VALUE);
    }

    let currentPath = swagger.paths[path];

    if (!currentPath) {
      currentPath = {};
      swagger.paths[path] = currentPath;
    }

    currentPath[method] = {
      operationId,
      parameters,
      responses,
      produces: produces || PAYLOAD_MIME_LIST,
    };
  });

  swagger.definitions = {
    [DEFAULT_SCHEMA_NAME]: {
      type: SWAGGER_TYPE.OBJECT,
      required: requiredFieldList,
      properties: dataSchema,
    },
  };

  return swagger;
};
