import crypto from "crypto";
import jwt from "jsonwebtoken";
import { keys, pick, omit, isUndefined, orderBy } from "lodash";
import fs from "fs";
import path from "path";
import svgCaptcha from "svg-captcha";

import apm from "../../helpers/apmHelper";
import sb from "../../helpers/serviceBusHelper";
import { equalToId } from "../../helpers/commonHelper";
import {
  ID_PARAM,
  REQUEST_BODY,
  UPDATE_RESPONSE,
  SWAGGER_TYPE,
  API_ACTION_CODE,
} from "../../helpers/swaggerHelper";
import {
  API,
  getListController,
  getByIdController,
  deleteController,
  getCRUDPermission,
} from "../../helpers/controllerHelper";
import { COMMON_EVENT, getServiceEventType } from "../../helpers/eventHelper";
import { HTTP_RESPONSE_CODE } from "../../constants/httpConstant";
import { HTTP_METHOD } from "../../constants/httpConstant";

import { getUniqueResource, getModuleFunctionList } from "../helpers/userHelper";

const mongoose = require("mongoose");

const OMITTED_FIELDS = ["salt", "hash"];
const modelName = "users";

const normalizeEmail = (email) => {
  return email.toLowerCase().trim();
};

export const createUserController = async (req, res, next) => {
  const Users = mongoose.model(modelName);
  const { body, context } = req;

  const {
    userName,
    fullName,
    password,
    email,
    phone,
    biography,
    isAdmin,
    roleList,
    active,
    employeeNo,
  } = body;
  const user = await Users.findOne({ userName });

  if (user) {
    res
      .status(HTTP_RESPONSE_CODE.UNPROCESSABLE_ENTITY)
      .json({ error: `Account "${userName}" has already existed.` });
    return;
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 512, "sha512").toString("hex");
  const { moduleList, functionList } = getUniqueResource(roleList);
  const {
    serviceCode,
    userId: createdBy,
    userName: createdByUserName,
    fullName: createdByFullName,
    traceId,
  } = context;

  const newUser = new Users({
    userName: userName.toLowerCase(),
    fullName,

    salt,
    hash,

    email: normalizeEmail(email),
    phone,

    employeeNo,
    biography,
    roleList,
    isAdmin,
    active,

    createdBy,
    createdByUserName,
    createdByFullName,

    functionList,
    moduleList,
    deleted: false,
  });

  context.apiActionCode = API_ACTION_CODE.CREATE;

  const perm = await getCRUDPermission(context, keys(newUser), newUser);

  if (!perm) {
    res
      .status(HTTP_RESPONSE_CODE.FORBIDDEN)
      .json({ error: "Forbidden: Can not get permission list." });
    return;
  }

  newUser
    .save()
    .then((createdUser) => {
      const newData = pick(createdUser, [
        "_id",
        "userName",
        "fullName",
        "email",
        "phone",
        "isAdmin",
        "roleList",
        "functionList",
        "moduleList",
        "employeeNo",
        "active",
      ]);
      const eventType = getServiceEventType("users", COMMON_EVENT.CREATED);

      sb.publish(serviceCode, eventType, { newData }, traceId, (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        } else {
          return res.json({ data: newData });
        }
      });
    })
    .catch((error) => {
      apm.captureError(error);
      next(error);
    });
};

export const updateStaffProfile = async (req, res, next) => {
  const { body, dataObject, context } = req;
  const { userId, serviceCode, traceId } = context;

  if (!equalToId(userId, dataObject._id)) {
    res
      .status(HTTP_RESPONSE_CODE.FORBIDDEN)
      .json({ error: "Forbidden: Can not update other profile." });
    return;
  }

  try {
    const oldData = omit(dataObject._doc, OMITTED_FIELDS); // "dataObject._doc" keep real data NOT dataObject (console.log can not find out!)
    const {
      email,
      phone,
      biography,
      password,
      avatarFileId,
      signatureImage,
      employeeNo,
      sapAccount,
      sapPassword,
    } = body;

    if (!isUndefined(email)) {
      dataObject.email = normalizeEmail(email);
    }

    if (!isUndefined(phone)) {
      dataObject.phone = phone;
    }

    if (!isUndefined(biography)) {
      dataObject.biography = biography;
    }

    if (!isUndefined(avatarFileId)) {
      dataObject.avatarFileId = avatarFileId;
    }

    if (password) {
      const salt = crypto.randomBytes(16).toString("hex");

      dataObject.salt = salt;
      dataObject.hash = crypto.pbkdf2Sync(password, salt, 10000, 512, "sha512").toString("hex");
    }

    dataObject
      .save()
      .then((user) => {
        const newData = omit(user._doc, OMITTED_FIELDS); // "user._doc" keep real data NOT user (console.log can not find out!)
        const eventType = getServiceEventType("users", COMMON_EVENT.UPDATED);

        sb.publish(serviceCode, eventType, { oldData, newData }, traceId, (err) => {
          if (err) {
            next(err);
          } else {
            return res.json({ data: newData });
          }
        });
      })
      .catch((err) => {
        apm.captureError(err);
        next(err);
      });
  } catch (error) {
    apm.captureError(error);
    next(error);
  }
};

