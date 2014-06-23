/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    _ = require('lodash'),
    Task = require('./task'),
    STATUS = require('./status');


module.exports = Decision;


function Decision(name, deps, decisionFn) {
  if (!(this instanceof Decision)) {
    return new Decision(name, deps, decisionFn);
  }

  Task.apply(this, Array.prototype.slice.call(arguments));

  this.decisionFn = decisionFn || function () { return true; };
}

util.inherits(Decision, Task);


Decision.prototype.execute = function execute(context) {
  var input = context.input(this);

  // Make our decision
  if (_.isFunction(this.decisionFn)) {
    var resolved = this.decisionFn.call(this, input);
    context.addResult(this, resolved);
    if (resolved) {
      return STATUS.mask('complete', 'resolved');
    } else {
      return STATUS.mask('complete');
    }
  } else {
    return STATUS.mask('complete');
  }
};
