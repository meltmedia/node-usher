/*!
 * Usher
 * Copyright(c) 2015 meltmedia <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    winston = require('winston'),
    _ = require('lodash'),
    WorkflowExecution = require('../execution'),
    Context = require('../context'),
    Task = require('./task'),
    STATUS = require('./status');


module.exports = WhileLoop;

/**
 * The loop executes the `fragment` until the `doneFn` returns a truthy value
 *
 * @constructor
 */
function WhileLoop(name, deps, fragment, doneFn, options) {
  if (!(this instanceof WhileLoop)) {
    return new WhileLoop(name, deps, fragment, doneFn, options);
  }

  Task.apply(this, Array.prototype.slice.call(arguments));

  this.fragment = fragment;

  if (!_.isFunction(doneFn)) {
    throw new Error('You must provide a function to indicate when the loop is complete');
  }

  this.doneFn = doneFn;
  this.options = options || {};

  this.executionContexts = [];
}

util.inherits(WhileLoop, Task);


WhileLoop.prototype.execute = function execute(ctx) {

  var input = ctx.input(this),
      lastState = ctx.lastState(this),
      currentIndex = (lastState) ? lastState.currentIndex : 0;

  // Build the execution context for the current iteration
  // Depending on the index, this could be the first of our iterations, or
  // picking back up a previously run iteration
  var currentExecution = new WorkflowExecution(this.fragment.tasks()),
      currentContext = new Context(ctx.decisionTask, this.name + '-' + currentIndex);

  // Execute the current context.
  // If this is has already been done before, this will drive our state forward.
  currentContext.setWorkflowInput(input);
  currentExecution.execute(currentContext);

  // If our iteration failed, we mark ourselves as failed
  if (currentContext.failed()) {
    return STATUS.mask('failed');
  }

  // Else if current execution has finished running, check to see if it resolves our 'done' state
  if (currentContext.done()) {

    // We are done, we can mark our task resolved
    if (this.doneFn.call(this, currentContext.results)) {
      return STATUS.mask('complete', 'resolved');
    }

    // The last execution did not meet our 'done' criteria so we need to start
    // a new execution iteration
    currentIndex++;

    var nextExecution = new WorkflowExecution(this.fragment.tasks()),
        nextContext = new Context(ctx.decisionTask, this.name + '-' + currentIndex);

    // Execute the current context.
    // If this is has already been done before, this will drive our state forward.
    nextContext.setWorkflowInput(input);
    nextExecution.execute(nextContext);

  }

  ctx.saveState(this, { currentIndex: currentIndex });
  return STATUS.mask('outstanding');

};