export const unlockAccount = async (req, res, next) => {
  const { dataObject, user } = req;

  if (!user.isAdmin) {
    res
      .status(HTTP_RESPONSE_CODE.FORBIDDEN)
      .json({ error: "Forbidden: Can not update other profile." });
    return;
  }

  try {
    const UserLoggings = mongoose.model("userLoggings");

    await UserLoggings.insertMany([
      {
        userId: dataObject._id,
        userName: dataObject.userName,
        userFullName: dataObject.fullName,
        expiredLockedAt: Date.now(),
        failedCount: 0,
      },
    ]);

    return res.json({ data: dataObject });
  } catch (error) {
    apm.captureError(error);
    next(error);
  }
};

export const updateUserController = async (req, res, next) => {
  try {
    const { dataObject, context, body } = req;
    const { serviceCode, traceId } = context;
    const changedFields = [];
    const oldData = omit(dataObject._doc, OMITTED_FIELDS); // "dataObject._doc" keep real data NOT dataObject (console.log can not find out!)

    const {
      fullName,
      password,
      email,
      phone,
      biography,
      avatarFileId,
      roleList,
      isAdmin,
      active,
      defaultFunctionId,
      defaultFunctionUrl,
      defaultFunctionName,
      defaultModuleId,
      defaultModuleCode,
      defaultModuleName,
    } = body;

    if (fullName) {
      dataObject.fullName = fullName;
      changedFields.push("fullName");
    }

    if (email) {
      dataObject.email = normalizeEmail(email);
      changedFields.push("email");
    }

    if (phone) {
      dataObject.phone = phone;
      changedFields.push("phone");
    }

    if (biography) {
      dataObject.biography = biography;
      changedFields.push("biography");
    }

    if (avatarFileId) {
      dataObject.avatarFileId = avatarFileId;
      changedFields.push("avatarFileId");
    }

    if (defaultFunctionId) {
      dataObject.defaultFunctionId = defaultFunctionId;
      dataObject.defaultFunctionUrl = defaultFunctionUrl;
      dataObject.defaultFunctionName = defaultFunctionName;

      dataObject.defaultModuleId = defaultModuleId;
      dataObject.defaultModuleCode = defaultModuleCode;
      dataObject.defaultModuleName = defaultModuleName;

      changedFields.push("defaultFunctionId");
      changedFields.push("defaultModuleId");
    }

    if (password) {
      const salt = crypto.randomBytes(16).toString("hex");
      dataObject.salt = salt;
      dataObject.hash = crypto.pbkdf2Sync(password, salt, 10000, 512, "sha512").toString("hex");
    }

    if (roleList) {
      dataObject.roleList = roleList;
      changedFields.push("roleList");

      const { moduleList, functionList } = getUniqueResource(roleList);

      dataObject.functionList = functionList;
      changedFields.push("functionList");

      dataObject.moduleList = moduleList;
      changedFields.push("moduleList");
    }

    dataObject.isAdmin = isAdmin;
    dataObject.active = active;
    changedFields.push("isAdmin");

    context.apiActionCode = API_ACTION_CODE.UPDATE;

    const perm = await getCRUDPermission(context, changedFields, oldData);

    if (!perm) {
      res
        .status(HTTP_RESPONSE_CODE.FORBIDDEN)
        .json({ error: "Forbidden: Can not get permission list." });
      return;
    }

    dataObject
      .save()
      .then((user) => {
        const newData = omit(user._doc, OMITTED_FIELDS); // "user._doc" keep real data NOT "user" (console.log can not find out!)
        const eventType = getServiceEventType("users", COMMON_EVENT.UPDATED);

        sb.publish(serviceCode, eventType, { oldData, newData }, traceId, (err) => {
          if (err) {
            next(err);
          } else {
            return res.json({ data: newData });
          }
        });
      })
      .catch((err) => {
        apm.captureError(err);
        next(err);
      });
  } catch (error) {
    apm.captureError(error);
    next(error);
  }
};

