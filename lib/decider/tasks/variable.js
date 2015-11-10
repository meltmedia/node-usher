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
      value = this.valueFn.call(this, input, context),
      currentVariables = context.getVariables();

  // Only record variable if the new value does not equal the currently recorded value
  // This saves a lot of event namespace
  if (!currentVariables[this.name] || currentVariables[this.name] !== value) {
    context.setVariable(this.name, value);
  }

  return done(STATUS.mask('complete', 'resolved'));
};
