var gulp = require('gulp'),
    jshint = require('gulp-jshint'),
    jsdoc = require('gulp-jsdoc'),
    mocha = require('gulp-mocha');

gulp.task('lint', function () {
  return gulp.src('lib/**/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('test2', function () {
  return gulp.src(['test/setup.js', 'test/loop.js', '!test/fixtures/**/*.js'])
    .pipe(mocha({ reporter: 'spec' }));
});

gulp.task('test', function () {
  return gulp.src(['test/**/*.js', '!test/fixtures/**/*.js'])
    .pipe(mocha({ reporter: 'spec' }));
});

gulp.task('docs', function () {
  return gulp.src(['./lib/**/*.js', './docs/README.md'])
    .pipe(jsdoc.parser())
    .pipe(jsdoc.generator('./docs', {
      path: 'ink-docstrap',
      systemName: 'Usher',
      copyright: 'Copyright (C) 2014 meltmedia',
      navType: 'vertical',
      theme: 'simplex',
      linenums: true,
      collapseSymbols: false,
      inverseNav: false
    }));
});

gulp.task('default', ['lint', 'test']);