export const loginController = async (req, res, next) => {
  const Users = mongoose.model(modelName);
  const data = req.body.credentials;
  const { userName: userNameBody, password } = data;

  const userName = userNameBody.split("@")[0];

  if (!userName) {
    return res.status(422).json({ error: { message: "Chưa nhập tài khoản" } });
  }

  if (!password) {
    return res.status(422).json({ error: { message: "Chưa nhập mât khẩu" } });
  }

  try {
    const user = await Users.findOne(
      {
        userName,
        active: true,

        deleted: {
          $ne: true,
        },
      },
      {
        _id: 1,
        userName: 1,
        email: 1,
        fullName: 1,
        avatarFileId: 1,
        signatureImage: 1,
        functionList: 1,
        moduleList: 1,
        canLoginByLocalAccount: 1,
        isAdmin: 1,
        salt: 1,
        hash: 1,
      }
    ).lean();

    if (!user) {
      return res.status(403).json({ error: { message: "Tài khoản không tồn tại1!" } });
    }

    let checkLogin = true;

    const hash = crypto.pbkdf2Sync(password, user.salt, 10000, 512, "sha512").toString("hex");
    const UserLoggings = mongoose.model("userLoggings");
    const infoLogin = await UserLoggings.findOne({ userId: user._id }).sort({ createdAt: -1 });

    if (infoLogin && infoLogin.expiredLockedAt > Date.now()) {
      return res
        .status(403)
        .json({ error: { message: "Tài khoản đã bị khóa. Vui lòng thử lại sau 30 phút!" } });
    }

    const failedCount = infoLogin && infoLogin.failedCount ? infoLogin.failedCount + 1 : 1;
    const logging = {
      userId: user._id,
      userName: user.userName,
      userFullName: user.fullName,
      failedCount,
    };

    if (hash !== user.hash /*  && !checkEmail */) checkLogin = false;

    if (!checkLogin) {
      if (infoLogin && failedCount > 4) logging.expiredLockedAt = Date.now() + 30 * 60 * 1000;

      await UserLoggings.insertMany([logging]);

      const captcha = svgCaptcha.create({
        size: 6,
        ignoreChars: "0o1il",
        noise: 4,
        color: true,
      });

      return res
        .status(403)
        .json({
          error: { message: "Tài khoản hoặc mật khẩu không đúng!" },
          captcha,
          failedCount: failedCount - 1,
        });
    }

    await UserLoggings.insertMany([
      {
        ...logging,
        expiredLockedAt: Date.now(),
        failedCount: 0,
      },
    ]);

    const {
      _id,
      fullName,
      isAdmin,
      moduleList,
      functionList,
      avatarFileId,
      signatureImage,
      departmentList,
    } = user;

    const currentUser = {
      _id,
      userName,
      fullName,
      avatarFileId,
      isAdmin,
      signatureImage,
      departmentList,
    };

    const cert = fs.readFileSync(path.resolve(__dirname, "../certs/private_key.pem"));

    currentUser.token = jwt.sign(
      {
        userId: _id,
        userName,
        fullName,
        isAdmin,
      },
      cert,
      {
        algorithm: "RS256",
        notBefore: 0,
        expiresIn: 86400, // expires in 24 hours
      }
    );

    const currentModule = moduleList[0];

    if (currentModule) {
      currentUser.currentModuleId = currentModule.moduleId;
      currentUser.functionList = getModuleFunctionList(functionList, currentModule.moduleCode);
      currentUser.moduleList = orderBy(moduleList, ["moduleOrder"], ["asc"]);
    } else {
      currentUser.currentModuleId = "";
      currentUser.functionList = [];
      currentUser.moduleList = [];
    }

    return res.json({ data: currentUser });
  } catch (error) {
    apm.captureError(error);
    next(error);
  }
};

