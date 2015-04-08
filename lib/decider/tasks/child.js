/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

/* jshint camelcase:false */

'use strict';

var util = require('util'),
    Task = require('./task'),
    STATUS = require('./status');


module.exports = ChildWorkflow;


function ChildWorkflow(name, deps, workflowName, workflowVersion, options) {
  if (!(this instanceof ChildWorkflow)) {
    return new ChildWorkflow(name, deps, workflowName, workflowVersion, options);
  }

  Task.apply(this, Array.prototype.slice.call(arguments));

  this.workflowName = workflowName;
  this.workflowVersion = workflowVersion;
  this.options = options || {};
}

util.inherits(ChildWorkflow, Task);


ChildWorkflow.prototype.execute = function execute(context, done) {
  // Check to see if we ran and failed
  if (context.didChildWorkflowFail(this)) {
    return done(STATUS.mask('failed'));
  }

  // Check to see if we ran and completed
  if (context.didChildWorkflowComplete(this)) {
    context.addChildWorkflowResult(this);
    return done(STATUS.mask('complete', 'resolved'));
  }

  // If we have been scheduled, and are not failed or completed, we must still be outstanding
  if (context.isChildWorkflowOutstanding(this)) {
    return done(STATUS.mask('outstanding'));
  }

  context.scheduleChildWorkflow(this);
  return done(STATUS.mask('scheduled'));
};
