/*!
 * Usher
 * Copyright(c) 2014 Mike Moulton <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    _ = require('lodash'),
    Task = require('./task');


module.exports = Transform;


function Transform(name, deps, options, transformFn) {
  if (!(this instanceof Transform)) {
    return new Transform(name, deps, options, transformFn);
  }

  Task.apply(this, Array.prototype.slice.call(arguments));

  this.transformFn = transformFn;
}

util.inherits(Transform, Task);


Transform.prototype.execute = function execute(context) {
  var self = this;

  // Check to see if we are ready to execute
  if (!this.isResolved(context)) {
    context.pending(this);
    return;
  }

  var input = this.input(context);

  // Make our decision
  if (_.isFunction(this.transformFn)) {
    var result = this.transformFn.call(self, input);
    context.complete(this, result);
    context.resolve(this);
  } else {
    context.failed(this);
  }
};
