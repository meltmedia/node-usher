/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    Task = require('./task'),
    STATUS = require('./status');


module.exports = Terminate;


function Terminate(name, deps) {
  if (!(this instanceof Terminate)) {
    return new Terminate(name, deps);
  }

  Task.apply(this, Array.prototype.slice.call(arguments));
}

util.inherits(Terminate, Task);


Terminate.prototype.execute = function execute(context) {
  return STATUS.mask('terminate');
};
