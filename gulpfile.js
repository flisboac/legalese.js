var gulp = require('gulp');
var mocha = require('gulp-mocha');
var gutil = require('gulp-util');

var sourceHeader = 
"/*\n" +
" * This file is part of legalese.js 0.1.0." +
" *\n" +
" * Copyright (c) 2014 Flávio Lisbôa\n" +
" *\n" +
" * This software may be modified and distributed under the terms\n" +
" * of the MIT license.  See the LICENSE file for details.\n" +
" */\n";


gulp.task('compile', function () {
  console.log('TODO.');
});


gulp.task('test', function () {
  return gulp.src(
    ['test/**/*.js'],
    { read: false })
  .pipe(
    mocha({
      reporter: 'spec'
    })
  )
  .on('error', gutil.log)
  ;
});


gulp.task('default', ['compile', 'test']);

legal()
  .require(
    function () {},
    "description", 1,
    
    function () {},
    "description", 2,
  )
  .throws(
    SomeClass,
    'number',
    legal.thrown('objtype', 'object', SomeOtherClass),
    
  )