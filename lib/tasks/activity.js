/*!
 * Usher
 * Copyright(c) 2014 Mike Moulton <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    Task = require('./task');


module.exports = Activity;


function Activity(name, deps, options) {
  if (!(this instanceof Activity)) {
    return new Activity(name, deps, options);
  }

  Task.apply(this, Array.prototype.slice.call(arguments));
}

util.inherits(Activity, Task);


Activity.prototype.readyToSchedule = function readyToSchedule(context) {
  var workflowEvents = context.eventList();

  if (!this.isResolved(context)) {
    context.pending(this);
    return false;
  }

  // Check to see if we ran and failed
  if (workflowEvents.failed(this.name)) {
    context.failed(this);
    return false;
  }

  // Check to see if we ran and completed
  if (workflowEvents.completed(this.name)) {
    // Mark this activity as resolved for future dependents
    context.complete(this, workflowEvents.results(this.name));
    context.resolve(this);
    return false;
  }

  // If we have been scheduled, and are not failed or completed, we must still be outstanding
  if (workflowEvents.scheduled(this.name)) {
    context.outstanding(this);
    return false;
  }

  // We are ready to be scheduled
  return true;
};


Activity.prototype.execute = function execute(context) {
  // Check to see if we are ready to execute
  if (!this.readyToSchedule(context)) {
    return;
  }

  context.schedule(this);
};
