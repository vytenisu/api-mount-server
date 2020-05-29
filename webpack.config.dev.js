const webpack = require('webpack')
const LicenseWebpackPlugin = require('license-webpack-plugin')
  .LicenseWebpackPlugin
const nodeExternals = require('webpack-node-externals')

const exportedConfig = {
  entry: __dirname + '/index.ts',
  devtool: 'inline-source-map',
  plugins: [new LicenseWebpackPlugin()],
  mode: 'development',
  target: 'node',
  externals: [nodeExternals()],
  resolve: {
    extensions: ['.webpack.js', '.web.js', '.ts', '.js'],
  },
  output: {
    path: __dirname + '/dist',
    filename: 'index.js',
    sourceMapFilename: 'index.js.map',
    libraryTarget: 'umd',
  },
  resolveLoader: {
    modules: [__dirname + '/node_modules'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: __dirname + '/tsconfig.json',
            },
          },
        ],
      },
    ],
  },
}

module.exports = exportedConfig
