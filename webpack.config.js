const path = require('path');

module.exports = {
    entry: {
        "photogrammetric-camera": [path.resolve(__dirname, 'src/main.js')]
    },
    devtool: 'source-map',
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: '[name].js',
        library: 'PhotogrammetricCamera',
        libraryTarget: 'umd'
    },
    module: {
        rules: [
            {
                test: /\.glsl$/,
                loader: 'webpack-glsl-loader'
            }
        ]
    },
  devServer: {
    publicPath: '/dist/'
  },
};
