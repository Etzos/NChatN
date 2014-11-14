var NwBuilder = require('node-webkit-builder');
var gulp = require('gulp');
var gutil = require('gulp-util');

gulp.task('nw', function () {

    var nw = new NwBuilder({
        version: '0.10.5',
        files: [ './**', '!./cache/**', '!./build/**', '!./bin/**', '!./node_modules/gulp/**',
            '!./node_modules/gulp_util/**', '!./node_modules/node-webkit-builder/**'
        ],
        platforms: ['win', 'linux32', 'linux64']
    });

    // Log stuff you want
    nw.on('log', function (msg) {
        gutil.log('node-webkit-builder', msg);
    });

    // Build returns a promise, return it so the task isn't called in parallel
    return nw.build().catch(function (err) {
        gutil.log('node-webkit-builder', err);
    });
});