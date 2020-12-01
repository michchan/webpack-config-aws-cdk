import fs = require('fs')
import path = require('path')
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'
import { Configuration, RuleSetRule } from 'webpack'

const DEFAULT_ANALYZER_PORT = 8888

export const createBundleAnalyzerPlugin = (
  reportTitle: string,
  analyzerPort: number = DEFAULT_ANALYZER_PORT,
  reportFilename: string = 'bundler_report.html'
): BundleAnalyzerPlugin => new BundleAnalyzerPlugin({
  // Avoid CI crash issue
  analyzerMode: 'static',
  openAnalyzer: false,
  reportTitle,
  reportFilename,
  analyzerPort,
})

const mapEntry = (handlersPath: string): Configuration['entry'] => {
  const dirs = fs.readdirSync(handlersPath)
  // Get names of js files
  const names = dirs.filter(dir => {
    const isSubDir = !/(\.js|\.ts)$/.test(dir)
    if (isSubDir) {
      const subDir = fs.readdirSync(`${handlersPath}/${dir}`)
      // See if there is an index file for this sub directory
      return subDir.filter(n => /^index.js$/.test(n))
    }
    return /\.js$/.test(dir)
  })
  // Map entry object
  return names.reduce((obj: { [key: string]: string }, name) => {
    // Remove .js file extension
    const key = name.replace(/\.js$/, '')
    // Append 'index.js' if it is a directory
    const filePath = /\.js$/.test(name) ? name : `${name}/index.js`

    return {
      ...obj,
      [key]: `./${handlersPath}/${filePath}`,
    }
  }, {})
}

/**
 * Example usage:
 *
 * Module.exports = [
 *   createConfig('build/services/cron/handlers'),
 *   createConfig('build/services/api/handlers'),
 * ];
 *
 * And they will be bundled into:
 *    /bundles/cron/handlers
 *    /bundles/api/handlers
 */
export const createConfig = (
  handlersPath: string,
  srcDirname: string,
  srcDirnameAlias: string = 'src',
): Configuration => ({
  mode: 'development',
  target: 'node',
  entry: mapEntry(handlersPath),
  output: {
    path: `${process.cwd()}/${
      handlersPath
      // Replace '/build' with '/bundles' pathname
        .replace(/build/i, 'bundles')
      // Remove "/services"
        .replace(/\/services/i, '')
    }`,
    // Keep the bundle name same as the orignal function name
    filename: '[name].js',
    libraryTarget: 'umd',
  },
  node: {
    // Make sure that __dirname works in node env
    __dirname: true,
  },
  resolve: {
    alias: {
      [srcDirnameAlias]: path.resolve(srcDirname, 'build'),
    },
  },
  externals: {
    // * Do NOT bundle 'aws-sdk' since it is included in the AWS Lambda NodeJS runtime
    'aws-sdk': 'aws-sdk',
  },
})

export const chromeAWSLambdaRules: RuleSetRule[] = [
  /**
   * Use file loader to move chromnium .br files into /bin~
   * @link https://github.com/alixaxel/chrome-aws-lambda/issues/80
   *
   * This is for correctly bundling the chromnium instance required by 'chrome-aws-lambda',
   * from the helper 'launchPuppeteerBrowserSession' of 'simply-utils'.
   */
  {
    test: /chrome\-aws\-lambda\/bin\/(.+)\.br$/,
    use: [{ loader: 'file-loader', options: { name: '/node_modules/chrome-aws-lambda/bin/[name].[ext]' } }],
  },
]