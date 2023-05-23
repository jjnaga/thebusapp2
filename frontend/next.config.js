const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^pg-native$/ }));

    return config;
  },
};

module.exports = nextConfig;
