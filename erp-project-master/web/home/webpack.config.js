require("@babel/polyfill");
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");

const MODULE_PREFIX = `${__dirname.substring(__dirname.lastIndexOf("/"), __dirname.length)}/`;

const config = {
  entry: ["@babel/polyfill", "./index.js"],

  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react"],
            plugins: ["@babel/plugin-transform-runtime"],
          },
        },
      },
    ],
  },

  resolve: {
    extensions: ["*", ".js", ".jsx"],
  },

  output: {
    path: path.resolve(__dirname, "./static/"),
    publicPath: MODULE_PREFIX,
    filename: "app.bundle.js",
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: "./templates/indexHtml.ebs",
      prefix: MODULE_PREFIX,
    }),
  ],
};

module.exports = (env, argv) => {
  if (argv.mode === "production") {
    return {
      ...config,

      mode: "production",

      optimization: {
        minimize: true,
        minimizer: [new TerserPlugin()],
        concatenateModules: false,
        providedExports: false,
        usedExports: false,
      },
    };
  }

  return {
    ...config,

    mode: "development",
    devtool: "source-map",

    optimization: {
      minimize: false,
      minimizer: [new TerserPlugin()],
      concatenateModules: false,
      providedExports: false,
      usedExports: false,
    },

    devServer: {
      contentBase: "./static",
      hot: true,
    },
  };
};
