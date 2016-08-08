/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

/* jshint camelcase:false */

'use strict';

var util = require('util'),
    _ = require('lodash'),
    Task = require('./task'),
    STATUS = require('./status');


module.exports = ChildWorkflow;


function ChildWorkflow(name, deps, workflowName, workflowVersion, options) {
  if (!(this instanceof ChildWorkflow)) {
    return new ChildWorkflow(name, deps, workflowName, workflowVersion, options);
  }

  Task.apply(this, Array.prototype.slice.call(arguments));

  // Workflow name / version are optional as they can be set via `options.workflowType`
  if (_.isObject(workflowName) && _.has(workflowName, 'workflowType')) {
    this.workflowName = null;
    this.workflowVersion = null;
    this.options = workflowName;
  } else {
    this.workflowName = workflowName;
    this.workflowVersion = workflowVersion;
    this.options = options || {};
  }
}

util.inherits(ChildWorkflow, Task);


ChildWorkflow.prototype.execute = function execute(context, done) {
  // Check to see if we ran and failed
  if (context.didChildWorkflowFail(this)) {
    // Ignore the child failure and let our workflow continue
    if (this.options.ignoreFailures) {
      return done(STATUS.mask('complete', 'resolved'));
    }

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