export const pingController = async (req, res, next) => {
  const Users = mongoose.model(modelName);
  const { context, body } = req;
  const { userId } = context;
  const { moduleCode } = body;

  if (!userId) {
    return res.status(422).json({ error: { message: "Can NOT get token data!" } });
  }

  try {
    const user = await Users.findOne(
      {
        _id: userId,
        active: true,

        deleted: {
          $ne: true,
        },
      },
      {
        userName: 1,
        fullName: 1,
        functionList: 1,
        moduleList: 1,
        avatarFileId: 1,
        signatureImage: 1,
        isAdmin: 1,
        defaultModuleCode: 1,
        defaultFunctionId: 1,
        defaultFunctionUrl: 1,
        defaultFunctionName: 1,
      }
    ).lean();

    if (user) {
      const {
        moduleList,
        functionList,
        defaultModuleCode,
        defaultFunctionId,
        defaultFunctionUrl,
        defaultFunctionName,
      } = user;

      const currentModule =
        moduleCode === "home" || !moduleCode
          ? defaultModuleCode || moduleList[0]
          : moduleList.find((f) => f.moduleCode === moduleCode);

      if (moduleList.length === 0 || !currentModule) {
        console.warn(`Can not get current module "${moduleCode}"`);
        return res.status(403).json({ error: { message: "Bạn không chưa được phân quyền!" } });
      }

      const { moduleId: currentModuleId, moduleCode: currentModuleCode } = currentModule;

      const hasDefaultFunction = currentModuleCode === defaultModuleCode;

      const data = {
        ...pick(user, [
          "_id",
          "userName",
          "fullName",
          "avatarFileId",
          "isAdmin",
          "signatureImage",
          "moduleList",
        ]),

        currentModuleId: currentModuleId || "",
        currentModuleCode: currentModuleCode || "",

        functionList: currentModule ? getModuleFunctionList(functionList, moduleCode) : [],
        moduleList: currentModule ? orderBy(moduleList, ["moduleOrder"], ["asc"]) : [],

        defaultFunctionId: hasDefaultFunction ? defaultFunctionId : "",
        defaultFunctionUrl: hasDefaultFunction ? defaultFunctionUrl : "",
        defaultFunctionName: hasDefaultFunction ? defaultFunctionName : "",
      };

      return res.json({ data });
    }

    return res.sendStatus(404);
  } catch (error) {
    console.log("error", error);
    apm.captureError(error);
    next(error);
  }
};

const apiList = [
  {
    ...API.GET_LIST,
    controller: getListController,
  },
  {
    ...API.GET_BY_ID,
    controller: getByIdController,
  },
  {
    operationId: "updateProfileById",
    method: HTTP_METHOD.PUT,
    path: "/updateProfile/:id",
    parameters: [ID_PARAM, REQUEST_BODY], // TODO: limit REQUEST_BODY
    responses: UPDATE_RESPONSE,
    eventType: COMMON_EVENT.UPDATED,
    controller: updateStaffProfile,
  },
  {
    operationId: "unlockAccountById",
    method: HTTP_METHOD.PUT,
    path: "/unlockAccount/:id",
    parameters: [ID_PARAM, REQUEST_BODY], // TODO: limit REQUEST_BODY
    responses: UPDATE_RESPONSE,
    eventType: COMMON_EVENT.UPDATED,
    controller: unlockAccount,
  },
  {
    ...API.UPDATE,
    controller: updateUserController,
  },
  {
    ...API.DELETE,
    controller: deleteController,
  },
  {
    operationId: "login",
    method: HTTP_METHOD.POST,
    path: "/login",
    parameters: [
      {
        in: "body",
        name: "credentials",
        required: true,
        type: SWAGGER_TYPE.OBJECT,
      },
    ],
    responses: UPDATE_RESPONSE,
    controller: loginController,
  },
  {
    operationId: "ping",
    method: HTTP_METHOD.POST,
    path: "/ping",
    parameters: [], // check jwt in http header
    responses: UPDATE_RESPONSE,
    controller: pingController,
  },
  {
    ...API.CREATE,
    controller: createUserController,
  },
];

export default apiList;
