import { DATA_TYPE } from "../../constants/dataTypeConstant";

const refModel = {
  functionId: {
    type: DATA_TYPE.ID,
    required: true,
    refModelName: "functions",
    refKeyField: "_id",
    relatedFields: ["functionUrl", "functionName"],
  },

  functionUrl: { type: DATA_TYPE.STRING },
  functionName: { type: DATA_TYPE.STRING },
};

export default refModel;
