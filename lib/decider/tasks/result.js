/*!
 * Usher
 * Copyright(c) 2016 meltmedia <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    _ = require('lodash'),
    Task = require('./task'),
    STATUS = require('./status');


module.exports = Result;


function Result(name, deps, transformFn) {
  if (!(this instanceof Result)) {
    return new Result(name, deps, transformFn);
  }

  Task.apply(this, Array.prototype.slice.call(arguments));

  this.transformFn = transformFn;
}

util.inherits(Result, Task);


Result.prototype.execute = function execute(context, done) {
  var input = context.input(this);

  // Make our decision
  if (_.isFunction(this.transformFn)) {
    // Override the global context results with our transformed value
    var result = this.transformFn.call(this, input, context);
    context.results = result;

    return done(STATUS.mask('complete', 'resolved'));
  } else {
    return done(STATUS.mask('failed'));
  }
};
