import { DATA_TYPE } from "../../constants/dataTypeConstant";

const refModel = {
  userId: {
    type: DATA_TYPE.ID,
    refModelName: "users",
    refKeyField: "_id",
    relatedFields: ["userName", "fullName"],
  },

  userName: { type: DATA_TYPE.STRING },
  fullName: { type: DATA_TYPE.STRING },
};

export default refModel;
