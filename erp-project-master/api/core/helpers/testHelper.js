import mongoose from "mongoose";
import config from "config";

import { registerModelList } from "./modelHelper";
import sb from "./serviceBusHelper";

mongoose.Promise = global.Promise;
mongoose.set("debug", false);

export let crossModelDataConstraint = null;

// mongoose.connection.on('connected', function () {
//   console.log(`Mongoose connected.`);
// });

// mongoose.connection.on('error',function (err) {
//   console.log(`Mongoose error:\n ${err}`);
// });

// mongoose.connection.on('disconnected', function () {
//   console.log('Mongoose disconnected.');
// });

const _deleteAllDocumentsFromCollection = async () => {
  const collections = Object.keys(mongoose.connection.collections);

  for (const collectionName of collections) {
    const collection = mongoose.connection.collections[collectionName];
    await collection.deleteMany();
  }
};

const _dropAllCollections = async () => {
  const collections = Object.keys(mongoose.connection.collections);

  for (const collectionName of collections) {
    const collection = mongoose.connection.collections[collectionName];

    try {
      await collection.drop();
    } catch (error) {
      if (error.message === "ns not found") {
        return;
      }

      if (error.message.includes("a background operation is currently running")) {
        return;
      }
    }
  }
};

export const setupTestEnv = (modelList, deleteAllDocumentAfterEach = true, parseModelConstraint = true) => {
  beforeAll(async () => {
    crossModelDataConstraint = registerModelList(modelList, parseModelConstraint);

    const db = config.get("testDatabase");
    await mongoose.connect(db, { useNewUrlParser: true, useUnifiedTopology: true });

    sb.init(config.get("testMessageBroker.server"), config.get("testMessageBroker.exchangeName"), (error) => {
      if (error) {
        console.log("Can not setup test environment", error);
        throw error;
      }
    });
  });

  afterEach(async () => {
    if (deleteAllDocumentAfterEach) {
      await _deleteAllDocumentsFromCollection();
    }
  });

  afterAll(async () => {
    await _dropAllCollections();
    await mongoose.connection.close();
  });
};

process.on("SIGINT", () => {
  mongoose.connection.close(() => {
    process.exit(0);
  });
});
