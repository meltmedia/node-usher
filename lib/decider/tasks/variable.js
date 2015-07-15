/*!
 * Usher
 * Copyright(c) 2015 meltmedia <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    Task = require('./task'),
    STATUS = require('./status');


module.exports = Variable;


function Variable(name, deps, valueFn) {
  if (!(this instanceof Variable)) {
    return new Variable(name, deps);
  }

  this.valueFn = valueFn;

  Task.apply(this, Array.prototype.slice.call(arguments));
}

util.inherits(Variable, Task);


Variable.prototype.execute = function execute(context, done) {

  var input = context.input(this),
      value = this.valueFn.call(this, input, context);

  context.setVariable(this.name, value);

  return done(STATUS.mask('complete', 'resolved'));
};
