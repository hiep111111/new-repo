import { DATA_TYPE } from "../../constants/dataTypeConstant";
import { API_LIST } from "../../helpers/controllerHelper";

const model = {
  modelName: "modules",

  data: {
    moduleCode: {
      type: DATA_TYPE.STRING,
      required: true,
      index: true,
      unique: true,
    },

    moduleName: {
      type: DATA_TYPE.STRING,
      required: true,
      index: true,
    },

    applicationId: {
      type: DATA_TYPE.ID,
      required: true,
      refModelName: "applications",
      refKeyField: "_id",
      relatedFields: ["applicationCode", "applicationName"],
    },

    applicationCode: { type: DATA_TYPE.STRING },
    applicationName: { type: DATA_TYPE.STRING },

    icon: { type: DATA_TYPE.STRING, defaultValue: "cube" },
    showAsIcon: { type: DATA_TYPE.BOOLEAN, defaultValue: false },
    moduleOrder: { type: DATA_TYPE.NUMBER },
  },

  apiList: API_LIST.CRUD,
};

export default model;
