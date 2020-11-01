const path = require('path');

module.exports = {
    entry: {
        "photogrammetric-camera": [path.resolve(__dirname, 'src/main.js')],
        "three-additional": [path.resolve(__dirname, 'src/three-additional.js')]
    },
    devtool: 'source-map',
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: '[name].js',
        library: 'photogrammetricCamera',
        libraryTarget: 'umd'
    },
  devServer: {
    publicPath: '/dist/'
  },
};
