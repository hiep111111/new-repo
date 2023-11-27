import { DATA_TYPE } from "../../constants/dataTypeConstant";
import { USER_FEATURE_LIST } from "../../constants/policyConstant";
import { OPERATOR_LIST } from "../../constants/mathOperator";
import { API_LIST } from "../../helpers/controllerHelper";

import functionRefModel from "../refModels/functionRefModel";

const model = {
  modelName: "sysPolicies",

  data: {
    policyName: {
      type: DATA_TYPE.STRING,
      required: true,
      index: true,
    },

    ...functionRefModel,

    context: {
      type: DATA_TYPE.STRING,
      index: true,
      defaultValue: "",
    },

    serviceId: { type: DATA_TYPE.ID, required: true },
    serviceCode: { type: DATA_TYPE.STRING, required: true },
    serviceName: { type: DATA_TYPE.STRING, required: true },

    actionList: { type: DATA_TYPE.ARRAY, defaultValue: [] }, // service's actionList
    fieldList: { type: DATA_TYPE.ARRAY, defaultValue: [] }, // service's fieldList

    actionCode: {
      type: DATA_TYPE.STRING,
      required: true,
      index: true,
    },

    path: {
      type: DATA_TYPE.STRING,
      required: true,
      index: true,
    },

    method: {
      type: DATA_TYPE.STRING,
      required: true,
      index: true,
    },

    userFeatureList: [
      {
        featureName: { type: DATA_TYPE.STRING, oneOf: USER_FEATURE_LIST },

        operatorOptionList: { type: DATA_TYPE.ARRAY },
        selectedOperator: { type: DATA_TYPE.STRING, oneOf: OPERATOR_LIST },

        valueOptionList: { type: DATA_TYPE.ARRAY },
        selectedValueList: { type: DATA_TYPE.ARRAY },
      },
    ],

    fullRequestFieldList: { type: DATA_TYPE.ARRAY },
    requestFieldList: { type: DATA_TYPE.ARRAY },
    requestExceptFieldList: { type: DATA_TYPE.ARRAY },
    allowedRequestFieldList: { type: DATA_TYPE.ARRAY },

    fullResponseFieldList: { type: DATA_TYPE.ARRAY },
    responseFieldList: { type: DATA_TYPE.ARRAY },
    responseExceptFieldList: { type: DATA_TYPE.ARRAY },
    allowedResponseFieldList: { type: DATA_TYPE.ARRAY },

    recordFeatureList: [
      {
        featureName: { type: DATA_TYPE.STRING },
        type: { type: DATA_TYPE.STRING },

        operatorOptionList: { type: DATA_TYPE.ARRAY },
        selectedOperator: { type: DATA_TYPE.STRING, oneOf: OPERATOR_LIST },

        isUserFeature: { type: DATA_TYPE.BOOLEAN },
        selectedValueList: { type: DATA_TYPE.STRING }, // String-like ARRAY, separated by ","
      },
    ],

    fullApiParamList: { type: DATA_TYPE.ARRAY, defaultValue: [] },

    apiFeatureList: [
      {
        featureName: { type: DATA_TYPE.STRING },
        type: { type: DATA_TYPE.STRING },

        operatorOptionList: { type: DATA_TYPE.ARRAY },
        selectedOperator: { type: DATA_TYPE.STRING, oneOf: OPERATOR_LIST },

        isUserFeature: { type: DATA_TYPE.BOOLEAN },
        selectedValueList: { type: DATA_TYPE.STRING }, // String-like ARRAY, separated by ","
      },
    ],
  },

  apiList: API_LIST.CRUD,
};

export default model;
