/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    _ = require('lodash'),
    Task = require('./task');


module.exports = Decision;


function Decision(name, deps, options, decisionFn) {
  if (!(this instanceof Decision)) {
    return new Decision(name, deps, options, decisionFn);
  }

  Task.apply(this, Array.prototype.slice.call(arguments));

  this.decisionFn = decisionFn || function () { return true; };
}

util.inherits(Decision, Task);


Decision.prototype.execute = function execute(context) {
  // Check to see if we are ready to execute
  if (!this.isResolved(context)) {
    context.pending(this);
    return;
  }

  var input = this.input(context);

  // Make our decision
  if (_.isFunction(this.decisionFn)) {
    var resolved = this.decisionFn.call(this, input);
    context.complete(this, resolved);
    if (resolved) {
      context.resolve(this);
    }
  }
};
