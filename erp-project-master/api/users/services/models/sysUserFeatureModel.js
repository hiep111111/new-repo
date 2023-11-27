import { DATA_TYPE } from "../../constants/dataTypeConstant";
import { API_LIST } from "../../helpers/controllerHelper";

const model = {
  modelName: "sysUserFeatures",

  data: {
    userId: {
      type: DATA_TYPE.ID,
      required: true,
      refModelName: "users",
      refKeyField: "_id",
      relatedFields: ["userName", "fullName", "email", "phone"],
    },

    userName: { type: DATA_TYPE.STRING, index: true },
    fullName: { type: DATA_TYPE.STRING },

    email: { type: DATA_TYPE.EMAIL },
    phone: { type: DATA_TYPE.PHONE },

    userFeatureList: [
      {
        featureName: { type: DATA_TYPE.STRING }, // oneOf: USER_FEATURE_LIST
        value: { type: DATA_TYPE.ARRAY },
      },
    ],
  },

  apiList: API_LIST.R,
};

export default model;
