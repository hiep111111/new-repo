import config from "config";
import axios from "axios";

const apiGateway = config.get("apiGateway");
axios.defaults.headers.post["Content-Type"] = "application/json";

export const registerGatewayUser = (user, cb) => {
  const { fullName } = user;

  const firstSpacePosition = fullName.indexOf(" ");
  let lastName = fullName.substr(0, firstSpacePosition ? firstSpacePosition - 1 : 1);
  let firstName = fullName.replace(lastName, "").trim();

  if (lastName.length < 1) {
    lastName = ".";
  }

  if (firstName.length < 1) {
    firstName = ".";
  }

  const userData = {
    userName: user.userName,
    firstName,
    lastName,
    fullName,
    email: user.email,
  };

  axios
    .post(`${apiGateway}/users/`, userData)
    .then((result) => {
      cb(null, result.data);
    })
    .catch((err) => {
      cb(err);
    });
};

export const updateGatewayUserStatus = (userName, status, cb) => {
  axios
    .put(`${apiGateway}/users/${userName}/status`, { status })
    .then((result) => {
      cb(null, result.data);
    })
    .catch((err) => {
      cb(err);
    });
};

export const deleteGatewayUser = (userName, cb) => {
  axios
    .delete(`${apiGateway}/users/${userName}`)
    .then((result) => {
      cb(null, result.data);
    })
    .catch((err) => {
      cb(err);
    });
};

export const createGatewayCredential = (user, cb) => {
  const credentialData = {
    type: "jwt",
    consumerId: user.userName,
    credential: {},
  };

  axios
    .post(`${apiGateway}/credentials`, credentialData)
    .then((result) => {
      cb(null, result.data);
    })
    .catch((err) => {
      cb(err);
    });
};
