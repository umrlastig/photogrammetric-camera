const path = require('path');

module.exports = {
    entry: {
        "three": [path.resolve(__dirname, 'src/three.js')],
        "photogrammetric-camera": [path.resolve(__dirname, 'src/main.js')],
        "three_additional": [path.resolve(__dirname, 'src/three-additional.js')]
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
