/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    _ = require('lodash'),
    Task = require('./task'),
    STATUS = require('./status');


module.exports = Transform;


function Transform(name, deps, transformFn) {
  if (!(this instanceof Transform)) {
    return new Transform(name, deps, transformFn);
  }

  Task.apply(this, Array.prototype.slice.call(arguments));

  this.transformFn = transformFn;
}

util.inherits(Transform, Task);


Transform.prototype.execute = function execute(context, done) {
  var input = context.input(this);

  // Make our decision
  if (_.isFunction(this.transformFn)) {
    var result = this.transformFn.call(this, input);
    context.addResult(this, result);
    return done(STATUS.mask('complete', 'resolved'));
  } else {
    return done(STATUS.mask('failed'));
  }
};
