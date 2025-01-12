import path from 'path';
import { fileURLToPath } from 'url';
import CopyPlugin from 'copy-webpack-plugin';
import NodePolyfillPlugin from 'node-polyfill-webpack-plugin';
import webpack from 'webpack';
import crypto from 'crypto-browserify';
import stream from 'stream-browserify';
import buffer from 'buffer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    mode: 'development',
    devtool: 'source-map',
    entry: {
        background: './src/background.js',
        content: './src/content.js',
        overlay: './src/overlay.js',
        contentAnalyzer: './src/contentAnalyzer.js'
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
        clean: true
    },
    resolve: {
        extensions: ['.js'],
        fallback: {
            path: path.resolve('path-browserify'),
            fs: false,
            crypto: path.resolve('node_modules/crypto-browserify'),
            stream: path.resolve('node_modules/stream-browserify'),
            buffer: path.resolve('node_modules/buffer'),
        }
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', {
                                targets: {
                                    chrome: "88"
                                },
                                modules: false
                            }]
                        ]
                    }
                }
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ]
    },
    experiments: {
        topLevelAwait: true
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: 'src/manifest.json', to: 'manifest.json' },
                { from: 'src/assets', to: 'assets' },
                { from: 'src/*.html', to: '[name][ext]' },
                { from: 'src/*.css', to: '[name][ext]' }
            ]
        }),
        new NodePolyfillPlugin(),
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        })
    ]
};