import { DATA_TYPE } from "../../constants/dataTypeConstant";
import { API_LIST } from "../../helpers/controllerHelper";

const model = {
  modelName: "sysAccessLists",

  data: {
    userId: {
      type: DATA_TYPE.ID,
      required: true,
      refModelName: "users",
      refKeyField: "_id",
      relatedFields: ["userName", "fullName"],
    },

    userName: { type: DATA_TYPE.STRING, index: true },
    fullName: { type: DATA_TYPE.STRING },

    policyId: {
      // [!] cause of recreation => no need to keep data consistent
      type: DATA_TYPE.ID,
      required: true,
    },

    policyName: { type: DATA_TYPE.STRING, required: true },

    functionId: {
      type: DATA_TYPE.ID,
      required: true,
      refModelName: "functions",
      refKeyField: "_id",
      relatedFields: ["functionUrl", "functionName"],
    },

    functionUrl: { type: DATA_TYPE.STRING, required: true },
    functionName: { type: DATA_TYPE.STRING, required: true },
    context: { type: DATA_TYPE.STRING, defaultValue: "" },

    serviceId: { type: DATA_TYPE.ID, required: true },
    serviceCode: { type: DATA_TYPE.STRING, required: true },
    serviceName: { type: DATA_TYPE.STRING, required: true },

    actionCode: { type: DATA_TYPE.STRING, required: true },
    path: { type: DATA_TYPE.STRING, required: true },
    method: { type: DATA_TYPE.STRING, required: true },

    allowedRequestFieldList: { type: DATA_TYPE.ARRAY },
    allowedResponseFieldList: { type: DATA_TYPE.ARRAY },

    recordFeatureList: [
      {
        featureName: { type: DATA_TYPE.STRING },
        type: { type: DATA_TYPE.STRING },
        selectedOperator: { type: DATA_TYPE.STRING }, // oneOf: OPERATOR_LIST

        isUserFeature: { type: DATA_TYPE.BOOLEAN },
        selectedValueList: { type: DATA_TYPE.STRING }, // String-like ARRAY, separated by ","
      },
    ],

    apiFeatureList: [
      {
        featureName: { type: DATA_TYPE.STRING },
        type: { type: DATA_TYPE.STRING },
        selectedOperator: { type: DATA_TYPE.STRING }, // oneOf: OPERATOR_LIST

        isUserFeature: { type: DATA_TYPE.BOOLEAN },
        selectedValueList: { type: DATA_TYPE.STRING }, // String-like ARRAY, separated by ","
      },
    ],
  },

  apiList: API_LIST.R,
};

export default model;
