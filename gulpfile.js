'use strict';

const { exec } = require('teen_process');
const system = require('appium-support').system;
const gulp = require('gulp');
const boilerplate = require('appium-gulp-plugins').boilerplate.use(gulp);


const ANT_CMD = system.isWindows() ? 'ant.bat' : 'ant';

gulp.task('ant-clean', function clean () {
  return exec(ANT_CMD, ['clean'], {cwd: 'bootstrap'});
});

gulp.task('ant-build', function build () {
  return exec(ANT_CMD, ['build'], {cwd: 'bootstrap'});
});

gulp.task('ant', gulp.series(['ant-clean', 'ant-build']));


boilerplate({
  build: 'appium-android-driver',
  e2eTest: {android: true},
  testTimeout: 40000,
  coverage: {
    files: ['./build/test/unit/**/*-specs.js', '!./build/test/functional/**', '!./build/test/assets'],
    verbose: true,
  },
});
