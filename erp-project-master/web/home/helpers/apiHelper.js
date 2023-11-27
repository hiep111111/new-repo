import axios from "axios";
import humps from "humps";
import pluralize from "pluralize";
import qs from "qs";
import { isArray, omit, isString } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { API_GATEWAY_URL } from "../constants/config";
import { getToken, getFunctionId, isObjectId } from "./commonHelper";
import BosError, { BOS_ERROR } from "./errorHelper";

export const apiUrlOptions = {
  encode: false,
  arrayFormat: "indices", // [!] using "brackets" makes merged value issue
};

const isAbsoluteUrl = (endPoint) => {
  return endPoint.startsWith("http");
};

export const getRequestHeader = (clientContext = {}) => {
  const { functionId, policyContext } = clientContext;

  return {
    Authorization: `Bearer ${getToken() || "jwt.token.here"}`,
    "x-function-id": functionId || getFunctionId(),
    "x-policy-context": policyContext || "",
    "x-trace-id": uuidv4(),
    // [!] TODO: Accept-Language bind to web language
  };
};

export const convertModelNameApiEndpoint = (modelName) => {
  if (!modelName) {
    throw new BosError("modelName is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  return modelName ? pluralize.plural(humps.camelize(modelName)) : null;
};

export const apiGet = async (endPoint, queryString, clientContext) => {
  try {
    if (!endPoint) {
      throw new BosError("endPoint is undefined", BOS_ERROR.INVALID_ARG_VALUE);
    }

    const result = await axios({
      method: "GET",
      url: isAbsoluteUrl(endPoint) ? `${endPoint}/${queryString}` : `${API_GATEWAY_URL}/${endPoint}/${queryString}`,
      headers: getRequestHeader(clientContext),
    });

    return { data: result.data };
  } catch (error) {
    return { error: error.response || error };
  }
};

export const apiGetList = async (endPoint, query, clientContext) => {
  const { offset, limit, page, itemsPerPage } = query;

  if (limit === 0) {
    return {
      model: endPoint,
      data: [],
      query,
    };
  }

  let queryString = "?";
  const apiQuery = {};

  Object.entries(query).forEach(([key, value]) => {
    // copy and reject null / empty / undefined values
    if (["fields", "orderBy"].indexOf(key) > -1) {
      if (isArray(value)) {
        // if ARRAY then CONVERT to NOT SPACED STRING
        apiQuery[key] = value.join(",").replace(/\s/g, "");
      } else {
        apiQuery[key] = value.replace(/\s/g, "");
      }
    } else {
      // other fields
      apiQuery[key] = value;
    }
  });

  if (apiQuery.page) {
    apiQuery.offset = (page - 1) * itemsPerPage;
    apiQuery.limit = itemsPerPage;
  } else {
    apiQuery.offset = typeof offset === "undefined" ? 0 : offset;

    if (typeof limit !== "undefined") {
      apiQuery.limit = limit;
    }
  }

  apiQuery.itemsPerPage = undefined;
  apiQuery.page = undefined;

  queryString += qs.stringify(apiQuery, apiUrlOptions);

  return apiGet(endPoint, queryString, clientContext);
};

export const apiGetById = async (endPoint, objectId, fields, checkPermission = false, clientContext) => {
  try {
    if (!isObjectId(objectId)) {
      throw new BosError("objectId is not correct", BOS_ERROR.INVALID_ARG_VALUE);
    }

    let query;

    if (fields && checkPermission) {
      query = `${objectId}?fields=${fields}&checkPermission=true`;
    } else if (fields) {
      query = `${objectId}?fields=${fields}`;
    } else if (checkPermission) {
      query = `${objectId}?checkPermission=${checkPermission}`;
    }

    return apiGet(endPoint, query, clientContext);
  } catch (error) {
    return { error: error.response || error };
  }
};

export const apiPost = async (endPoint, data, clientContext) => {
  try {
    const result = await axios({
      method: "POST",
      data,
      url: isAbsoluteUrl(endPoint) ? endPoint : `${API_GATEWAY_URL}/${endPoint}/`,
      headers: getRequestHeader(clientContext),
    });

    return { data: result.data };
  } catch (error) {
    return { error: error.response || error };
  }
};

export const apiGetWithBody = async (endPoint, data, clientContext) => {
  try {
    const result = await axios({
      method: "GET",
      params: data,
      url: isAbsoluteUrl(endPoint) ? endPoint : `${API_GATEWAY_URL}/${endPoint}/`,
      headers: getRequestHeader(clientContext),
    });

    return { data: result.data };
  } catch (error) {
    return { error: error.response || error };
  }
};

export const apiCreate = async (endPoint, data, clientContext) => {
  return apiPost(endPoint, data, clientContext);
};

export const apiDelete = async (endPoint, objectId, clientContext) => {
  try {
    if (!endPoint) {
      throw new BosError("endPoint is undefined", BOS_ERROR.INVALID_ARG_VALUE);
    }

    if (!isObjectId(objectId)) {
      throw new BosError("objectId is not correct", BOS_ERROR.INVALID_ARG_VALUE);
    }

    const result = await axios({
      method: "DELETE",
      url: isAbsoluteUrl(endPoint) ? `${endPoint}/${objectId}` : `${API_GATEWAY_URL}/${endPoint}/${objectId}`,
      headers: getRequestHeader(clientContext),
    });

    return { data: result.data };
  } catch (error) {
    return { error: error.response || error };
  }
};

export const apiDeleteById = async (endPoint, objectId, clientContext) => {
  if (!endPoint) {
    throw new BosError("endPoint is undefined", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isObjectId(objectId)) {
    throw new BosError("objectId is not correct", BOS_ERROR.INVALID_ARG_VALUE);
  }

  return apiDelete(endPoint, objectId, clientContext);
};

export const apiUpdate = async (endPoint, objectId, data, clientContext) => {
  try {
    if (!endPoint) {
      throw new BosError("updated endPoint is undefined", BOS_ERROR.INVALID_ARG_VALUE);
    }

    if (!isObjectId(objectId)) {
      throw new BosError("updated objectId is not correct", BOS_ERROR.INVALID_ARG_VALUE);
    }

    if (!data) {
      throw new BosError("updated data is undefined", BOS_ERROR.INVALID_ARG_VALUE);
    }

    const result = await axios({
      method: "PUT",
      data,
      url: isAbsoluteUrl(endPoint) ? `${endPoint}/${objectId}` : `${API_GATEWAY_URL}/${endPoint}/${objectId}`,
      headers: getRequestHeader(clientContext),
    });

    return { data: result.data };
  } catch (error) {
    return { error: error.response || error };
  }
};

export const apiPatch = async (endPoint, objectId, data, clientContext) => {
  try {
    if (!endPoint) {
      throw new BosError("updated endPoint is undefined", BOS_ERROR.INVALID_ARG_VALUE);
    }

    if (!isObjectId(objectId)) {
      throw new BosError("updated objectId is not correct", BOS_ERROR.INVALID_ARG_VALUE);
    }

    if (!data) {
      throw new BosError("updated data is undefined", BOS_ERROR.INVALID_ARG_VALUE);
    }

    const result = await axios({
      method: "PATCH",
      data,
      url: isAbsoluteUrl(endPoint) ? `${endPoint}/${objectId}` : `${API_GATEWAY_URL}/${endPoint}/${objectId}`,
      headers: getRequestHeader(clientContext),
    });

    return { data: result.data };
  } catch (error) {
    return { error: error.response || error };
  }
};

export const apiUpdateById = async (endPoint, data, clientContext) => {
  try {
    if (!endPoint) {
      throw new BosError("updated endPoint is undefined", BOS_ERROR.INVALID_ARG_VALUE);
    }

    if (!data) {
      throw new BosError("updated data is undefined", BOS_ERROR.INVALID_ARG_VALUE);
    }

    const objectId = data._id;

    if (!isObjectId(objectId)) {
      throw new BosError("data doesn't include correct correct id field", BOS_ERROR.INVALID_ARG_VALUE);
    }

    return apiUpdate(endPoint, objectId, data, clientContext);
  } catch (error) {
    return { error: error.response || error };
  }
};

export const apiTriggerWorkflow = async (endPoint, objectId, actionCode, data, clientContext) => {
  try {
    if (!endPoint) {
      throw new BosError("workflow's endPoint is undefined", BOS_ERROR.INVALID_ARG_VALUE);
    }

    if (!isObjectId(objectId)) {
      throw new BosError("objectId is not correct", BOS_ERROR.INVALID_ARG_VALUE);
    }

    if (!actionCode) {
      throw new BosError("workflow's actionCode is undefined", BOS_ERROR.INVALID_ARG_VALUE);
    }

    if (!data) {
      throw new BosError("workflow's data is undefined", BOS_ERROR.INVALID_ARG_VALUE);
    }

    const result = await axios({
      method: "PATCH",
      data,
      url: isAbsoluteUrl(endPoint) ? `${endPoint}/${actionCode}/${objectId}` : `${API_GATEWAY_URL}/${endPoint}/${actionCode}/${objectId}`,
      headers: getRequestHeader(clientContext),
    });

    return { data: result.data };
  } catch (error) {
    return { error: error.response || error };
  }
};

export const apiDownloadList = async (endPoint, action, query, clientContext) => {
  try {
    if (!endPoint) {
      throw new BosError("endPoint is undefined", BOS_ERROR.INVALID_ARG_VALUE);
    }

    let endpointWithAction = action ? `${endPoint}/${action}` : endPoint; // [!] not validate action
    let queryString = "?";
    const { fields } = query;

    const apiQuery = {
      ...omit(query, ["limit", "itemsPerPage", "page"]), // get max server limit
      fields: isString(fields) ? fields.replace(/\s/g, "") : fields.join(",").replace(/\s/g, ""), // change array into string
    };

    queryString += qs.stringify(apiQuery, apiUrlOptions);

    const result = await axios({
      method: "GET",
      responseType: "arraybuffer",
      url: isAbsoluteUrl(endpointWithAction) ? `${endpointWithAction}/${queryString}` : `${API_GATEWAY_URL}/${endpointWithAction}/${queryString}`,
      headers: getRequestHeader(clientContext),
    });

    return { data: result.data };
  } catch (error) {
    return { error: error.response || error };
  }
};

export const apiPrint = async (endPoint, template, data, clientContext) => {
  try {
    if (!endPoint) {
      throw new BosError("endPoint is undefined", BOS_ERROR.INVALID_ARG_VALUE);
    }

    if (!template) {
      throw new BosError("template is undefined", BOS_ERROR.INVALID_ARG_VALUE);
    }

    const result = await axios({
      method: "POST",
      responseType: "blob",
      url: isAbsoluteUrl(endPoint) ? `${endPoint}/${template}` : `${API_GATEWAY_URL}/${endPoint}/${template}`,
      headers: getRequestHeader(clientContext),
      data,
    });

    return { data: result.data };
  } catch (error) {
    // TODO: blob to text to show error data
    return { error: error.response || error };
  }
};

export const apiUpload = async (fileList, clientContext) => {
  try {
    if (!fileList) {
      throw new BosError("fileList is not an array", BOS_ERROR.INVALID_ARG_VALUE);
    }

    const data = new FormData();

    fileList.forEach((file) => {
      data.append(file.name, file);
    });

    const result = await axios({
      method: "POST",
      data,
      url: `${API_GATEWAY_URL}/v1/files`,
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${getToken()}`,
      },
    });

    return { data: result.data };
  } catch (error) {
    return { error: error.response || error };
  }
};
