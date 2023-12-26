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
 *   createConfig('build/services/cron/handlers', 'bundles/cron/handlers', __dirname, 'build'),
 *   createConfig('build/services/api/handlers', 'bundles/api/handlers', __dirname, 'build'),
 * ];
 *
 * And they will be bundled into:
 *    /bundles/cron/handlers
 *    /bundles/api/handlers
 *
 * @param inputPath
 *  The input pathname (relative to project root) containing lambda handlers source code
 * @param outputPath
 *  The output pathname (relative to project root)
 * @param srcDirname
 *  The dirname of the project (usually __dirname)
 * @param srcAliasOutput
 *  The output alias that is mapped from srcAlias.
 *  e.g. Defining "build" will replace all import paths with srcAlias with "build"
 * @param srcAlias
 *  The alias to replace as srcAliasOutput. Default to "src".
 */
export const createConfig = (
  inputPath: string,
  outputPath: string,
  srcDirname: string,
  srcAliasOutput: string,
  srcAlias: string = 'src'
  // eslint-disable-next-line max-params
): Configuration => ({
  mode: 'development',
  target: 'node',
  entry: mapEntry(inputPath),
  output: {
    path: path.join(process.cwd(), outputPath),
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
      [srcAlias]: path.resolve(srcDirname, srcAliasOutput),
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
    test: /chrome-aws-lambda\/bin\/(.+)\.br$/,
    use: [
      {
        loader: 'file-loader',
        options: { name: '/node_modules/chrome-aws-lambda/bin/[name].[ext]' },
      },
    ],
  },
  // Fix webpack 5 "Unexpected token" error for *.js.map files, since chrome-aws-lambda 7.0
  {
    test: /chrome-aws-lambda\/build\/(.+)\.js\.map$/,
    use: [
      {
        loader: 'file-loader',
        options: { name: '/node_modules/chrome-aws-lambda/build/[name].[ext]' },
      },
    ],
  },
]