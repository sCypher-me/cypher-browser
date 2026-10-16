const webpackConfig = require(__dirname + '/webpack.config');

module.exports = (env, argv) =>
	webpackConfig(env, argv, {
		mv: 2,
		distribution: 'distribution-cypher',
	});
