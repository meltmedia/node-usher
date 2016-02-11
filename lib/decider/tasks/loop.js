/*!
 * Usher
 * Copyright(c) 2015 meltmedia <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    winston = require('winston'),
    async = require('async'),
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
}

util.inherits(Loop, Task);


Loop.prototype.execute = function execute(ctx, done) {

  var executionContexts = [],
      resolvedName = (ctx.namespace) ? ctx.namespace + '-' + this.name : this.name;

  // All the items to loop through using the given fragment
  var input = this.loopFn.call(this, ctx.input(this));

  // The saved state from the previous batch
  var lastState = ctx.lastState(this);

  // Delay between batch executions
  var delayBetweenDecisions = this.options.batchDelay || 1;

  // How many items to process per batch
  var itemsPerDecision = this.options.itemsPerBatch || 20;

  // How many items can be in a scheduled or outstanding state at once
  var maxOutstanding = this.options.maxOutstanding || 10000;

  // The previousy processed and next stopping point for this batch execution
  var batch = (lastState) ? lastState.batch : 0,
      currentIndex = (lastState) ? lastState.currentIndex : 0,
      previouslyOutstanding = (lastState) ? lastState.totalOutstanding : 0,
      headroom = Math.max(maxOutstanding - previouslyOutstanding, 0),
      stopIndex = currentIndex + Math.min(itemsPerDecision, headroom),
      scheduleNextBatch = true,
      totalOutstanding = 0;


  // If it's not time to run another batch we still want to run through all previously
  // scheduled iterations
  if (!ctx.resumeExecution(this, batch)) {
    stopIndex = currentIndex;
    scheduleNextBatch = false;
  }


  // Loop through each item, handling only the ones that have been run in previous batches,
  // or this current batch.
  var inputRange = input.slice(0, stopIndex+1),
      index = 0;

  async.eachSeries(inputRange, function (item, next) {

    var execution = new WorkflowExecution(this.fragment.tasks()),
        context = new Context(ctx.decisionTask, resolvedName + '-' + index, ctx.localVariables);

    context.setWorkflowInput(item);

    executionContexts.push(context);

    execution.execute(context, function () {
      index++;

      if (!context.done()) {
        totalOutstanding++;
      }

      next();
    });

  }.bind(this), function () {

    // If we still have items to process in future batches we save our current position
    // and set a timer to call us back for the next batch.
    if (input.length > stopIndex) {
      if (scheduleNextBatch) {
        ctx.deferExecution(this, ++batch, delayBetweenDecisions);
        ctx.saveState(this, { currentIndex: stopIndex, batch: batch, totalOutstanding: totalOutstanding });
      }
      winston.log('debug', 'Of the %s items for loop: %s, %s have been proccessed so far',
        input.length, this.name, stopIndex);
      return done(STATUS.mask('outstanding'));
    }

    winston.log('debug', 'All %s items for loop: %s, have been scheduled', input.length, this.name);

    // Once here, all items have been executed so we can look to see if they all have completed
    var finished = _.every(executionContexts, function (c) {
      return c.done();
    });

    var success = _.every(executionContexts, function (c) {
      return c.success();
    });

    if (finished) {
      ctx.addResult(this, _.map(executionContexts, function (c) { return c.results; }));

      if (success) {
        return done(STATUS.mask('complete', 'resolved'));
      } else {
        return done(STATUS.mask('failed'));
      }
    } else {
      var status = _.map(executionContexts, function (c) { return c.currentStatus(); });
      winston.log('debug', 'All items for loop: %s have been scheduled, waiting for completion of each item.', this.name);
      return done(STATUS.mask('outstanding'));
    }

  }.bind(this));

};
