/*!
 * Usher
 * Copyright(c) 2014 Mike Moulton <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    Task = require('./task');


module.exports = Terminate;


function Terminate(name, deps, options) {
  if (!(this instanceof Terminate)) {
    return new Terminate(name, deps, options);
  }

  Task.apply(this, Array.prototype.slice.call(arguments));
}

util.inherits(Terminate, Task);


Terminate.prototype.execute = function execute(context) {
  // Check to see if we are ready to execute
  if (!this.isResolved(context)) {
    context.pending(this);
    return;
  }

  // Make our decision
  context.terminate(this);
};
