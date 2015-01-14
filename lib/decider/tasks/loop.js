/*!
 * Usher
 * Copyright(c) 2015 meltmedia <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    _ = require('lodash'),
    WorkflowExecution = require('../execution'),
    Context = require('../context'),
    Task = require('./task'),
    STATUS = require('./status');


module.exports = Loop;

/**
* The loop executes in batches to help alleviate rate limit exceptions
* The number of items to proccess per batch and the delay between batches are both
* configurable
* @constructor
*/
function Loop(name, deps, fragment, loopFn, options) {
  if (!(this instanceof Loop)) {
    return new Loop(name, deps, fragment, loopFn, options);
  }

  Task.apply(this, Array.prototype.slice.call(arguments));

  this.fragment = fragment;

  this.loopFn = (_.isFunction(loopFn)) ? loopFn : function (input) { return [input]; };
  this.options = options || {};

  this.executionContexts = [];
}

util.inherits(Loop, Task);


Loop.prototype.execute = function execute(ctx) {

  // All the items to loop through using the given fragment
  var input = this.loopFn.call(this, ctx.input(this));

  // The saved state from the previous batch
  var lastState = ctx.lastState(this);

  // Delay between batch executions
  var delayBetweenDecisions = this.options.batchDelay || 1;

  // How many items to process per batch
  var itemsPerDecision = this.options.itemsPerBatch || 20;

  // The previousy processed and next stopping point for this batch execution
  var batch = (lastState) ? lastState.batch : 0,
      currentIndex = (lastState) ? lastState.currentIndex : 0,
      stopIndex = currentIndex + itemsPerDecision,
      scheduleNextBatch = true;


  // If it's not time to run another batch we still want to run through all previously
  // scheduled iterations
  if (!ctx.resumeExecution(this, batch)) {
    stopIndex = currentIndex;
    scheduleNextBatch = false;
  }


  // Loop through each item, handling only the ones that have been run in previous batches,
  // or this current batch.
  _.each(input, function (data, i) {

    if (i >= stopIndex) {
      return;
    }

    var execution = new WorkflowExecution(this.fragment.tasks()),
    context = new Context(ctx.decisionTask, this.name + '-' + i);

    context.setWorkflowInput(data);
    execution.execute(context);

    this.executionContexts[i] = context;

  }.bind(this));


  // If we still have items to process in future batches we save our current position
  // and set a timer to call us back for the next batch.
  if (input.length > stopIndex) {
    if (scheduleNextBatch) {
      ctx.deferExecution(this, ++batch, delayBetweenDecisions);
      ctx.saveState(this, { currentIndex: stopIndex, batch: batch });
    }
    return STATUS.mask('outstanding');
  }


  // Once here, all items have been executed so we can look to see if they all have completed
  var done = _.every(this.executionContexts, function (c) {
    return c.done();
  });

  var success = _.every(this.executionContexts, function (c) {
    return c.success();
  });

  if (done) {
    ctx.addResult(this, _.map(this.executionContexts, function (c) { return c.results; }));

    if (success) {
      return STATUS.mask('complete', 'resolved');
    } else {
      return STATUS.mask('failed');
    }
  } else {
    return STATUS.mask('outstanding');
  }

};
