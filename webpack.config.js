const path = require('path');

module.exports = {
    entry: {
        "photogrammetric-camera": [path.resolve(__dirname, 'src/main.js')],
        "controls": [path.resolve(__dirname, 'src/controls.js')]
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
