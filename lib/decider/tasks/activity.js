/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    Task = require('./task'),
    STATUS = require('./status');


module.exports = Activity;


function Activity(name, deps, options) {
  if (!(this instanceof Activity)) {
    return new Activity(name, deps, options);
  }

  Task.apply(this, Array.prototype.slice.call(arguments));

  this.options = options || {};
}

util.inherits(Activity, Task);


Activity.prototype.execute = function execute(context) {
  // Check to see if we ran and failed
  if (context.didActivityFail(this)) {
    return STATUS.mask('failed');
  }

  // Check to see if we ran and completed
  if (context.didActivityComplete(this)) {
    context.addActivityResult(this);
    return STATUS.mask('complete', 'resolved');
  }

  // If we have been scheduled, and are not failed or completed, we must still be outstanding
  if (context.isActivityOutstanding(this)) {
    return STATUS.mask('outstanding');
  }

  context.scheduleActivity(this);
  return STATUS.mask('scheduled');
};
