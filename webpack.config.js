const path = require('path');

module.exports = {
    mode: 'development',
    entry: {
        "photogrammetric-camera": [path.resolve(__dirname, 'src/main.js')],
    },
    devtool: 'source-map',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        library: 'photogrammetricCamera',
        libraryTarget: 'umd'
    },
    devServer: {
        devMiddleware: {
            publicPath: '/dist/',
        },
        static: {
            directory: path.resolve(__dirname, './examples')
        },
    },
};
