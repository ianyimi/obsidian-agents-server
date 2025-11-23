module.exports = {
	"branches": [
		"master"
	],
	"plugins": [
		[
			"@semantic-release/commit-analyzer",
			{
				releaseRules: [
					{ type: 'feat', release: 'patch' },      // new features = 0.0.x
					{ type: 'majorFeat', release: 'minor' }, // new features = 0.0.x
					{ type: 'fix', release: 'patch' },       // bug fixes = 0.0.x
					{ type: 'perf', release: 'patch' },      // performance = 0.0.x
					{ type: 'docs', release: false },        // no release
					{ type: 'style', release: false },       // no release
					{ type: 'refactor', release: 'patch' },  // refactors = 0.0.x
					{ type: 'test', release: false },        // no release
					{ type: 'chore', release: false },       // no release
					{ breaking: true, release: 'major' }     // breaking = x.0.0
				]
			}
		],
		"@semantic-release/release-notes-generator",
		"@semantic-release/changelog",
		[
			"@semantic-release/github",
			{
				assets: ["main.js", "manifest.json", "main.css"]
			}
		],
		[
			"@semantic-release/git",
			{
				"assets": [
					"package.json",
					"CHANGELOG.md"
				],
				"message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
			}
		]
	]
}

